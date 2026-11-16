package uz.fvvgis.app.core

import androidx.compose.runtime.Immutable
import uz.fvvgis.app.data.model.GisRegistryItem
import uz.fvvgis.app.data.model.RegistryCategoryGroup
import java.util.PriorityQueue
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.roundToInt

enum class EmergencyVehicleProfile(
    val id: String,
    val minWidthMeters: Double,
    val vehicleWeightTons: Double,
    val heightMeters: Double,
    val cruiseSpeedMps: Double,
    val allowsUnpaved: Boolean,
    val labelKey: String,
    val specsKey: String
) {
    FIRE_ENGINE(
        id = "fire_engine",
        minWidthMeters = 3.6,
        vehicleWeightTons = 18.0,
        heightMeters = 3.9,
        cruiseSpeedMps = 16.5,
        allowsUnpaved = false,
        labelKey = "vehicleFireEngine",
        specsKey = "vehicleFireEngineSpecs"
    ),
    RESCUE_4X4(
        id = "rescue_4x4",
        minWidthMeters = 2.4,
        vehicleWeightTons = 3.8,
        heightMeters = 2.3,
        cruiseSpeedMps = 20.5,
        allowsUnpaved = true,
        labelKey = "vehicleRescue4x4",
        specsKey = "vehicleRescue4x4Specs"
    ),
    AMBULANCE_HAZMAT(
        id = "ambulance_hazmat",
        minWidthMeters = 2.8,
        vehicleWeightTons = 6.5,
        heightMeters = 3.1,
        cruiseSpeedMps = 19.0,
        allowsUnpaved = false,
        labelKey = "vehicleAmbulanceHazmat",
        specsKey = "vehicleAmbulanceHazmatSpecs"
    )
}

enum class RoadClass(
    val labelKey: String,
    val widthMeters: Double,
    val maxWeightTons: Double,
    val clearanceMeters: Double,
    val speedMultiplier: Double,
    val paved: Boolean
) {
    NATIONAL_HIGHWAY("roadHighway", 12.0, 40.0, 5.2, 1.25, true),
    ARTERIAL_CORRIDOR("roadArterial", 8.5, 28.0, 4.6, 1.0, true),
    COLLECTOR_STREET("roadCollector", 5.0, 14.0, 4.2, 0.82, true),
    BRIDGE_CONSTRAINED("roadBridge", 4.0, 10.0, 3.9, 0.68, true),
    NARROW_LANE("roadNarrow", 2.9, 6.0, 3.4, 0.45, false),
    UNPAVED_ACCESS("roadUnpaved", 3.2, 9.0, 4.5, 0.58, false)
}

enum class RouteAccessibilityStatus(val labelKey: String) {
    FULLY_ACCESSIBLE("routeAccessibleFull"),
    DETOUR_APPLIED("routeDetourApplied"),
    ACCESSIBLE_WITH_CAUTION("routeAccessibleCaution"),
    RESTRICTED_LAST_MILE("routeRestrictedLastMile")
}

@Immutable
data class PathNavigationStep(
    val roadName: String,
    val roadClass: RoadClass,
    val distanceMeters: Double,
    val durationSeconds: Double,
    val widthMeters: Double,
    val maxWeightTons: Double,
    val cautionReasonKey: String?,
    val from: GeoPoint,
    val to: GeoPoint
)

@Immutable
data class EmergencyPathResult(
    val origin: GeoPoint,
    val destination: GeoPoint,
    val destinationMarkerId: String,
    val destinationCode: String,
    val destinationName: String,
    val pathPoints: List<GeoPoint>,
    val totalDistanceMeters: Double,
    val estimatedDurationSeconds: Double,
    val vehicleProfile: EmergencyVehicleProfile,
    val accessibilityStatus: RouteAccessibilityStatus,
    val steps: List<PathNavigationStep>,
    val avoidedObstacleKeys: List<String>,
    val minRoadWidthMeters: Double,
    val minWeightLimitTons: Double
) {
    val estimatedMinutes: Int
        get() = max(1, (estimatedDurationSeconds / 60.0).roundToInt())
}

object EmergencyPathfinder {
    private data class GraphNode(
        val id: String,
        val point: GeoPoint
    )

