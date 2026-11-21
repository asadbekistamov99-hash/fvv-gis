import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppLocale,
  ApprovedRouteEntity,
  CategoryEntity,
  CitizenReportEntity,
  EmergencySubmissionResult,
  GeoBounds,
  GeoPoint,
  GisRegistryItem,
  InfrastructureObjectEntity,
  InspectionEntity,
  NotificationEntity,
  ObjectAttachmentEntity,
  OtpChallenge,
  RegionEntity,
  SyncOperationEntity,
  UserAccountEntity,
  isAccountEmployee,
} from '../types/gis';
import { toGisRegistryItem } from '../core/geoUtils';
import {
  NonAdminSessionSnapshot,
  captureNonAdminSession,
  restoreNonAdminPreferences,
  sanitizePreferencesForStorage,
  verifyAdminCredentials,
} from '../core/adminSession';
import { L10n } from '../core/localization';
import { OfflineAreaRecord, OfflineTileEstimator } from '../core/offlineMapManager';
import { Repository, StoreSnapshot, loadStore, saveStore } from '../data/repository';

export interface MainUiState {
  initializing: boolean;
  locale: AppLocale;
  darkTheme: boolean;
  account: UserAccountEntity | null;
  offlineMode: boolean;
  isNetworkConnected: boolean;
  isEffectiveOffline: boolean;
  isEmployee: boolean;
  leaseExpiresAtMs: number;
  lastSyncAtMs: number;
  currentTimeMs: number;
  isLeaseValid: boolean;
  leaseRemainingMinutes: number;
  syncing: boolean;
  message: string | null;
  authChallenge: OtpChallenge | null;
  authBusy: boolean;
  authError: string | null;
}

interface AppContextValue {
  state: MainUiState;
  regions: RegionEntity[];
  categories: CategoryEntity[];
  accounts: UserAccountEntity[];
  allObjects: InfrastructureObjectEntity[];
  publicObjects: InfrastructureObjectEntity[];
  mapMarkers: GisRegistryItem[];
  myReports: CitizenReportEntity[];
  allReports: CitizenReportEntity[];
  approvedRoutes: ApprovedRouteEntity[];
  syncQueue: SyncOperationEntity[];
  notifications: NotificationEntity[];
  savedOfflineAreas: OfflineAreaRecord[];
  creatingOfflineArea: boolean;
  adminUnlocked: boolean;

  clearMessage: () => void;
  showMessage: (msg: string) => void;
  setLocale: (locale: AppLocale) => void;
  setDarkTheme: (dark: boolean) => void;
  setOfflineMode: (offline: boolean) => void;
  renewLease: () => void;
  expireLeaseForTesting: () => void;

  requestLoginOtp: (phone: string) => void;
  requestRegisterOtp: (params: {
    phone: string;
    fullName: string;
    isEmployeeApplication: boolean;
    organizationId: string | null;
    regionId: string | null;
    department: string | null;
    verificationReference: string | null;
  }) => void;
  verifyOtp: (code: string, onVerified: (acc: UserAccountEntity) => void) => void;
  cancelAuthChallenge: () => void;
  updateProfileName: (newName: string) => void;
  logout: (onDone: () => void) => void;
  deleteAccount: (onDone: () => void) => void;

  getDraft: (draftId: string) => string | null;
  saveDraft: (draftId: string, payloadJson: string) => void;
  saveInfrastructureObject: (params: {
    existingId: string | null;
    code: string;
    name: string;
    description: string;
    categoryId: string;
    regionId: string;
    geometryJson: string;
    operationalStatus: string;
    passportJson: string;
    accuracyM: number | null;
    attachments: { filename: string; uriString: string }[];
  }) => { resultId: string; queued: boolean };

  submitObjectForReview: (objectId: string) => void;
  reviewObject: (objectId: string, approve: boolean) => void;
  addInspection: (
    objectId: string,
    condition: string,
    operationalStatus: string,
    notes: string,
    nextDate: string | null
  ) => void;

  submitCitizenReport: (
    category: string,
    description: string,
    regionId: string,
    location: GeoPoint | null,
    attachmentCount: number,
    onDone: (report: CitizenReportEntity) => void
  ) => void;

