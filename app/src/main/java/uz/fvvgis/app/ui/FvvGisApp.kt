package uz.fvvgis.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import uz.fvvgis.app.R
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.ui.components.ErrorPanel
import uz.fvvgis.app.ui.navigation.*
import uz.fvvgis.app.ui.screens.*
import uz.fvvgis.app.ui.theme.FvvGisTheme
import uz.fvvgis.app.ui.theme.GisColors
import uz.fvvgis.app.ui.viewmodel.MainViewModel

private data class NavTab(
    val route: Any,
    val labelKey: String,
    val icon: ImageVector,
    val testTag: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FvvGisApp(viewModel: MainViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val regions by viewModel.regions.collectAsStateWithLifecycle()
    val categories by viewModel.categories.collectAsStateWithLifecycle()
    val allObjects by viewModel.allObjects.collectAsStateWithLifecycle()
    val mapMarkers by viewModel.mapRegistryMarkers.collectAsStateWithLifecycle()
    val myReports by viewModel.myReports.collectAsStateWithLifecycle()
    val approvedRoutes by viewModel.approvedRoutes.collectAsStateWithLifecycle()
    val syncQueue by viewModel.syncQueue.collectAsStateWithLifecycle()
    val notifications by viewModel.notifications.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDest = navBackStackEntry?.destination
    val locale = state.locale

    LaunchedEffect(state.message) {
        val msg = state.message
        if (msg != null) {
            snackbarHostState.showSnackbar(msg)
            viewModel.clearMessage()
        }
    }

    val isEmployee = state.isEmployee
    val tabs = remember(isEmployee) {
        if (isEmployee) {
            listOf(
                NavTab(MapRoute, "map", Icons.Outlined.Map, "nav_map"),
                NavTab(RegistryRoute, "registry", Icons.Outlined.Inventory2, "nav_registry"),
                NavTab(ObjectFormRoute(null), "add", Icons.Outlined.AddCircleOutline, "nav_add"),
                NavTab(InspectionsRoute, "inspections", Icons.Outlined.FactCheck, "nav_inspections"),
                NavTab(ProfileRoute, "profile", Icons.Outlined.Person, "nav_profile")
            )
        } else {
            listOf(
                NavTab(HomeRoute, "home", Icons.Outlined.Home, "nav_home"),
                NavTab(MapRoute, "map", Icons.Outlined.Map, "nav_map"),
                NavTab(ReportRoute, "report", Icons.Outlined.AddAlert, "nav_report"),
                NavTab(MyReportsRoute, "reports", Icons.Outlined.Assignment, "nav_reports"),
                NavTab(ProfileRoute, "profile", Icons.Outlined.Person, "nav_profile")
            )
        }
    }

    val isAuthScreen = currentDest?.hasRoute(AuthRoute::class) == true
    val isRestrictedOperationalScreen = currentDest != null && (
        currentDest.hasRoute(RegistryRoute::class) ||
            currentDest.hasRoute(InspectionsRoute::class) ||
            currentDest.hasRoute(RoutesRoute::class) ||
            currentDest.hasRoute(PassportRoute::class)
        )
    val leaseExpiredGate = isEmployee && isRestrictedOperationalScreen && !state.isLeaseValid

    val unreadCount = remember(notifications) { notifications.count { it.readAt == null } }
    val pendingSyncCount = syncQueue.size

    fun navigateTopLevel(route: Any) {
        navController.navigate(route) {
            popUpTo(navController.graph.startDestinationId) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    FvvGisTheme(darkTheme = state.darkTheme) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val useRail = maxWidth >= 700.dp

            Scaffold(
                snackbarHost = { SnackbarHost(snackbarHostState) },
                topBar = {
                    if (!isAuthScreen) {
                        TopAppBar(
                            title = {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Explore,
                                        contentDescription = stringResource(R.string.content_desc_app_logo),
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                    Text(
                                        text = "FVV GIS",
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontWeight = FontWeight.Black,
                                            letterSpacing = 1.4.sp
                                        )
                                    )
                                }
                            },
                            actions = {
                                if (isEmployee || pendingSyncCount > 0 || state.isEffectiveOffline) {
                                    IconButton(
                                        onClick = { navController.navigate(SyncRoute) },
                                        modifier = Modifier.testTag("topbar_sync_button")
                                    ) {
                                        BadgedBox(
                                            badge = {
                                                if (pendingSyncCount > 0) {
                                                    Badge { Text("$pendingSyncCount") }
                                                }
                                            }
                                        ) {
                                            Icon(
                                                imageVector = if (pendingSyncCount > 0 && state.isEffectiveOffline) {
                                                    Icons.Outlined.CloudUpload
                                                } else {
                                                    Icons.Outlined.Sync
                                                },
                                                contentDescription = stringResource(R.string.content_desc_sync)
                                            )
                                        }
                                    }
                                }
                                IconButton(
                                    onClick = { navController.navigate(NotificationsRoute) },
                                    modifier = Modifier.testTag("topbar_notifications_button")
                                ) {
                                    BadgedBox(
                                        badge = {
                                            if (unreadCount > 0) {
                                                Badge { Text("$unreadCount") }
                                            }
                                        }
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.Notifications,
                                            contentDescription = stringResource(R.string.content_desc_notifications)
                                        )
                                    }
                                }
                            }
                        )
                    }
                },
                bottomBar = {
                    if (!isAuthScreen && !useRail) {
                        NavigationBar {
                            tabs.forEach { tab ->
                                val selected = when (tab.route) {
                                    is HomeRoute -> currentDest?.hasRoute(HomeRoute::class) == true
                                    is MapRoute -> currentDest?.hasRoute(MapRoute::class) == true
                                    is RegistryRoute -> currentDest?.hasRoute(RegistryRoute::class) == true
                                    is ObjectFormRoute -> currentDest?.hasRoute(ObjectFormRoute::class) == true
                                    is InspectionsRoute -> currentDest?.hasRoute(InspectionsRoute::class) == true
                                    is ReportRoute -> currentDest?.hasRoute(ReportRoute::class) == true
                                    is MyReportsRoute -> currentDest?.hasRoute(MyReportsRoute::class) == true
                                    is ProfileRoute -> currentDest?.hasRoute(ProfileRoute::class) == true
                                    else -> false
                                }
                                NavigationBarItem(
                                    selected = selected,
                                    onClick = { navigateTopLevel(tab.route) },
                                    icon = { Icon(tab.icon, contentDescription = L10n.text(locale, tab.labelKey)) },
                                    label = { Text(L10n.text(locale, tab.labelKey), maxLines = 1) },
                                    modifier = Modifier.testTag(tab.testTag)
                                )
                            }
                        }
                    }
                }
            ) { innerPadding ->
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    if (!isAuthScreen && useRail) {
                        NavigationRail {
                            tabs.forEach { tab ->
                                val selected = when (tab.route) {
                                    is HomeRoute -> currentDest?.hasRoute(HomeRoute::class) == true
                                    is MapRoute -> currentDest?.hasRoute(MapRoute::class) == true
                                    is RegistryRoute -> currentDest?.hasRoute(RegistryRoute::class) == true
                                    is ObjectFormRoute -> currentDest?.hasRoute(ObjectFormRoute::class) == true
                                    is InspectionsRoute -> currentDest?.hasRoute(InspectionsRoute::class) == true
                                    is ReportRoute -> currentDest?.hasRoute(ReportRoute::class) == true
                                    is MyReportsRoute -> currentDest?.hasRoute(MyReportsRoute::class) == true
                                    is ProfileRoute -> currentDest?.hasRoute(ProfileRoute::class) == true
                                    else -> false
                                }
                                NavigationRailItem(
                                    selected = selected,
                                    onClick = { navigateTopLevel(tab.route) },
                                    icon = { Icon(tab.icon, contentDescription = L10n.text(locale, tab.labelKey)) },
                                    label = { Text(L10n.text(locale, tab.labelKey)) }
                                )
                            }
                        }
                    }

                    Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
                        if (state.isEffectiveOffline) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(GisColors.OfflineBanner)
                                    .clickable { navController.navigate(SyncRoute) }
                                    .padding(horizontal = 16.dp, vertical = 10.dp)
                                    .testTag("global_offline_banner"),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.CloudOff,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = if (!state.isNetworkConnected) {
                                        L10n.text(locale, "networkDeviceOffline")
                                    } else {
                                        L10n.text(locale, "offline")
                                    },
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1f)
                                )
                                if (pendingSyncCount > 0) {
                                    Text(
                                        text = "${L10n.text(locale, "queuedReportsBadge")}: $pendingSyncCount",
                                        color = Color.White,
                                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.ExtraBold)
                                    )
                                }
                            }
                        }
                        if (state.account?.employeeStatus == "pending_verification") {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(MaterialTheme.colorScheme.primaryContainer)
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = L10n.text(locale, "pendingVerification"),
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }

                        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                            if (state.initializing) {
                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    CircularProgressIndicator()
                                }
                            } else if (leaseExpiredGate) {
                                val leaseMsg = L10n.pick(
                                    locale,
                                    "Offline ruxsat muddati tugagan yoki hali tasdiqlanmagan. Ruxsatlarni tekshirish uchun yangilang.",
                                    "Срок офлайн-доступа истёк. Обновите разрешения.",
                                    "Offline access has expired. Renew your grant."
                                )
                                ErrorPanel(
                                    message = leaseMsg,
                                    locale = locale,
                                    onRetry = { viewModel.renewLease() }
                                )
                            } else {
                                NavHost(
                                    navController = navController,
                                    startDestination = HomeRoute
                                ) {
                                    composable<HomeRoute> {
                                        HomeScreen(
                                            state = state,
                                            onOpenMap = { navigateTopLevel(MapRoute) },
                                            onOpenReport = { navigateTopLevel(ReportRoute) },
                                            onOpenMyReports = { navigateTopLevel(MyReportsRoute) },
                                            onOpenAuth = { navController.navigate(AuthRoute) }
                                        )
                                    }
                                    composable<AuthRoute> {
                                        AuthScreen(
                                            state = state,
                                            regions = regions,
                                            onRequestLoginOtp = { viewModel.requestLoginOtp(it) },
                                            onRequestRegisterOtp = { phone, name, emp, org, reg, dept, ref ->
                                                viewModel.requestRegisterOtp(phone, name, emp, org, reg, dept, ref)
                                            },
                                            onVerifyOtp = { code ->
                                                viewModel.verifyOtp(code) { _ ->
                                                    navController.navigate(MapRoute) {
                                                        popUpTo(0) { inclusive = true }
                                                    }
                                                }
                                            },
                                            onCancelChallenge = { viewModel.cancelAuthChallenge() },
                                            onOpenPublicMap = {
                                                navController.navigate(MapRoute) {
                                                    popUpTo(0) { inclusive = true }
                                                }
                                            }
                                        )
                                    }
                                    composable<MapRoute> {
                                        val queuedEmergencies = remember(syncQueue) {
                                            syncQueue.filter { it.entityType == "emergency_incident" && it.status == "pending" }
                                        }
                                        MapScreen(
                                            state = state,
                                            markers = mapMarkers,
                                            regions = regions,
                                            categories = categories,
                                            queuedEmergencyReports = queuedEmergencies,
                                            onOpenPassport = { objId -> navController.navigate(PassportRoute(objId)) },
                                            onAddRegistryItem = {
                                                if (state.isEmployee) {
                                                    navController.navigate(ObjectFormRoute(null))
                                                } else {
                                                    viewModel.showMessage(L10n.text(locale, "employeeRequiredForAdd"))
                                                    navController.navigate(AuthRoute)
                                                }
                                            },
                                            onOpenSyncQueue = { navController.navigate(SyncRoute) },
                                            onSubmitEmergencyIncident = { pin, gps, catId, title, notes, regionId, onDone ->
                                                viewModel.submitEmergencyIncident(
                                                    pinLocation = pin,
                                                    currentUserLocation = gps,
                                                    categoryId = catId,
                                                    hazardTitle = title,
                                                    notes = notes,
                                                    regionId = regionId,
                                                    onDone = onDone
                                                )
                                            },
                                            onShowMessage = { viewModel.showMessage(it) }
                                        )
                                    }
                                    composable<RegistryRoute> {
                                        RegistryScreen(
                                            state = state,
                                            objects = allObjects,
                                            categories = categories,
                                            onOpenPassport = { objId -> navController.navigate(PassportRoute(objId)) },
                                            onOpenAuth = { navController.navigate(AuthRoute) }
                                        )
                                    }
                                    composable<ObjectFormRoute> { backStackEntry ->
                                        val route = backStackEntry.toRoute<ObjectFormRoute>()
                                        val existing by remember(route.objectId) {
                                            route.objectId?.let { viewModel.observeObject(it) }
                                                ?: kotlinx.coroutines.flow.flowOf(null)
                                        }.collectAsStateWithLifecycle(initialValue = null)
                                        ObjectFormScreen(
                                            state = state,
                                            objectId = route.objectId,
                                            existingObject = existing,
                                            regions = regions,
                                            categories = categories,
                                            repo = viewModel.repo,
                                            onSaved = { savedId ->
                                                if (state.isEffectiveOffline) {
                                                    navController.navigate(SyncRoute) {
                                                        popUpTo<ObjectFormRoute> { inclusive = true }
                                                    }
                                                } else {
                                                    navController.navigate(PassportRoute(savedId)) {
                                                        popUpTo<ObjectFormRoute> { inclusive = true }
                                                    }
                                                }
                                            },
                                            onShowMessage = { viewModel.showMessage(it) },
                                            onOpenAuth = { navController.navigate(AuthRoute) }
                                        )
                                    }
                                    composable<PassportRoute> { backStackEntry ->
                                        val route = backStackEntry.toRoute<PassportRoute>()
                                        val obj by viewModel.observeObject(route.objectId)
                                            .collectAsStateWithLifecycle(initialValue = null)
                                        val atts by viewModel.observeAttachmentsForObject(route.objectId)
                                            .collectAsStateWithLifecycle(initialValue = emptyList())
                                        PassportScreen(
                                            state = state,
                                            item = obj,
                                            attachments = atts,
                                            onBack = { navController.popBackStack() },
                                            onEdit = { id -> navController.navigate(ObjectFormRoute(id)) },
                                            onSubmitForReview = { id -> viewModel.submitObjectForReview(id) },
                                            onReviewObject = { id, approve -> viewModel.reviewObject(id, approve) },
                                            onRequestRoute = { id, origin ->
                                                viewModel.requestRoute(id, origin) { res ->
                                                    res.fold(
                                                        onSuccess = {
                                                            viewModel.showMessage("Marshrut so‘raldi.")
                                                            navController.navigate(RoutesRoute)
                                                        },
                                                        onFailure = { e -> viewModel.showMessage(e.message ?: "Xatolik") }
                                                    )
                                                }
                                            },
                                            onSimulateConflict = { id ->
                                                viewModel.simulateConflict(id)
                                                navController.navigate(SyncRoute)
                                            }
                                        )
                                    }
                                    composable<ReportRoute> {
                                        ReportScreen(
                                            state = state,
                                            regions = regions,
                                            onSubmit = { cat, desc, reg, loc, attCount ->
                                                viewModel.submitCitizenReport(cat, desc, reg, loc, attCount) { rep ->
                                                    val statusKey = if (rep.status == "queued_offline") "queued_offline" else "open"
                                                    viewModel.showMessage("${L10n.text(locale, statusKey)} · ${rep.id}")
                                                    navigateTopLevel(MyReportsRoute)
                                                }
                                            },
                                            onOpenAuth = { navController.navigate(AuthRoute) },
                                            onShowMessage = { viewModel.showMessage(it) }
                                        )
                                    }
                                    composable<MyReportsRoute> {
                                        MyReportsScreen(
                                            state = state,
                                            reports = myReports,
                                            onOpenAuth = { navController.navigate(AuthRoute) }
                                        )
                                    }
                                    composable<InspectionsRoute> {
                                        InspectionsScreen(
                                            state = state,
                                            objects = allObjects,
                                            observeInspections = { viewModel.observeInspectionsForObject(it) },
                                            onAddInspection = { objId, cond, st, notes, next ->
                                                viewModel.addInspection(objId, cond, st, notes, next)
                                            }
                                        )
                                    }
                                    composable<RoutesRoute> {
                                        ApprovedRoutesScreen(
                                            state = state,
                                            routes = approvedRoutes,
                                            regions = regions,
                                            onApproveRoute = { viewModel.approveRoute(it) },
                                            onWithdrawRoute = { viewModel.withdrawRoute(it) }
                                        )
                                    }
                                    composable<SyncRoute> {
                                        SyncScreen(
                                            state = state,
                                            queue = syncQueue,
                                            onToggleOffline = { viewModel.setOfflineMode(it) },
                                            onSynchronize = { viewModel.synchronize() },
                                            onRenewLease = { viewModel.renewLease() },
                                            onExpireLeaseForTesting = { viewModel.expireLeaseForTesting() },
                                            onResolveAcceptServer = { viewModel.resolveConflictAcceptServer(it) },
                                            onResolveRetryLocal = { viewModel.resolveConflictRetryLocal(it) }
                                        )
                                    }
                                    composable<NotificationsRoute> {
                                        NotificationsScreen(
                                            state = state,
                                            notifications = notifications,
                                            onMarkRead = { viewModel.markNotificationRead(it) },
                                            onMarkAllRead = { viewModel.markAllNotificationsRead() },
                                            onOpenAuth = { navController.navigate(AuthRoute) }
                                        )
                                    }
                                    composable<ProfileRoute> {
                                        ProfileScreen(
                                            state = state,
                                            pendingSyncCount = pendingSyncCount,
                                            onSetDarkTheme = { viewModel.setDarkTheme(it) },
                                            onSetLocale = { viewModel.setLocale(it) },
                                            onUpdateName = { viewModel.updateProfileName(it) },
                                            onOpenRoutes = { navController.navigate(RoutesRoute) },
                                            onOpenSync = { navController.navigate(SyncRoute) },
                                            onOpenAuth = { navController.navigate(AuthRoute) },
                                            onLogout = {
                                                viewModel.logout {
                                                    navController.navigate(AuthRoute) {
                                                        popUpTo(0) { inclusive = true }
                                                    }
                                                }
                                            },
                                            onDeleteAccount = {
                                                viewModel.deleteAccount {
                                                    navController.navigate(AuthRoute) {
                                                        popUpTo(0) { inclusive = true }
                                                    }
                                                }
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
