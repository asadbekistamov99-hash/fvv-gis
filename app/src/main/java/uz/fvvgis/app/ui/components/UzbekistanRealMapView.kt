package uz.fvvgis.app.ui.components

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color as AndroidColor
import android.os.Bundle
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.location.LocationComponentActivationOptions
import org.maplibre.android.location.modes.CameraMode
import org.maplibre.android.location.modes.RenderMode
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.*
import org.maplibre.android.style.sources.GeoJsonOptions
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point
import org.maplibre.geojson.Polygon
import uz.fvvgis.app.core.GeoBounds
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.ParsedGeometry
import uz.fvvgis.app.data.model.GisRegistryItem
import uz.fvvgis.app.data.model.MarkerCluster
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.pow

private const val STYLE_LIGHT_URL = "https://tiles.openfreemap.org/styles/liberty"
private const val STYLE_DARK_URL = "https://tiles.openfreemap.org/styles/dark"

fun openFreeMapStyleUrl(darkTheme: Boolean): String = if (darkTheme) STYLE_DARK_URL else STYLE_LIGHT_URL

private const val GEOMETRIES_SOURCE_ID = "fvv-geometries-source"
private const val MARKERS_SOURCE_ID = "fvv-markers-source"
private const val OVERLAY_SOURCE_ID = "fvv-overlay-source"

private const val POLYGONS_LAYER_ID = "fvv-polygons-layer"
private const val LINES_LAYER_ID = "fvv-lines-layer"
private const val CLUSTERS_HALO_LAYER_ID = "fvv-clusters-halo"
private const val CLUSTERS_CIRCLE_LAYER_ID = "fvv-clusters-circle"
private const val CLUSTERS_COUNT_LAYER_ID = "fvv-clusters-count"
private const val UNCLUSTERED_MARKERS_LAYER_ID = "fvv-unclustered-markers"
private const val UNCLUSTERED_LABELS_LAYER_ID = "fvv-unclustered-labels"
private const val MEASURE_LINE_LAYER_ID = "fvv-measure-line-layer"
private const val MEASURE_POINTS_LAYER_ID = "fvv-measure-points-layer"
private const val USER_GPS_HALO_LAYER_ID = "fvv-gps-halo-layer"
private const val USER_GPS_DOT_LAYER_ID = "fvv-gps-dot-layer"
private const val EMERGENCY_PIN_HALO_LAYER_ID = "fvv-emergency-pin-halo-layer"
private const val EMERGENCY_PIN_CORE_LAYER_ID = "fvv-emergency-pin-core-layer"
private const val ROUTE_CASING_LAYER_ID = "fvv-active-route-casing"
private const val ROUTE_LINE_LAYER_ID = "fvv-active-route-line"
private const val ROUTE_DEST_LAYER_ID = "fvv-active-route-dest"
private const val OFFLINE_SAVED_FILL_LAYER_ID = "fvv-offline-saved-fill"
private const val OFFLINE_SAVED_LINE_LAYER_ID = "fvv-offline-saved-line"
private const val OFFLINE_PREVIEW_FILL_LAYER_ID = "fvv-offline-preview-fill"
private const val OFFLINE_PREVIEW_LINE_LAYER_ID = "fvv-offline-preview-line"

private fun canvasZoomToMapLibre(canvasZoom: Float): Double {
    val log2 = ln(canvasZoom.toDouble().coerceAtLeast(0.5)) / ln(2.0)
    return (4.7 + 2.2 * log2).coerceIn(3.5, 18.5)
}

private fun mapLibreZoomToCanvas(mlZoom: Double): Float {
    return 2.0.pow((mlZoom - 4.7) / 2.2).toFloat().coerceIn(0.75f, 40f)
}

private fun statusHexColor(status: String): String = when (status) {
    "working" -> "#16A34A"
    "faulty" -> "#DC2626"
    "under_maintenance" -> "#D97706"
    "temporarily_unavailable" -> "#EA580C"
    "not_inspected" -> "#0284C7"
    else -> "#64748B"
}

