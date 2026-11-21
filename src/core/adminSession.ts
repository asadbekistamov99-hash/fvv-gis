import { AppPreferences, AppRoute } from '../types/gis';

export const ADMIN_ACCOUNT_ID = 'admin-inspektor';

export interface NonAdminSessionSnapshot {
  activeAccountId: string | null;
  leaseExpiresAtMs: number;
}

/**
 * Verifies administrator login credentials.
 */
export function verifyAdminCredentials(username: string, password: string): boolean {
  const normalizedUser = username.trim().toLowerCase();
  const normalizedPass = password.trim();
  if (normalizedUser !== 'inspektor') return false;
  return normalizedPass === 'inspertor8007' || normalizedPass === 'inspektor8007';
}

/**
 * Captures the current non-admin user session before entering the standalone Admin Panel.
 * Never captures the hidden admin account ID as a restorable non-admin session.
 */
export function captureNonAdminSession(prefs: Pick<AppPreferences, 'activeAccountId' | 'leaseExpiresAtMs'>): NonAdminSessionSnapshot {
  if (!prefs.activeAccountId || prefs.activeAccountId === ADMIN_ACCOUNT_ID) {
    return { activeAccountId: null, leaseExpiresAtMs: 0 };
  }
  return {
    activeAccountId: prefs.activeAccountId,
    leaseExpiresAtMs: prefs.leaseExpiresAtMs,
  };
}

/**
 * Strips the ephemeral admin account from preferences when loading from or saving to storage,
 * ensuring reloads and panel closures never stay logged in as the admin inspector.
 */
export function sanitizePreferencesForStorage(
  prefs: AppPreferences,
  fallbackSession: NonAdminSessionSnapshot | null = null
): AppPreferences {
  if (prefs.activeAccountId !== ADMIN_ACCOUNT_ID) {
    return prefs;
  }
  return {
    ...prefs,
    activeAccountId: fallbackSession?.activeAccountId ?? null,
    leaseExpiresAtMs: fallbackSession?.leaseExpiresAtMs ?? 0,
  };
}

/**
 * Restores preferences back to the saved non-admin session when closing the Admin Panel.
 */
export function restoreNonAdminPreferences(
  prefs: AppPreferences,
  previousSession: NonAdminSessionSnapshot | null
): AppPreferences {
  const safeAccountId =
    previousSession?.activeAccountId && previousSession.activeAccountId !== ADMIN_ACCOUNT_ID
      ? previousSession.activeAccountId
      : null;
  return {
    ...prefs,
    activeAccountId: safeAccountId,
    leaseExpiresAtMs: safeAccountId ? previousSession?.leaseExpiresAtMs ?? 0 : 0,
  };
}

/**
 * Removes any 'admin' route entries from normal app navigation history so pressing Back
 * after closing the Admin Panel can never revisit it.
 */
export function stripAdminRoutes(history: AppRoute[]): AppRoute[] {
  const filtered = history.filter((route) => route.name !== 'admin');
  return filtered.length > 0 ? filtered : [{ name: 'home' }];
}
