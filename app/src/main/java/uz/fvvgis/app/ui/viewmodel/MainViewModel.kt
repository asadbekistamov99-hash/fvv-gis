package uz.fvvgis.app.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.core.NetworkMonitor
import uz.fvvgis.app.data.local.*
import uz.fvvgis.app.data.model.GisRegistryItem
import uz.fvvgis.app.data.model.toGisRegistryItem
import uz.fvvgis.app.data.preferences.AppPreferences
import uz.fvvgis.app.data.preferences.UserPreferences
import uz.fvvgis.app.data.repository.EmergencySubmissionResult
import uz.fvvgis.app.data.repository.FvvRepository
import uz.fvvgis.app.data.repository.OtpChallenge

data class MainUiState(
    val initializing: Boolean = true,
    val locale: AppLocale = AppLocale.UZ,
    val darkTheme: Boolean = true,
    val account: UserAccountEntity? = null,
    val offlineMode: Boolean = false,
    val isNetworkConnected: Boolean = true,
    val leaseExpiresAtMs: Long = 0L,
    val lastSyncAtMs: Long = 0L,
    val currentTimeMs: Long = System.currentTimeMillis(),
    val syncing: Boolean = false,
    val message: String? = null,
    val authChallenge: OtpChallenge? = null,
    val authBusy: Boolean = false,
    val authError: String? = null
) {
    val isEffectiveOffline: Boolean get() = offlineMode || !isNetworkConnected
    val isEmployee: Boolean get() = account?.isEmployee == true
    val isLeaseValid: Boolean get() = isEmployee && leaseExpiresAtMs > currentTimeMs
    val leaseRemainingMinutes: Int
        get() = if (!isLeaseValid) 0 else ((leaseExpiresAtMs - currentTimeMs) / 60_000L).toInt().coerceAtLeast(1)
}

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val db = AppDatabase.getInstance(application)
    private val prefs = UserPreferences(application)
    private val networkMonitor = NetworkMonitor(application)
    private val syncMutex = Mutex()
    val repo = FvvRepository(db, prefs)

    private val _ephemeral = MutableStateFlow(EphemeralState())
    private val _tickerMs = MutableStateFlow(System.currentTimeMillis())

    val regions: StateFlow<List<RegionEntity>> = repo.regions.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )
    val categories: StateFlow<List<CategoryEntity>> = repo.categories.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )
    val allObjects: StateFlow<List<InfrastructureObjectEntity>> = repo.allInfrastructure.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )
    val publicObjects: StateFlow<List<InfrastructureObjectEntity>> = repo.publicInfrastructure.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )
    val approvedRoutes: StateFlow<List<ApprovedRouteEntity>> = repo.approvedRoutes.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )
    val syncQueue: StateFlow<List<SyncOperationEntity>> = repo.syncQueue.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )
    val notifications: StateFlow<List<NotificationEntity>> = repo.notifications.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    private val activeAccountFlow: Flow<UserAccountEntity?> = repo.preferences
        .map { it.activeAccountId }
        .distinctUntilChanged()
        .flatMapLatest { id -> repo.observeAccount(id) }

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val myReports: StateFlow<List<CitizenReportEntity>> = repo.preferences
        .map { it.activeAccountId }
        .distinctUntilChanged()
        .flatMapLatest { id -> repo.observeReportsForUser(id) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val uiState: StateFlow<MainUiState> = combine(
        repo.preferences,
        activeAccountFlow,
        _ephemeral,
        _tickerMs,
        networkMonitor.isConnected
    ) { appPrefs, account, ephem, nowMs, netConnected ->
        MainUiState(
            initializing = ephem.initializing,
            locale = AppLocale.fromCode(appPrefs.locale),
            darkTheme = appPrefs.darkTheme,
            account = account,
            offlineMode = appPrefs.offlineMode,
            isNetworkConnected = netConnected,
            leaseExpiresAtMs = appPrefs.leaseExpiresAtMs,
            lastSyncAtMs = appPrefs.lastSyncAtMs,
            currentTimeMs = nowMs,
            syncing = ephem.syncing,
            message = ephem.message,
            authChallenge = ephem.authChallenge,
            authBusy = ephem.authBusy,
            authError = ephem.authError
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), MainUiState())

    val mapRegistryMarkers: StateFlow<List<GisRegistryItem>> = combine(
        uiState,
        allObjects,
        publicObjects,
        regions,
        categories
    ) { state, allObjs, pubObjs, regs, cats ->
        val visible = if (state.isEmployee && state.isLeaseValid) allObjs else pubObjs
        val regionsById = regs.associateBy { it.id }
        val categoriesById = cats.associateBy { it.id }
        visible.mapNotNull { entity ->
            entity.toGisRegistryItem(regionsById, categoriesById, state.locale.code)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        viewModelScope.launch {
            repo.ensureSeeded()
            _ephemeral.update { it.copy(initializing = false) }
        }
        viewModelScope.launch {
            while (true) {
                delay(5000L)
                _tickerMs.value = System.currentTimeMillis()
            }
        }
        // Automatically push offline-queued emergency and citizen reports when network connection is active
        viewModelScope.launch {
            combine(
                uiState.map { Triple(it.initializing, it.isEffectiveOffline, it.isEmployee) }.distinctUntilChanged(),
                syncQueue
            ) { (initializing, effectiveOffline, isEmployee), queue ->
                Triple(initializing, effectiveOffline, queue to isEmployee)
            }.collect { (initializing, effectiveOffline, queueAndRole) ->
                val (queue, isEmployee) = queueAndRole
                if (!initializing && !effectiveOffline) {
                    val hasFlushable = queue.any { op ->
                        op.status == "pending" && (
                            op.entityType == "emergency_incident" ||
                                op.entityType == "citizen_report" ||
                                (isEmployee && op.entityType == "infrastructure")
                            )
                    }
                    if (hasFlushable) {
                        runSyncInternal(clearOfflineFlag = false, isAuto = true)
                    }
                }
            }
        }
    }

    override fun onCleared() {
        networkMonitor.unregister()
        super.onCleared()
    }

    fun clearMessage() {
        _ephemeral.update { it.copy(message = null) }
    }

    fun showMessage(msg: String) {
        _ephemeral.update { it.copy(message = msg) }
    }

    fun setLocale(locale: AppLocale) {
        viewModelScope.launch { repo.setLocale(locale.code) }
    }

    fun setDarkTheme(dark: Boolean) {
        viewModelScope.launch { repo.setDarkTheme(dark) }
    }

    fun setOfflineMode(offline: Boolean) {
        viewModelScope.launch { repo.setOfflineMode(offline) }
    }

    fun renewLease() {
        viewModelScope.launch {
            val acc = uiState.value.account
            repo.renewLease(acc)
            _tickerMs.value = System.currentTimeMillis()
            showMessage("8 soatlik operativ ruxsat yangilandi.")
        }
    }

    fun expireLeaseForTesting() {
        viewModelScope.launch {
            repo.expireLeaseForTesting()
            _tickerMs.value = System.currentTimeMillis()
        }
    }

    fun requestLoginOtp(phone: String) {
        viewModelScope.launch {
            _ephemeral.update { it.copy(authBusy = true, authError = null) }
            val res = repo.requestLoginOtp(phone)
            res.fold(
                onSuccess = { ch -> _ephemeral.update { it.copy(authBusy = false, authChallenge = ch) } },
                onFailure = { e -> _ephemeral.update { it.copy(authBusy = false, authError = e.message) } }
            )
        }
    }

    fun requestRegisterOtp(
        phone: String,
        fullName: String,
        isEmployeeApplication: Boolean,
        organizationId: String?,
        regionId: String?,
        department: String?,
        verificationReference: String?
    ) {
        viewModelScope.launch {
            _ephemeral.update { it.copy(authBusy = true, authError = null) }
            val res = repo.requestRegisterOtp(
                phone, fullName, isEmployeeApplication, organizationId, regionId, department, verificationReference
            )
            res.fold(
                onSuccess = { ch -> _ephemeral.update { it.copy(authBusy = false, authChallenge = ch) } },
                onFailure = { e -> _ephemeral.update { it.copy(authBusy = false, authError = e.message) } }
            )
        }
    }

    fun verifyOtp(code: String, onVerified: (UserAccountEntity) -> Unit) {
        val challenge = uiState.value.authChallenge ?: return
        viewModelScope.launch {
            _ephemeral.update { it.copy(authBusy = true, authError = null) }
            val res = repo.verifyOtp(challenge, code)
            res.fold(
                onSuccess = { account ->
                    _tickerMs.value = System.currentTimeMillis()
                    _ephemeral.update { it.copy(authBusy = false, authChallenge = null, authError = null) }
                    onVerified(account)
                },
                onFailure = { e -> _ephemeral.update { it.copy(authBusy = false, authError = e.message) } }
            )
        }
    }

    fun cancelAuthChallenge() {
        _ephemeral.update { it.copy(authChallenge = null, authError = null) }
    }

    fun updateProfileName(newName: String) {
        val acc = uiState.value.account ?: return
        viewModelScope.launch {
            repo.updateProfileName(acc, newName)
            showMessage("Profil yangilandi.")
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            repo.logout()
            onDone()
        }
    }

    fun deleteAccount(onDone: () -> Unit) {
        val acc = uiState.value.account ?: return
        viewModelScope.launch {
            repo.deleteAccount(acc.id)
            onDone()
        }
    }

    fun synchronize() {
        val current = uiState.value
        if (current.syncing) return
        if (!networkMonitor.checkCurrentConnectivity()) {
            showMessage(L10n.text(current.locale, "waitingForNetworkHint"))
            return
        }
        viewModelScope.launch {
            runSyncInternal(clearOfflineFlag = true, isAuto = false)
        }
    }

    private suspend fun runSyncInternal(clearOfflineFlag: Boolean, isAuto: Boolean) {
        syncMutex.withLock {
            val current = uiState.value
            val locale = current.locale
            _ephemeral.update { it.copy(syncing = true) }
            try {
                val res = repo.synchronizeQueue(
                    account = current.account,
                    clearOfflineFlag = clearOfflineFlag
                )
                _tickerMs.value = System.currentTimeMillis()
                val msg = when {
                    isAuto && res.pushedReports > 0 ->
                        "${res.pushedReports} ${L10n.text(locale, "autoSyncCompletedMsg")}"
                    isAuto && res.totalSynced > 0 ->
                        "${L10n.text(locale, "sync")}: ${res.totalSynced}"
                    isAuto -> null
                    else ->
                        "${L10n.text(locale, "sync")}: ${res.totalSynced} · ${L10n.pick(locale, "Konfliktlar", "Конфликты", "Conflicts")}: ${res.conflicts}"
                }
                _ephemeral.update { it.copy(syncing = false, message = msg ?: it.message) }
            } catch (e: Exception) {
                _ephemeral.update { it.copy(syncing = false, message = if (isAuto) it.message else e.message) }
            }
        }
    }

    fun simulateConflict(objectId: String) {
        viewModelScope.launch {
            repo.createSimulatedConflict(objectId)
            showMessage("Sinov konflikti yaratildi (409).")
        }
    }

    fun resolveConflictAcceptServer(operationId: String) {
        viewModelScope.launch {
            repo.resolveConflictAcceptServer(operationId)
            showMessage("Server versiyasi saqlandi.")
        }
    }

    fun resolveConflictRetryLocal(operationId: String) {
        viewModelScope.launch {
            repo.resolveConflictRetryLocal(operationId)
            showMessage("Mahalliy tahrir qayta navbatga qo‘yildi.")
        }
    }

    fun submitObjectForReview(objectId: String) {
        viewModelScope.launch {
            repo.submitObjectForReview(objectId)
            showMessage("Obyekt ko‘rib chiqishga yuborildi.")
        }
    }

    fun reviewObject(objectId: String, approve: Boolean) {
        viewModelScope.launch {
            repo.reviewObject(objectId, approve)
            showMessage(if (approve) "Obyekt nashr etildi." else "Tuzatishga qaytarildi.")
        }
    }

    fun addInspection(
        objectId: String,
        condition: String,
        operationalStatus: String,
        notes: String,
        nextDate: String?
    ) {
        val inspector = uiState.value.account?.fullName ?: "Xodim"
        viewModelScope.launch {
            repo.addInspection(objectId, inspector, condition, operationalStatus, notes, nextDate)
            showMessage("Tekshiruv saqlandi.")
        }
    }

    fun submitCitizenReport(
        category: String,
        description: String,
        regionId: String,
        location: GeoPoint?,
        attachmentCount: Int,
        onDone: (CitizenReportEntity) -> Unit
    ) {
        val current = uiState.value
        val acc = current.account ?: return
        viewModelScope.launch {
            val report = repo.submitCitizenReport(
                userId = acc.id,
                category = category,
                description = description,
                regionId = regionId,
                location = location,
                contactPhone = acc.phone,
                attachmentCount = attachmentCount,
                isOffline = current.isEffectiveOffline
            )
            onDone(report)
        }
    }

    fun submitEmergencyIncident(
        pinLocation: GeoPoint,
        currentUserLocation: GeoPoint?,
        categoryId: String,
        hazardTitle: String,
        notes: String,
        regionId: String,
        onDone: (EmergencySubmissionResult) -> Unit
    ) {
        val current = uiState.value
        val acc = current.account
        viewModelScope.launch {
            val result = repo.submitEmergencyIncident(
                pinLocation = pinLocation,
                currentUserLocation = currentUserLocation,
                categoryId = categoryId,
                hazardTitle = hazardTitle,
                notes = notes,
                regionId = regionId,
                reporterUserId = acc?.id,
                reporterPhone = acc?.phone,
                isOffline = current.isEffectiveOffline
            )
            onDone(result)
        }
    }

    fun requestRoute(objectId: String, origin: GeoPoint, onDone: (Result<ApprovedRouteEntity>) -> Unit) {
        val acc = uiState.value.account ?: return
        viewModelScope.launch {
            val res = repo.requestRoute(objectId, origin, acc.id)
            onDone(res)
        }
    }

    fun approveRoute(routeId: String) {
        val approver = uiState.value.account?.fullName ?: "Rahbar"
        viewModelScope.launch {
            repo.approveRoute(routeId, approver)
            showMessage("Marshrut tasdiqlandi.")
        }
    }

    fun withdrawRoute(routeId: String) {
        viewModelScope.launch {
            repo.withdrawRoute(routeId)
            showMessage("Marshrut bekor qilindi.")
        }
    }

    fun markNotificationRead(id: String) {
        viewModelScope.launch { repo.markNotificationRead(id) }
    }

    fun markAllNotificationsRead() {
        viewModelScope.launch { repo.markAllNotificationsRead() }
    }

    fun observeObject(objectId: String): Flow<InfrastructureObjectEntity?> = repo.observeObject(objectId)
    fun observeInspectionsForObject(objectId: String): Flow<List<InspectionEntity>> = repo.observeInspectionsForObject(objectId)
    fun observeAttachmentsForObject(objectId: String): Flow<List<ObjectAttachmentEntity>> = repo.observeAttachmentsForObject(objectId)

    private data class EphemeralState(
        val initializing: Boolean = true,
        val syncing: Boolean = false,
        val message: String? = null,
        val authChallenge: OtpChallenge? = null,
        val authBusy: Boolean = false,
        val authError: String? = null
    )
}
