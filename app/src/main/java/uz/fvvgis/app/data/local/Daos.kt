package uz.fvvgis.app.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface RegionDao {
    @Query("SELECT * FROM regions ORDER BY nameUz ASC")
    fun observeAll(): Flow<List<RegionEntity>>

    @Query("SELECT COUNT(*) FROM regions")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<RegionEntity>)
}

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY nameUz ASC")
    fun observeAll(): Flow<List<CategoryEntity>>

    @Query("SELECT COUNT(*) FROM categories")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<CategoryEntity>)
}

@Dao
interface AccountDao {
    @Query("SELECT * FROM accounts ORDER BY role ASC")
    fun observeAll(): Flow<List<UserAccountEntity>>

    @Query("SELECT * FROM accounts WHERE id = :id LIMIT 1")
    fun observeById(id: String): Flow<UserAccountEntity?>

    @Query("SELECT * FROM accounts WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): UserAccountEntity?

    @Query("SELECT * FROM accounts WHERE phone = :phone LIMIT 1")
    suspend fun getByPhone(phone: String): UserAccountEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(account: UserAccountEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<UserAccountEntity>)

    @Query("DELETE FROM accounts WHERE id = :id")
    suspend fun deleteById(id: String)
}

@Dao
interface InfrastructureDao {
    @Query("SELECT * FROM infrastructure_objects ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<InfrastructureObjectEntity>>

    @Query("SELECT * FROM infrastructure_objects WHERE isPublicProjected = 1 OR lifecycle = 'published' ORDER BY updatedAt DESC")
    fun observePublic(): Flow<List<InfrastructureObjectEntity>>

    @Query("SELECT * FROM infrastructure_objects WHERE id = :id LIMIT 1")
    fun observeById(id: String): Flow<InfrastructureObjectEntity?>

    @Query("SELECT * FROM infrastructure_objects WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): InfrastructureObjectEntity?

    @Query("SELECT COUNT(*) FROM infrastructure_objects")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: InfrastructureObjectEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<InfrastructureObjectEntity>)
}

@Dao
interface InspectionDao {
    @Query("SELECT * FROM inspections WHERE objectId = :objectId ORDER BY createdAt DESC")
    fun observeForObject(objectId: String): Flow<List<InspectionEntity>>

    @Query("SELECT * FROM inspections ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<InspectionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: InspectionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<InspectionEntity>)
}

@Dao
interface ReportDao {
    @Query("SELECT * FROM citizen_reports WHERE userId = :userId ORDER BY createdAt DESC")
    fun observeByUser(userId: String): Flow<List<CitizenReportEntity>>

    @Query("SELECT * FROM citizen_reports ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<CitizenReportEntity>>

    @Query("SELECT * FROM citizen_reports WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): CitizenReportEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: CitizenReportEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<CitizenReportEntity>)
}

@Dao
interface RouteDao {
    @Query("SELECT * FROM approved_routes ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<ApprovedRouteEntity>>

    @Query("SELECT * FROM approved_routes WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): ApprovedRouteEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: ApprovedRouteEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<ApprovedRouteEntity>)
}

@Dao
interface SyncDao {
    @Query("SELECT * FROM sync_operations WHERE status != 'settled' ORDER BY createdAt DESC")
    fun observePendingAndConflicts(): Flow<List<SyncOperationEntity>>

    @Query("SELECT * FROM sync_operations WHERE status = 'pending' ORDER BY createdAt ASC")
    suspend fun getPending(): List<SyncOperationEntity>

    @Query("SELECT * FROM sync_operations WHERE operationId = :id LIMIT 1")
    suspend fun getById(id: String): SyncOperationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: SyncOperationEntity)

    @Query("DELETE FROM sync_operations WHERE operationId = :id")
    suspend fun deleteById(id: String)
}

@Dao
interface NotificationDao {
    @Query("SELECT * FROM notifications ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<NotificationEntity>>

    @Query("UPDATE notifications SET readAt = :readAt WHERE id = :id")
    suspend fun markRead(id: String, readAt: String)

    @Query("UPDATE notifications SET readAt = :readAt WHERE readAt IS NULL")
    suspend fun markAllRead(readAt: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: NotificationEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<NotificationEntity>)
}

@Dao
interface AttachmentDao {
    @Query("SELECT * FROM object_attachments WHERE objectId = :objectId ORDER BY createdAt DESC")
    fun observeForObject(objectId: String): Flow<List<ObjectAttachmentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: ObjectAttachmentEntity)
}

@Dao
interface DraftDao {
    @Query("SELECT * FROM drafts WHERE draftId = :draftId LIMIT 1")
    suspend fun getDraft(draftId: String): DraftEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveDraft(draft: DraftEntity)

    @Query("DELETE FROM drafts WHERE draftId = :draftId")
    suspend fun deleteDraft(draftId: String)
}