private fun buildGeometryFeatureCollection(markers: List<GisRegistryItem>): FeatureCollection {
    val features = mutableListOf<Feature>()
    for (item in markers) {
        val hex = statusHexColor(item.operationalStatus)
        when (val geom = item.parsedGeometry) {
            is ParsedGeometry.LineString -> {
                if (geom.points.size >= 2) {
                    val pts = geom.points.map { Point.fromLngLat(it.lon, it.lat) }
                    val f = Feature.fromGeometry(LineString.fromLngLats(pts))
                    f.addStringProperty("color", hex)
                    f.addStringProperty("id", item.id)
                    features.add(f)
                }
            }
            is ParsedGeometry.Polygon -> {
                val rings = geom.rings.mapNotNull { ring ->
                    if (ring.size >= 3) {
                        val closed = if (ring.first() == ring.last()) ring else ring + ring.first()
                        closed.map { Point.fromLngLat(it.lon, it.lat) }
                    } else null
                }
                if (rings.isNotEmpty()) {
                    val f = Feature.fromGeometry(Polygon.fromLngLats(rings))
                    f.addStringProperty("color", hex)
                    f.addStringProperty("id", item.id)
                    features.add(f)
                }
            }
            is ParsedGeometry.Point -> Unit
        }
    }
    return FeatureCollection.fromFeatures(features)
}

private fun buildMarkerFeatureCollection(
    markers: List<GisRegistryItem>,
    selectedMarkerId: String?
): FeatureCollection {
    val features = markers.map { item ->
        val f = Feature.fromGeometry(
            Point.fromLngLat(item.markerCoordinate.lon, item.markerCoordinate.lat)
        )
        f.addStringProperty("id", item.id)
        f.addStringProperty("code", item.code)
        f.addStringProperty("color", statusHexColor(item.operationalStatus))
        f.addBooleanProperty("selected", item.id == selectedMarkerId)
        f
    }
    return FeatureCollection.fromFeatures(features)
}

private fun buildOverlayFeatureCollection(
    measurePoints: List<GeoPoint>,
    userLocation: GeoPoint?,
    emergencyPin: GeoPoint?,
    activeRoutePoints: List<GeoPoint>,
    activeRouteWarning: Boolean,
    downloadPreviewBounds: GeoBounds?,
    savedAreaBounds: List<GeoBounds>
): FeatureCollection {
    val features = mutableListOf<Feature>()
    savedAreaBounds.forEach { b ->
        val ring = b.toPolygonRing().map { Point.fromLngLat(it.lon, it.lat) }
        val pf = Feature.fromGeometry(Polygon.fromLngLats(listOf(ring)))
        pf.addStringProperty("kind", "saved_offline_bounds")
        features.add(pf)
    }
    if (downloadPreviewBounds != null) {
        val ring = downloadPreviewBounds.toPolygonRing().map { Point.fromLngLat(it.lon, it.lat) }
        val pf = Feature.fromGeometry(Polygon.fromLngLats(listOf(ring)))
        pf.addStringProperty("kind", "download_preview_bounds")
        features.add(pf)
    }
    if (activeRoutePoints.size >= 2) {
        val routeColor = if (activeRouteWarning) "#F59E0B" else "#10B981"
        val rf = Feature.fromGeometry(
            LineString.fromLngLats(activeRoutePoints.map { Point.fromLngLat(it.lon, it.lat) })
        )
        rf.addStringProperty("kind", "active_route")
        rf.addStringProperty("routeColor", routeColor)
        features.add(rf)

        val destPt = activeRoutePoints.last()
        val df = Feature.fromGeometry(Point.fromLngLat(destPt.lon, destPt.lat))
        df.addStringProperty("kind", "route_dest")
        df.addStringProperty("routeColor", routeColor)
        features.add(df)
    }
    if (measurePoints.size >= 2) {
        val f = Feature.fromGeometry(
            LineString.fromLngLats(measurePoints.map { Point.fromLngLat(it.lon, it.lat) })
        )
        f.addStringProperty("kind", "measure_line")
        features.add(f)
    }
    measurePoints.forEach { pt ->
        val f = Feature.fromGeometry(Point.fromLngLat(pt.lon, pt.lat))
        f.addStringProperty("kind", "measure_point")
        features.add(f)
    }
    if (userLocation != null) {
        val f = Feature.fromGeometry(Point.fromLngLat(userLocation.lon, userLocation.lat))
        f.addStringProperty("kind", "user_gps")
        features.add(f)
    }
    if (emergencyPin != null) {
        val f = Feature.fromGeometry(Point.fromLngLat(emergencyPin.lon, emergencyPin.lat))
        f.addStringProperty("kind", "emergency_pin")
        features.add(f)
    }
    return FeatureCollection.fromFeatures(features)
}