  submitEmergencyIncident: (
    pinLocation: GeoPoint,
    currentUserLocation: GeoPoint | null,
    categoryId: string,
    hazardTitle: string,
    notes: string,
    regionId: string,
    onDone: (result: EmergencySubmissionResult) => void
  ) => void;

  requestRoute: (
    objectId: string,
    origin: GeoPoint,
    onDone: (res: { ok: true; route: ApprovedRouteEntity } | { ok: false; error: string }) => void
  ) => void;
  approveRoute: (routeId: string) => void;
  withdrawRoute: (routeId: string) => void;

  synchronize: () => void;
  simulateConflict: (objectId: string) => void;
  resolveConflictAcceptServer: (operationId: string) => void;
  resolveConflictRetryLocal: (operationId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  getObjectById: (id: string) => InfrastructureObjectEntity | null;
  getInspectionsForObject: (objectId: string) => InspectionEntity[];
  getAttachmentsForObject: (objectId: string) => ObjectAttachmentEntity[];

  startOfflineAreaDownload: (params: {
    name: string;
    bounds: GeoBounds;
    minZoom: number;
    maxZoom: number;
    onComplete: (area: OfflineAreaRecord) => void;
  }) => void;
  toggleOfflineAreaPauseResume: (areaId: number) => void;
  deleteOfflineArea: (areaId: number, onDeleted: () => void) => void;

  loginAdminPanel: (username: string, password: string) => { ok: true } | { ok: false; error: string };
  lockAdminPanel: () => void;
  verifyEmployeeApplication: (accountId: string, approve: boolean, role?: string) => void;
  updateCitizenReportStatus: (reportId: string, status: string, resolution?: string | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<StoreSnapshot>(() => {
    const loaded = loadStore();
    const sanitizedPrefs = sanitizePreferencesForStorage(loaded.preferences, null);
    if (sanitizedPrefs !== loaded.preferences) {
      const cleaned = { ...loaded, preferences: sanitizedPrefs };
      saveStore(cleaned);
      return cleaned;
    }
    return loaded;
  });
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isNetworkConnected, setIsNetworkConnected] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authChallenge, setAuthChallenge] = useState<OtpChallenge | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [creatingOfflineArea, setCreatingOfflineArea] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const prevNonAdminSessionRef = useRef<NonAdminSessionSnapshot | null>(null);

  const persistStoreSafely = useCallback((snapshot: StoreSnapshot) => {
    const sanitizedPrefs = sanitizePreferencesForStorage(
      snapshot.preferences,
      prevNonAdminSessionRef.current
    );
    if (sanitizedPrefs !== snapshot.preferences) {
      saveStore({ ...snapshot, preferences: sanitizedPrefs });
    } else {
      saveStore(snapshot);
    }
  }, []);

  const updateStore = useCallback(
    (updater: (prev: StoreSnapshot) => StoreSnapshot) => {
      setStore((prev) => {
        const next = updater(prev);
        persistStoreSafely(next);
        return next;
      });
    },
    [persistStoreSafely]
  );

  // Sync dark theme class & html lang attribute
  useEffect(() => {
    const root = document.documentElement;
    if (store.preferences.darkTheme) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.lang = store.preferences.locale;
  }, [store.preferences.darkTheme, store.preferences.locale]);

  // 5-second lease ticker
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  // Browser online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsNetworkConnected(true);
    const handleOffline = () => setIsNetworkConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const account = useMemo(
    () => store.accounts.find((a) => a.id === store.preferences.activeAccountId) ?? null,
    [store.accounts, store.preferences.activeAccountId]
  );

  const isEmployee = isAccountEmployee(account);
  const isLeaseValid = isEmployee && store.preferences.leaseExpiresAtMs > nowMs;
  const leaseRemainingMinutes = !isLeaseValid
    ? 0
    : Math.max(1, Math.floor((store.preferences.leaseExpiresAtMs - nowMs) / 60_000));
  const isEffectiveOffline = store.preferences.offlineMode || !isNetworkConnected;

