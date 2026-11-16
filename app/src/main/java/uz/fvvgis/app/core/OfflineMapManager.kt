package uz.fvvgis.app.core

import android.content.Context
import androidx.compose.runtime.Immutable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.maplibre.android.MapLibre
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.offline.OfflineManager
import org.maplibre.android.offline.OfflineRegion
import org.maplibre.android.offline.OfflineRegionError
import org.maplibre.android.offline.OfflineRegionStatus
import org.maplibre.android.offline.OfflineTilePyramidRegionDefinition
import uz.fvvgis.app.data.local.RegionEntity
import uz.fvvgis.app.ui.components.MapViewport
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.tan

@Immutable
data class GeoBounds(
    val northLat: Double,
    val southLat: Double,
    val eastLon: Double,
    val westLon: Double
) {
    val center: GeoPoint
        get() = GeoPoint((northLat + southLat) / 2.0, (eastLon + westLon) / 2.0)

    fun toPolygonRing(): List<GeoPoint> = listOf(
        GeoPoint(northLat, westLon),
        GeoPoint(northLat, eastLon),
        GeoPoint(southLat, eastLon),
        GeoPoint(southLat, westLon),
        GeoPoint(northLat, westLon)
    )
}

enum class TileDetailPreset(
    val minZoom: Double,
    val maxZoom: Double,
    val labelKey: String
) {
    OVERVIEW(6.0, 11.0, "detailOverview"),
    CITY(8.0, 14.0, "detailCity"),
    STREET(10.0, 15.0, "detailStreet")
}

@Immutable
data class OfflineAreaRecord(
    val id: Long,
    val name: String,
    val bounds: GeoBounds,
    val minZoom: Double,
    val maxZoom: Double,
    val completedResources: Long,
    val requiredResources: Long,
    val completedBytes: Long,
    val isComplete: Boolean,
    val isActive: Boolean,
    val errorMessage: String? = null
) {
    val progressFraction: Float
        get() = when {
            isComplete -> 1f
            requiredResources <= 0L -> 0f
            else -> (completedResources.toFloat() / requiredResources.toFloat()).coerceIn(0f, 1f)
        }
}

object OfflineTileEstimator {
    private fun lonToTileX(lon: Double, zoom: Int): Int {
        val n = 2.0.pow(zoom)
        return floor((lon + 180.0) / 360.0 * n).toInt().coerceIn(0, (1 shl zoom) - 1)
    }

    private fun latToTileY(lat: Double, zoom: Int): Int {
        val clampedLat = lat.coerceIn(-85.0511, 85.0511)
        val latRad = Math.toRadians(clampedLat)
        val n = 2.0.pow(zoom)
        val y = (1.0 - ln(tan(latRad) + 1.0 / cos(latRad)) / PI) / 2.0 * n
        return floor(y).toInt().coerceIn(0, (1 shl zoom) - 1)
    }

    fun estimateTileCount(bounds: GeoBounds, minZoom: Double, maxZoom: Double): Long {
        val zMin = minZoom.toInt().coerceIn(0, 18)
        val zMax = maxZoom.toInt().coerceIn(zMin, 18)
        var total = 0L
        for (z in zMin..zMax) {
            val xMin = lonToTileX(bounds.westLon, z)
            val xMax = lonToTileX(bounds.eastLon, z)
            val yMin = latToTileY(bounds.northLat, z)
            val yMax = latToTileY(bounds.southLat, z)
            val countX = (xMax - xMin + 1).coerceAtLeast(1).toLong()
            val countY = (yMax - yMin + 1).coerceAtLeast(1).toLong()
            total += countX * countY
        }
        return total
    }

    fun estimateBytes(tileCount: Long): Long = tileCount * 24_576L // ~24 KB avg vector tile + style/glyph overhead

    fun formatBytes(bytes: Long): String = when {
        bytes < 1024L -> "$bytes B"
        bytes < 1024L * 1024L -> "${(bytes / 1024.0).toInt()} KB"
        bytes < 1024L * 1024L * 1024L -> "${"%.1f".format(bytes / (1024.0 * 1024.0))} MB"
        else -> "${"%.2f".format(bytes / (1024.0 * 1024.0 * 1024.0))} GB"
    }

    fun boundsForViewport(viewport: MapViewport): GeoBounds {
        val latSpan = (7.2 / viewport.zoom.toDouble().coerceAtLeast(0.75)).coerceIn(0.08, 4.5)
        val lonSpan = (latSpan / 0.75).coerceIn(0.10, 6.0)
        val halfLat = latSpan / 2.0
        val halfLon = lonSpan / 2.0
        val south = (viewport.centerLat - halfLat).coerceIn(35.5, 45.8)
        val north = (viewport.centerLat + halfLat).coerceIn(south + 0.04, 46.2)
        val west = (viewport.centerLon - halfLon).coerceIn(55.0, 74.0)
        val east = (viewport.centerLon + halfLon).coerceIn(west + 0.05, 74.5)
        return GeoBounds(northLat = north, southLat = south, eastLon = east, westLon = west)
    }