    private data class GraphEdge(
        val fromId: String,
        val toId: String,
        val roadName: String,
        val roadClass: RoadClass,
        val distanceMeters: Double,
        val widthMeters: Double = roadClass.widthMeters,
        val maxWeightTons: Double = roadClass.maxWeightTons,
        val clearanceMeters: Double = roadClass.clearanceMeters,
        val obstacleReasonKey: String? = null
    )

    private data class TrunkHub(
        val id: String,
        val name: String,
        val point: GeoPoint
    )

    private val trunkHubs = listOf(
        TrunkHub("tashkent", "Tashkent", GeoPoint(41.2995, 69.2401)),
        TrunkHub("chirchiq", "Chirchiq", GeoPoint(41.4689, 69.5822)),
        TrunkHub("ohangaron", "Ohangaron", GeoPoint(40.9167, 69.6333)),
        TrunkHub("kamchik", "Kamchik Pass", GeoPoint(41.0950, 70.5100)),
        TrunkHub("guliston", "Guliston", GeoPoint(40.4897, 68.7842)),
        TrunkHub("jizzakh", "Jizzakh", GeoPoint(40.1158, 67.8422)),
        TrunkHub("samarkand", "Samarkand", GeoPoint(39.6542, 66.9597)),
        TrunkHub("navoi", "Navoi", GeoPoint(40.0844, 65.3792)),
        TrunkHub("bukhara", "Bukhara", GeoPoint(39.7747, 64.4286)),
        TrunkHub("qarshi", "Qarshi", GeoPoint(38.8606, 65.7891)),
        TrunkHub("termez", "Termez", GeoPoint(37.2242, 67.2783)),
        TrunkHub("namangan", "Namangan", GeoPoint(40.9983, 71.6726)),
        TrunkHub("andijan", "Andijan", GeoPoint(40.7821, 72.3442)),
        TrunkHub("fergana", "Fergana", GeoPoint(40.3864, 71.7864)),
        TrunkHub("urgench", "Urgench", GeoPoint(41.5500, 60.6333)),
        TrunkHub("nukus", "Nukus", GeoPoint(42.4619, 59.6166))
    )

    private val trunkConnections = listOf(
        Triple("tashkent", "chirchiq", "4R12 Emergency Arterial" to RoadClass.ARTERIAL_CORRIDOR),
        Triple("tashkent", "ohangaron", "A373 Corridor" to RoadClass.NATIONAL_HIGHWAY),
        Triple("ohangaron", "kamchik", "A373 Kamchik Pass" to RoadClass.BRIDGE_CONSTRAINED),
        Triple("kamchik", "namangan", "A373 Valley Descent" to RoadClass.NATIONAL_HIGHWAY),
        Triple("namangan", "andijan", "A373 Andijan Hwy" to RoadClass.NATIONAL_HIGHWAY),
        Triple("namangan", "fergana", "4R112 Fergana Ring" to RoadClass.ARTERIAL_CORRIDOR),
        Triple("fergana", "andijan", "A373 Fergana-Andijan" to RoadClass.ARTERIAL_CORRIDOR),
        Triple("tashkent", "guliston", "M39 Syr Darya Hwy" to RoadClass.NATIONAL_HIGHWAY),
        Triple("guliston", "jizzakh", "M39 Jizzakh Hwy" to RoadClass.NATIONAL_HIGHWAY),
        Triple("jizzakh", "samarkand", "M39 Samarkand Hwy" to RoadClass.NATIONAL_HIGHWAY),
        Triple("samarkand", "navoi", "M37 Zeravshan Hwy" to RoadClass.NATIONAL_HIGHWAY),
        Triple("navoi", "bukhara", "M37 Bukhara Hwy" to RoadClass.NATIONAL_HIGHWAY),
        Triple("samarkand", "qarshi", "A378 Kashkadarya Hwy" to RoadClass.NATIONAL_HIGHWAY),
        Triple("bukhara", "qarshi", "A380 Steppe Corridor" to RoadClass.NATIONAL_HIGHWAY),
        Triple("qarshi", "termez", "M39 Surkhandarya Pass" to RoadClass.NATIONAL_HIGHWAY),
        Triple("samarkand", "termez", "M39 Mountain Hwy" to RoadClass.ARTERIAL_CORRIDOR),
        Triple("bukhara", "urgench", "A380 Kyzylkum Hwy" to RoadClass.NATIONAL_HIGHWAY),
        Triple("urgench", "nukus", "A380 Amu Darya Hwy" to RoadClass.NATIONAL_HIGHWAY)
    )

