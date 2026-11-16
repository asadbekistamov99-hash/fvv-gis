package uz.fvvgis.app.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.*

@Serializable
data class GeoPoint(val lat: Double, val lon: Double)

sealed class ParsedGeometry {
    data class Point(val point: GeoPoint) : ParsedGeometry()
    data class LineString(val points: List<GeoPoint>) : ParsedGeometry()
    data class Polygon(val rings: List<List<GeoPoint>>) : ParsedGeometry()

    fun representativePoint(): GeoPoint = when (this) {
        is Point -> point
        is LineString -> points[points.size / 2]
        is Polygon -> {
            val outer = rings.firstOrNull().orEmpty()
            if (outer.isEmpty()) GeoPoint(41.299, 69.240)
            else GeoPoint(outer.map { it.lat }.average(), outer.map { it.lon }.average())
        }
    }

    fun allPoints(): List<GeoPoint> = when (this) {
        is Point -> listOf(point)
        is LineString -> points
        is Polygon -> rings.flatten()
    }
}

object GeoUtils {
    private val json = Json { ignoreUnknownKeys = true }

    fun parseGeoJson(raw: String): ParsedGeometry? {
        return try {
            val obj = json.parseToJsonElement(raw).jsonObject
            val type = obj["type"]?.jsonPrimitive?.content ?: return null
            val coords = obj["coordinates"] ?: return null
            when (type) {
                "Point" -> {
                    val arr = coords.jsonArray
                    if (arr.size < 2) return null
                    val lon = arr[0].jsonPrimitive.doubleOrNull ?: return null
                    val lat = arr[1].jsonPrimitive.doubleOrNull ?: return null
                    ParsedGeometry.Point(GeoPoint(lat, lon))
                }
                "LineString" -> {
                    val pts = parsePointList(coords.jsonArray)
                    if (pts.size < 2) null else ParsedGeometry.LineString(pts)
                }
                "Polygon" -> {
                    val rings = coords.jsonArray.map { parsePointList(it.jsonArray) }.filter { it.size >= 3 }
                    if (rings.isEmpty()) null else ParsedGeometry.Polygon(rings)
                }
                else -> null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun parsePointList(arr: JsonArray): List<GeoPoint> = arr.mapNotNull { item ->
        val pair = item as? JsonArray ?: return@mapNotNull null
        if (pair.size < 2) return@mapNotNull null
        val lon = pair[0].jsonPrimitive.doubleOrNull ?: return@mapNotNull null
        val lat = pair[1].jsonPrimitive.doubleOrNull ?: return@mapNotNull null
        GeoPoint(lat, lon)
    }

    fun encodeGeoJson(type: String, vertices: List<GeoPoint>): String {
        val obj = when (type) {
            "Point" -> {
                val p = vertices.firstOrNull() ?: GeoPoint(41.299, 69.240)
                JsonObject(
                    mapOf(
                        "type" to JsonPrimitive("Point"),
                        "coordinates" to JsonArray(listOf(JsonPrimitive(p.lon), JsonPrimitive(p.lat)))
                    )
                )
            }
            "LineString" -> {
                JsonObject(
                    mapOf(
                        "type" to JsonPrimitive("LineString"),
                        "coordinates" to JsonArray(
                            vertices.map { JsonArray(listOf(JsonPrimitive(it.lon), JsonPrimitive(it.lat))) }
                        )
                    )
                )
            }
            else -> {
                val ring = if (vertices.isNotEmpty() && vertices.first() != vertices.last()) {
                    vertices + vertices.first()
                } else vertices
                JsonObject(
                    mapOf(
                        "type" to JsonPrimitive("Polygon"),
                        "coordinates" to JsonArray(
                            listOf(
                                JsonArray(
                                    ring.map { JsonArray(listOf(JsonPrimitive(it.lon), JsonPrimitive(it.lat))) }
                                )
                            )
                        )
                    )
                )
            }
        }
        return obj.toString()
    }

    fun distanceMeters(a: GeoPoint, b: GeoPoint): Double {
        val r = 6371000.0
        val dLat = Math.toRadians(b.lat - a.lat)
        val dLon = Math.toRadians(b.lon - a.lon)
        val lat1 = Math.toRadians(a.lat)
        val lat2 = Math.toRadians(b.lat)
        val h = sin(dLat / 2).pow(2) + cos(lat1) * cos(lat2) * sin(dLon / 2).pow(2)
        return 2 * r * asin(sqrt(h.coerceIn(0.0, 1.0)))
    }

    fun distanceFromLineMeters(point: GeoPoint, line: List<GeoPoint>): Double {
        if (line.size < 2) return Double.POSITIVE_INFINITY
        val scale = cos(Math.toRadians(point.lat))
        val metresPerDeg = 111195.0
        var nearest = Double.POSITIVE_INFINITY
        for (i in 1 until line.size) {
            val ax = (line[i - 1].lon - point.lon) * scale * metresPerDeg
            val ay = (line[i - 1].lat - point.lat) * metresPerDeg
            val bx = (line[i].lon - point.lon) * scale * metresPerDeg
            val by = (line[i].lat - point.lat) * metresPerDeg
            val dx = bx - ax
            val dy = by - ay
            val denom = dx * dx + dy * dy
            val proj = if (denom == 0.0) 0.0 else (-(ax * dx + ay * dy) / denom).coerceIn(0.0, 1.0)
            val d = hypot(ax + proj * dx, ay + proj * dy)
            if (d < nearest) nearest = d
        }
        return nearest
    }

    // Simplified Uzbekistan national border polygon (lon, lat) for crisp offline basemap context
    val uzbekistanBorder: List<GeoPoint> = listOf(
        GeoPoint(45.58, 58.60), GeoPoint(45.10, 56.00), GeoPoint(41.32, 56.00),
        GeoPoint(41.15, 57.50), GeoPoint(42.20, 58.60), GeoPoint(41.30, 60.10),
        GeoPoint(40.15, 62.20), GeoPoint(39.00, 63.60), GeoPoint(37.35, 65.20),
        GeoPoint(37.18, 67.20), GeoPoint(37.40, 68.10), GeoPoint(38.90, 67.80),
        GeoPoint(39.50, 67.50), GeoPoint(40.10, 69.00), GeoPoint(40.30, 70.60),
        GeoPoint(40.00, 71.70), GeoPoint(40.55, 73.15), GeoPoint(41.35, 72.10),
        GeoPoint(41.55, 70.95), GeoPoint(42.10, 70.20), GeoPoint(41.50, 69.05),
        GeoPoint(40.80, 68.10), GeoPoint(41.30, 66.80), GeoPoint(42.40, 66.00),
        GeoPoint(43.10, 64.00), GeoPoint(43.80, 62.00), GeoPoint(44.50, 60.50),
        GeoPoint(45.58, 58.60)
    )

    // Aral Sea / Aydar Lake water accent polygons for visual realism
    val aralContour: List<GeoPoint> = listOf(
        GeoPoint(45.3, 58.4), GeoPoint(45.2, 59.5), GeoPoint(44.2, 59.7),
        GeoPoint(43.7, 58.8), GeoPoint(44.4, 58.2), GeoPoint(45.3, 58.4)
    )

    val aydarLakeContour: List<GeoPoint> = listOf(
        GeoPoint(40.95, 66.20), GeoPoint(40.85, 67.15), GeoPoint(40.68, 67.30),
        GeoPoint(40.72, 66.40), GeoPoint(40.95, 66.20)
    )
}
