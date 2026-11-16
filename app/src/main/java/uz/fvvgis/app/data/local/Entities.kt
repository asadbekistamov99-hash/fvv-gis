package uz.fvvgis.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "regions")
data class RegionEntity(
    @PrimaryKey val id: String,
    val nameUz: String,
    val nameRu: String,
    val nameEn: String,
    val centerLat: Double,
    val centerLon: Double
) {
    fun localizedName(localeCode: String): String = when (localeCode) {
        "ru" -> nameRu
        "en" -> nameEn
        else -> nameUz
    }
}

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val id: String,
    val nameUz: String,
    val nameRu: String,
    val nameEn: String,
    val geometryTypesCsv: String,
    val iconName: String,
    val colorHex: String
) {
    fun localizedName(localeCode: String): String = when (localeCode) {
        "ru" -> nameRu
        "en" -> nameEn
        else -> nameUz
    }
}

@Entity(tableName = "accounts")
data class UserAccountEntity(
    @PrimaryKey val id: String,
    val phone: String,
    val fullName: String,
    val role: String,
    val employeeStatus: String?,
    val organizationId: String?,
    val regionId: String?,
    val districtId: String?,
    val department: String? = null,
    val verificationReference: String? = null,
    val policyEpoch: Int = 1,
    val isSynthetic: Boolean = true
) {
    val isEmployee: Boolean
        get() = role in EMPLOYEE_ROLES && employeeStatus == "verified"

    val canReviewOrPublish: Boolean
        get() = isEmployee && role in REVIEWER_ROLES

    val canApproveRoutes: Boolean
        get() = isEmployee && role in SUPERVISOR_ROLES

    companion object {
        val EMPLOYEE_ROLES = setOf(
            "verified_employee",
            "regional_supervisor",
            "infrastructure_inspector",
            "data_reviewer",
            "system_administrator",
            "super_administrator"
        )
        val REVIEWER_ROLES = setOf(
            "data_reviewer",
            "regional_supervisor",
            "system_administrator",
            "super_administrator"
        )
        val SUPERVISOR_ROLES = setOf(
            "regional_supervisor",
            "system_administrator",
            "super_administrator"
        )
    }
}

@Entity(tableName = "infrastructure_objects")
data class InfrastructureObjectEntity(
    @PrimaryKey val id: String,
    val code: String,
    val name: String,
    val description: String,
    val categoryId: String,
    val regionId: String,
    val districtId: String?,
    val geometryJson: String,
    val operationalStatus: String,
    val lifecycle: String,
    val sensitivity: String,
    val version: Int,
    val passportJson: String,
    val accuracyM: Double?,
    val updatedAt: String,
    val isSynthetic: Boolean,
    val isPublicProjected: Boolean = false
)

@Entity(tableName = "inspections")
data class InspectionEntity(
    @PrimaryKey val id: String,
    val objectId: String,
    val inspectorName: String,
    val condition: String,
    val operationalStatus: String,
    val notes: String,
    val nextInspectionDate: String?,
    val createdAt: String
)

@Entity(tableName = "citizen_reports")
data class CitizenReportEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val category: String,
    val description: String,
    val regionId: String?,
    val geometryJson: String?,
    val contactPhone: String?,
    val status: String,
    val resolution: String? = null,
    val attachmentCount: Int = 0,
    val isSynthetic: Boolean = true,
    val createdAt: String,
    val updatedAt: String
)

@Entity(tableName = "approved_routes")
data class ApprovedRouteEntity(
    @PrimaryKey val id: String,
    val destinationObjectId: String,
    val destinationName: String,
    val requestedBy: String,
    val geometryJson: String,
    val stepsJson: String,
    val distanceM: Double,
    val durationS: Double,
    val status: String,
    val approvedBy: String?,
    val expiresAtEpochMs: Long?,
    val sourceDate: String,
    val version: Int,
    val createdAt: String
)

@Entity(tableName = "sync_operations")
data class SyncOperationEntity(
    @PrimaryKey val operationId: String,
    val entityType: String,
    val action: String,
    val objectId: String?,
    val objectName: String,
    val expectedVersion: Int?,
    val payloadJson: String,
    val status: String, // "pending", "conflict", "settled"
    val errorMessage: String? = null,
    val createdAt: String
)

@Entity(tableName = "notifications")
data class NotificationEntity(
    @PrimaryKey val id: String,
    val userId: String?,
    val title: String,
    val body: String,
    val kind: String,
    val readAt: String?,
    val createdAt: String
)

@Entity(tableName = "object_attachments")
data class ObjectAttachmentEntity(
    @PrimaryKey val id: String,
    val objectId: String?,
    val reportId: String?,
    val filename: String,
    val mimeType: String,
    val uriString: String,
    val scanStatus: String,
    val createdAt: String
)

@Entity(tableName = "drafts")
data class DraftEntity(
    @PrimaryKey val draftId: String,
    val payloadJson: String,
    val updatedAtMs: Long
)