    fun calculateShortestPath(
        origin: GeoPoint,
        destinationMarker: GisRegistryItem,
        allMarkers: List<GisRegistryItem>,
        profile: EmergencyVehicleProfile,
        avoidFaultyHazards: Boolean = true
    ): EmergencyPathResult {
        val destination = destinationMarker.markerCoordinate
        val directDistance = GeoUtils.distanceMeters(origin, destination)

        val hazardZones = if (avoidFaultyHazards) {
            allMarkers.filter { marker ->
                marker.id != destinationMarker.id &&
                    (marker.operationalStatus == "faulty" || marker.operationalStatus == "temporarily_unavailable") &&
                    (marker.categoryGroup == RegistryCategoryGroup.HAZARDS || marker.categoryId.contains("water") || marker.categoryId.contains("sewer"))
            }.map { it.markerCoordinate }
        } else {
            emptyList()
        }

        if (directDistance < 250.0) {
            val speed = profile.cruiseSpeedMps * RoadClass.ARTERIAL_CORRIDOR.speedMultiplier
            val dur = (directDistance / speed).coerceAtLeast(15.0)
            return EmergencyPathResult(
                origin = origin,
                destination = destination,
                destinationMarkerId = destinationMarker.id,
                destinationCode = destinationMarker.code,
                destinationName = destinationMarker.name,
                pathPoints = listOf(origin, destination),
                totalDistanceMeters = directDistance,
                estimatedDurationSeconds = dur,
                vehicleProfile = profile,
                accessibilityStatus = RouteAccessibilityStatus.FULLY_ACCESSIBLE,
                steps = listOf(
                    PathNavigationStep(
                        roadName = "Direct Emergency Access",
                        roadClass = RoadClass.ARTERIAL_CORRIDOR,
                        distanceMeters = directDistance,
                        durationSeconds = dur,
                        widthMeters = RoadClass.ARTERIAL_CORRIDOR.widthMeters,
                        maxWeightTons = RoadClass.ARTERIAL_CORRIDOR.maxWeightTons,
                        cautionReasonKey = null,
                        from = origin,
                        to = destination
                    )
                ),
                avoidedObstacleKeys = emptyList(),
                minRoadWidthMeters = RoadClass.ARTERIAL_CORRIDOR.widthMeters,
                minWeightLimitTons = RoadClass.ARTERIAL_CORRIDOR.maxWeightTons
            )
        }

        val nodes = LinkedHashMap<String, GraphNode>()
        val adj = LinkedHashMap<String, MutableList<GraphEdge>>()

        fun addNode(id: String, pt: GeoPoint) {
            nodes[id] = GraphNode(id, pt)
            adj.putIfAbsent(id, mutableListOf())
        }

        fun addBidirectionalEdge(
            aId: String,
            bId: String,
            roadName: String,
            roadClass: RoadClass,
            widthMeters: Double = roadClass.widthMeters,
            maxWeightTons: Double = roadClass.maxWeightTons,
            clearanceMeters: Double = roadClass.clearanceMeters,
            obstacleReasonKey: String? = null
        ) {
            val a = nodes[aId]?.point ?: return
            val b = nodes[bId]?.point ?: return
            val dist = GeoUtils.distanceMeters(a, b)
            adj.getOrPut(aId) { mutableListOf() }.add(
                GraphEdge(aId, bId, roadName, roadClass, dist, widthMeters, maxWeightTons, clearanceMeters, obstacleReasonKey)
            )
            adj.getOrPut(bId) { mutableListOf() }.add(
                GraphEdge(bId, aId, roadName, roadClass, dist, widthMeters, maxWeightTons, clearanceMeters, obstacleReasonKey)
            )
        }

        addNode("origin", origin)
        addNode("dest", destination)

        if (directDistance <= 65_000.0) {
            // Local multi-lane road mesh around origin & destination so A* balances
            // shortest urban paths against road width, bridge load, unpaved tracks, and hazard zones.
            buildLocalRoadMesh(
                startId = "origin",
                endId = "dest",
                start = origin,
                end = destination,
                prefix = "loc",
                addNode = ::addNode,
                addEdge = ::addBidirectionalEdge
            )
        } else {
            // Intercity routing via real Uzbekistan highway backbone + local feeder meshes
            trunkHubs.forEach { addNode("hub_${it.id}", it.point) }
            trunkConnections.forEach { (from, to, info) ->
                val isKamchik = from == "kamchik" || to == "kamchik"
                addBidirectionalEdge(
                    aId = "hub_$from",
                    bId = "hub_$to",
                    roadName = info.first,
                    roadClass = info.second,
                    widthMeters = if (isKamchik) 7.0 else info.second.widthMeters,
                    maxWeightTons = if (isKamchik) 22.0 else info.second.maxWeightTons,
                    clearanceMeters = if (isKamchik) 4.0 else info.second.clearanceMeters,
                    obstacleReasonKey = if (isKamchik) "obstacleMountainPass" else null
                )
            }
            val startHubs = trunkHubs.sortedBy { GeoUtils.distanceMeters(origin, it.point) }.take(2)
            val endHubs = trunkHubs.sortedBy { GeoUtils.distanceMeters(destination, it.point) }.take(2)
            startHubs.forEachIndexed { idx, hub ->
                buildLocalRoadMesh(
                    startId = "origin",
                    endId = "hub_${hub.id}",
                    start = origin,
                    end = hub.point,
                    prefix = "start_$idx",
                    addNode = ::addNode,
                    addEdge = ::addBidirectionalEdge
                )
            }
            endHubs.forEachIndexed { idx, hub ->
                buildLocalRoadMesh(
                    startId = "hub_${hub.id}",
                    endId = "dest",
                    start = hub.point,
                    end = destination,
                    prefix = "end_$idx",
                    addNode = ::addNode,
                    addEdge = ::addBidirectionalEdge
                )
            }
        }

        val hazardThresholdMeters = if (directDistance <= 65_000.0) 220.0 else 1_200.0
        val avoidedObstacles = LinkedHashSet<String>()

        fun evaluateEdge(edge: GraphEdge, allowFallbackRestricted: Boolean): Pair<Double, String?>? {
            val fromPt = nodes[edge.fromId]?.point ?: return null
            val toPt = nodes[edge.toId]?.point ?: return null

            val tooNarrow = profile.minWidthMeters > edge.widthMeters
            val tooHeavy = profile.vehicleWeightTons > edge.maxWeightTons
            val tooTall = profile.heightMeters > edge.clearanceMeters
            val unpavedBlocked = !edge.roadClass.paved && !profile.allowsUnpaved

            val passesNearHazard = hazardZones.any { hz ->
                GeoUtils.distanceFromLineMeters(hz, listOf(fromPt, toPt)) <= hazardThresholdMeters
            }

            if (tooNarrow || tooHeavy || tooTall || unpavedBlocked) {
                if (tooNarrow) avoidedObstacles.add("obstacleNarrowLane")
                if (tooHeavy) avoidedObstacles.add("obstacleWeakBridge")
                if (tooTall) avoidedObstacles.add("obstacleMountainPass")
                if (unpavedBlocked) avoidedObstacles.add("obstacleUnpavedTrack")
                if (!allowFallbackRestricted) return null
                // High penalty fallback only if no accessible path exists
                val baseSpeed = profile.cruiseSpeedMps * edge.roadClass.speedMultiplier
                val note = when {
                    tooNarrow -> "obstacleNarrowLane"
                    tooHeavy -> "obstacleWeakBridge"
                    tooTall -> "obstacleMountainPass"
                    else -> "obstacleUnpavedTrack"
                }
                return (edge.distanceMeters / baseSpeed) * 250.0 to note
            }

            val baseSpeed = profile.cruiseSpeedMps * edge.roadClass.speedMultiplier
            var costSeconds = edge.distanceMeters / baseSpeed
            var cautionKey: String? = edge.obstacleReasonKey

            if (passesNearHazard) {
                avoidedObstacles.add("obstacleHazardZone")
                costSeconds *= 18.0
                cautionKey = "obstacleHazardZone"
            } else if (!edge.roadClass.paved && profile.allowsUnpaved) {
                costSeconds *= 1.12
            }

            return costSeconds to cautionKey
        }

        // First try strict A* excluding all inaccessible segments
        val strictResult = runAStar(
            nodes = nodes,
            adj = adj,
            startId = "origin",
            goalId = "dest",
            profile = profile,
            evaluateEdge = { edge -> evaluateEdge(edge, allowFallbackRestricted = false) }
        )

        val (chosenEdges, usedRestrictedFallback) = if (strictResult != null) {
            strictResult to false
        } else {
            val fallback = runAStar(
                nodes = nodes,
                adj = adj,
                startId = "origin",
                goalId = "dest",
                profile = profile,
                evaluateEdge = { edge -> evaluateEdge(edge, allowFallbackRestricted = true) }
            ) ?: emptyList()
            fallback to true
        }

        if (chosenEdges.isEmpty()) {
            val speed = profile.cruiseSpeedMps * RoadClass.COLLECTOR_STREET.speedMultiplier
            val dur = (directDistance / speed).coerceAtLeast(30.0)
            return EmergencyPathResult(
                origin = origin,
                destination = destination,
                destinationMarkerId = destinationMarker.id,
                destinationCode = destinationMarker.code,
                destinationName = destinationMarker.name,
                pathPoints = listOf(origin, destination),
                totalDistanceMeters = directDistance,
                estimatedDurationSeconds = dur,
                vehicleProfile = profile,
                accessibilityStatus = RouteAccessibilityStatus.ACCESSIBLE_WITH_CAUTION,
                steps = listOf(
                    PathNavigationStep(
                        roadName = "Direct Access",
                        roadClass = RoadClass.COLLECTOR_STREET,
                        distanceMeters = directDistance,
                        durationSeconds = dur,
                        widthMeters = RoadClass.COLLECTOR_STREET.widthMeters,
                        maxWeightTons = RoadClass.COLLECTOR_STREET.maxWeightTons,
                        cautionReasonKey = null,
                        from = origin,
                        to = destination
                    )
                ),
                avoidedObstacleKeys = emptyList(),
                minRoadWidthMeters = RoadClass.COLLECTOR_STREET.widthMeters,
                minWeightLimitTons = RoadClass.COLLECTOR_STREET.maxWeightTons
            )
        }

        val points = mutableListOf(origin)
        val steps = mutableListOf<PathNavigationStep>()
        var totalDist = 0.0
        var totalDuration = 0.0
        var minWidth = Double.POSITIVE_INFINITY
        var minWeight = Double.POSITIVE_INFINITY
        var hasCaution = false

        for (edge in chosenEdges) {
            val fromPt = nodes[edge.fromId]?.point ?: continue
            val toPt = nodes[edge.toId]?.point ?: continue
            val eval = evaluateEdge(edge, allowFallbackRestricted = usedRestrictedFallback)
            val caution = eval?.second
            if (caution != null) hasCaution = true
            val speed = profile.cruiseSpeedMps * edge.roadClass.speedMultiplier
            val stepDuration = edge.distanceMeters / speed
            totalDist += edge.distanceMeters
            totalDuration += stepDuration
            if (edge.widthMeters < minWidth) minWidth = edge.widthMeters
            if (edge.maxWeightTons < minWeight) minWeight = edge.maxWeightTons
            points.add(toPt)
            steps.add(
                PathNavigationStep(
                    roadName = edge.roadName,
                    roadClass = edge.roadClass,
                    distanceMeters = edge.distanceMeters,
                    durationSeconds = stepDuration,
                    widthMeters = edge.widthMeters,
                    maxWeightTons = edge.maxWeightTons,
                    cautionReasonKey = caution,
                    from = fromPt,
                    to = toPt
                )
            )
        }

        val status = when {
            usedRestrictedFallback -> RouteAccessibilityStatus.RESTRICTED_LAST_MILE
            hasCaution -> RouteAccessibilityStatus.ACCESSIBLE_WITH_CAUTION
            avoidedObstacles.isNotEmpty() -> RouteAccessibilityStatus.DETOUR_APPLIED
            else -> RouteAccessibilityStatus.FULLY_ACCESSIBLE
        }

        return EmergencyPathResult(
            origin = origin,
            destination = destination,
            destinationMarkerId = destinationMarker.id,
            destinationCode = destinationMarker.code,
            destinationName = destinationMarker.name,
            pathPoints = points,
            totalDistanceMeters = totalDist,
            estimatedDurationSeconds = totalDuration,
            vehicleProfile = profile,
            accessibilityStatus = status,
            steps = steps,
            avoidedObstacleKeys = avoidedObstacles.toList(),
            minRoadWidthMeters = if (minWidth.isFinite()) minWidth else 5.0,
            minWeightLimitTons = if (minWeight.isFinite()) minWeight else 14.0
        )
    }

