package uz.fvvgis.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        RegionEntity::class,
        CategoryEntity::class,
        UserAccountEntity::class,
        InfrastructureObjectEntity::class,
        InspectionEntity::class,
        CitizenReportEntity::class,
        ApprovedRouteEntity::class,
        SyncOperationEntity::class,
        NotificationEntity::class,
        ObjectAttachmentEntity::class,
        DraftEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun regionDao(): RegionDao
    abstract fun categoryDao(): CategoryDao
    abstract fun accountDao(): AccountDao
    abstract fun infrastructureDao(): InfrastructureDao
    abstract fun inspectionDao(): InspectionDao
    abstract fun reportDao(): ReportDao
    abstract fun routeDao(): RouteDao
    abstract fun syncDao(): SyncDao
    abstract fun notificationDao(): NotificationDao
    abstract fun attachmentDao(): AttachmentDao
    abstract fun draftDao(): DraftDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "fvv_gis_uzbekistan.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