private fun installOrUpdateStyleLayers(
    style: Style,
    markers: List<GisRegistryItem>,
    selectedMarkerId: String?,
    measurePoints: List<GeoPoint>,
    userLocation: GeoPoint?,
    emergencyPin: GeoPoint?,
    activeRoutePoints: List<GeoPoint>,
    activeRouteWarning: Boolean,
    downloadPreviewBounds: GeoBounds?,
    savedAreaBounds: List<GeoBounds>,
    darkTheme: Boolean
) {
    val geomFc = buildGeometryFeatureCollection(markers)
    val markersFc = buildMarkerFeatureCollection(markers, selectedMarkerId)
    val overlayFc = buildOverlayFeatureCollection(
        measurePoints = measurePoints,
        userLocation = userLocation,
        emergencyPin = emergencyPin,
        activeRoutePoints = activeRoutePoints,
        activeRouteWarning = activeRouteWarning,
        downloadPreviewBounds = downloadPreviewBounds,
        savedAreaBounds = savedAreaBounds
    )

    val existingGeom = style.getSourceAs<GeoJsonSource>(GEOMETRIES_SOURCE_ID)
    if (existingGeom != null) {
        existingGeom.setGeoJson(geomFc)
    } else {
        style.addSource(GeoJsonSource(GEOMETRIES_SOURCE_ID, geomFc))
        style.addLayer(
            FillLayer(POLYGONS_LAYER_ID, GEOMETRIES_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.geometryType(), Expression.literal("Polygon")))
                setProperties(
                    PropertyFactory.fillColor(Expression.get("color")),
                    PropertyFactory.fillOpacity(0.24f)
                )
            }
        )
        style.addLayer(
            LineLayer(LINES_LAYER_ID, GEOMETRIES_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.geometryType(), Expression.literal("LineString")))
                setProperties(
                    PropertyFactory.lineColor(Expression.get("color")),
                    PropertyFactory.lineWidth(3.5f),
                    PropertyFactory.lineCap(Property.LINE_CAP_ROUND),
                    PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND)
                )
            }
        )
    }

    val existingMarkers = style.getSourceAs<GeoJsonSource>(MARKERS_SOURCE_ID)
    if (existingMarkers != null) {
        existingMarkers.setGeoJson(markersFc)
    } else {
        style.addSource(
            GeoJsonSource(
                MARKERS_SOURCE_ID,
                markersFc,
                GeoJsonOptions()
                    .withCluster(true)
                    .withClusterRadius(48)
                    .withClusterMaxZoom(13)
            )
        )
        style.addLayer(
            CircleLayer(CLUSTERS_HALO_LAYER_ID, MARKERS_SOURCE_ID).apply {
                setFilter(Expression.has("point_count"))
                setProperties(
                    PropertyFactory.circleColor(AndroidColor.parseColor("#0D9488")),
                    PropertyFactory.circleOpacity(0.25f),
                    PropertyFactory.circleRadius(
                        Expression.step(
                            Expression.get("point_count"),
                            Expression.literal(22f),
                            Expression.stop(5, Expression.literal(26f)),
                            Expression.stop(15, Expression.literal(30f))
                        )
                    )
                )
            }
        )
        style.addLayer(
            CircleLayer(CLUSTERS_CIRCLE_LAYER_ID, MARKERS_SOURCE_ID).apply {
                setFilter(Expression.has("point_count"))
                setProperties(
                    PropertyFactory.circleColor(
                        Expression.step(
                            Expression.get("point_count"),
                            Expression.color(AndroidColor.parseColor("#0D9488")),
                            Expression.stop(5, Expression.color(AndroidColor.parseColor("#0284C7"))),
                            Expression.stop(15, Expression.color(AndroidColor.parseColor("#D97706")))
                        )
                    ),
                    PropertyFactory.circleRadius(
                        Expression.step(
                            Expression.get("point_count"),
                            Expression.literal(16f),
                            Expression.stop(5, Expression.literal(19f)),
                            Expression.stop(15, Expression.literal(22f))
                        )
                    ),
                    PropertyFactory.circleStrokeWidth(2.5f),
                    PropertyFactory.circleStrokeColor(AndroidColor.WHITE)
                )
            }
        )
        style.addLayer(
            SymbolLayer(CLUSTERS_COUNT_LAYER_ID, MARKERS_SOURCE_ID).apply {
                setFilter(Expression.has("point_count"))
                setProperties(
                    PropertyFactory.textField(Expression.toString(Expression.get("point_count"))),
                    PropertyFactory.textFont(arrayOf("Noto Sans Bold")),
                    PropertyFactory.textSize(13f),
                    PropertyFactory.textColor(AndroidColor.WHITE),
                    PropertyFactory.textIgnorePlacement(true),
                    PropertyFactory.textAllowOverlap(true)
                )
            }
        )
        style.addLayer(
            CircleLayer(UNCLUSTERED_MARKERS_LAYER_ID, MARKERS_SOURCE_ID).apply {
                setFilter(Expression.not(Expression.has("point_count")))
                setProperties(
                    PropertyFactory.circleColor(Expression.get("color")),
                    PropertyFactory.circleRadius(
                        Expression.switchCase(
                            Expression.eq(Expression.get("selected"), Expression.literal(true)),
                            Expression.literal(11f),
                            Expression.literal(7.5f)
                        )
                    ),
                    PropertyFactory.circleStrokeWidth(2.5f),
                    PropertyFactory.circleStrokeColor(AndroidColor.WHITE)
                )
            }
        )
        style.addLayer(
            SymbolLayer(UNCLUSTERED_LABELS_LAYER_ID, MARKERS_SOURCE_ID).apply {
                minZoom = 10.5f
                setFilter(Expression.not(Expression.has("point_count")))
                setProperties(
                    PropertyFactory.textField(Expression.get("code")),
                    PropertyFactory.textFont(arrayOf("Noto Sans Bold")),
                    PropertyFactory.textSize(11f),
                    PropertyFactory.textOffset(arrayOf(0f, 1.45f)),
                    PropertyFactory.textAnchor(Property.TEXT_ANCHOR_TOP),
                    PropertyFactory.textColor(
                        if (darkTheme) AndroidColor.WHITE else AndroidColor.parseColor("#0F172A")
                    ),
                    PropertyFactory.textHaloColor(
                        if (darkTheme) AndroidColor.parseColor("#0F172A") else AndroidColor.WHITE
                    ),
                    PropertyFactory.textHaloWidth(1.5f),
                    PropertyFactory.textOptional(true)
                )
            }
        )
    }

    val existingOverlay = style.getSourceAs<GeoJsonSource>(OVERLAY_SOURCE_ID)
    if (existingOverlay != null) {
        existingOverlay.setGeoJson(overlayFc)
    } else {
        style.addSource(GeoJsonSource(OVERLAY_SOURCE_ID, overlayFc))
        style.addLayer(
            LineLayer(MEASURE_LINE_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("measure_line")))
                setProperties(
                    PropertyFactory.lineColor(AndroidColor.parseColor("#0EA5E9")),
                    PropertyFactory.lineWidth(3f),
                    PropertyFactory.lineDasharray(arrayOf(3f, 2f))
                )
            }
        )
        style.addLayer(
            CircleLayer(MEASURE_POINTS_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("measure_point")))
                setProperties(
                    PropertyFactory.circleColor(AndroidColor.parseColor("#F59E0B")),
                    PropertyFactory.circleRadius(6.5f),
                    PropertyFactory.circleStrokeWidth(2f),
                    PropertyFactory.circleStrokeColor(AndroidColor.WHITE)
                )
            }
        )
        style.addLayer(
            CircleLayer(USER_GPS_HALO_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("user_gps")))
                setProperties(
                    PropertyFactory.circleColor(AndroidColor.parseColor("#06B6D4")),
                    PropertyFactory.circleOpacity(0.28f),
                    PropertyFactory.circleRadius(18f)
                )
            }
        )
        style.addLayer(
            CircleLayer(USER_GPS_DOT_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("user_gps")))
                setProperties(
                    PropertyFactory.circleColor(AndroidColor.parseColor("#0284C7")),
                    PropertyFactory.circleRadius(7f),
                    PropertyFactory.circleStrokeWidth(2.5f),
                    PropertyFactory.circleStrokeColor(AndroidColor.WHITE)
                )
            }
        )
        style.addLayer(
            CircleLayer(EMERGENCY_PIN_HALO_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("emergency_pin")))
                setProperties(
                    PropertyFactory.circleColor(AndroidColor.parseColor("#DC2626")),
                    PropertyFactory.circleOpacity(0.32f),
                    PropertyFactory.circleRadius(24f)
                )
            }
        )
        style.addLayer(
            LineLayer(ROUTE_CASING_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("active_route")))
                setProperties(
                    PropertyFactory.lineColor(AndroidColor.parseColor("#081320")),
                    PropertyFactory.lineWidth(8.5f),
                    PropertyFactory.lineCap(Property.LINE_CAP_ROUND),
                    PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND)
                )
            }
        )
        style.addLayer(
            LineLayer(ROUTE_LINE_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("active_route")))
                setProperties(
                    PropertyFactory.lineColor(Expression.get("routeColor")),
                    PropertyFactory.lineWidth(4.5f),
                    PropertyFactory.lineCap(Property.LINE_CAP_ROUND),
                    PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND)
                )
            }
        )
        style.addLayer(
            CircleLayer(ROUTE_DEST_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("route_dest")))
                setProperties(
                    PropertyFactory.circleColor(Expression.get("routeColor")),
                    PropertyFactory.circleRadius(10f),
                    PropertyFactory.circleStrokeWidth(3f),
                    PropertyFactory.circleStrokeColor(AndroidColor.WHITE)
                )
            }
        )
        style.addLayer(
            FillLayer(OFFLINE_SAVED_FILL_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("saved_offline_bounds")))
                setProperties(
                    PropertyFactory.fillColor(AndroidColor.parseColor("#10B981")),
                    PropertyFactory.fillOpacity(0.08f)
                )
            }
        )
        style.addLayer(
            LineLayer(OFFLINE_SAVED_LINE_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("saved_offline_bounds")))
                setProperties(
                    PropertyFactory.lineColor(AndroidColor.parseColor("#10B981")),
                    PropertyFactory.lineWidth(1.5f),
                    PropertyFactory.lineDasharray(arrayOf(4f, 3f))
                )
            }
        )
        style.addLayer(
            FillLayer(OFFLINE_PREVIEW_FILL_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("download_preview_bounds")))
                setProperties(
                    PropertyFactory.fillColor(AndroidColor.parseColor("#0EA5E9")),
                    PropertyFactory.fillOpacity(0.16f)
                )
            }
        )
        style.addLayer(
            LineLayer(OFFLINE_PREVIEW_LINE_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("download_preview_bounds")))
                setProperties(
                    PropertyFactory.lineColor(AndroidColor.parseColor("#0284C7")),
                    PropertyFactory.lineWidth(2.8f),
                    PropertyFactory.lineDasharray(arrayOf(3f, 2f))
                )
            }
        )
        style.addLayer(
            CircleLayer(EMERGENCY_PIN_CORE_LAYER_ID, OVERLAY_SOURCE_ID).apply {
                setFilter(Expression.eq(Expression.get("kind"), Expression.literal("emergency_pin")))
                setProperties(
                    PropertyFactory.circleColor(AndroidColor.parseColor("#DC2626")),
                    PropertyFactory.circleRadius(10.5f),
                    PropertyFactory.circleStrokeWidth(3f),
                    PropertyFactory.circleStrokeColor(AndroidColor.WHITE)
                )
            }
        )
    }
}

