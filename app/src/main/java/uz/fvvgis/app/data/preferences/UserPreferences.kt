package uz.fvvgis.app.data.preferences

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "fvv_gis_prefs")

data class AppPreferences(
    val locale: String = "uz",
    val darkTheme: Boolean = true,
    val activeAccountId: String? = null,
    val offlineMode: Boolean = false,
    val leaseExpiresAtMs: Long = 0L,
    val lastSyncAtMs: Long = 0L
)

class UserPreferences(private val context: Context) {
    private object Keys {
        val LOCALE = stringPreferencesKey("locale")
        val DARK_THEME = booleanPreferencesKey("dark_theme")
        val ACTIVE_ACCOUNT_ID = stringPreferencesKey("active_account_id")
        val OFFLINE_MODE = booleanPreferencesKey("offline_mode")
        val LEASE_EXPIRES_AT_MS = longPreferencesKey("lease_expires_at_ms")
        val LAST_SYNC_AT_MS = longPreferencesKey("last_sync_at_ms")
    }

    val preferences: Flow<AppPreferences> = context.dataStore.data.map { prefs ->
        AppPreferences(
            locale = prefs[Keys.LOCALE] ?: "uz",
            darkTheme = prefs[Keys.DARK_THEME] ?: true,
            activeAccountId = prefs[Keys.ACTIVE_ACCOUNT_ID],
            offlineMode = prefs[Keys.OFFLINE_MODE] ?: false,
            leaseExpiresAtMs = prefs[Keys.LEASE_EXPIRES_AT_MS] ?: 0L,
            lastSyncAtMs = prefs[Keys.LAST_SYNC_AT_MS] ?: 0L
        )
    }

    suspend fun setLocale(locale: String) {
        context.dataStore.edit { it[Keys.LOCALE] = locale }
    }

    suspend fun setDarkTheme(dark: Boolean) {
        context.dataStore.edit { it[Keys.DARK_THEME] = dark }
    }

    suspend fun setActiveAccount(accountId: String?, leaseExpiresAtMs: Long = 0L) {
        context.dataStore.edit { prefs ->
            if (accountId == null) {
                prefs.remove(Keys.ACTIVE_ACCOUNT_ID)
                prefs[Keys.LEASE_EXPIRES_AT_MS] = 0L
            } else {
                prefs[Keys.ACTIVE_ACCOUNT_ID] = accountId
                prefs[Keys.LEASE_EXPIRES_AT_MS] = leaseExpiresAtMs
            }
        }
    }

    suspend fun setOfflineMode(offline: Boolean) {
        context.dataStore.edit { it[Keys.OFFLINE_MODE] = offline }
    }

    suspend fun setLeaseExpiresAt(ms: Long) {
        context.dataStore.edit { it[Keys.LEASE_EXPIRES_AT_MS] = ms }
    }

    suspend fun setLastSyncAt(ms: Long) {
        context.dataStore.edit { it[Keys.LAST_SYNC_AT_MS] = ms }
    }
}
