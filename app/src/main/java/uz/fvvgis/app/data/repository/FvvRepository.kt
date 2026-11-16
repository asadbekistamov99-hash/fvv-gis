package uz.fvvgis.app.data.repository

import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.GeoUtils
import uz.fvvgis.app.data.local.*
import uz.fvvgis.app.data.preferences.AppPreferences
import uz.fvvgis.app.data.preferences.UserPreferences
import java.text.SimpleDateFormat
import java.util.*

data class OtpChallenge(
    val challengeId: String,
    val phone: String,
    val devOtp: String,
    val isRegister: Boolean,
    val pendingAccount: UserAccountEntity? = null
)

data class EmergencySubmissionResult(
    val code: String,
    val entity: InfrastructureObjectEntity?,
    val queuedOffline: Boolean
)

data class SyncFlushResult(
    val pushedReports: Int,
    val pushedInfrastructure: Int,
    val conflicts: Int
) {
    val totalSynced: Int get() = pushedReports + pushedInfrastructure
}

class FvvRepository(
    private val db: AppDatabase,
    private val prefs: UserPreferences
) {
    private val json = Json { ignoreUnknownKeys = true }

    val preferences: Flow<AppPreferences> = prefs.preferences
    val regions: Flow<List<RegionEntity>> = db.regionDao().observeAll()
    val categories: Flow<List<CategoryEntity>> = db.categoryDao().observeAll()
    val allAccounts: Flow<List<UserAccountEntity>> = db.accountDao().observeAll()
    val allInfrastructure: Flow<List<InfrastructureObjectEntity>> = db.infrastructureDao().observeAll()
    val publicInfrastructure: Flow<List<InfrastructureObjectEntity>> = db.infrastructureDao().observePublic()
    val allInspections: Flow<List<InspectionEntity>> = db.inspectionDao().observeAll()
    val allReports: Flow<List<CitizenReportEntity>> = db.reportDao().observeAll()
    val approvedRoutes: Flow<List<ApprovedRouteEntity>> = db.routeDao().observeAll()
    val syncQueue: Flow<List<SyncOperationEntity>> = db.syncDao().observePendingAndConflicts()
    val notifications: Flow<List<NotificationEntity>> = db.notificationDao().observeAll()

    fun observeAccount(id: String?): Flow<UserAccountEntity?> =
        if (id == null) flowOf(null) else db.accountDao().observeById(id)

    fun observeObject(id: String): Flow<InfrastructureObjectEntity?> =
        db.infrastructureDao().observeById(id)

    fun observeInspectionsForObject(objectId: String): Flow<List<InspectionEntity>> =
        db.inspectionDao().observeForObject(objectId)

    fun observeAttachmentsForObject(objectId: String): Flow<List<ObjectAttachmentEntity>> =
        db.attachmentDao().observeForObject(objectId)

    fun observeReportsForUser(userId: String?): Flow<List<CitizenReportEntity>> =
        if (userId == null) flowOf(emptyList()) else db.reportDao().observeByUser(userId)

    suspend fun ensureSeeded() {
        if (db.regionDao().count() == 0) {
            db.regionDao().insertAll(SeedData.regions)
        }
        if (db.categoryDao().count() == 0) {
            db.categoryDao().insertAll(SeedData.categories)
        }
        if (db.infrastructureDao().count() == 0) {
            db.accountDao().insertAll(SeedData.demoAccounts)
            db.infrastructureDao().insertAll(SeedData.createDemoObjects())
            db.inspectionDao().insertAll(SeedData.createDemoInspections())
            db.reportDao().insertAll(SeedData.createDemoReports())
            db.routeDao().insertAll(SeedData.createDemoRoutes())
            db.notificationDao().insertAll(SeedData.createDemoNotifications())
        }
    }

    suspend fun setLocale(locale: String) = prefs.setLocale(locale)
    suspend fun setDarkTheme(dark: Boolean) = prefs.setDarkTheme(dark)
    suspend fun setOfflineMode(offline: Boolean) = prefs.setOfflineMode(offline)

    suspend fun requestLoginOtp(phone: String): Result<OtpChallenge> {
        val account = db.accountDao().getByPhone(phone.trim())
            ?: return Result.failure(IllegalStateException("Bu telefon raqami ro‘yxatdan o‘tmagan. Demo hisobdan foydalaning yoki ro‘yxatdan o‘ting."))
        return Result.success(
            OtpChallenge(
                challengeId = UUID.randomUUID().toString(),
                phone = account.phone,
                devOtp = "123456",
                isRegister = false,
                pendingAccount = account
            )
        )
    }

    suspend fun requestRegisterOtp(
        phone: String,
        fullName: String,
        isEmployeeApplication: Boolean,
        organizationId: String?,
        regionId: String?,
        department: String?,
        verificationReference: String?
    ): Result<OtpChallenge> {
        val existing = db.accountDao().getByPhone(phone.trim())
        if (existing != null) {
            return Result.failure(IllegalStateException("Bu raqam allaqachon ro‘yxatdan o‘tgan. Kirish bo‘limidan foydalaning."))
        }
        val newAccount = UserAccountEntity(
            id = "acc-${UUID.randomUUID().toString().take(8)}",
            phone = phone.trim(),
            fullName = fullName.trim(),
            role = if (isEmployeeApplication) "pending_employee" else "citizen",
            employeeStatus = if (isEmployeeApplication) "pending_verification" else "none",
            organizationId = organizationId,
            regionId = regionId,
            districtId = regionId?.let { "DEMO-$it" },
            department = department?.trim()?.takeIf { it.isNotEmpty() },
            verificationReference = verificationReference?.trim()?.takeIf { it.isNotEmpty() },
            isSynthetic = true
        )
        return Result.success(
            OtpChallenge(
                challengeId = UUID.randomUUID().toString(),
                phone = newAccount.phone,
                devOtp = "123456",
                isRegister = true,
                pendingAccount = newAccount
            )
        )
    }

    suspend fun verifyOtp(challenge: OtpChallenge, code: String): Result<UserAccountEntity> {
        if (code.trim() != challenge.devOtp) {
            return Result.failure(IllegalArgumentException("Tasdiqlash kodi noto‘g‘ri (demo kod: ${challenge.devOtp})."))
        }
        val account = challenge.pendingAccount
            ?: return Result.failure(IllegalStateException("Hisob topilmadi."))
        if (challenge.isRegister) {
            db.accountDao().upsert(account)
        }
        val leaseExpiry = if (account.isEmployee) System.currentTimeMillis() + 8L * 3600_000L else 0L
        prefs.setActiveAccount(account.id, leaseExpiry)
        prefs.setLastSyncAt(System.currentTimeMillis())
        return Result.success(account)
    }

    suspend fun renewLease(account: UserAccountEntity?) {
        if (account?.isEmployee == true) {
            prefs.setOfflineMode(false)
            prefs.setLeaseExpiresAt(System.currentTimeMillis() + 8L * 3600_000L)
            prefs.setLastSyncAt(System.currentTimeMillis())
        }
    }

    suspend fun expireLeaseForTesting() {
        prefs.setLeaseExpiresAt(System.currentTimeMillis() - 1000L)
    }

    suspend fun updateProfileName(account: UserAccountEntity, newName: String) {
        db.accountDao().upsert(account.copy(fullName = newName.trim()))
    }

    suspend fun logout() {
        prefs.setActiveAccount(null, 0L)
    }

    suspend fun deleteAccount(accountId: String) {
        db.accountDao().deleteById(accountId)
        prefs.setActiveAccount(null, 0L)
    }

    suspend fun getDraft(draftId: String): String? = db.draftDao().getDraft(draftId)?.payloadJson

    suspend fun saveDraft(draftId: String, payloadJson: String) {
        db.draftDao().saveDraft(DraftEntity(draftId, payloadJson, System.currentTimeMillis()))
    }

    suspend fun deleteDraft(draftId: String) = db.draftDao().deleteDraft(draftId)

    suspend fun saveInfrastructureObject(
        existingId: String?,
        code: String,
        name: String,
        description: String,
        categoryId: String,
        regionId: String,
        geometryJson: String,
        operationalStatus: String,
        passportJson: String,
        accuracyM: Double?,
        attachments: List<Pair<String, String>>, // (filename, uriString)
        isOffline: Boolean
    ): Result<String> {
        val nowIso = currentIsoUtc()
        val existing = if (existingId != null) db.infrastructureDao().getById(existingId) else null
        val targetId = existing?.id ?: "obj-${UUID.randomUUID().toString().take(8)}"
        val nextVersion = (existing?.version ?: 0) + 1
        val entity = InfrastructureObjectEntity(
            id = targetId,
            code = code.trim(),
            name = name.trim(),
            description = description.trim(),
            categoryId = categoryId,
            regionId = regionId,
            districtId = existing?.districtId ?: "DEMO-$regionId",
            geometryJson = geometryJson,
            operationalStatus = operationalStatus,
            lifecycle = existing?.lifecycle ?: "draft",
            sensitivity = existing?.sensitivity ?: "restricted",
            version = nextVersion,
            passportJson = passportJson,
            accuracyM = accuracyM,
            updatedAt = nowIso,
            isSynthetic = true,
            isPublicProjected = existing?.isPublicProjected ?: false
        )

        if (isOffline) {
            val op = SyncOperationEntity(
                operationId = UUID.randomUUID().toString(),
                entityType = "infrastructure",
                action = if (existing == null) "create" else "update",
                objectId = targetId,
                objectName = name.trim(),
                expectedVersion = existing?.version,
                payloadJson = serializeObjectPayload(entity),
                status = "pending",
                createdAt = nowIso
            )
            db.syncDao().upsert(op)
            attachments.forEach { (filename, uriStr) ->
                db.attachmentDao().insert(
                    ObjectAttachmentEntity(
                        id = UUID.randomUUID().toString(),
                        objectId = targetId,
                        reportId = null,
                        filename = filename,
                        mimeType = if (filename.endsWith(".pdf", true)) "application/pdf" else "image/jpeg",
                        uriString = uriStr,
                        scanStatus = "pending_scan",
                        createdAt = nowIso
                    )
                )
            }
            db.draftDao().deleteDraft(existingId ?: "new-object")
            return Result.success("QUEUED:$targetId")
        }

        db.infrastructureDao().upsert(entity)
        attachments.forEach { (filename, uriStr) ->
            db.attachmentDao().insert(
                ObjectAttachmentEntity(
                    id = UUID.randomUUID().toString(),
                    objectId = targetId,
                    reportId = null,
                    filename = filename,
                    mimeType = if (filename.endsWith(".pdf", true)) "application/pdf" else "image/jpeg",
                    uriString = uriStr,
                    scanStatus = "quarantined_local",
                    createdAt = nowIso
                )
            )
        }
        db.draftDao().deleteDraft(existingId ?: "new-object")
        return Result.success(targetId)
    }

    suspend fun submitObjectForReview(objectId: String) {
        val obj = db.infrastructureDao().getById(objectId) ?: return
        db.infrastructureDao().upsert(
            obj.copy(
                lifecycle = "submitted",
                version = obj.version + 1,
                updatedAt = currentIsoUtc()
            )
        )
        db.notificationDao().insert(
            NotificationEntity(
                id = UUID.randomUUID().toString(),
                userId = null,
                title = "Obyekt tekshiruvga yuborildi",
                body = "${obj.code} · ${obj.name} ko‘rib chiqish uchun navbatga qo‘shildi.",
                kind = "object_submitted",
                readAt = null,
                createdAt = currentIsoUtc()
            )
        )
    }

    suspend fun reviewObject(objectId: String, approve: Boolean) {
        val obj = db.infrastructureDao().getById(objectId) ?: return
        db.infrastructureDao().upsert(
            obj.copy(
                lifecycle = if (approve) "published" else "requires_correction",
                version = obj.version + 1,
                updatedAt = currentIsoUtc()
            )
        )
        db.notificationDao().insert(
            NotificationEntity(
                id = UUID.randomUUID().toString(),
                userId = null,
                title = if (approve) "Obyekt nashr etildi" else "Tuzatish talab qilinadi",
                body = "${obj.code} · ${obj.name}",
                kind = "object_review",
                readAt = null,
                createdAt = currentIsoUtc()
            )
        )
    }

    suspend fun addInspection(
        objectId: String,
        inspectorName: String,
        condition: String,
        operationalStatus: String,
        notes: String,
        nextInspectionDate: String?
    ) {
        val nowIso = currentIsoUtc()
        db.inspectionDao().insert(
            InspectionEntity(
                id = UUID.randomUUID().toString(),
                objectId = objectId,
                inspectorName = inspectorName,
                condition = condition,
                operationalStatus = operationalStatus,
                notes = notes.trim(),
                nextInspectionDate = nextInspectionDate?.trim()?.takeIf { it.isNotEmpty() },
                createdAt = nowIso
            )
        )
        val obj = db.infrastructureDao().getById(objectId)
        if (obj != null) {
            db.infrastructureDao().upsert(
                obj.copy(
                    operationalStatus = operationalStatus,
                    version = obj.version + 1,
                    updatedAt = nowIso
                )
            )
        }
    }

    suspend fun submitCitizenReport(
        userId: String,
        category: String,
        description: String,
        regionId: String,
        location: GeoPoint?,
        contactPhone: String?,
        attachmentCount: Int,
        isOffline: Boolean = false
    ): CitizenReportEntity {
        val nowIso = currentIsoUtc()
        val report = CitizenReportEntity(
            id = "rep-${UUID.randomUUID().toString().take(8)}",
            userId = userId,
            category = category,
            description = description.trim(),
            regionId = regionId,
            geometryJson = location?.let { GeoUtils.encodeGeoJson("Point", listOf(it)) },
            contactPhone = contactPhone,
            status = if (isOffline) "queued_offline" else "received",
            attachmentCount = attachmentCount,
            isSynthetic = true,
            createdAt = nowIso,
            updatedAt = nowIso
        )
        db.reportDao().upsert(report)
        if (isOffline) {
            val payload = JsonObject(
                mapOf(
                    "report_id" to JsonPrimitive(report.id),
                    "user_id" to JsonPrimitive(userId),
                    "category" to JsonPrimitive(category),
                    "region_id" to JsonPrimitive(regionId),
                    "description" to JsonPrimitive(report.description)
                )
            ).toString()
            db.syncDao().upsert(
                SyncOperationEntity(
                    operationId = UUID.randomUUID().toString(),
                    entityType = "citizen_report",
                    action = "create",
                    objectId = report.id,
                    objectName = "${report.id} · $category",
                    expectedVersion = null,
                    payloadJson = payload,
                    status = "pending",
                    createdAt = nowIso
                )
            )
            db.notificationDao().insert(
                NotificationEntity(
                    id = UUID.randomUUID().toString(),
                    userId = userId,
                    title = "Murojaat offline navbatga saqlandi",
                    body = "${report.id} qurilmada saqlandi va tarmoq tiklanganda avtomatik yuboriladi.",
                    kind = "report_queued",
                    readAt = null,
                    createdAt = nowIso
                )
            )
        } else {
            db.notificationDao().insert(
                NotificationEntity(
                    id = UUID.randomUUID().toString(),
                    userId = userId,
                    title = "Murojaat qabul qilindi",
                    body = "Murojaatingiz ro‘yxatga olindi (${report.id}). Shoshilinch holatda 112 ga qo‘ng‘iroq qiling.",
                    kind = "report_received",
                    readAt = null,
                    createdAt = nowIso
                )
            )
        }
        return report
    }

    suspend fun submitEmergencyIncident(
        pinLocation: GeoPoint,
        currentUserLocation: GeoPoint?,
        categoryId: String,
        hazardTitle: String,
        notes: String,
        regionId: String,
        reporterUserId: String?,
        reporterPhone: String?,
        isOffline: Boolean = false
    ): EmergencySubmissionResult {
        val nowIso = currentIsoUtc()
        val shortHex = UUID.randomUUID().toString().replace("-", "").take(6).uppercase(Locale.US)
        val cleanNotes = notes.trim()
        val effectiveDescription = if (cleanNotes.isNotEmpty()) {
            cleanNotes
        } else {
            "$hazardTitle (${"%.5f".format(Locale.US, pinLocation.lat)}, ${"%.5f".format(Locale.US, pinLocation.lon)})"
        }
        val passportMap = buildMap<String, JsonElement> {
            put("schema_version", JsonPrimitive(1))
            put("report_source", JsonPrimitive("emergency_map_pin"))
            put("pin_lat", JsonPrimitive(pinLocation.lat))
            put("pin_lon", JsonPrimitive(pinLocation.lon))
            if (currentUserLocation != null) {
                put("reporter_gps_lat", JsonPrimitive(currentUserLocation.lat))
                put("reporter_gps_lon", JsonPrimitive(currentUserLocation.lon))
            }
            if (cleanNotes.isNotEmpty()) {
                put("incident_notes", JsonPrimitive(cleanNotes))
            }
        }
        val entity = InfrastructureObjectEntity(
            id = "emg-$shortHex",
            code = "EMG-$shortHex",
            name = hazardTitle.trim().ifEmpty { "Emergency Incident" },
            description = effectiveDescription,
            categoryId = categoryId,
            regionId = regionId,
            districtId = null,
            geometryJson = GeoUtils.encodeGeoJson("Point", listOf(pinLocation)),
            operationalStatus = "faulty",
            lifecycle = "submitted",
            sensitivity = "public_projected",
            version = 1,
            passportJson = JsonObject(passportMap).toString(),
            accuracyM = if (currentUserLocation != null) 5.0 else 15.0,
            updatedAt = nowIso,
            isSynthetic = true,
            isPublicProjected = true
        )
        val reportId = "rep-emg-$shortHex"
        val report = CitizenReportEntity(
            id = reportId,
            userId = reporterUserId ?: "guest-emergency",
            category = categoryId,
            description = "[${entity.code}] $hazardTitle: $effectiveDescription" +
                (currentUserLocation?.let {
                    " | GPS: ${"%.5f".format(Locale.US, it.lat)}, ${"%.5f".format(Locale.US, it.lon)}"
                } ?: ""),
            regionId = regionId,
            geometryJson = entity.geometryJson,
            contactPhone = reporterPhone,
            status = if (isOffline) "queued_offline" else "received",
            attachmentCount = 0,
            isSynthetic = true,
            createdAt = nowIso,
            updatedAt = nowIso
        )
        db.reportDao().upsert(report)

        if (isOffline) {
            val queuedPayload = serializeEmergencyPayload(
                entity = entity,
                reportId = reportId,
                reporterUserId = reporterUserId,
                reporterPhone = reporterPhone
            )
            db.syncDao().upsert(
                SyncOperationEntity(
                    operationId = UUID.randomUUID().toString(),
                    entityType = "emergency_incident",
                    action = "create",
                    objectId = entity.id,
                    objectName = "${entity.code} · ${entity.name}",
                    expectedVersion = null,
                    payloadJson = queuedPayload,
                    status = "pending",
                    createdAt = nowIso
                )
            )
            db.notificationDao().insert(
                NotificationEntity(
                    id = UUID.randomUUID().toString(),
                    userId = reporterUserId,
                    title = "${entity.code} · ${entity.name}",
                    body = "${"%.4f".format(Locale.US, pinLocation.lat)}, ${"%.4f".format(Locale.US, pinLocation.lon)} — Offline navbatga saqlandi. Tarmoq tiklanganda markaziy reyestrga avtomatik yuboriladi.",
                    kind = "emergency_queued",
                    readAt = null,
                    createdAt = nowIso
                )
            )
            return EmergencySubmissionResult(
                code = entity.code,
                entity = null,
                queuedOffline = true
            )
        }

        db.infrastructureDao().upsert(entity)
        db.notificationDao().insert(
            NotificationEntity(
                id = UUID.randomUUID().toString(),
                userId = reporterUserId,
                title = "${entity.code} · $hazardTitle",
                body = "${"%.4f".format(Locale.US, pinLocation.lat)}, ${"%.4f".format(Locale.US, pinLocation.lon)} — Markaziy reyestrga yuborildi. Xavf kuchli bo‘lsa 112 ga qo‘ng‘iroq qiling.",
                kind = "emergency_incident",
                readAt = null,
                createdAt = nowIso
            )
        )
        return EmergencySubmissionResult(
            code = entity.code,
            entity = entity,
            queuedOffline = false
        )
    }

    suspend fun requestRoute(
        objectId: String,
        origin: GeoPoint,
        requestedById: String
    ): Result<ApprovedRouteEntity> {
        val obj = db.infrastructureDao().getById(objectId)
            ?: return Result.failure(IllegalStateException("Obyekt topilmadi."))
        if (obj.lifecycle != "published") {
            return Result.failure(IllegalStateException("Faqat tasdiqlangan operativ obyektga marshrut tuziladi."))
        }
        val dest = GeoUtils.parseGeoJson(obj.geometryJson)?.representativePoint()
            ?: GeoPoint(41.299, 69.240)
        val mid1 = GeoPoint((origin.lat * 2 + dest.lat) / 3.0, (origin.lon * 2 + dest.lon) / 3.0)
        val mid2 = GeoPoint((origin.lat + dest.lat * 2) / 3.0, (origin.lon + dest.lon * 2) / 3.0)
        val distance = GeoUtils.distanceMeters(origin, mid1) +
            GeoUtils.distanceMeters(mid1, mid2) +
            GeoUtils.distanceMeters(mid2, dest)
        val duration = (distance / 11.5).coerceAtLeast(60.0)
        val geomJson = GeoUtils.encodeGeoJson("LineString", listOf(origin, mid1, mid2, dest))
        val stepsJson = """[
            {"name":"Boshlang‘ich yo‘nalish","distance_m":${(distance * 0.35).toInt()},"duration_s":${(duration * 0.35).toInt()},"maneuver":{"type":"depart","modifier":"straight","location":[${origin.lon},${origin.lat}]}},
            {"name":"Markaziy yo‘lak","distance_m":${(distance * 0.40).toInt()},"duration_s":${(duration * 0.40).toInt()},"maneuver":{"type":"turn","modifier":"right","location":[${mid1.lon},${mid1.lat}]}},
            {"name":"${obj.code} manzili","distance_m":${(distance * 0.25).toInt()},"duration_s":${(duration * 0.25).toInt()},"maneuver":{"type":"arrive","modifier":"straight","location":[${dest.lon},${dest.lat}]}}
        ]"""
        val route = ApprovedRouteEntity(
            id = "route-${UUID.randomUUID().toString().take(8)}",
            destinationObjectId = obj.id,
            destinationName = "${obj.code} · ${obj.name}",
            requestedBy = requestedById,
            geometryJson = geomJson,
            stepsJson = stepsJson,
            distanceM = distance,
            durationS = duration,
            status = "pending",
            approvedBy = null,
            expiresAtEpochMs = null,
            sourceDate = "2026-11-01",
            version = 1,
            createdAt = currentIsoUtc()
        )
        db.routeDao().upsert(route)
        return Result.success(route)
    }

    suspend fun approveRoute(routeId: String, approverName: String) {
        val route = db.routeDao().getById(routeId) ?: return
        db.routeDao().upsert(
            route.copy(
                status = "approved",
                approvedBy = approverName,
                expiresAtEpochMs = System.currentTimeMillis() + 8L * 3600_000L,
                version = route.version + 1
            )
        )
        db.notificationDao().insert(
            NotificationEntity(
                id = UUID.randomUUID().toString(),
                userId = null,
                title = "Marshrut tasdiqlandi",
                body = "${route.destinationName} uchun marshrut tasdiqlandi.",
                kind = "route_approved",
                readAt = null,
                createdAt = currentIsoUtc()
            )
        )
    }

    suspend fun withdrawRoute(routeId: String) {
        val route = db.routeDao().getById(routeId) ?: return
        db.routeDao().upsert(
            route.copy(
                status = "withdrawn",
                expiresAtEpochMs = System.currentTimeMillis(),
                version = route.version + 1
            )
        )
    }

    suspend fun flushQueuedReports(): SyncFlushResult =
        synchronizeQueue(account = null, clearOfflineFlag = false)

    suspend fun synchronizeQueue(
        account: UserAccountEntity?,
        clearOfflineFlag: Boolean = true
    ): SyncFlushResult {
        val pending = db.syncDao().getPending()
        var pushedReports = 0
        var pushedInfrastructure = 0
        var conflicts = 0
        val nowIso = currentIsoUtc()

        for (op in pending) {
            val payload = runCatching { json.parseToJsonElement(op.payloadJson).jsonObject }.getOrNull()
            if (payload == null) {
                db.syncDao().upsert(op.copy(status = "conflict", errorMessage = "Payload formati noto‘g‘ri"))
                conflicts++
                continue
            }

            when (op.entityType) {
                "emergency_incident" -> {
                    val entity = deserializeEmergencyPayload(payload, op.objectId ?: "emg-${UUID.randomUUID().toString().take(6)}", nowIso)
                    db.infrastructureDao().upsert(entity)
                    val reportId = payload["report_id"]?.jsonPrimitive?.contentOrNull
                    val existingReport = reportId?.let { db.reportDao().getById(it) }
                    if (existingReport != null) {
                        db.reportDao().upsert(existingReport.copy(status = "received", updatedAt = nowIso))
                    }
                    val reporterUserId = payload["reporter_user_id"]?.jsonPrimitive?.contentOrNull
                    db.notificationDao().insert(
                        NotificationEntity(
                            id = UUID.randomUUID().toString(),
                            userId = reporterUserId,
                            title = "${entity.code} · ${entity.name}",
                            body = "Offline navbatdan markaziy reyestrga yuborildi.",
                            kind = "emergency_synced",
                            readAt = null,
                            createdAt = nowIso
                        )
                    )
                    db.syncDao().deleteById(op.operationId)
                    pushedReports++
                }

                "citizen_report" -> {
                    val reportId = payload["report_id"]?.jsonPrimitive?.contentOrNull ?: op.objectId
                    val existingReport = reportId?.let { db.reportDao().getById(it) }
                    if (existingReport != null) {
                        db.reportDao().upsert(existingReport.copy(status = "received", updatedAt = nowIso))
                    }
                    val userId = payload["user_id"]?.jsonPrimitive?.contentOrNull
                    db.notificationDao().insert(
                        NotificationEntity(
                            id = UUID.randomUUID().toString(),
                            userId = userId,
                            title = "Murojaat yuborildi (${reportId ?: op.objectName})",
                            body = "Offline navbatdagi murojaat markaziy tizimga muvaffaqiyatli yuklandi.",
                            kind = "report_synced",
                            readAt = null,
                            createdAt = nowIso
                        )
                    )
                    db.syncDao().deleteById(op.operationId)
                    pushedReports++
                }

                else -> {
                    if (account?.isEmployee != true) {
                        continue
                    }
                    val existing = op.objectId?.let { db.infrastructureDao().getById(it) }
                    if (existing != null && op.expectedVersion != null && existing.version != op.expectedVersion) {
                        db.syncDao().upsert(
                            op.copy(
                                status = "conflict",
                                errorMessage = "409 Conflict: server versiyasi v${existing.version}, kutilgan v${op.expectedVersion}."
                            )
                        )
                        conflicts++
                        continue
                    }
                    val entity = deserializeObjectPayload(
                        payload,
                        op.objectId ?: "obj-${UUID.randomUUID().toString().take(8)}",
                        (existing?.version ?: 0) + 1
                    )
                    db.infrastructureDao().upsert(entity)
                    db.syncDao().deleteById(op.operationId)
                    pushedInfrastructure++
                }
            }
        }

        if (clearOfflineFlag) {
            prefs.setOfflineMode(false)
        }
        if (account?.isEmployee == true) {
            prefs.setLeaseExpiresAt(System.currentTimeMillis() + 8L * 3600_000L)
        }
        if (pushedReports + pushedInfrastructure > 0 || clearOfflineFlag) {
            prefs.setLastSyncAt(System.currentTimeMillis())
        }
        return SyncFlushResult(
            pushedReports = pushedReports,
            pushedInfrastructure = pushedInfrastructure,
            conflicts = conflicts
        )
    }

    suspend fun createSimulatedConflict(objectId: String) {
        val obj = db.infrastructureDao().getById(objectId) ?: return
        val op = SyncOperationEntity(
            operationId = UUID.randomUUID().toString(),
            entityType = "infrastructure",
            action = "update",
            objectId = obj.id,
            objectName = obj.name,
            expectedVersion = (obj.version - 1).coerceAtLeast(0),
            payloadJson = serializeObjectPayload(obj.copy(description = "${obj.description} [Local offline edit]")),
            status = "conflict",
            errorMessage = "409: Yozuv boshqa foydalanuvchi tomonidan yangilangan (v${obj.version}).",
            createdAt = currentIsoUtc()
        )
        db.syncDao().upsert(op)
    }

    suspend fun resolveConflictAcceptServer(operationId: String) {
        db.syncDao().deleteById(operationId)
    }

    suspend fun resolveConflictRetryLocal(operationId: String) {
        val op = db.syncDao().getById(operationId) ?: return
        val server = op.objectId?.let { db.infrastructureDao().getById(it) }
        db.syncDao().upsert(
            op.copy(
                expectedVersion = server?.version,
                status = "pending",
                errorMessage = null
            )
        )
    }

    suspend fun markNotificationRead(id: String) {
        db.notificationDao().markRead(id, currentIsoUtc())
    }

    suspend fun markAllNotificationsRead() {
        db.notificationDao().markAllRead(currentIsoUtc())
    }

    private fun serializeObjectPayload(e: InfrastructureObjectEntity): String {
        val obj = JsonObject(
            mapOf(
                "id" to JsonPrimitive(e.id),
                "code" to JsonPrimitive(e.code),
                "name" to JsonPrimitive(e.name),
                "description" to JsonPrimitive(e.description),
                "category_id" to JsonPrimitive(e.categoryId),
                "region_id" to JsonPrimitive(e.regionId),
                "district_id" to JsonPrimitive(e.districtId ?: ""),
                "geometry_json" to JsonPrimitive(e.geometryJson),
                "operational_status" to JsonPrimitive(e.operationalStatus),
                "lifecycle" to JsonPrimitive(e.lifecycle),
                "sensitivity" to JsonPrimitive(e.sensitivity),
                "passport_json" to JsonPrimitive(e.passportJson),
                "accuracy_m" to (e.accuracyM?.let { JsonPrimitive(it) } ?: JsonNull)
            )
        )
        return obj.toString()
    }

    private fun deserializeObjectPayload(obj: JsonObject, id: String, version: Int): InfrastructureObjectEntity {
        return InfrastructureObjectEntity(
            id = id,
            code = obj["code"]?.jsonPrimitive?.contentOrNull ?: "DEMO-NEW",
            name = obj["name"]?.jsonPrimitive?.contentOrNull ?: "Yangi obyekt",
            description = obj["description"]?.jsonPrimitive?.contentOrNull ?: "",
            categoryId = obj["category_id"]?.jsonPrimitive?.contentOrNull ?: "other",
            regionId = obj["region_id"]?.jsonPrimitive?.contentOrNull ?: "UZ-TK",
            districtId = obj["district_id"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotEmpty() },
            geometryJson = obj["geometry_json"]?.jsonPrimitive?.contentOrNull ?: GeoUtils.encodeGeoJson("Point", listOf(GeoPoint(41.299, 69.240))),
            operationalStatus = obj["operational_status"]?.jsonPrimitive?.contentOrNull ?: "unknown",
            lifecycle = obj["lifecycle"]?.jsonPrimitive?.contentOrNull ?: "draft",
            sensitivity = obj["sensitivity"]?.jsonPrimitive?.contentOrNull ?: "restricted",
            version = version,
            passportJson = obj["passport_json"]?.jsonPrimitive?.contentOrNull ?: """{"schema_version":1}""",
            accuracyM = obj["accuracy_m"]?.jsonPrimitive?.doubleOrNull,
            updatedAt = currentIsoUtc(),
            isSynthetic = true,
            isPublicProjected = false
        )
    }

    private fun serializeEmergencyPayload(
        entity: InfrastructureObjectEntity,
        reportId: String,
        reporterUserId: String?,
        reporterPhone: String?
    ): String {
        val obj = JsonObject(
            buildMap {
                put("id", JsonPrimitive(entity.id))
                put("code", JsonPrimitive(entity.code))
                put("name", JsonPrimitive(entity.name))
                put("description", JsonPrimitive(entity.description))
                put("category_id", JsonPrimitive(entity.categoryId))
                put("region_id", JsonPrimitive(entity.regionId))
                put("geometry_json", JsonPrimitive(entity.geometryJson))
                put("operational_status", JsonPrimitive(entity.operationalStatus))
                put("lifecycle", JsonPrimitive(entity.lifecycle))
                put("sensitivity", JsonPrimitive(entity.sensitivity))
                put("passport_json", JsonPrimitive(entity.passportJson))
                put("accuracy_m", entity.accuracyM?.let { JsonPrimitive(it) } ?: JsonNull)
                put("report_id", JsonPrimitive(reportId))
                reporterUserId?.let { put("reporter_user_id", JsonPrimitive(it)) }
                reporterPhone?.let { put("reporter_phone", JsonPrimitive(it)) }
            }
        )
        return obj.toString()
    }

    private fun deserializeEmergencyPayload(
        obj: JsonObject,
        id: String,
        updatedAtIso: String
    ): InfrastructureObjectEntity {
        return InfrastructureObjectEntity(
            id = id,
            code = obj["code"]?.jsonPrimitive?.contentOrNull ?: "EMG-QUEUE",
            name = obj["name"]?.jsonPrimitive?.contentOrNull ?: "Emergency Incident",
            description = obj["description"]?.jsonPrimitive?.contentOrNull ?: "",
            categoryId = obj["category_id"]?.jsonPrimitive?.contentOrNull ?: "other",
            regionId = obj["region_id"]?.jsonPrimitive?.contentOrNull ?: "UZ-TK",
            districtId = null,
            geometryJson = obj["geometry_json"]?.jsonPrimitive?.contentOrNull
                ?: GeoUtils.encodeGeoJson("Point", listOf(GeoPoint(41.2995, 69.2401))),
            operationalStatus = obj["operational_status"]?.jsonPrimitive?.contentOrNull ?: "faulty",
            lifecycle = "submitted",
            sensitivity = "public_projected",
            version = 1,
            passportJson = obj["passport_json"]?.jsonPrimitive?.contentOrNull ?: """{"schema_version":1}""",
            accuracyM = obj["accuracy_m"]?.jsonPrimitive?.doubleOrNull,
            updatedAt = updatedAtIso,
            isSynthetic = true,
            isPublicProjected = true
        )
    }

    companion object {
        fun currentIsoUtc(): String {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            return sdf.format(Date())
        }
    }
}
