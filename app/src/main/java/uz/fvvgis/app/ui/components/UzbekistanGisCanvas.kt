package uz.fvvgis.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import uz.fvvgis.app.core.GeoBounds
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.GeoUtils
import uz.fvvgis.app.core.ParsedGeometry
import uz.fvvgis.app.data.local.InfrastructureObjectEntity
import uz.fvvgis.app.data.local.RegionEntity
import uz.fvvgis.app.data.model.GisRegistryItem
import uz.fvvgis.app.data.model.MarkerCluster
import uz.fvvgis.app.ui.theme.GisColors
import uz.fvvgis.app.ui.theme.statusColor
import kotlin.math.hypot
import kotlin.math.min

data class MapViewport(
    val centerLat: Double = 41.35,
    val centerLon: Double = 64.55,
    val zoom: Float = 1.0f // 1.0 fits all of Uzbekistan comfortably
)

private fun projectGeoPoint(pt: GeoPoint, size: IntSize, vp: MapViewport): Offset {
    if (size.width == 0 || size.height == 0) return Offset.Zero
    val baseLonSpan = 18.5
    val pxPerDegLon = (size.width / baseLonSpan) * vp.zoom
    val cosLat = 0.75 // cos(~41 deg)
    val pxPerDegLat = pxPerDegLon / cosLat
    val x = size.width / 2f + ((pt.lon - vp.centerLon) * pxPerDegLon).toFloat()
    val y = size.height / 2f - ((pt.lat - vp.centerLat) * pxPerDegLat).toFloat()
    return Offset(x, y)
}

private fun unprojectOffset(offset: Offset, size: IntSize, vp: MapViewport): GeoPoint {
    if (size.width == 0 || size.height == 0) return GeoPoint(41.299, 69.240)
    val baseLonSpan = 18.5
    val pxPerDegLon = (size.width / baseLonSpan) * vp.zoom
    val cosLat = 0.75
    val pxPerDegLat = pxPerDegLon / cosLat
    val lon = vp.centerLon + (offset.x - size.width / 2f) / pxPerDegLon
    val lat = vp.centerLat - (offset.y - size.height / 2f) / pxPerDegLat
    return GeoPoint(lat.coerceIn(35.0, 48.0), lon.coerceIn(53.0, 76.0))
}

private fun clusterMarkersByProximity(
    markers: List<GisRegistryItem>,
    size: IntSize,
    viewport: MapViewport,
    clusterRadiusPx: Float
): List<MarkerCluster> {
    if (markers.isEmpty()) return emptyList()
    if (size.width == 0 || size.height == 0 || viewport.zoom >= 14f || clusterRadiusPx <= 0f) {
        return markers.map { item ->
            MarkerCluster(id = item.id, center = item.markerCoordinate, items = listOf(item))
        }
    }

    val buckets = mutableListOf<Pair<Offset, MutableList<GisRegistryItem>>>()
    for (item in markers) {
        val pos = projectGeoPoint(item.markerCoordinate, size, viewport)
        var targetIndex = -1
        var bestDist = clusterRadiusPx
        for (i in buckets.indices) {
            val anchor = buckets[i].first
            val d = hypot(pos.x - anchor.x, pos.y - anchor.y)
            if (d <= bestDist) {
                bestDist = d
                targetIndex = i
            }
        }
        if (targetIndex >= 0) {
            buckets[targetIndex].second.add(item)
        } else {
            buckets.add(pos to mutableListOf(item))
        }
    }

    return buckets.mapIndexed { idx, (_, group) ->
        val avgLat = group.map { it.markerCoordinate.lat }.average()
        val avgLon = group.map { it.markerCoordinate.lon }.average()
        MarkerCluster(
            id = if (group.size == 1) group.first().id else "cluster_${idx}_${group.first().id}",
            center = GeoPoint(avgLat, avgLon),
            items = group
        )
    }
}

