package uz.fvvgis.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.OfflinePin
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.R
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.GeoBounds
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.RegionEntity
import uz.fvvgis.app.data.model.GisRegistryItem
import uz.fvvgis.app.data.model.MarkerCluster

/**
 * Unified GIS map viewport hosting the real MapLibre OpenStreetMap vector map
 * of Uzbekistan (`UzbekistanRealMapView`) when online or when cached offline tile
 * packs are present, with seamless fallback to the offline `UzbekistanGisCanvas`
 * contour map if offline mode is active without downloaded tiles or tiles fail to load.
 */
@Composable
fun GisSdkPlaceholderView(
    locale: AppLocale,
    markers: List<GisRegistryItem>,
    regions: List<RegionEntity>,
    darkTheme: Boolean,
    offlineMode: Boolean,
    viewport: MapViewport,
    onViewportChange: (MapViewport) -> Unit,
    measurePoints: List<GeoPoint>,
    userLocation: GeoPoint?,
    emergencyPin: GeoPoint? = null,
    emergencyModeActive: Boolean = false,
    activeRoutePoints: List<GeoPoint> = emptyList(),
    activeRouteWarning: Boolean = false,
    downloadPreviewBounds: GeoBounds? = null,
    savedAreaBounds: List<GeoBounds> = emptyList(),
    hasCachedOfflineAreas: Boolean = false,
    hasLocationPermission: Boolean = false,
    isTrackingLocation: Boolean = false,
    onUserGestureStoppedTracking: () -> Unit = {},
    selectedMarkerId: String?,
    onMarkerTap: (GisRegistryItem) -> Unit,
    onClusterTap: (MarkerCluster) -> Unit,
    onMapTap: ((GeoPoint) -> Unit)?,
    onMapLongPress: ((GeoPoint) -> Unit)? = null,
    onSdkBadgeClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var mapLoadFailed by remember(offlineMode) { mutableStateOf(false) }
    val useOfflineFallback = (offlineMode && !hasCachedOfflineAreas) || mapLoadFailed

    Box(
        modifier = modifier
            .fillMaxSize()
            .testTag("gis_sdk_placeholder_view")
    ) {
        if (!useOfflineFallback) {
            UzbekistanRealMapView(
                markers = markers,
                darkTheme = darkTheme,
                viewport = viewport,
                onViewportChange = onViewportChange,
                measurePoints = measurePoints,
                userLocation = userLocation,
                emergencyPin = emergencyPin,
                activeRoutePoints = activeRoutePoints,
                activeRouteWarning = activeRouteWarning,
                downloadPreviewBounds = downloadPreviewBounds,
                savedAreaBounds = savedAreaBounds,
                hasLocationPermission = hasLocationPermission,
                isTrackingLocation = isTrackingLocation,
                onUserGestureStoppedTracking = onUserGestureStoppedTracking,
                selectedMarkerId = selectedMarkerId,
                onMarkerTap = onMarkerTap,
                onClusterTap = onClusterTap,
                onMapTap = onMapTap,
                onMapLongPress = onMapLongPress,
                onMapLoadFailed = { mapLoadFailed = true },
                modifier = Modifier.fillMaxSize()
            )
        } else {
            UzbekistanGisCanvas(
                markers = markers,
                regions = regions,
                localeCode = locale.code,
                darkTheme = darkTheme,
                viewport = viewport,
                onViewportChange = onViewportChange,
                measurePoints = measurePoints,
                routePoints = activeRoutePoints,
                routeIsWarning = activeRouteWarning,
                userLocation = userLocation,
                emergencyPin = emergencyPin,
                downloadPreviewBounds = downloadPreviewBounds,
                savedAreaBounds = savedAreaBounds,
                selectedObjectId = selectedMarkerId,
                onMarkerTap = onMarkerTap,
                onClusterTap = onClusterTap,
                onMapTap = onMapTap,
                onMapLongPress = onMapLongPress,
                modifier = Modifier.fillMaxSize()
            )
        }

        // Clickable live Uzbekistan Map / Cached Offline Tiles / Offline Contour badge
        if (!emergencyModeActive) {
            val badgeIcon = when {
                useOfflineFallback -> Icons.Outlined.CloudOff
                offlineMode && hasCachedOfflineAreas -> Icons.Outlined.OfflinePin
                else -> Icons.Outlined.Public
            }
            val badgeKey = when {
                useOfflineFallback -> "realMapOfflineBadge"
                offlineMode && hasCachedOfflineAreas -> "realMapCachedOfflineBadge"
                else -> "realMapBadge"
            }
            Surface(
                onClick = onSdkBadgeClick,
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                tonalElevation = 2.dp,
                shadowElevation = 2.dp,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 14.dp, top = 132.dp)
                    .testTag("map_sdk_placeholder_badge")
            ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = badgeIcon,
                    contentDescription = stringResource(R.string.content_desc_gis_sdk_info),
                    tint = if (useOfflineFallback) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = L10n.text(locale, badgeKey),
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${markers.size} ${L10n.text(locale, "markerCount")} · ${"%.2f".format(viewport.centerLat)}, ${"%.2f".format(viewport.centerLon)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        }
    }
}