    private fun buildLocalRoadMesh(
        startId: String,
        endId: String,
        start: GeoPoint,
        end: GeoPoint,
        prefix: String,
        addNode: (String, GeoPoint) -> Unit,
        addEdge: (String, String, String, RoadClass, Double, Double, Double, String?) -> Unit
    ) {
        val dLat = end.lat - start.lat
        val dLon = end.lon - start.lon
        val cosLat = cos(Math.toRadians((start.lat + end.lat) / 2.0)).coerceAtLeast(0.4)
        val dx = dLon * cosLat
        val dy = dLat
        val len = hypot(dx, dy).coerceAtLeast(1e-6)

        // Perpendicular unit vector in geographic degrees
        val perpLat = dx / len
        val perpLon = -(dy / len) / cosLat

        // Lateral corridor offset scales smoothly with trip distance (approx 11% of span, clamped)
        val spanDeg = hypot(dLat, dLon * cosLat)
        val lateralScale = (spanDeg * 0.14).coerceIn(0.0025, 0.045)

        fun pointAt(t: Double, lateralFactor: Double): GeoPoint = GeoPoint(
            lat = (start.lat + dLat * t + perpLat * lateralScale * lateralFactor).coerceIn(36.0, 46.5),
            lon = (start.lon + dLon * t + perpLon * lateralScale * lateralFactor).coerceIn(54.0, 75.0)
        )

        val c1 = "${prefix}_c1"; val c2 = "${prefix}_c2"; val c3 = "${prefix}_c3"
        val a1 = "${prefix}_a1"; val a2 = "${prefix}_a2"; val a3 = "${prefix}_a3"
        val s1 = "${prefix}_s1"; val s2 = "${prefix}_s2"; val s3 = "${prefix}_s3"

        // Center direct urban corridor (includes narrow lane + weight-limited bridge)
        addNode(c1, pointAt(0.26, 0.0))
        addNode(c2, pointAt(0.52, 0.02))
        addNode(c3, pointAt(0.76, 0.0))

        // Left Emergency Arterial Bypass (wide paved multi-lane road, 8.5m, 28t)
        addNode(a1, pointAt(0.24, 1.0))
        addNode(a2, pointAt(0.50, 1.15))
        addNode(a3, pointAt(0.76, 0.95))

        // Right District / Unpaved Access Corridor (ideal for 4x4 Rescue when urban streets block)
        addNode(s1, pointAt(0.25, -0.95))
        addNode(s2, pointAt(0.51, -1.05))
        addNode(s3, pointAt(0.75, -0.90))

        // Center direct path edges (shortest distance, constrained width/weight)
        addEdge(startId, c1, "Central Access Street", RoadClass.COLLECTOR_STREET, 5.0, 14.0, 4.2, null)
        addEdge(c1, c2, "Old Quarter Lane", RoadClass.NARROW_LANE, 2.9, 6.0, 3.4, "obstacleNarrowLane")
        addEdge(c2, c3, "Canal Crossing Bridge", RoadClass.BRIDGE_CONSTRAINED, 3.8, 10.0, 3.8, "obstacleWeakBridge")
        addEdge(c3, endId, "Final Collector Approach", RoadClass.COLLECTOR_STREET, 5.0, 14.0, 4.2, null)

        // Emergency Arterial Corridor (wide, high weight limit, all vehicles)
        addEdge(startId, a1, "Emergency Arterial Feeder", RoadClass.ARTERIAL_CORRIDOR, 8.5, 28.0, 4.6, null)
        addEdge(a1, a2, "Main Emergency Boulevard", RoadClass.ARTERIAL_CORRIDOR, 9.0, 32.0, 4.8, null)
        addEdge(a2, a3, "Ring Emergency Avenue", RoadClass.ARTERIAL_CORRIDOR, 8.5, 28.0, 4.6, null)
        addEdge(a3, endId, "Paved Service Approach", RoadClass.ARTERIAL_CORRIDOR, 7.5, 24.0, 4.5, null)

        // Secondary Collector + Unpaved 4x4 Access Bypass
        addEdge(startId, s1, "District Link Road", RoadClass.COLLECTOR_STREET, 5.0, 14.0, 4.2, null)
        addEdge(s1, s2, "Gravel Utility Track", RoadClass.UNPAVED_ACCESS, 3.2, 9.0, 4.5, "obstacleUnpavedTrack")
        addEdge(s2, s3, "Perimeter Access Road", RoadClass.UNPAVED_ACCESS, 3.3, 9.5, 4.5, "obstacleUnpavedTrack")
        addEdge(s3, endId, "Secondary Collector", RoadClass.COLLECTOR_STREET, 4.8, 14.0, 4.2, null)

        // Cross-links allowing A* to weave around local hazards
        addEdge(c1, a1, "Cross Avenue N-1", RoadClass.ARTERIAL_CORRIDOR, 7.0, 22.0, 4.5, null)
        addEdge(c2, a2, "Cross Avenue N-2", RoadClass.COLLECTOR_STREET, 5.2, 16.0, 4.2, null)
        addEdge(c3, a3, "Cross Avenue N-3", RoadClass.ARTERIAL_CORRIDOR, 7.0, 22.0, 4.5, null)
        addEdge(c1, s1, "Cross Street S-1", RoadClass.COLLECTOR_STREET, 4.8, 14.0, 4.2, null)
        addEdge(c2, s2, "Cross Street S-2", RoadClass.COLLECTOR_STREET, 4.8, 14.0, 4.2, null)
        addEdge(c3, s3, "Cross Street S-3", RoadClass.COLLECTOR_STREET, 4.8, 14.0, 4.2, null)
    }