@Composable
fun UzbekistanGisCanvas(
    objects: List<InfrastructureObjectEntity> = emptyList(),
    markers: List<GisRegistryItem> = emptyList(),
    regions: List<RegionEntity>,
    localeCode: String,
    darkTheme: Boolean,
    viewport: MapViewport,
    onViewportChange: (MapViewport) -> Unit,
    measurePoints: List<GeoPoint> = emptyList(),
    routePoints: List<GeoPoint> = emptyList(),
    routeIsWarning: Boolean = false,
    pickedVertices: List<GeoPoint> = emptyList(),
    userLocation: GeoPoint? = null,
    emergencyPin: GeoPoint? = null,
    downloadPreviewBounds: GeoBounds? = null,
    savedAreaBounds: List<GeoBounds> = emptyList(),
    selectedObjectId: String? = null,
    onFeatureTap: ((InfrastructureObjectEntity) -> Unit)? = null,
    onMarkerTap: ((GisRegistryItem) -> Unit)? = null,
    onClusterTap: ((MarkerCluster) -> Unit)? = null,
    onMapTap: ((GeoPoint) -> Unit)? = null,
    onMapLongPress: ((GeoPoint) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val textMeasurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val clusterRadiusPx = with(density) { 46.dp.toPx() }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    val currentViewport by rememberUpdatedState(viewport)
    val currentOnMapTap by rememberUpdatedState(onMapTap)
    val currentOnMapLongPress by rememberUpdatedState(onMapLongPress)
    val currentOnMarkerTap by rememberUpdatedState(onMarkerTap)
    val currentOnClusterTap by rememberUpdatedState(onClusterTap)
    val currentOnFeatureTap by rememberUpdatedState(onFeatureTap)

    val parsedObjects = remember(objects) {
        objects.mapNotNull { obj ->
            GeoUtils.parseGeoJson(obj.geometryJson)?.let { obj to it }
        }
    }

    val clusters = remember(markers, canvasSize, viewport, clusterRadiusPx) {
        clusterMarkersByProximity(markers, canvasSize, viewport, clusterRadiusPx)
    }
    val currentClusters by rememberUpdatedState(clusters)

    val bgColor = if (darkTheme) Color(0xFF091826) else Color(0xFFE6EEF4)
    val gridColor = if (darkTheme) Color(0xFF17314A) else Color(0xFFCBDAE6)
    val landFill = if (darkTheme) Color(0xFF102438) else Color(0xFFF5F9FC)
    val borderColor = if (darkTheme) Color(0xFF2D6580) else Color(0xFF5D89A3)
    val waterFill = if (darkTheme) Color(0xFF0C344D) else Color(0xFFC5E3F5)
    val labelColor = if (darkTheme) Color(0xFF8BB7CE) else Color(0xFF395B72)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(bgColor)
            .onSizeChanged { canvasSize = it }
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoomChange, _ ->
                    val vp = currentViewport
                    val newZoom = (vp.zoom * zoomChange).coerceIn(0.75f, 40f)
                    val baseLonSpan = 18.5
                    val pxPerDegLon = (canvasSize.width.coerceAtLeast(1) / baseLonSpan) * newZoom
                    val pxPerDegLat = pxPerDegLon / 0.75
                    val newLon = (vp.centerLon - pan.x / pxPerDegLon).coerceIn(55.0, 74.0)
                    val newLat = (vp.centerLat + pan.y / pxPerDegLat).coerceIn(36.5, 46.0)
                    onViewportChange(vp.copy(centerLat = newLat, centerLon = newLon, zoom = newZoom))
                }
            }
            .pointerInput(parsedObjects) {
                detectTapGestures(
                    onLongPress = { longOffset ->
                        val longHook = currentOnMapLongPress ?: return@detectTapGestures
                        val vp = currentViewport
                        val geo = unprojectOffset(longOffset, canvasSize, vp)
                        longHook(geo)
                    },
                    onTap = { tapOffset ->
                        val vp = currentViewport
                        val tapHook = currentOnMapTap
                        if (tapHook != null) {
                            val tappedGeo = unprojectOffset(tapOffset, canvasSize, vp)
                            tapHook(tappedGeo)
                            return@detectTapGestures
                        }
                        val activeClusters = currentClusters
                        val markerTapHook = currentOnMarkerTap
                        val clusterTapHook = currentOnClusterTap
                        if ((markerTapHook != null || clusterTapHook != null) && activeClusters.isNotEmpty()) {
                            var closest: MarkerCluster? = null
                            var bestDist = with(density) { 28.dp.toPx() }
                            for (cluster in activeClusters) {
                                val repOffset = projectGeoPoint(cluster.center, canvasSize, vp)
                                val dist = hypot(repOffset.x - tapOffset.x, repOffset.y - tapOffset.y)
                                if (dist < bestDist) {
                                    bestDist = dist
                                    closest = cluster
                                }
                            }
                            if (closest != null) {
                                if (closest.isCluster) {
                                    clusterTapHook?.invoke(closest)
                                } else {
                                    markerTapHook?.invoke(closest.primaryItem)
                                }
                            }
                            return@detectTapGestures
                        }
                        val featureTapHook = currentOnFeatureTap
                        if (featureTapHook != null) {
                            var closest: InfrastructureObjectEntity? = null
                            var bestDist = with(density) { 26.dp.toPx() }
                            for ((obj, geom) in parsedObjects) {
                                val repOffset = projectGeoPoint(geom.representativePoint(), canvasSize, vp)
                                val dist = hypot(repOffset.x - tapOffset.x, repOffset.y - tapOffset.y)
                                if (dist < bestDist) {
                                    bestDist = dist
                                    closest = obj
                                }
                            }
                            if (closest != null) {
                                featureTapHook(closest)
                            }
                        }
                    }
                )
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val intSize = IntSize(w.toInt(), h.toInt())

            // Coordinate Graticule
            val lonStep = if (viewport.zoom > 6f) 0.5 else if (viewport.zoom > 2.5f) 1.0 else 2.0
            var lon = 54.0
            while (lon <= 75.0) {
                val x = projectGeoPoint(GeoPoint(41.0, lon), intSize, viewport).x
                if (x in -50f..(w + 50f)) {
                    drawLine(gridColor, Offset(x, 0f), Offset(x, h), strokeWidth = 1f)
                }
                lon += lonStep
            }
            var lat = 36.0
            while (lat <= 46.5) {
                val y = projectGeoPoint(GeoPoint(lat, 64.0), intSize, viewport).y
                if (y in -50f..(h + 50f)) {
                    drawLine(gridColor, Offset(0f, y), Offset(w, y), strokeWidth = 1f)
                }
                lat += lonStep
            }

            // Uzbekistan national boundary fill & outline
            val borderPath = Path()
            GeoUtils.uzbekistanBorder.forEachIndexed { idx, pt ->
                val p = projectGeoPoint(pt, intSize, viewport)
                if (idx == 0) borderPath.moveTo(p.x, p.y) else borderPath.lineTo(p.x, p.y)
            }
            borderPath.close()
            drawPath(borderPath, color = landFill)
            drawPath(borderPath, color = borderColor, style = Stroke(width = 2.5f))

            // Water bodies (Aral & Aydar Lake)
            listOf(GeoUtils.aralContour, GeoUtils.aydarLakeContour).forEach { poly ->
                val wp = Path()
                poly.forEachIndexed { idx, pt ->
                    val p = projectGeoPoint(pt, intSize, viewport)
                    if (idx == 0) wp.moveTo(p.x, p.y) else wp.lineTo(p.x, p.y)
                }
                wp.close()
                drawPath(wp, color = waterFill)
                drawPath(wp, color = borderColor.copy(alpha = 0.5f), style = Stroke(width = 1.5f))
            }

            // Regional centers & labels
            regions.forEach { region ->
                val p = projectGeoPoint(GeoPoint(region.centerLat, region.centerLon), intSize, viewport)
                if (p.x in -40f..(w + 40f) && p.y in -40f..(h + 40f)) {
                    drawCircle(color = borderColor.copy(alpha = 0.45f), radius = 3.5f, center = p)
                    val labelLayout = textMeasurer.measure(
                        text = region.localizedName(localeCode).substringBefore(" "),
                        style = TextStyle(color = labelColor, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                    )
                    drawText(labelLayout, topLeft = Offset(p.x + 6f, p.y - 12f))
                }
            }

            fun drawSpatialGeometry(geom: ParsedGeometry, color: Color, isSelected: Boolean) {
                when (geom) {
                    is ParsedGeometry.Polygon -> {
                        geom.rings.forEach { ring ->
                            val path = Path()
                            ring.forEachIndexed { i, pt ->
                                val p = projectGeoPoint(pt, intSize, viewport)
                                if (i == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y)
                            }
                            path.close()
                            drawPath(path, color = color.copy(alpha = 0.26f))
                            drawPath(path, color = color, style = Stroke(width = if (isSelected) 5f else 2.5f))
                        }
                    }
                    is ParsedGeometry.LineString -> {
                        val path = Path()
                        geom.points.forEachIndexed { i, pt ->
                            val p = projectGeoPoint(pt, intSize, viewport)
                            if (i == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y)
                        }
                        drawPath(
                            path,
                            color = color,
                            style = Stroke(width = if (isSelected) 9f else 5.5f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                        )
                    }
                    is ParsedGeometry.Point -> Unit
                }
            }

            if (clusters.isNotEmpty()) {
                // Draw spatial footprints at medium/high zoom
                if (viewport.zoom >= 2.2f) {
                    markers.forEach { marker ->
                        val color = statusColor(marker.operationalStatus)
                        val isSelected = marker.id == selectedObjectId
                        drawSpatialGeometry(marker.parsedGeometry, color, isSelected)
                    }
                }

                clusters.forEach { cluster ->
                    val p = projectGeoPoint(cluster.center, intSize, viewport)
                    if (p.x !in -60f..(w + 60f) || p.y !in -60f..(h + 60f)) return@forEach

                    if (cluster.isCluster) {
                        val hasSelected = cluster.items.any { it.id == selectedObjectId }
                        val clusterColor = statusColor(cluster.worstStatus)
                        val extra = min(cluster.count, 20) * 0.35f
                        val outerR = (18f + extra).dp.toPx()
                        val ringR = (15.5f + extra).dp.toPx()
                        val coreR = (13f + extra).dp.toPx()

                        drawCircle(
                            color = clusterColor.copy(alpha = if (hasSelected) 0.35f else 0.20f),
                            radius = outerR,
                            center = p
                        )
                        drawCircle(
                            color = if (darkTheme) Color(0xFF081320) else Color.White,
                            radius = ringR,
                            center = p
                        )
                        drawCircle(
                            color = clusterColor,
                            radius = coreR,
                            center = p
                        )
                        val countText = textMeasurer.measure(
                            text = "${cluster.count}",
                            style = TextStyle(
                                color = Color(0xFF081320),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        )
                        drawText(
                            textLayoutResult = countText,
                            topLeft = Offset(
                                p.x - countText.size.width / 2f,
                                p.y - countText.size.height / 2f
                            )
                        )
                    } else {
                        val marker = cluster.primaryItem
                        val color = statusColor(marker.operationalStatus)
                        val isSelected = marker.id == selectedObjectId
                        if (isSelected) {
                            drawCircle(color = color.copy(alpha = 0.28f), radius = 16.dp.toPx(), center = p)
                        }
                        drawCircle(
                            color = if (darkTheme) Color(0xFF081320) else Color.White,
                            radius = (if (isSelected) 9.5f else 7.2f).dp.toPx(),
                            center = p
                        )
                        drawCircle(
                            color = color,
                            radius = (if (isSelected) 7.5f else 5.5f).dp.toPx(),
                            center = p
                        )
                        drawCircle(
                            color = Color.White.copy(alpha = 0.88f),
                            radius = (if (isSelected) 2.5f else 1.8f).dp.toPx(),
                            center = p
                        )

                        if (isSelected || viewport.zoom >= 3.0f) {
                            val badge = textMeasurer.measure(
                                text = marker.code,
                                style = TextStyle(
                                    color = if (darkTheme) Color(0xFFF3F8FB) else Color(0xFF0D2030),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            val boxLeft = p.x + 11.dp.toPx()
                            val boxTop = p.y - badge.size.height / 2f - 3.dp.toPx()
                            drawRoundRect(
                                color = (if (darkTheme) Color(0xFF0E2336) else Color.White).copy(alpha = 0.92f),
                                topLeft = Offset(boxLeft, boxTop),
                                size = Size(badge.size.width + 10.dp.toPx(), badge.size.height + 6.dp.toPx()),
                                cornerRadius = CornerRadius(6.dp.toPx(), 6.dp.toPx())
                            )
                            drawText(badge, topLeft = Offset(boxLeft + 5.dp.toPx(), boxTop + 3.dp.toPx()))
                        }
                    }
                }
            } else {
                // Fallback rendering for InfrastructureObjectEntity consumers (ObjectFormScreen / RoutesScreen)
                parsedObjects.forEach { (obj, geom) ->
                    val color = statusColor(obj.operationalStatus)
                    val isSelected = obj.id == selectedObjectId
                    if (geom is ParsedGeometry.Point) {
                        val p = projectGeoPoint(geom.point, intSize, viewport)
                        if (isSelected) {
                            drawCircle(color = color.copy(alpha = 0.28f), radius = 15.dp.toPx(), center = p)
                        }
                        drawCircle(color = Color(0xFF081320), radius = (if (isSelected) 8.5f else 7f).dp.toPx(), center = p)
                        drawCircle(color = color, radius = (if (isSelected) 6.8f else 5.3f).dp.toPx(), center = p)
                    } else {
                        drawSpatialGeometry(geom, color, isSelected)
                    }
                }
            }

            // Saved offline area bounds & active Download Area preview box
            savedAreaBounds.forEach { b ->
                val ring = b.toPolygonRing()
                val path = Path()
                ring.forEachIndexed { idx, pt ->
                    val p = projectGeoPoint(pt, intSize, viewport)
                    if (idx == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y)
                }
                path.close()
                drawPath(path, color = GisColors.StatusWorking.copy(alpha = 0.08f))
                drawPath(
                    path,
                    color = GisColors.StatusWorking.copy(alpha = 0.65f),
                    style = Stroke(width = 2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f)))
                )
            }
            if (downloadPreviewBounds != null) {
                val ring = downloadPreviewBounds.toPolygonRing()
                val path = Path()
                ring.forEachIndexed { idx, pt ->
                    val p = projectGeoPoint(pt, intSize, viewport)
                    if (idx == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y)
                }
                path.close()
                drawPath(path, color = GisColors.CyanAccent.copy(alpha = 0.16f))
                drawPath(
                    path,
                    color = GisColors.CyanAccent,
                    style = Stroke(width = 3.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 8f)))
                )
            }

            // Approved / Emergency Route overlay
            if (routePoints.size >= 2) {
                val rPath = Path()
                routePoints.forEachIndexed { idx, pt ->
                    val p = projectGeoPoint(pt, intSize, viewport)
                    if (idx == 0) rPath.moveTo(p.x, p.y) else rPath.lineTo(p.x, p.y)
                }
                val routeColor = if (routeIsWarning) GisColors.StatusMaintenance else GisColors.StatusWorking
                drawPath(rPath, color = Color(0xFF081320), style = Stroke(width = 11f, cap = StrokeCap.Round, join = StrokeJoin.Round))
                drawPath(rPath, color = routeColor, style = Stroke(width = 6.5f, cap = StrokeCap.Round, join = StrokeJoin.Round))
                val endP = projectGeoPoint(routePoints.last(), intSize, viewport)
                drawCircle(Color.White, radius = 13f, center = endP)
                drawCircle(routeColor, radius = 9.5f, center = endP)
            }

            // Picked vertices (ObjectForm geometry picker)
            if (pickedVertices.isNotEmpty()) {
                if (pickedVertices.size >= 2) {
                    val vPath = Path()
                    pickedVertices.forEachIndexed { idx, pt ->
                        val p = projectGeoPoint(pt, intSize, viewport)
                        if (idx == 0) vPath.moveTo(p.x, p.y) else vPath.lineTo(p.x, p.y)
                    }
                    drawPath(vPath, color = GisColors.CyanAccent, style = Stroke(width = 5f, cap = StrokeCap.Round))
                }
                pickedVertices.forEach { pt ->
                    val p = projectGeoPoint(pt, intSize, viewport)
                    drawCircle(Color.White, radius = 11f, center = p)
                    drawCircle(GisColors.DeepTeal, radius = 7.5f, center = p)
                }
            }

            // Measure distance overlay
            if (measurePoints.isNotEmpty()) {
                if (measurePoints.size >= 2) {
                    val mPath = Path()
                    measurePoints.forEachIndexed { idx, pt ->
                        val p = projectGeoPoint(pt, intSize, viewport)
                        if (idx == 0) mPath.moveTo(p.x, p.y) else mPath.lineTo(p.x, p.y)
                    }
                    drawPath(
                        mPath,
                        color = if (darkTheme) Color.White else GisColors.LightInk,
                        style = Stroke(width = 4f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 8f)))
                    )
                }
                measurePoints.forEach { pt ->
                    val p = projectGeoPoint(pt, intSize, viewport)
                    drawCircle(GisColors.StatusMaintenance, radius = 9f, center = p)
                }
            }

            // User GPS position pin
            if (userLocation != null) {
                val up = projectGeoPoint(userLocation, intSize, viewport)
                drawCircle(GisColors.CyanAccent.copy(alpha = 0.25f), radius = 24f, center = up)
                drawCircle(Color.White, radius = 11f, center = up)
                drawCircle(GisColors.DeepTeal, radius = 7.5f, center = up)
            }

            // Emergency dropped incident pin
            if (emergencyPin != null) {
                val ep = projectGeoPoint(emergencyPin, intSize, viewport)
                drawCircle(GisColors.StatusFaulty.copy(alpha = 0.26f), radius = 28.dp.toPx(), center = ep)
                drawCircle(
                    color = GisColors.StatusFaulty,
                    radius = 18.dp.toPx(),
                    center = ep,
                    style = Stroke(width = 2.dp.toPx())
                )
                drawCircle(Color.White, radius = 12.dp.toPx(), center = ep)
                drawCircle(GisColors.StatusFaulty, radius = 9.dp.toPx(), center = ep)
            }
        }
    }
}
