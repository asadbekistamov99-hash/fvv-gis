package uz.fvvgis.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GeoUtilsTest {

    private val tashkent = GeoPoint(41.2995, 69.2401)
    private val samarkand = GeoPoint(39.6542, 66.9597)

    @Test
    fun distanceToSamePointIsZero() {
        assertEquals(0.0, GeoUtils.distanceMeters(tashkent, tashkent), 1e-6)
    }

    @Test
    fun distanceIsSymmetric() {
        val ab = GeoUtils.distanceMeters(tashkent, samarkand)
        val ba = GeoUtils.distanceMeters(samarkand, tashkent)
        assertEquals(ab, ba, 1e-6)
    }

    @Test
    fun tashkentToSamarkandIsRoughlyTwoHundredSixtyKm() {
        val meters = GeoUtils.distanceMeters(tashkent, samarkand)
        assertTrue("was $meters", meters in 250_000.0..290_000.0)
    }

    @Test
    fun distanceOneDegreeLatitudeIsAboutOneHundredElevenKm() {
        val meters = GeoUtils.distanceMeters(GeoPoint(41.0, 69.0), GeoPoint(42.0, 69.0))
        assertEquals(111_195.0, meters, 500.0)
    }

    @Test
    fun pointOnSegmentHasZeroDistanceFromLine() {
        val line = listOf(GeoPoint(41.0, 69.0), GeoPoint(41.0, 70.0))
        val d = GeoUtils.distanceFromLineMeters(GeoPoint(41.0, 69.5), line)
        assertEquals(0.0, d, 1.0)
    }

    @Test
    fun pointOffLineIsMeasuredPerpendicularly() {
        val line = listOf(GeoPoint(41.0, 69.0), GeoPoint(41.0, 70.0))
        val d = GeoUtils.distanceFromLineMeters(GeoPoint(41.01, 69.5), line)
        assertEquals(1111.95, d, 20.0)
    }

    @Test
    fun parsesPointGeoJson() {
        val geometry = GeoUtils.parseGeoJson("""{"type":"Point","coordinates":[69.2401,41.2995]}""")
        val point = (geometry as ParsedGeometry.Point).point
        assertEquals(41.2995, point.lat, 1e-9)
        assertEquals(69.2401, point.lon, 1e-9)
    }

    @Test
    fun parsesLineStringGeoJson() {
        val geometry = GeoUtils.parseGeoJson(
            """{"type":"LineString","coordinates":[[69.0,41.0],[69.1,41.1]]}"""
        )
        assertTrue(geometry is ParsedGeometry.LineString)
        assertEquals(2, (geometry as ParsedGeometry.LineString).points.size)
    }

    @Test
    fun invalidGeoJsonReturnsNull() {
        assertNull(GeoUtils.parseGeoJson("not json"))
        assertNull(GeoUtils.parseGeoJson("""{"type":"LineString","coordinates":[[69.0,41.0]]}"""))
    }
}
