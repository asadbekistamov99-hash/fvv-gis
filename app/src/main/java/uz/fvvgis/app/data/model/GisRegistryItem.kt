package uz.fvvgis.app.data.model

import androidx.compose.runtime.Immutable
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.GeoUtils
import uz.fvvgis.app.core.ParsedGeometry
import uz.fvvgis.app.data.local.CategoryEntity
import uz.fvvgis.app.data.local.InfrastructureObjectEntity
import uz.fvvgis.app.data.local.RegionEntity

enum class RegistryGeometryType {
    POINT,
    LINE,
    POLYGON
}

enum class RegistryCategoryGroup(val labelKey: String) {
    INFRASTRUCTURE("groupInfrastructure"),
    HAZARDS("groupHazards"),
    EQUIPMENT("groupEquipment");

    companion object {
        fun fromCategoryId(categoryId: String): RegistryCategoryGroup = when (categoryId) {
            "gas_pipeline",
            "gas_valve",
            "electrical_cable",
            "substation" -> HAZARDS

            "fire_hydrant",
            "pumping_station",
            "emergency_water_source" -> EQUIPMENT

            else -> INFRASTRUCTURE
        }
    }
}

enum class MarkerSeverity {
    OPERATIONAL,
    MAINTENANCE,
    FAULTY,
    UNAVAILABLE,
    UNKNOWN;

    companion object {
        fun fromOperationalStatus(status: String): MarkerSeverity = when (status) {
            "working" -> OPERATIONAL
            "under_maintenance" -> MAINTENANCE
            "faulty" -> FAULTY
            "temporarily_unavailable" -> UNAVAILABLE
            else -> UNKNOWN
        }
    }
}

/**
 * Domain/UI data model representing a GIS registry item and its resolved
 * map marker coordinate and spatial geometry for the map viewport.
 */
@Immutable
data class GisRegistryItem(
    val id: String,
    val code: String,
    val name: String,
    val description: String,
    val categoryId: String,
    val categoryName: String,
    val categoryGroup: RegistryCategoryGroup,
    val regionId: String,
    val regionName: String,
    val operationalStatus: String,
    val severity: MarkerSeverity,
    val lifecycle: String,
    val geometryType: RegistryGeometryType,
    val markerCoordinate: GeoPoint,
    val parsedGeometry: ParsedGeometry,
    val accuracyM: Double?,
    val updatedAt: String,
    val isSynthetic: Boolean,
    val isPublicProjected: Boolean
)

@Immutable
data class MarkerCluster(
    val id: String,
    val center: GeoPoint,
    val items: List<GisRegistryItem>
) {
    val count: Int get() = items.size
    val isCluster: Boolean get() = items.size > 1
    val primaryItem: GisRegistryItem get() = items.first()
    val worstStatus: String
        get() {
            val priority = listOf(
                "faulty",
                "temporarily_unavailable",
                "under_maintenance",
                "not_inspected",
                "unknown",
                "working"
            )
            return priority.firstOrNull { st -> items.any { it.operationalStatus == st } }
                ?: primaryItem.operationalStatus
        }
}

fun InfrastructureObjectEntity.toGisRegistryItem(
    regionsById: Map<String, RegionEntity>,
    categoriesById: Map<String, CategoryEntity>,
    localeCode: String
): GisRegistryItem? {
    val parsed = GeoUtils.parseGeoJson(geometryJson) ?: return null
    val geomType = when (parsed) {
        is ParsedGeometry.Point -> RegistryGeometryType.POINT
        is ParsedGeometry.LineString -> RegistryGeometryType.LINE
        is ParsedGeometry.Polygon -> RegistryGeometryType.POLYGON
    }
    return GisRegistryItem(
        id = id,
        code = code,
        name = name,
        description = description,
        categoryId = categoryId,
        categoryName = categoriesById[categoryId]?.localizedName(localeCode) ?: categoryId,
        categoryGroup = RegistryCategoryGroup.fromCategoryId(categoryId),
        regionId = regionId,
        regionName = regionsById[regionId]?.localizedName(localeCode) ?: regionId,
        operationalStatus = operationalStatus,
        severity = MarkerSeverity.fromOperationalStatus(operationalStatus),
        lifecycle = lifecycle,
        geometryType = geomType,
        markerCoordinate = parsed.representativePoint(),
        parsedGeometry = parsed,
        accuracyM = accuracyM,
        updatedAt = updatedAt,
        isSynthetic = isSynthetic,
        isPublicProjected = isPublicProjected
    )
}