    private data class AStarState(
        val nodeId: String,
        val fScore: Double
    ) : Comparable<AStarState> {
        override fun compareTo(other: AStarState): Int = fScore.compareTo(other.fScore)
    }

    private fun runAStar(
        nodes: Map<String, GraphNode>,
        adj: Map<String, List<GraphEdge>>,
        startId: String,
        goalId: String,
        profile: EmergencyVehicleProfile,
        evaluateEdge: (GraphEdge) -> Pair<Double, String?>?
    ): List<GraphEdge>? {
        val goalPt = nodes[goalId]?.point ?: return null
        val maxSpeed = profile.cruiseSpeedMps * RoadClass.NATIONAL_HIGHWAY.speedMultiplier

        fun heuristic(nodeId: String): Double {
            val pt = nodes[nodeId]?.point ?: return 0.0
            return GeoUtils.distanceMeters(pt, goalPt) / maxSpeed
        }

        val gScore = HashMap<String, Double>()
        val cameFrom = HashMap<String, GraphEdge>()
        val closed = HashSet<String>()
        val open = PriorityQueue<AStarState>()

        gScore[startId] = 0.0
        open.add(AStarState(startId, heuristic(startId)))

        while (open.isNotEmpty()) {
            val current = open.poll() ?: break
            if (current.nodeId == goalId) {
                val reconstructed = mutableListOf<GraphEdge>()
                var cur = goalId
                while (cur != startId) {
                    val edge = cameFrom[cur] ?: break
                    reconstructed.add(edge)
                    cur = edge.fromId
                }
                reconstructed.reverse()
                return reconstructed
            }
            if (!closed.add(current.nodeId)) continue

            val currentG = gScore[current.nodeId] ?: continue
            val neighbors = adj[current.nodeId].orEmpty()
            for (edge in neighbors) {
                if (edge.toId in closed) continue
                val eval = evaluateEdge(edge) ?: continue
                val tentativeG = currentG + eval.first
                val prevG = gScore[edge.toId]
                if (prevG == null || tentativeG < prevG) {
                    gScore[edge.toId] = tentativeG
                    cameFrom[edge.toId] = edge
                    open.add(AStarState(edge.toId, tentativeG + heuristic(edge.toId)))
                }
            }
        }
        return null
    }
}