@SuppressLint("MissingPermission")
private fun syncLocationComponent(
    context: Context,
    map: MapLibreMap,
    style: Style,
    hasPermission: Boolean,
    isTracking: Boolean
) {
    if (!hasPermission || !style.isFullyLoaded) return
    val lc = map.locationComponent
    runCatching {
        if (!lc.isLocationComponentActivated) {
            val options = LocationComponentActivationOptions.builder(context, style)
                .useDefaultLocationEngine(true)
                .build()
            lc.activateLocationComponent(options)
        }
        lc.isLocationComponentEnabled = true
        lc.renderMode = RenderMode.COMPASS
        lc.cameraMode = if (isTracking) CameraMode.TRACKING else CameraMode.NONE
    }
}

@Composable
fun UzbekistanRealMapView(
    markers: List<GisRegistryItem>,
    darkTheme: Boolean,
    viewport: MapViewport,
    onViewportChange: (MapViewport) -> Unit,
    measurePoints: List<GeoPoint>,
    userLocation: GeoPoint?,
    emergencyPin: GeoPoint? = null,
    activeRoutePoints: List<GeoPoint> = emptyList(),
    activeRouteWarning: Boolean = false,
    downloadPreviewBounds: GeoBounds? = null,
    savedAreaBounds: List<GeoBounds> = emptyList(),
    hasLocationPermission: Boolean = false,
    isTrackingLocation: Boolean = false,
    onUserGestureStoppedTracking: () -> Unit = {},
    selectedMarkerId: String?,
    onMarkerTap: (GisRegistryItem) -> Unit,
    onClusterTap: (MarkerCluster) -> Unit,
    onMapTap: ((GeoPoint) -> Unit)?,
    onMapLongPress: ((GeoPoint) -> Unit)? = null,
    onMapLoadFailed: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    remember(context) { MapLibre.getInstance(context) }

    val currentMarkers by rememberUpdatedState(markers)
    val currentSelectedId by rememberUpdatedState(selectedMarkerId)
    val currentMeasurePoints by rememberUpdatedState(measurePoints)
    val currentUserLocation by rememberUpdatedState(userLocation)
    val currentEmergencyPin by rememberUpdatedState(emergencyPin)
    val currentRoutePoints by rememberUpdatedState(activeRoutePoints)
    val currentRouteWarning by rememberUpdatedState(activeRouteWarning)
    val currentPreviewBounds by rememberUpdatedState(downloadPreviewBounds)
    val currentSavedBounds by rememberUpdatedState(savedAreaBounds)
    val currentHasLocationPerm by rememberUpdatedState(hasLocationPermission)
    val currentIsTracking by rememberUpdatedState(isTrackingLocation)
    val currentOnStopTracking by rememberUpdatedState(onUserGestureStoppedTracking)
    val currentOnMarkerTap by rememberUpdatedState(onMarkerTap)
    val currentOnClusterTap by rememberUpdatedState(onClusterTap)
    val currentOnMapTap by rememberUpdatedState(onMapTap)
    val currentOnMapLongPress by rememberUpdatedState(onMapLongPress)
    val currentOnViewportChange by rememberUpdatedState(onViewportChange)
    val currentOnLoadFailed by rememberUpdatedState(onMapLoadFailed)

    var mapController by remember { mutableStateOf<MapLibreMap?>(null) }
    var loadedStyleDark by remember { mutableStateOf<Boolean?>(null) }
    var isProgrammaticCameraMove by remember { mutableStateOf(false) }

    val mapView = remember(context) {
        val options = MapLibreMapOptions.createFromAttributes(context)
            .textureMode(true)
        MapView(context, options).apply {
            onCreate(Bundle())
            addOnDidFailLoadingMapListener {
                currentOnLoadFailed()
            }
        }
    }

    DisposableEffect(lifecycleOwner, mapView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            mapView.onPause()
            mapView.onStop()
            mapView.onDestroy()
        }
    }

    LaunchedEffect(mapView) {
        mapView.getMapAsync { map ->
            mapController = map
            map.setLatLngBoundsForCameraTarget(
                LatLngBounds.Builder()
                    .include(LatLng(35.0, 53.5))
                    .include(LatLng(47.5, 75.5))
                    .build()
            )
            map.setMinZoomPreference(3.5)
            map.setMaxZoomPreference(18.5)
            map.uiSettings.apply {
                isLogoEnabled = false
                isAttributionEnabled = false
                isCompassEnabled = false
            }
            map.cameraPosition = CameraPosition.Builder()
                .target(LatLng(viewport.centerLat, viewport.centerLon))
                .zoom(canvasZoomToMapLibre(viewport.zoom))
                .build()

            map.addOnCameraMoveStartedListener { reason ->
                if (reason == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE && currentIsTracking) {
                    currentOnStopTracking()
                }
            }

            map.addOnCameraIdleListener {
                if (isProgrammaticCameraMove) {
                    isProgrammaticCameraMove = false
                    return@addOnCameraIdleListener
                }
                val pos = map.cameraPosition
                val target = pos.target ?: return@addOnCameraIdleListener
                val next = MapViewport(
                    centerLat = target.latitude,
                    centerLon = target.longitude,
                    zoom = mapLibreZoomToCanvas(pos.zoom)
                )
                currentOnViewportChange(next)
            }

            map.addOnMapClickListener { latLng ->
                val tapHook = currentOnMapTap
                if (tapHook != null) {
                    tapHook(GeoPoint(latLng.latitude, latLng.longitude))
                    return@addOnMapClickListener true
                }
                val screenPoint = map.projection.toScreenLocation(latLng)
                val markerFeatures = map.queryRenderedFeatures(screenPoint, UNCLUSTERED_MARKERS_LAYER_ID)
                val hitId = markerFeatures.firstOrNull()?.getStringProperty("id")
                if (hitId != null) {
                    val found = currentMarkers.firstOrNull { it.id == hitId }
                    if (found != null) {
                        currentOnMarkerTap(found)
                        return@addOnMapClickListener true
                    }
                }
                val clusterFeatures = map.queryRenderedFeatures(screenPoint, CLUSTERS_CIRCLE_LAYER_ID)
                val clusterFeat = clusterFeatures.firstOrNull()
                if (clusterFeat != null) {
                    val camZoom = map.cameraPosition.zoom
                    val count = clusterFeat.getNumberProperty("point_count")?.toInt() ?: 2
                    if (camZoom < 12.5) {
                        map.animateCamera(
                            CameraUpdateFactory.newLatLngZoom(
                                latLng,
                                (camZoom + 2.4).coerceAtMost(15.0)
                            ),
                            380
                        )
                    } else {
                        val nearby = currentMarkers.sortedBy { m ->
                            val dLat = m.markerCoordinate.lat - latLng.latitude
                            val dLon = m.markerCoordinate.lon - latLng.longitude
                            dLat * dLat + dLon * dLon
                        }.take(count.coerceAtLeast(2))
                        if (nearby.isNotEmpty()) {
                            currentOnClusterTap(
                                MarkerCluster(
                                    id = "ml_cluster_${latLng.latitude}_${latLng.longitude}",
                                    center = GeoPoint(latLng.latitude, latLng.longitude),
                                    items = nearby
                                )
                            )
                        }
                    }
                    return@addOnMapClickListener true
                }
                false
            }

            map.addOnMapLongClickListener { latLng ->
                val longPressHook = currentOnMapLongPress
                if (longPressHook != null) {
                    longPressHook(GeoPoint(latLng.latitude, latLng.longitude))
                    true
                } else {
                    false
                }
            }
        }
    }

    // Apply or switch Light/Dark OpenFreeMap vector style when controller or theme changes
    LaunchedEffect(mapController, darkTheme) {
        val map = mapController ?: return@LaunchedEffect
        if (loadedStyleDark == darkTheme) return@LaunchedEffect
        val styleUrl = if (darkTheme) STYLE_DARK_URL else STYLE_LIGHT_URL
        map.setStyle(Style.Builder().fromUri(styleUrl)) { style ->
            loadedStyleDark = darkTheme
            installOrUpdateStyleLayers(
                style = style,
                markers = currentMarkers,
                selectedMarkerId = currentSelectedId,
                measurePoints = currentMeasurePoints,
                userLocation = currentUserLocation,
                emergencyPin = currentEmergencyPin,
                activeRoutePoints = currentRoutePoints,
                activeRouteWarning = currentRouteWarning,
                downloadPreviewBounds = currentPreviewBounds,
                savedAreaBounds = currentSavedBounds,
                darkTheme = darkTheme
            )
            syncLocationComponent(
                context = context,
                map = map,
                style = style,
                hasPermission = currentHasLocationPerm,
                isTracking = currentIsTracking
            )
        }
    }

    // Update GeoJSON sources dynamically whenever markers, selection, measure points, GPS, emergency pin, route, or offline bounds change
    LaunchedEffect(
        mapController,
        markers,
        selectedMarkerId,
        measurePoints,
        userLocation,
        emergencyPin,
        activeRoutePoints,
        activeRouteWarning,
        downloadPreviewBounds,
        savedAreaBounds
    ) {
        val map = mapController ?: return@LaunchedEffect
        val style = map.style ?: return@LaunchedEffect
        if (!style.isFullyLoaded) return@LaunchedEffect
        installOrUpdateStyleLayers(
            style = style,
            markers = markers,
            selectedMarkerId = selectedMarkerId,
            measurePoints = measurePoints,
            userLocation = userLocation,
            emergencyPin = emergencyPin,
            activeRoutePoints = activeRoutePoints,
            activeRouteWarning = activeRouteWarning,
            downloadPreviewBounds = downloadPreviewBounds,
            savedAreaBounds = savedAreaBounds,
            darkTheme = darkTheme
        )
    }

    // Sync MapLibre LocationComponent when permission or tracking state changes
    LaunchedEffect(mapController, hasLocationPermission, isTrackingLocation) {
        val map = mapController ?: return@LaunchedEffect
        val style = map.style ?: return@LaunchedEffect
        syncLocationComponent(
            context = context,
            map = map,
            style = style,
            hasPermission = hasLocationPermission,
            isTracking = isTrackingLocation
        )
    }

    // Sync programmatic viewport changes (Zoom +/-, Reset, GPS, Region jump, Center on marker)
    LaunchedEffect(mapController, viewport.centerLat, viewport.centerLon, viewport.zoom) {
        val map = mapController ?: return@LaunchedEffect
        val cam = map.cameraPosition
        val camTarget = cam.target
        val desiredZoom = canvasZoomToMapLibre(viewport.zoom)
        val sameTarget = camTarget != null &&
            abs(camTarget.latitude - viewport.centerLat) < 0.0004 &&
            abs(camTarget.longitude - viewport.centerLon) < 0.0004 &&
            abs(cam.zoom - desiredZoom) < 0.08
        if (!sameTarget) {
            isProgrammaticCameraMove = true
            map.animateCamera(
                CameraUpdateFactory.newLatLngZoom(
                    LatLng(viewport.centerLat, viewport.centerLon),
                    desiredZoom
                ),
                320
            )
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = { mapView },
            modifier = Modifier.fillMaxSize()
        )
    }
}