    fun boundsForRegion(region: RegionEntity): GeoBounds {
        val (halfLat, halfLon) = when (region.id) {
            "UZ-TK" -> 0.14 to 0.18
            "UZ-QR", "UZ-NW" -> 0.65 to 0.85
            else -> 0.30 to 0.42
        }
        val south = (region.centerLat - halfLat).coerceIn(35.5, 45.8)
        val north = (region.centerLat + halfLat).coerceIn(south + 0.05, 46.2)
        val west = (region.centerLon - halfLon).coerceIn(55.0, 74.0)
        val east = (region.centerLon + halfLon).coerceIn(west + 0.05, 74.5)
        return GeoBounds(northLat = north, southLat = south, eastLon = east, westLon = west)
    }
}

class OfflineMapController(context: Context) {
    private val appContext = context.applicationContext
    private val json = Json { ignoreUnknownKeys = true }
    private val regionHandles = LinkedHashMap<Long, OfflineRegion>()

    private val _areas = MutableStateFlow<List<OfflineAreaRecord>>(emptyList())
    val areas: StateFlow<List<OfflineAreaRecord>> = _areas.asStateFlow()

    private val _creating = MutableStateFlow(false)
    val creating: StateFlow<Boolean> = _creating.asStateFlow()

    private val offlineManager: OfflineManager by lazy {
        MapLibre.getInstance(appContext)
        OfflineManager.getInstance(appContext)
    }

    fun refreshAreas() {
        runCatching {
            offlineManager.listOfflineRegions(object : OfflineManager.ListOfflineRegionsCallback {
                override fun onList(offlineRegions: Array<OfflineRegion>?) {
                    val list = offlineRegions?.toList().orEmpty()
                    regionHandles.clear()
                    if (list.isEmpty()) {
                        _areas.value = emptyList()
                        return
                    }
                    list.forEach { region ->
                        regionHandles[region.id] = region
                        attachObserver(region)
                        region.getStatus(object : OfflineRegion.OfflineRegionStatusCallback {
                            override fun onStatus(status: OfflineRegionStatus?) {
                                if (status != null) {
                                    upsertRegionRecord(region, status, null)
                                }
                            }

                            override fun onError(error: String?) {
                                upsertRegionRecord(region, null, error)
                            }
                        })
                    }
                }

                override fun onError(error: String) = Unit
            })
        }
    }

    fun startDownload(
        name: String,
        styleUrl: String,
        bounds: GeoBounds,
        minZoom: Double,
        maxZoom: Double,
        pixelRatio: Float,
        onComplete: (OfflineAreaRecord) -> Unit,
        onError: (String) -> Unit
    ) {
        if (_creating.value) return
        _creating.value = true

        val latLngBounds = LatLngBounds.from(
            bounds.northLat,
            bounds.eastLon,
            bounds.southLat,
            bounds.westLon
        )
        val definition = OfflineTilePyramidRegionDefinition(
            styleUrl,
            latLngBounds,
            minZoom,
            maxZoom,
            pixelRatio
        )
        val metadata = JsonObject(
            mapOf(
                "name" to JsonPrimitive(name),
                "north" to JsonPrimitive(bounds.northLat),
                "south" to JsonPrimitive(bounds.southLat),
                "east" to JsonPrimitive(bounds.eastLon),
                "west" to JsonPrimitive(bounds.westLon),
                "minZoom" to JsonPrimitive(minZoom),
                "maxZoom" to JsonPrimitive(maxZoom)
            )
        ).toString().toByteArray(Charsets.UTF_8)

        runCatching {
            offlineManager.createOfflineRegion(
                definition,
                metadata,
                object : OfflineManager.CreateOfflineRegionCallback {
                    override fun onCreate(offlineRegion: OfflineRegion) {
                        _creating.value = false
                        regionHandles[offlineRegion.id] = offlineRegion
                        attachObserver(offlineRegion, onComplete = onComplete, onError = onError)
                        offlineRegion.setDownloadState(OfflineRegion.STATE_ACTIVE)
                    }

                    override fun onError(error: String) {
                        _creating.value = false
                        onError(error)
                    }
                }
            )
        }.onFailure { err ->
            _creating.value = false
            onError(err.message ?: "Offline download failed")
        }
    }

    fun togglePauseResume(areaId: Long) {
        val region = regionHandles[areaId] ?: return
        val existing = _areas.value.firstOrNull { it.id == areaId } ?: return
        val nextState = if (existing.isActive) OfflineRegion.STATE_INACTIVE else OfflineRegion.STATE_ACTIVE
        region.setDownloadState(nextState)
    }