  const state: MainUiState = useMemo(
    () => ({
      initializing: false,
      locale: store.preferences.locale,
      darkTheme: store.preferences.darkTheme,
      account,
      offlineMode: store.preferences.offlineMode,
      isNetworkConnected,
      isEffectiveOffline,
      isEmployee,
      leaseExpiresAtMs: store.preferences.leaseExpiresAtMs,
      lastSyncAtMs: store.preferences.lastSyncAtMs,
      currentTimeMs: nowMs,
      isLeaseValid,
      leaseRemainingMinutes,
      syncing,
      message,
      authChallenge,
      authBusy,
      authError,
    }),
    [
      store.preferences,
      account,
      isNetworkConnected,
      isEffectiveOffline,
      isEmployee,
      nowMs,
      isLeaseValid,
      leaseRemainingMinutes,
      syncing,
      message,
      authChallenge,
      authBusy,
      authError,
    ]
  );

  // Auto-flush queue when coming back online
  const autoSyncLock = useRef(false);
  useEffect(() => {
    if (isEffectiveOffline || syncing || autoSyncLock.current) return;
    const hasFlushable = store.syncQueue.some(
      (op) =>
        op.status === 'pending' &&
        (op.entityType === 'emergency_incident' ||
          op.entityType === 'citizen_report' ||
          (isEmployee && op.entityType === 'infrastructure'))
    );
    if (!hasFlushable) return;
    autoSyncLock.current = true;
    const timer = window.setTimeout(() => {
      let pushedReports = 0;
      let totalSynced = 0;
      setStore((prev) => {
        const { next, result } = Repository.synchronizeQueue(prev, account, false);
        pushedReports = result.pushedReports;
        totalSynced = result.pushedReports + result.pushedInfrastructure;
        persistStoreSafely(next);
        return next;
      });
      setNowMs(Date.now());
      if (pushedReports > 0) {
        setMessage(`${pushedReports} ${L10n.text(store.preferences.locale, 'autoSyncCompletedMsg')}`);
      } else if (totalSynced > 0) {
        setMessage(`${L10n.text(store.preferences.locale, 'sync')}: ${totalSynced}`);
      }
      autoSyncLock.current = false;
    }, 350);
    return () => {
      window.clearTimeout(timer);
      autoSyncLock.current = false;
    };
  }, [isEffectiveOffline, store.syncQueue, isEmployee, account, syncing, store.preferences.locale, persistStoreSafely]);

