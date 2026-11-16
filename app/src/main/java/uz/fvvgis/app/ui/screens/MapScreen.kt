package uz.fvvgis.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import uz.fvvgis.app.R
import uz.fvvgis.app.core.EmergencyPathResult
import uz.fvvgis.app.core.EmergencyPathfinder
import uz.fvvgis.app.core.EmergencyVehicleProfile
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.GeoUtils
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.core.OfflineMapController
import uz.fvvgis.app.core.OfflineTileEstimator
import uz.fvvgis.app.core.RouteAccessibilityStatus
import uz.fvvgis.app.core.TileDetailPreset
import uz.fvvgis.app.data.local.CategoryEntity
import uz.fvvgis.app.data.local.RegionEntity
import uz.fvvgis.app.data.local.SyncOperationEntity
import uz.fvvgis.app.data.model.GisRegistryItem
import uz.fvvgis.app.data.model.MarkerCluster
import uz.fvvgis.app.data.model.RegistryCategoryGroup
import uz.fvvgis.app.data.repository.EmergencySubmissionResult
import uz.fvvgis.app.ui.components.*
import uz.fvvgis.app.ui.theme.GisColors
import uz.fvvgis.app.ui.viewmodel.MainUiState
import kotlin.math.pow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    state: MainUiState,
    markers: List<GisRegistryItem>,
    regions: List<RegionEntity>,
    categories: List<CategoryEntity>,
    queuedEmergencyReports: List<SyncOperationEntity> = emptyList(),
    onOpenPassport: (String) -> Unit,
    onAddRegistryItem: () -> Unit,
    onOpenSyncQueue: () -> Unit = {},
    onSubmitEmergencyIncident: (
        pinLocation: GeoPoint,
        currentUserLocation: GeoPoint?,
        categoryId: String,
        hazardTitle: String,
        notes: String,
        regionId: String,
        onDone: (EmergencySubmissionResult) -> Unit
    ) -> Unit,
    onShowMessage: (String) -> Unit
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val haptic = LocalHapticFeedback.current
    val locale = state.locale
    var search by remember { mutableStateOf("") }
    var visibleGroups by remember { mutableStateOf(RegistryCategoryGroup.entries.toSet()) }
    var filterRegionId by remember { mutableStateOf<String?>(null) }
    var filterCategoryId by remember { mutableStateOf<String?>(null) }
    var filterStatus by remember { mutableStateOf<String?>(null) }
    var showFiltersSheet by remember { mutableStateOf(false) }
    var showSdkInfoSheet by remember { mutableStateOf(false) }
    var showMarkersListSheet by remember { mutableStateOf(false) }
    var activeCluster by remember { mutableStateOf<MarkerCluster?>(null) }
    var selectedMarker by remember { mutableStateOf<GisRegistryItem?>(null) }
    var measureMode by remember { mutableStateOf(false) }
    var measurePoints by remember { mutableStateOf<List<GeoPoint>>(emptyList()) }
    var userLocation by remember { mutableStateOf<GeoPoint?>(null) }
    var lastAccuracyM by remember { mutableStateOf<Double?>(null) }
    var isTrackingLocation by remember { mutableStateOf(false) }
    var emergencyMode by remember { mutableStateOf(false) }
    var emergencyPin by remember { mutableStateOf<GeoPoint?>(null) }
    var pendingDropAtGps by remember { mutableStateOf(false) }
    var isSubmittingEmergency by remember { mutableStateOf(false) }
    var pathfindingTarget by remember { mutableStateOf<GisRegistryItem?>(null) }
    var showPathfindingSheet by remember { mutableStateOf(false) }
    var vehicleProfile by remember { mutableStateOf(EmergencyVehicleProfile.FIRE_ENGINE) }
    var avoidFaultyHazards by remember { mutableStateOf(true) }
    var pendingRouteGps by remember { mutableStateOf(false) }
    var viewport by remember { mutableStateOf(MapViewport()) }

    val offlineController = remember(context) { OfflineMapController(context) }
    LaunchedEffect(Unit) {
        offlineController.refreshAreas()
    }
    val savedOfflineAreas by offlineController.areas.collectAsStateWithLifecycle()
    val creatingOfflineArea by offlineController.creating.collectAsStateWithLifecycle()
    var showDownloadAreaSheet by remember { mutableStateOf(false) }
    var downloadAreaMode by remember { mutableStateOf(DownloadAreaMode.CURRENT_VIEW) }
    var downloadRegionId by remember(regions) {
        mutableStateOf(regions.firstOrNull { it.id == "UZ-TK" }?.id ?: regions.firstOrNull()?.id)
    }
    var downloadPreset by remember { mutableStateOf(TileDetailPreset.CITY) }

    val downloadPreviewBounds = remember(showDownloadAreaSheet, downloadAreaMode, downloadRegionId, viewport, regions) {
        if (!showDownloadAreaSheet) {
            null
        } else if (downloadAreaMode == DownloadAreaMode.REGION) {
            val targetRegion = regions.firstOrNull { it.id == downloadRegionId } ?: regions.firstOrNull()
            if (targetRegion != null) {
                OfflineTileEstimator.boundsForRegion(targetRegion)
            } else {
                OfflineTileEstimator.boundsForViewport(viewport)
            }
        } else {
            OfflineTileEstimator.boundsForViewport(viewport)
        }
    }

    val groupCounts = remember(markers) {
        markers.groupingBy { it.categoryGroup }.eachCount()
    }

    val filteredMarkers = remember(markers, search, visibleGroups, filterRegionId, filterCategoryId, filterStatus) {
        val q = search.trim().lowercase()
        markers.filter { item ->
            (item.categoryGroup in visibleGroups) &&
                (filterRegionId == null || item.regionId == filterRegionId) &&
                (filterCategoryId == null || item.categoryId == filterCategoryId) &&
                (filterStatus == null || item.operationalStatus == filterStatus) &&
                (q.isEmpty() || "${item.name} ${item.code} ${item.description} ${item.categoryName}".lowercase().contains(q))
        }
    }

    val measuredMeters = remember(measurePoints) {
        var total = 0.0
        for (i in 1 until measurePoints.size) {
            total += GeoUtils.distanceMeters(measurePoints[i - 1], measurePoints[i])
        }
        total
    }

    val activeRoute = remember(userLocation, pathfindingTarget, vehicleProfile, avoidFaultyHazards, markers) {
        val target = pathfindingTarget ?: return@remember null
        val origin = userLocation ?: return@remember null
        EmergencyPathfinder.calculateShortestPath(
            origin = origin,
            destinationMarker = target,
            allMarkers = markers,
            profile = vehicleProfile,
            avoidFaultyHazards = avoidFaultyHazards
        )
    }

    fun focusMapOnRoute(route: EmergencyPathResult) {
        val midLat = (route.origin.lat + route.destination.lat) / 2.0
        val midLon = (route.origin.lon + route.destination.lon) / 2.0
        val targetZoom = when {
            route.totalDistanceMeters < 2_500 -> 9.5f
            route.totalDistanceMeters < 12_000 -> 6.5f
            route.totalDistanceMeters < 65_000 -> 4.2f
            route.totalDistanceMeters < 250_000 -> 2.1f
            else -> 1.15f
        }
        viewport = MapViewport(centerLat = midLat, centerLon = midLon, zoom = targetZoom)
    }

    val locationController = rememberLocationTrackingController(
        locale = locale,
        onPermissionGranted = {
            if (pendingDropAtGps) {
                pendingDropAtGps = false
                val fix = readBestDeviceLocation(context)
                    ?: LocationFix(userLocation ?: GeoPoint(41.2995, 69.2401), 15.0)
                userLocation = fix.point
                lastAccuracyM = fix.accuracyMeters
                emergencyPin = fix.point
                viewport = MapViewport(
                    centerLat = fix.point.lat,
                    centerLon = fix.point.lon,
                    zoom = viewport.zoom.coerceAtLeast(10f)
                )
            } else if (pendingRouteGps) {
                pendingRouteGps = false
                val fix = readBestDeviceLocation(context)
                    ?: LocationFix(userLocation ?: GeoPoint(41.2995, 69.2401), 15.0)
                userLocation = fix.point
                lastAccuracyM = fix.accuracyMeters
                showPathfindingSheet = true
            } else {
                isTrackingLocation = true
                onShowMessage(L10n.text(locale, "gpsTrackingActive"))
            }
        },
        onPermissionDeniedMessage = { msg ->
            pendingDropAtGps = false
            pendingRouteGps = false
            isTrackingLocation = false
            onShowMessage(msg)
        }
    )

    fun startPathfindingForMarker(target: GisRegistryItem?) {
        selectedMarker = null
        val chosen = target ?: pathfindingTarget ?: filteredMarkers.firstOrNull() ?: markers.firstOrNull()
        pathfindingTarget = chosen
        if (locationController.permissionLevel != LocationPermissionLevel.DENIED) {
            if (userLocation == null) {
                val fix = readBestDeviceLocation(context) ?: LocationFix(GeoPoint(41.2995, 69.2401), 15.0)
                userLocation = fix.point
                lastAccuracyM = fix.accuracyMeters
            }
            showPathfindingSheet = true
        } else {
            pendingRouteGps = true
            locationController.requestTrackingStart()
        }
    }

    LiveLocationUpdatesEffect(
        enabled = isTrackingLocation || emergencyMode || pathfindingTarget != null,
        permissionLevel = locationController.permissionLevel
    ) { fix, usedFallback ->
        val firstFix = userLocation == null
        userLocation = fix.point
        lastAccuracyM = fix.accuracyMeters
        if (isTrackingLocation) {
            viewport = MapViewport(
                centerLat = fix.point.lat,
                centerLon = fix.point.lon,
                zoom = viewport.zoom.coerceAtLeast(10f)
            )
        }
        if (usedFallback && firstFix && isTrackingLocation) {
            onShowMessage("${L10n.text(locale, "accuracy")}: ±${"%.1f".format(fix.accuracyMeters)} m")
        }
    }

    LaunchedEffect(emergencyMode, locationController.permissionLevel) {
        if (emergencyMode && locationController.permissionLevel != LocationPermissionLevel.DENIED) {
            val fix = readBestDeviceLocation(context)
            if (fix != null) {
                userLocation = fix.point
                lastAccuracyM = fix.accuracyMeters
            }
        }
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val useExtendedFab = maxWidth >= 410.dp

        // Live Uzbekistan MapLibre vector map with automatic offline fallback
        GisSdkPlaceholderView(
            locale = locale,
            markers = filteredMarkers,
            regions = regions,
            darkTheme = state.darkTheme,
            offlineMode = state.isEffectiveOffline,
            viewport = viewport,
            onViewportChange = { viewport = it },
            measurePoints = measurePoints,
            userLocation = userLocation,
            emergencyPin = emergencyPin,
            emergencyModeActive = emergencyMode,
            activeRoutePoints = activeRoute?.pathPoints.orEmpty(),
            activeRouteWarning = activeRoute != null && (
                activeRoute.accessibilityStatus == RouteAccessibilityStatus.ACCESSIBLE_WITH_CAUTION ||
                    activeRoute.accessibilityStatus == RouteAccessibilityStatus.RESTRICTED_LAST_MILE
                ),
            downloadPreviewBounds = downloadPreviewBounds,
            savedAreaBounds = savedOfflineAreas.map { it.bounds },
            hasCachedOfflineAreas = savedOfflineAreas.any { it.isComplete },
            hasLocationPermission = locationController.permissionLevel != LocationPermissionLevel.DENIED,
            isTrackingLocation = isTrackingLocation,
            onUserGestureStoppedTracking = { isTrackingLocation = false },
            selectedMarkerId = selectedMarker?.id,
            onMarkerTap = { marker -> selectedMarker = marker },
            onClusterTap = { cluster ->
                if (viewport.zoom < 10f) {
                    viewport = MapViewport(
                        centerLat = cluster.center.lat,
                        centerLon = cluster.center.lon,
                        zoom = (viewport.zoom * 2.5f).coerceIn(3.5f, 15f)
                    )
                } else {
                    activeCluster = cluster
                }
            },
            onMapTap = if (measureMode && !emergencyMode) { pt ->
                measurePoints = measurePoints + pt
            } else null,
            onMapLongPress = if (emergencyMode) { pt ->
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                emergencyPin = pt
            } else null,
            onSdkBadgeClick = { showSdkInfoSheet = true },
            modifier = Modifier.fillMaxSize()
        )

        // Search bar & category filter chip group above the map
        MapSearchOverlay(
            locale = locale,
            searchQuery = search,
            onSearchQueryChange = { search = it },
            visibleGroups = visibleGroups,
            groupCounts = groupCounts,
            onToggleGroup = { group ->
                visibleGroups = if (group in visibleGroups) visibleGroups - group else visibleGroups + group
            },
            onShowAllGroups = {
                visibleGroups = RegistryCategoryGroup.entries.toSet()
            },
            hasActiveSheetFilters = filterRegionId != null || filterCategoryId != null || filterStatus != null,
            onOpenFiltersSheet = { showFiltersSheet = true },
            modifier = Modifier.align(Alignment.TopCenter)
        )

        // Emergency mode active instructions banner beneath search & chip overlay
        AnimatedVisibility(
            visible = emergencyMode,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically(),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(start = 14.dp, end = 14.dp, top = 132.dp)
                .widthIn(max = 580.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.96f),
                border = BorderStroke(1.5.dp, MaterialTheme.colorScheme.error),
                tonalElevation = 6.dp,
                shadowElevation = 6.dp,
                modifier = Modifier.testTag("map_emergency_banner")
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.ReportProblem,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = L10n.text(locale, "emergencyModeActive"),
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.ExtraBold),
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = {
                                emergencyMode = false
                                emergencyPin = null
                            },
                            modifier = Modifier
                                .minimumInteractiveComponentSize()
                                .testTag("emergency_banner_close")
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Close,
                                contentDescription = L10n.text(locale, "cancel"),
                                tint = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                    Text(
                        text = L10n.text(locale, "emergencyLongPressHint"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        FilledTonalButton(
                            onClick = {
                                if (locationController.permissionLevel == LocationPermissionLevel.DENIED) {
                                    pendingDropAtGps = true
                                    locationController.requestTrackingStart()
                                } else {
                                    val fix = readBestDeviceLocation(context)
                                        ?: LocationFix(userLocation ?: GeoPoint(41.2995, 69.2401), 15.0)
                                    userLocation = fix.point
                                    lastAccuracyM = fix.accuracyMeters
                                    emergencyPin = fix.point
                                    viewport = MapViewport(
                                        centerLat = fix.point.lat,
                                        centerLon = fix.point.lon,
                                        zoom = viewport.zoom.coerceAtLeast(10f)
                                    )
                                }
                            },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                            modifier = Modifier
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("emergency_drop_at_gps_button")
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.MyLocation,
                                contentDescription = stringResource(R.string.content_desc_emergency_pin),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = L10n.text(locale, "emergencyDropAtMyGps"),
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                        Button(
                            onClick = { dialPhone(context, "112") },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error,
                                contentColor = MaterialTheme.colorScheme.onError
                            ),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                            modifier = Modifier
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("emergency_call_112_button")
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Call,
                                contentDescription = stringResource(R.string.content_desc_dial_112),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text("112", fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            }
        }

        // Compact right-side map controls (Emergency, Zoom, GPS, Measure, Reset)
        Surface(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 14.dp),
            shape = RoundedCornerShape(18.dp),
            tonalElevation = 4.dp,
            shadowElevation = 4.dp,
            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)
        ) {
            Column(
                modifier = Modifier.padding(4.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                FilledIconToggleButton(
                    checked = emergencyMode,
                    onCheckedChange = { active ->
                        emergencyMode = active
                        if (active) {
                            measureMode = false
                            measurePoints = emptyList()
                            onShowMessage(L10n.text(locale, "emergencyLongPressHint"))
                        } else {
                            emergencyPin = null
                        }
                    },
                    colors = IconButtonDefaults.filledIconToggleButtonColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.45f),
                        contentColor = MaterialTheme.colorScheme.error,
                        checkedContainerColor = MaterialTheme.colorScheme.error,
                        checkedContentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("map_emergency_mode_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.ReportProblem,
                        contentDescription = stringResource(R.string.content_desc_emergency_mode)
                    )
                }
                HorizontalDivider(modifier = Modifier.width(28.dp))
                IconButton(
                    onClick = { viewport = viewport.copy(zoom = (viewport.zoom * 1.6f).coerceAtMost(40f)) },
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("map_zoom_in")
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = "Zoom in")
                }
                IconButton(
                    onClick = { viewport = viewport.copy(zoom = (viewport.zoom / 1.6f).coerceAtLeast(0.75f)) },
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("map_zoom_out")
                ) {
                    Icon(Icons.Outlined.Remove, contentDescription = "Zoom out")
                }
                HorizontalDivider(modifier = Modifier.width(28.dp))
                FilledTonalIconToggleButton(
                    checked = isTrackingLocation,
                    onCheckedChange = { wantTrack ->
                        if (wantTrack) {
                            locationController.requestTrackingStart()
                        } else {
                            isTrackingLocation = false
                            onShowMessage(L10n.text(locale, "gpsTrackingStopped"))
                        }
                    },
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("map_gps_button")
                ) {
                    Icon(
                        imageVector = if (isTrackingLocation) Icons.Outlined.GpsFixed else Icons.Outlined.MyLocation,
                        contentDescription = stringResource(R.string.content_desc_gps)
                    )
                }
                FilledTonalIconToggleButton(
                    checked = activeRoute != null || showPathfindingSheet,
                    onCheckedChange = {
                        if (showPathfindingSheet) {
                            showPathfindingSheet = false
                        } else {
                            startPathfindingForMarker(selectedMarker ?: pathfindingTarget)
                        }
                    },
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("map_pathfinding_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.AltRoute,
                        contentDescription = stringResource(R.string.content_desc_pathfinding)
                    )
                }
                FilledTonalIconToggleButton(
                    checked = measureMode,
                    onCheckedChange = {
                        measureMode = it
                        measurePoints = emptyList()
                        if (it) {
                            emergencyMode = false
                            emergencyPin = null
                        }
                    },
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("map_measure_button")
                ) {
                    Icon(Icons.Outlined.Straighten, contentDescription = stringResource(R.string.content_desc_measure))
                }
                FilledTonalIconToggleButton(
                    checked = showDownloadAreaSheet,
                    onCheckedChange = { showDownloadAreaSheet = it },
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("map_download_area_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.DownloadForOffline,
                        contentDescription = stringResource(R.string.content_desc_download_area)
                    )
                }
                IconButton(
                    onClick = { viewport = MapViewport() },
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("map_reset_button")
                ) {
                    Icon(Icons.Outlined.CenterFocusWeak, contentDescription = stringResource(R.string.content_desc_refresh))
                }
            }
        }

        // Bottom-left stacked Active Route HUD (if active) & marker count card
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 14.dp, bottom = 16.dp, end = if (useExtendedFab) 196.dp else 88.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (activeRoute != null && !showPathfindingSheet) {
                val distText = if (activeRoute.totalDistanceMeters < 1000.0) {
                    "${activeRoute.totalDistanceMeters.toInt()} m"
                } else {
                    "${"%.2f".format(activeRoute.totalDistanceMeters / 1000.0)} km"
                }
                val isWarn = activeRoute.accessibilityStatus == RouteAccessibilityStatus.ACCESSIBLE_WITH_CAUTION ||
                    activeRoute.accessibilityStatus == RouteAccessibilityStatus.RESTRICTED_LAST_MILE
                ElevatedCard(
                    onClick = { showPathfindingSheet = true },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.elevatedCardColors(
                        containerColor = if (isWarn) {
                            MaterialTheme.colorScheme.tertiaryContainer
                        } else {
                            MaterialTheme.colorScheme.secondaryContainer
                        }
                    ),
                    modifier = Modifier.testTag("map_active_route_hud")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.AltRoute,
                            contentDescription = null,
                            tint = if (isWarn) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        Column(modifier = Modifier.weight(1f, fill = false)) {
                            Text(
                                text = "$distText · ${activeRoute.estimatedMinutes} ${L10n.text(locale, "etaMinutes")} → ${activeRoute.destinationCode}",
                                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.ExtraBold),
                                color = if (isWarn) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSecondaryContainer
                            )
                            Text(
                                text = "${L10n.text(locale, activeRoute.vehicleProfile.labelKey)} · ${L10n.text(locale, activeRoute.accessibilityStatus.labelKey)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isWarn) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                        IconButton(
                            onClick = { pathfindingTarget = null },
                            modifier = Modifier
                                .minimumInteractiveComponentSize()
                                .testTag("map_active_route_clear")
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Close,
                                contentDescription = L10n.text(locale, "clearRoute"),
                                tint = if (isWarn) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                    }
                }
            }

            if (queuedEmergencyReports.isNotEmpty()) {
                ElevatedCard(
                    onClick = onOpenSyncQueue,
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.elevatedCardColors(
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer
                    ),
                    modifier = Modifier.testTag("map_queued_reports_hud")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CloudUpload,
                            contentDescription = stringResource(R.string.content_desc_queued_reports),
                            tint = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                        Column {
                            Text(
                                text = "${queuedEmergencyReports.size} · ${L10n.text(locale, "queuedReportsBadge")}",
                                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.ExtraBold),
                                color = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                            Text(
                                text = L10n.text(
                                    locale,
                                    if (state.syncing) "sync" else "waitingForNetworkHint"
                                ),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                        }
                    }
                }
            }

            ElevatedCard(
                onClick = { showMarkersListSheet = true },
                modifier = Modifier.testTag("map_markers_list_button"),
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Place,
                        contentDescription = stringResource(R.string.content_desc_markers_list),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Column {
                        Text(
                            text = if (measureMode) {
                                val distStr = if (measuredMeters < 1000) "${measuredMeters.toInt()} m"
                                else "${"%.2f".format(measuredMeters / 1000.0)} km"
                                "${L10n.text(locale, "measure")}: $distStr (${measurePoints.size})"
                            } else {
                                "${filteredMarkers.size} · ${L10n.text(locale, if (state.isEmployee) "operationalMap" else "publicMap")}"
                            },
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.ExtraBold)
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = if (isTrackingLocation && lastAccuracyM != null) {
                                "${L10n.text(locale, "gpsTrackingActive")} · ±${"%.0f".format(lastAccuracyM)} m"
                            } else {
                                "© OpenStreetMap contributors · ODbL"
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isTrackingLocation) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Primary Floating Action Button to add new registry items
        if (useExtendedFab) {
            ExtendedFloatingActionButton(
                onClick = onAddRegistryItem,
                icon = {
                    Icon(
                        imageVector = Icons.Outlined.AddLocationAlt,
                        contentDescription = stringResource(R.string.content_desc_add_registry_item)
                    )
                },
                text = {
                    Text(
                        text = L10n.text(locale, "addRegistryItem"),
                        fontWeight = FontWeight.Bold
                    )
                },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
                    .testTag("map_add_registry_fab")
            )
        } else {
            FloatingActionButton(
                onClick = onAddRegistryItem,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
                    .testTag("map_add_registry_fab")
            ) {
                Icon(
                    imageVector = Icons.Outlined.AddLocationAlt,
                    contentDescription = stringResource(R.string.content_desc_add_registry_item)
                )
            }
        }
    }

    // Precise location permission rationale / settings flow dialog
    locationController.dialogContent()

    // Instant Emergency Incident Report bottom sheet when a long-press pin is dropped
    emergencyPin?.let { pin ->
        EmergencyReportSheet(
            locale = locale,
            pinLocation = pin,
            currentUserLocation = userLocation,
            currentAccuracyM = lastAccuracyM,
            regions = regions,
            submitting = isSubmittingEmergency,
            isOffline = state.isEffectiveOffline,
            onRequestCaptureGps = {
                if (locationController.permissionLevel == LocationPermissionLevel.DENIED) {
                    locationController.requestTrackingStart()
                } else {
                    val fix = readBestDeviceLocation(context)
                        ?: LocationFix(userLocation ?: GeoPoint(41.2995, 69.2401), 15.0)
                    userLocation = fix.point
                    lastAccuracyM = fix.accuracyMeters
                }
            },
            onClearPin = { emergencyPin = null },
            onSubmitIncident = { categoryId, hazardTitle, notes, regionId ->
                isSubmittingEmergency = true
                onSubmitEmergencyIncident(
                    pin,
                    userLocation,
                    categoryId,
                    hazardTitle,
                    notes,
                    regionId
                ) { result ->
                    isSubmittingEmergency = false
                    emergencyPin = null
                    emergencyMode = false
                    viewport = MapViewport(
                        centerLat = pin.lat,
                        centerLon = pin.lon,
                        zoom = viewport.zoom.coerceAtLeast(10f)
                    )
                    val msgKey = if (result.queuedOffline) "emergencyQueuedMsg" else "emergencySubmittedMsg"
                    onShowMessage("${result.code} · ${L10n.text(locale, msgKey)}")
                }
            }
        )
    }

    // Markers state list bottom sheet (also used when tapping a dense cluster at high zoom)
    val sheetMarkers = activeCluster?.items ?: if (showMarkersListSheet) filteredMarkers else null
    if (sheetMarkers != null) {
        val sheetTitle = if (activeCluster != null) L10n.text(locale, "clusterObjects") else L10n.text(locale, "markersList")
        ModalBottomSheet(
            onDismissRequest = {
                showMarkersListSheet = false
                activeCluster = null
            }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 520.dp)
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = sheetTitle,
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "${sheetMarkers.size}",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                if (sheetMarkers.isEmpty()) {
                    EmptyPanel(locale = locale)
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 20.dp)
                    ) {
                        items(sheetMarkers, key = { it.id }) { marker ->
                            ElevatedCard(
                                onClick = {
                                    viewport = MapViewport(
                                        centerLat = marker.markerCoordinate.lat,
                                        centerLon = marker.markerCoordinate.lon,
                                        zoom = 8f
                                    )
                                    selectedMarker = marker
                                    showMarkersListSheet = false
                                    activeCluster = null
                                },
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("map_marker_list_item_${marker.id}")
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.LocationOn,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "${marker.code} · ${marker.categoryName}",
                                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        Text(
                                            text = marker.name,
                                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.ExtraBold)
                                        )
                                        Spacer(Modifier.height(4.dp))
                                        Text(
                                            text = "${marker.regionName} · ${"%.4f".format(marker.markerCoordinate.lat)}, ${"%.4f".format(marker.markerCoordinate.lon)}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    StatusPill(marker.operationalStatus, locale)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // GIS SDK Placeholder integration details bottom sheet
    if (showSdkInfoSheet) {
        ModalBottomSheet(onDismissRequest = { showSdkInfoSheet = false }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Layers,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = L10n.text(locale, "gisSdkStatusTitle"),
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold)
                    )
                }
                Text(
                    text = L10n.text(locale, "realMapHint"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                DataRowView(L10n.text(locale, "gisSdkEngine"), L10n.text(locale, "realMapEngineValue"))
                DataRowView(
                    L10n.text(locale, "gisSdkTarget"),
                    if (state.isEffectiveOffline) L10n.text(locale, "realMapOfflineBadge") else L10n.text(locale, "realMapBadge")
                )
                DataRowView(L10n.text(locale, "markersList"), "${filteredMarkers.size}")
                DataRowView(
                    L10n.text(locale, "coordinates"),
                    "${"%.5f".format(viewport.centerLat)}° N, ${"%.5f".format(viewport.centerLon)}° E"
                )
                DataRowView(L10n.text(locale, "savedOfflineAreas"), "${savedOfflineAreas.size}")
                Button(
                    onClick = {
                        showSdkInfoSheet = false
                        showDownloadAreaSheet = true
                    },
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .testTag("sdk_info_download_area_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.DownloadForOffline,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(L10n.text(locale, "downloadArea"), fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(12.dp))
            }
        }
    }

    // Download Area / Offline Map Tile Packs bottom sheet
    if (showDownloadAreaSheet) {
        val activeBounds = downloadPreviewBounds ?: OfflineTileEstimator.boundsForViewport(viewport)
        DownloadAreaSheet(
            locale = locale,
            regions = regions,
            currentViewport = viewport,
            savedAreas = savedOfflineAreas,
            creatingDownload = creatingOfflineArea,
            selectedAreaMode = downloadAreaMode,
            selectedRegionId = downloadRegionId,
            selectedPreset = downloadPreset,
            previewBounds = activeBounds,
            onSelectMode = { mode ->
                downloadAreaMode = mode
                if (mode == DownloadAreaMode.REGION) {
                    val reg = regions.firstOrNull { it.id == downloadRegionId } ?: regions.firstOrNull()
                    if (reg != null) {
                        viewport = MapViewport(reg.centerLat, reg.centerLon, zoom = 4.5f)
                    }
                }
            },
            onSelectRegion = { regId ->
                downloadRegionId = regId
                regions.firstOrNull { it.id == regId }?.let { reg ->
                    viewport = MapViewport(reg.centerLat, reg.centerLon, zoom = 4.5f)
                }
            },
            onSelectPreset = { preset -> downloadPreset = preset },
            onStartDownload = { areaName ->
                offlineController.startDownload(
                    name = areaName,
                    styleUrl = openFreeMapStyleUrl(state.darkTheme),
                    bounds = activeBounds,
                    minZoom = downloadPreset.minZoom,
                    maxZoom = downloadPreset.maxZoom,
                    pixelRatio = density.density.coerceIn(1f, 2f),
                    onComplete = { record ->
                        onShowMessage("${record.name} · ${L10n.text(locale, "downloadCompletedMsg")}")
                    },
                    onError = { err ->
                        onShowMessage(err)
                    }
                )
            },
            onTogglePauseResume = { areaId ->
                offlineController.togglePauseResume(areaId)
            },
            onJumpToArea = { area ->
                val center = area.bounds.center
                val mlZoom = ((area.minZoom + area.maxZoom) / 2.0).coerceIn(5.0, 14.0)
                val canvasZoom = 2.0.pow((mlZoom - 4.7) / 2.2).toFloat().coerceIn(0.75f, 40f)
                viewport = MapViewport(
                    centerLat = center.lat,
                    centerLon = center.lon,
                    zoom = canvasZoom
                )
                showDownloadAreaSheet = false
            },
            onDeleteArea = { areaId ->
                offlineController.deleteArea(
                    areaId = areaId,
                    onDeleted = { onShowMessage(L10n.text(locale, "downloadDeletedMsg")) },
                    onError = { err -> onShowMessage(err) }
                )
            },
            onDismiss = { showDownloadAreaSheet = false }
        )
    }

    // Emergency Vehicle Shortest Path bottom sheet
    if (showPathfindingSheet) {
        PathfindingSheet(
            locale = locale,
            originLocation = userLocation,
            destinationMarker = pathfindingTarget,
            availableMarkers = filteredMarkers.ifEmpty { markers },
            selectedProfile = vehicleProfile,
            avoidFaultyHazards = avoidFaultyHazards,
            pathResult = activeRoute,
            onSelectDestination = { target -> pathfindingTarget = target },
            onSelectProfile = { profile -> vehicleProfile = profile },
            onToggleAvoidHazards = { avoidFaultyHazards = it },
            onRequestGpsFix = {
                if (locationController.permissionLevel == LocationPermissionLevel.DENIED) {
                    pendingRouteGps = true
                    locationController.requestTrackingStart()
                } else {
                    val fix = readBestDeviceLocation(context)
                        ?: LocationFix(userLocation ?: GeoPoint(41.2995, 69.2401), 15.0)
                    userLocation = fix.point
                    lastAccuracyM = fix.accuracyMeters
                }
            },
            onClearRoute = {
                pathfindingTarget = null
                showPathfindingSheet = false
            },
            onShowOnMap = {
                activeRoute?.let { focusMapOnRoute(it) }
                showPathfindingSheet = false
            },
            onDismiss = { showPathfindingSheet = false }
        )
    }

    // Selected registry item marker detail bottom sheet
    selectedMarker?.let { marker ->
        RegistryMarkerDetailSheet(
            marker = marker,
            locale = locale,
            isEmployee = state.isEmployee,
            onDismiss = { selectedMarker = null },
            onCenterOnMarker = { target ->
                viewport = MapViewport(
                    centerLat = target.markerCoordinate.lat,
                    centerLon = target.markerCoordinate.lon,
                    zoom = 8f
                )
                selectedMarker = null
            },
            onFindRoute = { target ->
                startPathfindingForMarker(target)
            },
            onOpenPassport = { id ->
                selectedMarker = null
                onOpenPassport(id)
            }
        )
    }

    // Layers / Filter bottom sheet
    if (showFiltersSheet) {
        ModalBottomSheet(onDismissRequest = { showFiltersSheet = false }) {
            var rExp by remember { mutableStateOf(false) }
            var cExp by remember { mutableStateOf(false) }
            var sExp by remember { mutableStateOf(false) }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(L10n.text(locale, "layers"), style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold))

                ExposedDropdownMenuBox(expanded = rExp, onExpandedChange = { rExp = !rExp }) {
                    val regLabel = filterRegionId?.let { id -> regions.firstOrNull { it.id == id }?.localizedName(locale.code) }
                        ?: L10n.text(locale, "all")
                    OutlinedTextField(
                        value = regLabel,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(L10n.text(locale, "region")) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(rExp) },
                        modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                    )
                    ExposedDropdownMenu(expanded = rExp, onDismissRequest = { rExp = false }) {
                        DropdownMenuItem(text = { Text(L10n.text(locale, "all")) }, onClick = { filterRegionId = null; rExp = false })
                        regions.forEach { r ->
                            DropdownMenuItem(
                                text = { Text(r.localizedName(locale.code)) },
                                onClick = {
                                    filterRegionId = r.id
                                    viewport = MapViewport(r.centerLat, r.centerLon, zoom = 6f)
                                    rExp = false
                                }
                            )
                        }
                    }
                }

                ExposedDropdownMenuBox(expanded = cExp, onExpandedChange = { cExp = !cExp }) {
                    val catLabel = filterCategoryId?.let { id -> categories.firstOrNull { it.id == id }?.localizedName(locale.code) }
                        ?: L10n.text(locale, "all")
                    OutlinedTextField(
                        value = catLabel,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(L10n.text(locale, "category")) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(cExp) },
                        modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                    )
                    ExposedDropdownMenu(expanded = cExp, onDismissRequest = { cExp = false }) {
                        DropdownMenuItem(text = { Text(L10n.text(locale, "all")) }, onClick = { filterCategoryId = null; cExp = false })
                        categories.forEach { c ->
                            DropdownMenuItem(
                                text = { Text(c.localizedName(locale.code)) },
                                onClick = { filterCategoryId = c.id; cExp = false }
                            )
                        }
                    }
                }

                ExposedDropdownMenuBox(expanded = sExp, onExpandedChange = { sExp = !sExp }) {
                    val stLabel = filterStatus?.let { L10n.text(locale, it) } ?: L10n.text(locale, "all")
                    OutlinedTextField(
                        value = stLabel,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(L10n.text(locale, "status")) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(sExp) },
                        modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                    )
                    ExposedDropdownMenu(expanded = sExp, onDismissRequest = { sExp = false }) {
                        DropdownMenuItem(text = { Text(L10n.text(locale, "all")) }, onClick = { filterStatus = null; sExp = false })
                        listOf("working", "faulty", "under_maintenance", "temporarily_unavailable", "not_inspected", "unknown").forEach { s ->
                            DropdownMenuItem(
                                text = { Text(L10n.text(locale, s)) },
                                onClick = { filterStatus = s; sExp = false }
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            visibleGroups = RegistryCategoryGroup.entries.toSet()
                            filterRegionId = null
                            filterCategoryId = null
                            filterStatus = null
                            viewport = MapViewport()
                            showFiltersSheet = false
                        },
                        modifier = Modifier.weight(1f).height(52.dp)
                    ) { Text(L10n.text(locale, "all")) }
                    Button(
                        onClick = { showFiltersSheet = false },
                        modifier = Modifier.weight(1f).height(52.dp)
                    ) { Text(L10n.text(locale, "verify")) }
                }
                Spacer(Modifier.height(12.dp))
            }
        }
    }
}