    fun deleteArea(areaId: Long, onDeleted: () -> Unit, onError: (String) -> Unit) {
        val region = regionHandles[areaId]
        if (region == null) {
            _areas.value = _areas.value.filterNot { it.id == areaId }
            onDeleted()
            return
        }
        region.setDownloadState(OfflineRegion.STATE_INACTIVE)
        region.delete(object : OfflineRegion.OfflineRegionDeleteCallback {
            override fun onDelete() {
                regionHandles.remove(areaId)
                _areas.value = _areas.value.filterNot { it.id == areaId }
                onDeleted()
            }

            override fun onError(error: String) {
                onError(error)
            }
        })
    }

    private fun attachObserver(
        region: OfflineRegion,
        onComplete: ((OfflineAreaRecord) -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ) {
        var notifiedComplete = false
        region.setObserver(object : OfflineRegion.OfflineRegionObserver {
            override fun onStatusChanged(status: OfflineRegionStatus) {
                val record = upsertRegionRecord(region, status, null)
                if (status.isComplete && !notifiedComplete) {
                    notifiedComplete = true
                    region.setDownloadState(OfflineRegion.STATE_INACTIVE)
                    onComplete?.invoke(record)
                }
            }

            override fun onError(error: OfflineRegionError) {
                val msg = error.message.ifBlank { error.reason }
                upsertRegionRecord(region, null, msg)
                onError?.invoke(msg)
            }

            override fun mapboxTileCountLimitExceeded(limit: Long) {
                val msg = "Tile limit exceeded ($limit)"
                upsertRegionRecord(region, null, msg)
                region.setDownloadState(OfflineRegion.STATE_INACTIVE)
                onError?.invoke(msg)
            }
        })
    }

    private fun upsertRegionRecord(
        region: OfflineRegion,
        status: OfflineRegionStatus?,
        error: String?
    ): OfflineAreaRecord {
        val parsed = parseMetadata(region)
        val existing = _areas.value.firstOrNull { it.id == region.id }
        val def = region.definition as? OfflineTilePyramidRegionDefinition
        val defBounds = def?.bounds?.let { b ->
            GeoBounds(
                northLat = b.latitudeNorth,
                southLat = b.latitudeSouth,
                eastLon = b.longitudeEast,
                westLon = b.longitudeWest
            )
        }
        val record = OfflineAreaRecord(
            id = region.id,
            name = parsed.name,
            bounds = parsed.bounds ?: defBounds ?: GeoBounds(41.45, 41.15, 69.42, 69.06),
            minZoom = parsed.minZoom ?: def?.minZoom ?: 8.0,
            maxZoom = parsed.maxZoom ?: def?.maxZoom ?: 14.0,
            completedResources = status?.completedResourceCount ?: existing?.completedResources ?: 0L,
            requiredResources = status?.requiredResourceCount ?: existing?.requiredResources ?: 0L,
            completedBytes = status?.completedResourceSize ?: existing?.completedBytes ?: 0L,
            isComplete = status?.isComplete ?: existing?.isComplete ?: false,
            isActive = status?.let { it.downloadState == OfflineRegion.STATE_ACTIVE } ?: existing?.isActive ?: false,
            errorMessage = error
        )
        _areas.value = (_areas.value.filterNot { it.id == region.id } + record).sortedByDescending { it.id }
        return record
    }

    private data class ParsedMetadata(
        val name: String,
        val bounds: GeoBounds?,
        val minZoom: Double?,
        val maxZoom: Double?
    )

    private fun parseMetadata(region: OfflineRegion): ParsedMetadata {
        val raw = runCatching { String(region.metadata, Charsets.UTF_8) }.getOrNull().orEmpty()
        val obj = runCatching { json.parseToJsonElement(raw).jsonObject }.getOrNull()
        val name = obj?.get("name")?.jsonPrimitive?.content ?: "Offline Area #${region.id}"
        val n = obj?.get("north")?.jsonPrimitive?.doubleOrNull
        val s = obj?.get("south")?.jsonPrimitive?.doubleOrNull
        val e = obj?.get("east")?.jsonPrimitive?.doubleOrNull
        val w = obj?.get("west")?.jsonPrimitive?.doubleOrNull
        val bounds = if (n != null && s != null && e != null && w != null) GeoBounds(n, s, e, w) else null
        return ParsedMetadata(
            name = name,
            bounds = bounds,
            minZoom = obj?.get("minZoom")?.jsonPrimitive?.doubleOrNull,
            maxZoom = obj?.get("maxZoom")?.jsonPrimitive?.doubleOrNull
        )
    }
}