  // Simulate progressive tile downloads for active offline regions
  useEffect(() => {
    const hasActive = store.offlineAreas.some((a) => a.isActive && !a.isComplete);
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      const completedNames: OfflineAreaRecord[] = [];
      updateStore((prev) => {
        const updatedAreas = prev.offlineAreas.map((area) => {
          if (!area.isActive || area.isComplete) return area;
          const step = Math.max(1, Math.ceil(area.requiredResources / 6));
          const nextCompleted = Math.min(area.requiredResources, area.completedResources + step);
          const done = nextCompleted >= area.requiredResources;
          const updated: OfflineAreaRecord = {
            ...area,
            completedResources: nextCompleted,
            completedBytes: OfflineTileEstimator.estimateBytes(nextCompleted),
            isComplete: done,
            isActive: !done,
          };
          if (done) completedNames.push(updated);
          return updated;
        });
        return { ...prev, offlineAreas: updatedAreas };
      });
      if (completedNames.length > 0) {
        const first = completedNames[0];
        setMessage(`${first.name} · ${L10n.text(store.preferences.locale, 'downloadCompletedMsg')}`);
      }
    }, 450);
    return () => window.clearInterval(timer);
  }, [store.offlineAreas, store.preferences.locale, updateStore]);

  const publicObjects = useMemo(
    () =>
      store.infrastructure.filter(
        (obj) => obj.isPublicProjected && obj.lifecycle === 'published'
      ),
    [store.infrastructure]
  );

  const mapMarkers = useMemo(() => {
    const visible = isEmployee && isLeaseValid ? store.infrastructure : publicObjects;
    const regionsById = new Map(store.regions.map((r) => [r.id, r]));
    const categoriesById = new Map(store.categories.map((c) => [c.id, c]));
    return visible
      .map((obj) => toGisRegistryItem(obj, regionsById, categoriesById, store.preferences.locale))
      .filter((item): item is GisRegistryItem => item !== null);
  }, [isEmployee, isLeaseValid, store.infrastructure, publicObjects, store.regions, store.categories, store.preferences.locale]);

  const myReports = useMemo(() => {
    if (!account) return [];
    return store.reports.filter((r) => r.userId === account.id);
  }, [account, store.reports]);

  const clearMessage = useCallback(() => setMessage(null), []);
  const showMessage = useCallback((msg: string) => setMessage(msg), []);

  const setLocale = useCallback(
    (locale: AppLocale) => {
      updateStore((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, locale },
      }));
    },
    [updateStore]
  );

  const setDarkTheme = useCallback(
    (darkTheme: boolean) => {
      updateStore((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, darkTheme },
      }));
    },
    [updateStore]
  );

  const setOfflineMode = useCallback(
    (offlineMode: boolean) => {
      updateStore((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, offlineMode },
      }));
    },
    [updateStore]
  );

  const renewLease = useCallback(() => {
    if (!isEmployee) return;
    const now = Date.now();
    updateStore((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        offlineMode: false,
        leaseExpiresAtMs: now + 8 * 3600_000,
        lastSyncAtMs: now,
      },
    }));
    setNowMs(now);
    setMessage('8 soatlik operativ ruxsat yangilandi.');
  }, [isEmployee, updateStore]);

  const expireLeaseForTesting = useCallback(() => {
    const now = Date.now();
    updateStore((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, leaseExpiresAtMs: now - 1000 },
    }));
    setNowMs(now);
  }, [updateStore]);

  const requestLoginOtp = useCallback(
    (phone: string) => {
      setAuthBusy(true);
      setAuthError(null);
      const res = Repository.requestLoginOtp(store, phone);
      setAuthBusy(false);
      if (res.ok) {
        setAuthChallenge(res.challenge);
      } else {
        setAuthError(res.error);
      }
    },
    [store]
  );

  const requestRegisterOtp = useCallback(
    (params: {
      phone: string;
      fullName: string;
      isEmployeeApplication: boolean;
      organizationId: string | null;
      regionId: string | null;
      department: string | null;
      verificationReference: string | null;
    }) => {
      setAuthBusy(true);
      setAuthError(null);
      const res = Repository.requestRegisterOtp(store, params);
      setAuthBusy(false);
      if (res.ok) {
        setAuthChallenge(res.challenge);
      } else {
        setAuthError(res.error);
      }
    },
    [store]
  );

  const verifyOtp = useCallback(
    (code: string, onVerified: (acc: UserAccountEntity) => void) => {
      if (!authChallenge) return;
      setAuthBusy(true);
      setAuthError(null);
      const res = Repository.verifyOtp(store, authChallenge, code);
      setAuthBusy(false);
      if (res.ok) {
        persistStoreSafely(res.next);
        setStore(res.next);
        setNowMs(Date.now());
        setAuthChallenge(null);
        setAuthError(null);
        onVerified(res.account);
      } else {
        setAuthError(res.error);
      }
    },
    [authChallenge, persistStoreSafely, store]
  );

  const cancelAuthChallenge = useCallback(() => {
    setAuthChallenge(null);
    setAuthError(null);
  }, []);

  const updateProfileName = useCallback(
    (newName: string) => {
      if (!account) return;
      const trimmed = newName.trim();
      updateStore((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === account.id ? { ...a, fullName: trimmed } : a
        ),
      }));
      setMessage('Profil yangilandi.');
    },
    [account, updateStore]
  );

  const logout = useCallback(
    (onDone: () => void) => {
      setAdminUnlocked(false);
      updateStore((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          activeAccountId: null,
          leaseExpiresAtMs: 0,
        },
      }));
      onDone();
    },
    [updateStore]
  );

  const deleteAccount = useCallback(
    (onDone: () => void) => {
      if (!account) return;
      updateStore((prev) => ({
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== account.id),
        preferences: {
          ...prev.preferences,
          activeAccountId: null,
          leaseExpiresAtMs: 0,
        },
      }));
      onDone();
    },
    [account, updateStore]
  );

  const getDraft = useCallback(
    (draftId: string) => store.drafts[draftId]?.payloadJson ?? null,
    [store.drafts]
  );

  const saveDraft = useCallback(
    (draftId: string, payloadJson: string) => {
      updateStore((prev) => ({
        ...prev,
        drafts: {
          ...prev.drafts,
          [draftId]: { draftId, payloadJson, updatedAtMs: Date.now() },
        },
      }));
    },
    [updateStore]
  );

  const saveInfrastructureObject = useCallback(
    (params: {
      existingId: string | null;
      code: string;
      name: string;
      description: string;
      categoryId: string;
      regionId: string;
      geometryJson: string;
      operationalStatus: string;
      passportJson: string;
      accuracyM: number | null;
      attachments: { filename: string; uriString: string }[];
    }) => {
      let outId = '';
      let outQueued = false;
      updateStore((prev) => {
        const res = Repository.saveInfrastructureObject(prev, {
          ...params,
          isOffline: isEffectiveOffline,
        });
        outId = res.resultId;
        outQueued = res.queued;
        return res.next;
      });
      return { resultId: outId, queued: outQueued };
    },
    [isEffectiveOffline, updateStore]
  );

  const submitObjectForReview = useCallback(
    (objectId: string) => {
      updateStore((prev) => Repository.submitObjectForReview(prev, objectId));
      setMessage('Obyekt ko‘rib chiqishga yuborildi.');
    },
    [updateStore]
  );

  const reviewObject = useCallback(
    (objectId: string, approve: boolean) => {
      updateStore((prev) => Repository.reviewObject(prev, objectId, approve));
      setMessage(approve ? 'Obyekt nashr etildi.' : 'Tuzatishga qaytarildi.');
    },
    [updateStore]
  );

  const addInspection = useCallback(
    (
      objectId: string,
      condition: string,
      operationalStatus: string,
      notes: string,
      nextInspectionDate: string | null
    ) => {
      const inspectorName = account?.fullName ?? 'Xodim';
      updateStore((prev) =>
        Repository.addInspection(prev, {
          objectId,
          inspectorName,
          condition,
          operationalStatus,
          notes,
          nextInspectionDate,
        })
      );
      setMessage('Tekshiruv saqlandi.');
    },
    [account, updateStore]
  );

  const submitCitizenReport = useCallback(
    (
      category: string,
      description: string,
      regionId: string,
      location: GeoPoint | null,
      attachmentCount: number,
      onDone: (report: CitizenReportEntity) => void
    ) => {
      if (!account) return;
      const res = Repository.submitCitizenReport(store, {
        userId: account.id,
        category,
        description,
        regionId,
        location,
        contactPhone: account.phone,
        attachmentCount,
        isOffline: isEffectiveOffline,
      });
      persistStoreSafely(res.next);
      setStore(res.next);
      onDone(res.report);
    },
    [account, isEffectiveOffline, persistStoreSafely, store]
  );

  const submitEmergencyIncident = useCallback(
    (
      pinLocation: GeoPoint,
      currentUserLocation: GeoPoint | null,
      categoryId: string,
      hazardTitle: string,
      notes: string,
      regionId: string,
      onDone: (result: EmergencySubmissionResult) => void
    ) => {
      const res = Repository.submitEmergencyIncident(store, {
        pinLocation,
        currentUserLocation,
        categoryId,
        hazardTitle,
        notes,
        regionId,
        reporterUserId: account?.id ?? null,
        reporterPhone: account?.phone ?? null,
        isOffline: isEffectiveOffline,
      });
      persistStoreSafely(res.next);
      setStore(res.next);
      onDone(res.result);
    },
    [account, isEffectiveOffline, persistStoreSafely, store]
  );

  const requestRoute = useCallback(
    (
      objectId: string,
      origin: GeoPoint,
      onDone: (res: { ok: true; route: ApprovedRouteEntity } | { ok: false; error: string }) => void
    ) => {
      if (!account) return;
      const res = Repository.requestRoute(store, objectId, origin, account.id);
      if (res.ok) {
        persistStoreSafely(res.next);
        setStore(res.next);
        onDone({ ok: true, route: res.route });
      } else {
        onDone({ ok: false, error: res.error });
      }
    },
    [account, persistStoreSafely, store]
  );

  const approveRoute = useCallback(
    (routeId: string) => {
      const approver = account?.fullName ?? 'Rahbar';
      updateStore((prev) => Repository.approveRoute(prev, routeId, approver));
      setMessage('Marshrut tasdiqlandi.');
    },
    [account, updateStore]
  );

  const withdrawRoute = useCallback(
    (routeId: string) => {
      updateStore((prev) => Repository.withdrawRoute(prev, routeId));
      setMessage('Marshrut bekor qilindi.');
    },
    [updateStore]
  );

  const synchronize = useCallback(() => {
    if (syncing) return;
    if (!isNetworkConnected) {
      setMessage(L10n.text(store.preferences.locale, 'waitingForNetworkHint'));
      return;
    }
    setSyncing(true);
    const { next, result } = Repository.synchronizeQueue(store, account, true);
    persistStoreSafely(next);
    setStore(next);
    setNowMs(Date.now());
    setSyncing(false);
    const totalSynced = result.pushedReports + result.pushedInfrastructure;
    const conflictLabel = L10n.pick(store.preferences.locale, 'Konfliktlar', 'Конфликты', 'Conflicts');
    setMessage(`${L10n.text(store.preferences.locale, 'sync')}: ${totalSynced} · ${conflictLabel}: ${result.conflicts}`);
  }, [account, isNetworkConnected, persistStoreSafely, store, syncing]);

  const simulateConflict = useCallback(
    (objectId: string) => {
      updateStore((prev) => Repository.createSimulatedConflict(prev, objectId));
      setMessage('Sinov konflikti yaratildi (409).');
    },
    [updateStore]
  );

  const resolveConflictAcceptServer = useCallback(
    (operationId: string) => {
      updateStore((prev) => Repository.resolveConflictAcceptServer(prev, operationId));
      setMessage('Server versiyasi saqlandi.');
    },
    [updateStore]
  );

  const resolveConflictRetryLocal = useCallback(
    (operationId: string) => {
      updateStore((prev) => Repository.resolveConflictRetryLocal(prev, operationId));
      setMessage('Mahalliy tahrir qayta navbatga qo‘yildi.');
    },
    [updateStore]
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      updateStore((prev) => Repository.markNotificationRead(prev, id));
    },
    [updateStore]
  );

  const markAllNotificationsRead = useCallback(() => {
    updateStore((prev) => Repository.markAllNotificationsRead(prev));
  }, [updateStore]);

  const getObjectById = useCallback(
    (id: string) => store.infrastructure.find((o) => o.id === id) ?? null,
    [store.infrastructure]
  );

  const getInspectionsForObject = useCallback(
    (objectId: string) => store.inspections.filter((i) => i.objectId === objectId),
    [store.inspections]
  );

  const getAttachmentsForObject = useCallback(
    (objectId: string) => store.attachments.filter((a) => a.objectId === objectId),
    [store.attachments]
  );

  const startOfflineAreaDownload = useCallback(
    (params: {
      name: string;
      bounds: GeoBounds;
      minZoom: number;
      maxZoom: number;
      onComplete: (area: OfflineAreaRecord) => void;
    }) => {
      setCreatingOfflineArea(true);
      const requiredResources = Math.max(
        1,
        OfflineTileEstimator.estimateTileCount(params.bounds, params.minZoom, params.maxZoom)
      );
      window.setTimeout(() => {
        updateStore((prev) => {
          const newId = prev.nextOfflineAreaId;
          const record: OfflineAreaRecord = {
            id: newId,
            name: params.name,
            bounds: params.bounds,
            minZoom: params.minZoom,
            maxZoom: params.maxZoom,
            completedResources: Math.max(1, Math.floor(requiredResources / 6)),
            requiredResources,
            completedBytes: OfflineTileEstimator.estimateBytes(Math.max(1, Math.floor(requiredResources / 6))),
            isComplete: false,
            isActive: true,
            errorMessage: null,
          };
          return {
            ...prev,
            offlineAreas: [record, ...prev.offlineAreas],
            nextOfflineAreaId: newId + 1,
          };
        });
        setCreatingOfflineArea(false);
      }, 220);
    },
    [updateStore]
  );

  const toggleOfflineAreaPauseResume = useCallback(
    (areaId: number) => {
      updateStore((prev) => ({
        ...prev,
        offlineAreas: prev.offlineAreas.map((a) =>
          a.id === areaId && !a.isComplete ? { ...a, isActive: !a.isActive } : a
        ),
      }));
    },
    [updateStore]
  );

  const deleteOfflineArea = useCallback(
    (areaId: number, onDeleted: () => void) => {
      updateStore((prev) => ({
        ...prev,
        offlineAreas: prev.offlineAreas.filter((a) => a.id !== areaId),
      }));
      onDeleted();
    },
    [updateStore]
  );

  const loginAdminPanel = useCallback(
    (username: string, password: string): { ok: true } | { ok: false; error: string } => {
      if (!verifyAdminCredentials(username, password)) {
        return {
          ok: false,
          error: L10n.text(store.preferences.locale, 'adminInvalidCredentials'),
        };
      }
      prevNonAdminSessionRef.current = captureNonAdminSession(store.preferences);
      const res = Repository.loginAsAdminInspector(store);
      persistStoreSafely(res.next);
      setStore(res.next);
      setNowMs(Date.now());
      setAdminUnlocked(true);
      setMessage(L10n.text(store.preferences.locale, 'adminPanel'));
      return { ok: true };
    },
    [persistStoreSafely, store]
  );

  const lockAdminPanel = useCallback(() => {
    const previousSession = prevNonAdminSessionRef.current;
    prevNonAdminSessionRef.current = null;
    setAdminUnlocked(false);
    setStore((prev) => {
      const next: StoreSnapshot = {
        ...prev,
        preferences: restoreNonAdminPreferences(prev.preferences, previousSession),
      };
      saveStore(next);
      return next;
    });
    setMessage(L10n.text(store.preferences.locale, 'adminClosedMsg'));
  }, [store.preferences.locale]);

  const verifyEmployeeApplication = useCallback(
    (accountId: string, approve: boolean, role = 'verified_employee') => {
      updateStore((prev) => Repository.updateAccountVerification(prev, accountId, approve, role));
      setMessage(
        L10n.text(
          store.preferences.locale,
          approve ? 'adminApproveEmployee' : 'adminRejectEmployee'
        )
      );
    },
    [store.preferences.locale, updateStore]
  );

  const updateCitizenReportStatus = useCallback(
    (reportId: string, status: string, resolution: string | null = null) => {
      updateStore((prev) =>
        Repository.updateCitizenReportStatus(prev, reportId, status, resolution)
      );
      setMessage(`${reportId} · ${L10n.text(store.preferences.locale, status)}`);
    },
    [store.preferences.locale, updateStore]
  );

  const value: AppContextValue = {
    state,
    regions: store.regions,
    categories: store.categories,
    accounts: store.accounts,
    allObjects: store.infrastructure,
    publicObjects,
    mapMarkers,
    myReports,
    allReports: store.reports,
    approvedRoutes: store.routes,
    syncQueue: store.syncQueue,
    notifications: store.notifications,
    savedOfflineAreas: store.offlineAreas,
    creatingOfflineArea,
    adminUnlocked,
    clearMessage,
    showMessage,
    setLocale,
    setDarkTheme,
    setOfflineMode,
    renewLease,
    expireLeaseForTesting,
    requestLoginOtp,
    requestRegisterOtp,
    verifyOtp,
    cancelAuthChallenge,
    updateProfileName,
    logout,
    deleteAccount,
    getDraft,
    saveDraft,
    saveInfrastructureObject,
    submitObjectForReview,
    reviewObject,
    addInspection,
    submitCitizenReport,
    submitEmergencyIncident,
    requestRoute,
    approveRoute,
    withdrawRoute,
    synchronize,
    simulateConflict,
    resolveConflictAcceptServer,
    resolveConflictRetryLocal,
    markNotificationRead,
    markAllNotificationsRead,
    getObjectById,
    getInspectionsForObject,
    getAttachmentsForObject,
    startOfflineAreaDownload,
    toggleOfflineAreaPauseResume,
    deleteOfflineArea,
    loginAdminPanel,
    lockAdminPanel,
    verifyEmployeeApplication,
    updateCitizenReportStatus,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
