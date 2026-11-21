import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_ACCOUNT_ID,
  captureNonAdminSession,
  restoreNonAdminPreferences,
  sanitizePreferencesForStorage,
  stripAdminRoutes,
  verifyAdminCredentials,
} from './adminSession';
import { AppPreferences, AppRoute } from '../types/gis';

const basePrefs: AppPreferences = {
  locale: 'uz',
  darkTheme: true,
  activeAccountId: 'citizen-1',
  offlineMode: false,
  leaseExpiresAtMs: 123456,
  lastSyncAtMs: 999,
};

test('verifyAdminCredentials accepts valid inspector credentials and rejects invalid ones', () => {
  assert.equal(verifyAdminCredentials('inspektor', 'inspertor8007'), true);
  assert.equal(verifyAdminCredentials('  INSPEKTOR ', 'inspektor8007 '), true);
  assert.equal(verifyAdminCredentials('inspektor', 'wrongpass'), false);
  assert.equal(verifyAdminCredentials('admin', 'inspertor8007'), false);
  assert.equal(verifyAdminCredentials('', ''), false);
});

test('captureNonAdminSession saves regular user and ignores admin-inspektor', () => {
  const regular = captureNonAdminSession(basePrefs);
  assert.deepEqual(regular, { activeAccountId: 'citizen-1', leaseExpiresAtMs: 123456 });

  const fromAdmin = captureNonAdminSession({
    activeAccountId: ADMIN_ACCOUNT_ID,
    leaseExpiresAtMs: 999999,
  });
  assert.deepEqual(fromAdmin, { activeAccountId: null, leaseExpiresAtMs: 0 });
});

test('sanitizePreferencesForStorage strips admin-inspektor so reload never stays in admin mode', () => {
  const adminPrefs: AppPreferences = {
    ...basePrefs,
    activeAccountId: ADMIN_ACCOUNT_ID,
    leaseExpiresAtMs: 999999,
  };
  const sanitized = sanitizePreferencesForStorage(adminPrefs, {
    activeAccountId: 'citizen-1',
    leaseExpiresAtMs: 123456,
  });
  assert.equal(sanitized.activeAccountId, 'citizen-1');
  assert.equal(sanitized.leaseExpiresAtMs, 123456);

  const sanitizedGuest = sanitizePreferencesForStorage(adminPrefs, null);
  assert.equal(sanitizedGuest.activeAccountId, null);
  assert.equal(sanitizedGuest.leaseExpiresAtMs, 0);
});

test('restoreNonAdminPreferences restores previous non-admin session on panel close', () => {
  const adminPrefs: AppPreferences = {
    ...basePrefs,
    activeAccountId: ADMIN_ACCOUNT_ID,
    leaseExpiresAtMs: 999999,
  };
  const restored = restoreNonAdminPreferences(adminPrefs, {
    activeAccountId: 'citizen-1',
    leaseExpiresAtMs: 123456,
  });
  assert.equal(restored.activeAccountId, 'citizen-1');
  assert.equal(restored.leaseExpiresAtMs, 123456);

  const restoredFromNull = restoreNonAdminPreferences(adminPrefs, null);
  assert.equal(restoredFromNull.activeAccountId, null);
  assert.equal(restoredFromNull.leaseExpiresAtMs, 0);
});

test('stripAdminRoutes removes admin routes from history and falls back to home', () => {
  const history: AppRoute[] = [{ name: 'home' }, { name: 'map' }, { name: 'admin' }];
  assert.deepEqual(stripAdminRoutes(history), [{ name: 'home' }, { name: 'map' }]);

  const onlyAdmin: AppRoute[] = [{ name: 'admin' }];
  assert.deepEqual(stripAdminRoutes(onlyAdmin), [{ name: 'home' }]);
});
