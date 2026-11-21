import {
  AppPreferences,
  ApprovedRouteEntity,
  CategoryEntity,
  CitizenReportEntity,
  EmergencySubmissionResult,
  GeoPoint,
  InfrastructureObjectEntity,
  InspectionEntity,
  NotificationEntity,
  ObjectAttachmentEntity,
  OtpChallenge,
  RegionEntity,
  SyncFlushResult,
  SyncOperationEntity,
  UserAccountEntity,
  isAccountEmployee,
} from '../types/gis';
import { GeoUtils, representativePoint } from '../core/geoUtils';
import { OfflineAreaRecord } from '../core/offlineMapManager';
import { SeedData } from './seedData';

const STORAGE_KEY = 'fvv_gis_db_v1';

export interface DraftRecord {
  draftId: string;
  payloadJson: string;
  updatedAtMs: number;
}

export interface StoreSnapshot {
  preferences: AppPreferences;
  regions: RegionEntity[];
  categories: CategoryEntity[];
  accounts: UserAccountEntity[];
  infrastructure: InfrastructureObjectEntity[];
  inspections: InspectionEntity[];
  reports: CitizenReportEntity[];
  routes: ApprovedRouteEntity[];
  syncQueue: SyncOperationEntity[];
  notifications: NotificationEntity[];
  attachments: ObjectAttachmentEntity[];
  drafts: Record<string, DraftRecord>;
  offlineAreas: OfflineAreaRecord[];
  nextOfflineAreaId: number;
}

export function currentIsoUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createInitialStore(): StoreSnapshot {
  return {
    preferences: {
      locale: 'uz',
      darkTheme: true,
      activeAccountId: null,
      offlineMode: false,
      leaseExpiresAtMs: 0,
      lastSyncAtMs: 0,
    },
    regions: SeedData.regions,
    categories: SeedData.categories,
    accounts: SeedData.demoAccounts,
    infrastructure: SeedData.createDemoObjects(),
    inspections: SeedData.createDemoInspections(),
    reports: SeedData.createDemoReports(),
    routes: SeedData.createDemoRoutes(),
    syncQueue: [],
    notifications: SeedData.createDemoNotifications(),
    attachments: [],
    drafts: {},
    offlineAreas: [],
    nextOfflineAreaId: 1,
  };
}

export function loadStore(): StoreSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreSnapshot>;
      if (parsed && Array.isArray(parsed.regions) && parsed.regions.length > 0 && Array.isArray(parsed.infrastructure)) {
        const defaults = createInitialStore();
        return {
          ...defaults,
          ...parsed,
          preferences: { ...defaults.preferences, ...(parsed.preferences ?? {}) },
        };
      }
    }
  } catch {
    // fall through to seed store
  }
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

export function saveStore(snapshot: StoreSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota errors gracefully
  }
}

export function serializeObjectPayload(e: InfrastructureObjectEntity): string {
  return JSON.stringify({
    id: e.id,
    code: e.code,
    name: e.name,
    description: e.description,
    category_id: e.categoryId,
    region_id: e.regionId,
    district_id: e.districtId ?? '',
    geometry_json: e.geometryJson,
    operational_status: e.operationalStatus,
    lifecycle: e.lifecycle,
    sensitivity: e.sensitivity,
    passport_json: e.passportJson,
    accuracy_m: e.accuracyM,
  });
}

function deserializeObjectPayload(
  obj: Record<string, unknown>,
  id: string,
  version: number
): InfrastructureObjectEntity {
  const districtRaw = typeof obj.district_id === 'string' ? obj.district_id : '';
  return {
    id,
    code: typeof obj.code === 'string' ? obj.code : 'DEMO-NEW',
    name: typeof obj.name === 'string' ? obj.name : 'Yangi obyekt',
    description: typeof obj.description === 'string' ? obj.description : '',
    categoryId: typeof obj.category_id === 'string' ? obj.category_id : 'other',
    regionId: typeof obj.region_id === 'string' ? obj.region_id : 'UZ-TK',
    districtId: districtRaw.length > 0 ? districtRaw : null,
    geometryJson:
      typeof obj.geometry_json === 'string'
        ? obj.geometry_json
        : GeoUtils.encodeGeoJson('Point', [{ lat: 41.299, lon: 69.240 }]),
    operationalStatus: typeof obj.operational_status === 'string' ? obj.operational_status : 'unknown',
    lifecycle: typeof obj.lifecycle === 'string' ? obj.lifecycle : 'draft',
    sensitivity: typeof obj.sensitivity === 'string' ? obj.sensitivity : 'restricted',
    version,
    passportJson: typeof obj.passport_json === 'string' ? obj.passport_json : '{"schema_version":1}',
    accuracyM: typeof obj.accuracy_m === 'number' ? obj.accuracy_m : null,
    updatedAt: currentIsoUtc(),
    isSynthetic: true,
    isPublicProjected: false,
  };
}

function serializeEmergencyPayload(
  entity: InfrastructureObjectEntity,
  reportId: string,
  reporterUserId: string | null,
  reporterPhone: string | null
): string {
  const map: Record<string, unknown> = {
    id: entity.id,
    code: entity.code,
    name: entity.name,
    description: entity.description,
    category_id: entity.categoryId,
    region_id: entity.regionId,
    geometry_json: entity.geometryJson,
    operational_status: entity.operationalStatus,
    lifecycle: entity.lifecycle,
    sensitivity: entity.sensitivity,
    passport_json: entity.passportJson,
    accuracy_m: entity.accuracyM,
    report_id: reportId,
  };
  if (reporterUserId) map.reporter_user_id = reporterUserId;
  if (reporterPhone) map.reporter_phone = reporterPhone;
  return JSON.stringify(map);
}

function deserializeEmergencyPayload(
  obj: Record<string, unknown>,
  id: string,
  updatedAtIso: string
): InfrastructureObjectEntity {
  return {
    id,
    code: typeof obj.code === 'string' ? obj.code : 'EMG-QUEUE',
    name: typeof obj.name === 'string' ? obj.name : 'Emergency Incident',
    description: typeof obj.description === 'string' ? obj.description : '',
    categoryId: typeof obj.category_id === 'string' ? obj.category_id : 'other',
    regionId: typeof obj.region_id === 'string' ? obj.region_id : 'UZ-TK',
    districtId: null,
    geometryJson:
      typeof obj.geometry_json === 'string'
        ? obj.geometry_json
        : GeoUtils.encodeGeoJson('Point', [{ lat: 41.2995, lon: 69.2401 }]),
    operationalStatus: typeof obj.operational_status === 'string' ? obj.operational_status : 'faulty',
    lifecycle: 'submitted',
    sensitivity: 'public_projected',
    version: 1,
    passportJson: typeof obj.passport_json === 'string' ? obj.passport_json : '{"schema_version":1}',
    accuracyM: typeof obj.accuracy_m === 'number' ? obj.accuracy_m : null,
    updatedAt: updatedAtIso,
    isSynthetic: true,
    isPublicProjected: true,
  };
}

export const Repository = {
  requestLoginOtp(store: StoreSnapshot, phone: string): { ok: true; challenge: OtpChallenge } | { ok: false; error: string } {
    const cleanPhone = phone.trim();
    const account = store.accounts.find((a) => a.phone === cleanPhone);
    if (!account) {
      return {
        ok: false,
        error: 'Bu telefon raqami ro‘yxatdan o‘tmagan. Demo hisobdan foydalaning yoki ro‘yxatdan o‘ting.',
      };
    }
    return {
      ok: true,
      challenge: {
        challengeId: makeUuid(),
        phone: account.phone,
        devOtp: '123456',
        isRegister: false,
        pendingAccount: account,
      },
    };
  },

  requestRegisterOtp(
    store: StoreSnapshot,
    params: {
      phone: string;
      fullName: string;
      isEmployeeApplication: boolean;
      organizationId: string | null;
      regionId: string | null;
      department: string | null;
      verificationReference: string | null;
    }
  ): { ok: true; challenge: OtpChallenge } | { ok: false; error: string } {
    const cleanPhone = params.phone.trim();
    if (store.accounts.some((a) => a.phone === cleanPhone)) {
      return {
        ok: false,
        error: 'Bu raqam allaqachon ro‘yxatdan o‘tgan. Kirish bo‘limidan foydalaning.',
      };
    }
    const newAccount: UserAccountEntity = {
      id: `acc-${makeUuid().slice(0, 8)}`,
      phone: cleanPhone,
      fullName: params.fullName.trim(),
      role: params.isEmployeeApplication ? 'pending_employee' : 'citizen',
      employeeStatus: params.isEmployeeApplication ? 'pending_verification' : 'none',
      organizationId: params.organizationId,
      regionId: params.regionId,
      districtId: params.regionId ? `DEMO-${params.regionId}` : null,
      department: params.department?.trim() || null,
      verificationReference: params.verificationReference?.trim() || null,
      policyEpoch: 1,
      isSynthetic: true,
    };
    return {
      ok: true,
      challenge: {
        challengeId: makeUuid(),
        phone: newAccount.phone,
        devOtp: '123456',
        isRegister: true,
        pendingAccount: newAccount,
      },
    };
  },

  verifyOtp(
    store: StoreSnapshot,
    challenge: OtpChallenge,
    code: string
  ): { ok: true; next: StoreSnapshot; account: UserAccountEntity } | { ok: false; error: string } {
    if (code.trim() !== challenge.devOtp) {
      return {
        ok: false,
        error: `Tasdiqlash kodi noto‘g‘ri (demo kod: ${challenge.devOtp}).`,
      };
    }
    const account = challenge.pendingAccount;
    if (!account) {
      return { ok: false, error: 'Hisob topilmadi.' };
    }
    const accounts = challenge.isRegister
      ? [...store.accounts.filter((a) => a.id !== account.id), account]
      : store.accounts;
    const now = Date.now();
    const leaseExpiresAtMs = isAccountEmployee(account) ? now + 8 * 3600_000 : 0;
    const next: StoreSnapshot = {
      ...store,
      accounts,
      preferences: {
        ...store.preferences,
        activeAccountId: account.id,
        leaseExpiresAtMs,
        lastSyncAtMs: now,
      },
    };
    return { ok: true, next, account };
  },

  saveInfrastructureObject(
    store: StoreSnapshot,
    params: {
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
      isOffline: boolean;
    }
  ): { next: StoreSnapshot; resultId: string; queued: boolean } {
    const nowIso = currentIsoUtc();
    const existing = params.existingId
      ? store.infrastructure.find((o) => o.id === params.existingId) ?? null
      : null;
    const targetId = existing?.id ?? `obj-${makeUuid().slice(0, 8)}`;
    const nextVersion = (existing?.version ?? 0) + 1;
    const entity: InfrastructureObjectEntity = {
      id: targetId,
      code: params.code.trim(),
      name: params.name.trim(),
      description: params.description.trim(),
      categoryId: params.categoryId,
      regionId: params.regionId,
      districtId: existing?.districtId ?? `DEMO-${params.regionId}`,
      geometryJson: params.geometryJson,
      operationalStatus: params.operationalStatus,
      lifecycle: existing?.lifecycle ?? 'draft',
      sensitivity: existing?.sensitivity ?? 'restricted',
      version: nextVersion,
      passportJson: params.passportJson,
      accuracyM: params.accuracyM,
      updatedAt: nowIso,
      isSynthetic: true,
      isPublicProjected: existing?.isPublicProjected ?? false,
    };

    const draftKey = params.existingId ?? 'new-object';
    const nextDrafts = { ...store.drafts };
    delete nextDrafts[draftKey];

    const newAtts: ObjectAttachmentEntity[] = params.attachments.map((att) => ({
      id: makeUuid(),
      objectId: targetId,
      reportId: null,
      filename: att.filename,
      mimeType: att.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      uriString: att.uriString,
      scanStatus: params.isOffline ? 'pending_scan' : 'quarantined_local',
      createdAt: nowIso,
    }));

    if (params.isOffline) {
      const op: SyncOperationEntity = {
        operationId: makeUuid(),
        entityType: 'infrastructure',
        action: existing == null ? 'create' : 'update',
        objectId: targetId,
        objectName: params.name.trim(),
        expectedVersion: existing?.version ?? null,
        payloadJson: serializeObjectPayload(entity),
        status: 'pending',
        createdAt: nowIso,
      };
      const next: StoreSnapshot = {
        ...store,
        syncQueue: [op, ...store.syncQueue],
        attachments: [...newAtts, ...store.attachments],
        drafts: nextDrafts,
      };
      return { next, resultId: targetId, queued: true };
    }

    const nextInfra = [entity, ...store.infrastructure.filter((o) => o.id !== targetId)];
    const next: StoreSnapshot = {
      ...store,
      infrastructure: nextInfra,
      attachments: [...newAtts, ...store.attachments],
      drafts: nextDrafts,
    };
    return { next, resultId: targetId, queued: false };
  },

  submitObjectForReview(store: StoreSnapshot, objectId: string): StoreSnapshot {
    const obj = store.infrastructure.find((o) => o.id === objectId);
    if (!obj) return store;
    const nowIso = currentIsoUtc();
    const updated: InfrastructureObjectEntity = {
      ...obj,
      lifecycle: 'submitted',
      version: obj.version + 1,
      updatedAt: nowIso,
    };
    const notif: NotificationEntity = {
      id: makeUuid(),
      userId: null,
      title: 'Obyekt tekshiruvga yuborildi',
      body: `${obj.code} · ${obj.name} ko‘rib chiqish uchun navbatga qo‘shildi.`,
      kind: 'object_submitted',
      readAt: null,
      createdAt: nowIso,
    };
    return {
      ...store,
      infrastructure: store.infrastructure.map((o) => (o.id === objectId ? updated : o)),
      notifications: [notif, ...store.notifications],
    };
  },

  reviewObject(store: StoreSnapshot, objectId: string, approve: boolean): StoreSnapshot {
    const obj = store.infrastructure.find((o) => o.id === objectId);
    if (!obj) return store;
    const nowIso = currentIsoUtc();
    const updated: InfrastructureObjectEntity = {
      ...obj,
      lifecycle: approve ? 'published' : 'requires_correction',
      version: obj.version + 1,
      updatedAt: nowIso,
    };
    const notif: NotificationEntity = {
      id: makeUuid(),
      userId: null,
      title: approve ? 'Obyekt nashr etildi' : 'Tuzatish talab qilinadi',
      body: `${obj.code} · ${obj.name}`,
      kind: 'object_review',
      readAt: null,
      createdAt: nowIso,
    };
    return {
      ...store,
      infrastructure: store.infrastructure.map((o) => (o.id === objectId ? updated : o)),
      notifications: [notif, ...store.notifications],
    };
  },

  addInspection(
    store: StoreSnapshot,
    params: {
      objectId: string;
      inspectorName: string;
      condition: string;
      operationalStatus: string;
      notes: string;
      nextInspectionDate: string | null;
    }
  ): StoreSnapshot {
    const nowIso = currentIsoUtc();
    const inspection: InspectionEntity = {
      id: makeUuid(),
      objectId: params.objectId,
      inspectorName: params.inspectorName,
      condition: params.condition,
      operationalStatus: params.operationalStatus,
      notes: params.notes.trim(),
      nextInspectionDate: params.nextInspectionDate?.trim() || null,
      createdAt: nowIso,
    };
    const nextInfra = store.infrastructure.map((obj) =>
      obj.id === params.objectId
        ? {
            ...obj,
            operationalStatus: params.operationalStatus,
            version: obj.version + 1,
            updatedAt: nowIso,
          }
        : obj
    );
    return {
      ...store,
      inspections: [inspection, ...store.inspections],
      infrastructure: nextInfra,
    };
  },

  submitCitizenReport(
    store: StoreSnapshot,
    params: {
      userId: string;
      category: string;
      description: string;
      regionId: string;
      location: GeoPoint | null;
      contactPhone: string | null;
      attachmentCount: number;
      isOffline: boolean;
    }
  ): { next: StoreSnapshot; report: CitizenReportEntity } {
    const nowIso = currentIsoUtc();
    const report: CitizenReportEntity = {
      id: `rep-${makeUuid().slice(0, 8)}`,
      userId: params.userId,
      category: params.category,
      description: params.description.trim(),
      regionId: params.regionId,
      geometryJson: params.location ? GeoUtils.encodeGeoJson('Point', [params.location]) : null,
      contactPhone: params.contactPhone,
      status: params.isOffline ? 'queued_offline' : 'received',
      resolution: null,
      attachmentCount: params.attachmentCount,
      isSynthetic: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextReports = [report, ...store.reports];
    let nextSync = store.syncQueue;
    let notif: NotificationEntity;

    if (params.isOffline) {
      const payload = JSON.stringify({
        report_id: report.id,
        user_id: params.userId,
        category: params.category,
        region_id: params.regionId,
        description: report.description,
      });
      const op: SyncOperationEntity = {
        operationId: makeUuid(),
        entityType: 'citizen_report',
        action: 'create',
        objectId: report.id,
        objectName: `${report.id} · ${params.category}`,
        expectedVersion: null,
        payloadJson: payload,
        status: 'pending',
        createdAt: nowIso,
      };
      nextSync = [op, ...store.syncQueue];
      notif = {
        id: makeUuid(),
        userId: params.userId,
        title: 'Murojaat offline navbatga saqlandi',
        body: `${report.id} qurilmada saqlandi va tarmoq tiklanganda avtomatik yuboriladi.`,
        kind: 'report_queued',
        readAt: null,
        createdAt: nowIso,
      };
    } else {
      notif = {
        id: makeUuid(),
        userId: params.userId,
        title: 'Murojaat qabul qilindi',
        body: `Murojaatingiz ro‘yxatga olindi (${report.id}). Shoshilinch holatda 112 ga qo‘ng‘iroq qiling.`,
        kind: 'report_received',
        readAt: null,
        createdAt: nowIso,
      };
    }

    return {
      next: {
        ...store,
        reports: nextReports,
        syncQueue: nextSync,
        notifications: [notif, ...store.notifications],
      },
      report,
    };
  },

  submitEmergencyIncident(
    store: StoreSnapshot,
    params: {
      pinLocation: GeoPoint;
      currentUserLocation: GeoPoint | null;
      categoryId: string;
      hazardTitle: string;
      notes: string;
      regionId: string;
      reporterUserId: string | null;
      reporterPhone: string | null;
      isOffline: boolean;
    }
  ): { next: StoreSnapshot; result: EmergencySubmissionResult } {
    const nowIso = currentIsoUtc();
    const shortHex = makeUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
    const cleanNotes = params.notes.trim();
    const effectiveDescription =
      cleanNotes.length > 0
        ? cleanNotes
        : `${params.hazardTitle} (${params.pinLocation.lat.toFixed(5)}, ${params.pinLocation.lon.toFixed(5)})`;

    const passportMap: Record<string, unknown> = {
      schema_version: 1,
      report_source: 'emergency_map_pin',
      pin_lat: params.pinLocation.lat,
      pin_lon: params.pinLocation.lon,
    };
    if (params.currentUserLocation) {
      passportMap.reporter_gps_lat = params.currentUserLocation.lat;
      passportMap.reporter_gps_lon = params.currentUserLocation.lon;
    }
    if (cleanNotes.length > 0) {
      passportMap.incident_notes = cleanNotes;
    }

    const entity: InfrastructureObjectEntity = {
      id: `emg-${shortHex}`,
      code: `EMG-${shortHex}`,
      name: params.hazardTitle.trim() || 'Emergency Incident',
      description: effectiveDescription,
      categoryId: params.categoryId,
      regionId: params.regionId,
      districtId: null,
      geometryJson: GeoUtils.encodeGeoJson('Point', [params.pinLocation]),
      operationalStatus: 'faulty',
      lifecycle: 'submitted',
      sensitivity: 'public_projected',
      version: 1,
      passportJson: JSON.stringify(passportMap),
      accuracyM: params.currentUserLocation ? 5.0 : 15.0,
      updatedAt: nowIso,
      isSynthetic: true,
      isPublicProjected: true,
    };

    const reportId = `rep-emg-${shortHex}`;
    const gpsSuffix = params.currentUserLocation
      ? ` | GPS: ${params.currentUserLocation.lat.toFixed(5)}, ${params.currentUserLocation.lon.toFixed(5)}`
      : '';
    const report: CitizenReportEntity = {
      id: reportId,
      userId: params.reporterUserId ?? 'guest-emergency',
      category: params.categoryId,
      description: `[${entity.code}] ${params.hazardTitle}: ${effectiveDescription}${gpsSuffix}`,
      regionId: params.regionId,
      geometryJson: entity.geometryJson,
      contactPhone: params.reporterPhone,
      status: params.isOffline ? 'queued_offline' : 'received',
      resolution: null,
      attachmentCount: 0,
      isSynthetic: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextReports = [report, ...store.reports];

    if (params.isOffline) {
      const queuedPayload = serializeEmergencyPayload(
        entity,
        reportId,
        params.reporterUserId,
        params.reporterPhone
      );
      const op: SyncOperationEntity = {
        operationId: makeUuid(),
        entityType: 'emergency_incident',
        action: 'create',
        objectId: entity.id,
        objectName: `${entity.code} · ${entity.name}`,
        expectedVersion: null,
        payloadJson: queuedPayload,
        status: 'pending',
        createdAt: nowIso,
      };
      const notif: NotificationEntity = {
        id: makeUuid(),
        userId: params.reporterUserId,
        title: `${entity.code} · ${entity.name}`,
        body: `${params.pinLocation.lat.toFixed(4)}, ${params.pinLocation.lon.toFixed(4)} — Offline navbatga saqlandi. Tarmoq tiklanganda markaziy reyestrga avtomatik yuboriladi.`,
        kind: 'emergency_queued',
        readAt: null,
        createdAt: nowIso,
      };
      return {
        next: {
          ...store,
          reports: nextReports,
          syncQueue: [op, ...store.syncQueue],
          notifications: [notif, ...store.notifications],
        },
        result: { code: entity.code, entity: null, queuedOffline: true },
      };
    }

    const notif: NotificationEntity = {
      id: makeUuid(),
      userId: params.reporterUserId,
      title: `${entity.code} · ${params.hazardTitle}`,
      body: `${params.pinLocation.lat.toFixed(4)}, ${params.pinLocation.lon.toFixed(4)} — Markaziy reyestrga yuborildi. Xavf kuchli bo‘lsa 112 ga qo‘ng‘iroq qiling.`,
      kind: 'emergency_incident',
      readAt: null,
      createdAt: nowIso,
    };

    return {
      next: {
        ...store,
        infrastructure: [entity, ...store.infrastructure],
        reports: nextReports,
        notifications: [notif, ...store.notifications],
      },
      result: { code: entity.code, entity, queuedOffline: false },
    };
  },

  requestRoute(
    store: StoreSnapshot,
    objectId: string,
    origin: GeoPoint,
    requestedById: string
  ): { ok: true; next: StoreSnapshot; route: ApprovedRouteEntity } | { ok: false; error: string } {
    const obj = store.infrastructure.find((o) => o.id === objectId);
    if (!obj) {
      return { ok: false, error: 'Obyekt topilmadi.' };
    }
    if (obj.lifecycle !== 'published') {
      return { ok: false, error: 'Faqat tasdiqlangan operativ obyektga marshrut tuziladi.' };
    }
    const parsed = GeoUtils.parseGeoJson(obj.geometryJson);
    const dest = parsed ? representativePoint(parsed) : { lat: 41.299, lon: 69.240 };
    const mid1: GeoPoint = {
      lat: (origin.lat * 2 + dest.lat) / 3.0,
      lon: (origin.lon * 2 + dest.lon) / 3.0,
    };
    const mid2: GeoPoint = {
      lat: (origin.lat + dest.lat * 2) / 3.0,
      lon: (origin.lon + dest.lon * 2) / 3.0,
    };
    const distance =
      GeoUtils.distanceMeters(origin, mid1) +
      GeoUtils.distanceMeters(mid1, mid2) +
      GeoUtils.distanceMeters(mid2, dest);
    const duration = Math.max(60.0, distance / 11.5);
    const geomJson = GeoUtils.encodeGeoJson('LineString', [origin, mid1, mid2, dest]);
    const stepsJson = JSON.stringify([
      {
        name: 'Boshlang‘ich yo‘nalish',
        distance_m: Math.floor(distance * 0.35),
        duration_s: Math.floor(duration * 0.35),
        maneuver: { type: 'depart', modifier: 'straight', location: [origin.lon, origin.lat] },
      },
      {
        name: 'Markaziy yo‘lak',
        distance_m: Math.floor(distance * 0.4),
        duration_s: Math.floor(duration * 0.4),
        maneuver: { type: 'turn', modifier: 'right', location: [mid1.lon, mid1.lat] },
      },
      {
        name: `${obj.code} manzili`,
        distance_m: Math.floor(distance * 0.25),
        duration_s: Math.floor(duration * 0.25),
        maneuver: { type: 'arrive', modifier: 'straight', location: [dest.lon, dest.lat] },
      },
    ]);

    const route: ApprovedRouteEntity = {
      id: `route-${makeUuid().slice(0, 8)}`,
      destinationObjectId: obj.id,
      destinationName: `${obj.code} · ${obj.name}`,
      requestedBy: requestedById,
      geometryJson: geomJson,
      stepsJson,
      distanceM: distance,
      durationS: duration,
      status: 'pending',
      approvedBy: null,
      expiresAtEpochMs: null,
      sourceDate: '2026-11-01',
      version: 1,
      createdAt: currentIsoUtc(),
    };

    return {
      ok: true,
      next: { ...store, routes: [route, ...store.routes] },
      route,
    };
  },

  approveRoute(store: StoreSnapshot, routeId: string, approverName: string): StoreSnapshot {
    const route = store.routes.find((r) => r.id === routeId);
    if (!route) return store;
    const now = Date.now();
    const updated: ApprovedRouteEntity = {
      ...route,
      status: 'approved',
      approvedBy: approverName,
      expiresAtEpochMs: now + 8 * 3600_000,
      version: route.version + 1,
    };
    const notif: NotificationEntity = {
      id: makeUuid(),
      userId: null,
      title: 'Marshrut tasdiqlandi',
      body: `${route.destinationName} uchun marshrut tasdiqlandi.`,
      kind: 'route_approved',
      readAt: null,
      createdAt: currentIsoUtc(),
    };
    return {
      ...store,
      routes: store.routes.map((r) => (r.id === routeId ? updated : r)),
      notifications: [notif, ...store.notifications],
    };
  },

  withdrawRoute(store: StoreSnapshot, routeId: string): StoreSnapshot {
    return {
      ...store,
      routes: store.routes.map((r) =>
        r.id === routeId
          ? {
              ...r,
              status: 'withdrawn',
              expiresAtEpochMs: Date.now(),
              version: r.version + 1,
            }
          : r
      ),
    };
  },

  synchronizeQueue(
    store: StoreSnapshot,
    account: UserAccountEntity | null,
    clearOfflineFlag = true
  ): { next: StoreSnapshot; result: SyncFlushResult } {
    const pending = store.syncQueue.filter((op) => op.status === 'pending');
    let pushedReports = 0;
    let pushedInfrastructure = 0;
    let conflicts = 0;
    const nowIso = currentIsoUtc();

    let infrastructure = [...store.infrastructure];
    let reports = [...store.reports];
    let syncQueue = [...store.syncQueue];
    const notifications = [...store.notifications];

    for (const op of pending) {
      let payload: Record<string, unknown> | null = null;
      try {
        payload = JSON.parse(op.payloadJson) as Record<string, unknown>;
      } catch {
        payload = null;
      }

      if (!payload || typeof payload !== 'object') {
        syncQueue = syncQueue.map((item) =>
          item.operationId === op.operationId
            ? { ...item, status: 'conflict', errorMessage: 'Payload formati noto‘g‘ri' }
            : item
        );
        conflicts++;
        continue;
      }

      if (op.entityType === 'emergency_incident') {
        const entity = deserializeEmergencyPayload(
          payload,
          op.objectId ?? `emg-${makeUuid().slice(0, 6)}`,
          nowIso
        );
        infrastructure = [entity, ...infrastructure.filter((o) => o.id !== entity.id)];
        const reportId = typeof payload.report_id === 'string' ? payload.report_id : null;
        if (reportId) {
          reports = reports.map((r) =>
            r.id === reportId ? { ...r, status: 'received', updatedAt: nowIso } : r
          );
        }
        const reporterUserId =
          typeof payload.reporter_user_id === 'string' ? payload.reporter_user_id : null;
        notifications.unshift({
          id: makeUuid(),
          userId: reporterUserId,
          title: `${entity.code} · ${entity.name}`,
          body: 'Offline navbatdan markaziy reyestrga yuborildi.',
          kind: 'emergency_synced',
          readAt: null,
          createdAt: nowIso,
        });
        syncQueue = syncQueue.filter((item) => item.operationId !== op.operationId);
        pushedReports++;
      } else if (op.entityType === 'citizen_report') {
        const reportId =
          typeof payload.report_id === 'string' ? payload.report_id : op.objectId;
        if (reportId) {
          reports = reports.map((r) =>
            r.id === reportId ? { ...r, status: 'received', updatedAt: nowIso } : r
          );
        }
        const userId = typeof payload.user_id === 'string' ? payload.user_id : null;
        notifications.unshift({
          id: makeUuid(),
          userId,
          title: `Murojaat yuborildi (${reportId ?? op.objectName})`,
          body: 'Offline navbatdagi murojaat markaziy tizimga muvaffaqiyatli yuklandi.',
          kind: 'report_synced',
          readAt: null,
          createdAt: nowIso,
        });
        syncQueue = syncQueue.filter((item) => item.operationId !== op.operationId);
        pushedReports++;
      } else {
        if (!isAccountEmployee(account)) {
          continue;
        }
        const existing = op.objectId
          ? infrastructure.find((o) => o.id === op.objectId) ?? null
          : null;
        if (
          existing &&
          op.expectedVersion !== null &&
          existing.version !== op.expectedVersion
        ) {
          syncQueue = syncQueue.map((item) =>
            item.operationId === op.operationId
              ? {
                  ...item,
                  status: 'conflict',
                  errorMessage: `409 Conflict: server versiyasi v${existing.version}, kutilgan v${op.expectedVersion}.`,
                }
              : item
          );
          conflicts++;
          continue;
        }
        const entity = deserializeObjectPayload(
          payload,
          op.objectId ?? `obj-${makeUuid().slice(0, 8)}`,
          (existing?.version ?? 0) + 1
        );
        infrastructure = [entity, ...infrastructure.filter((o) => o.id !== entity.id)];
        syncQueue = syncQueue.filter((item) => item.operationId !== op.operationId);
        pushedInfrastructure++;
      }
    }

    const now = Date.now();
    const nextPrefs: AppPreferences = {
      ...store.preferences,
      offlineMode: clearOfflineFlag ? false : store.preferences.offlineMode,
      leaseExpiresAtMs: isAccountEmployee(account)
        ? now + 8 * 3600_000
        : store.preferences.leaseExpiresAtMs,
      lastSyncAtMs:
        pushedReports + pushedInfrastructure > 0 || clearOfflineFlag
          ? now
          : store.preferences.lastSyncAtMs,
    };

    return {
      next: {
        ...store,
        preferences: nextPrefs,
        infrastructure,
        reports,
        syncQueue,
        notifications,
      },
      result: { pushedReports, pushedInfrastructure, conflicts },
    };
  },

  createSimulatedConflict(store: StoreSnapshot, objectId: string): StoreSnapshot {
    const obj = store.infrastructure.find((o) => o.id === objectId);
    if (!obj) return store;
    const op: SyncOperationEntity = {
      operationId: makeUuid(),
      entityType: 'infrastructure',
      action: 'update',
      objectId: obj.id,
      objectName: obj.name,
      expectedVersion: Math.max(0, obj.version - 1),
      payloadJson: serializeObjectPayload({
        ...obj,
        description: `${obj.description} [Local offline edit]`,
      }),
      status: 'conflict',
      errorMessage: `409: Yozuv boshqa foydalanuvchi tomonidan yangilangan (v${obj.version}).`,
      createdAt: currentIsoUtc(),
    };
    return {
      ...store,
      syncQueue: [op, ...store.syncQueue],
    };
  },

  resolveConflictAcceptServer(store: StoreSnapshot, operationId: string): StoreSnapshot {
    return {
      ...store,
      syncQueue: store.syncQueue.filter((op) => op.operationId !== operationId),
    };
  },

  resolveConflictRetryLocal(store: StoreSnapshot, operationId: string): StoreSnapshot {
    return {
      ...store,
      syncQueue: store.syncQueue.map((op) => {
        if (op.operationId !== operationId) return op;
        const server = op.objectId
          ? store.infrastructure.find((o) => o.id === op.objectId)
          : undefined;
        return {
          ...op,
          expectedVersion: server?.version ?? null,
          status: 'pending',
          errorMessage: null,
        };
      }),
    };
  },

  markNotificationRead(store: StoreSnapshot, id: string): StoreSnapshot {
    const nowIso = currentIsoUtc();
    return {
      ...store,
      notifications: store.notifications.map((n) =>
        n.id === id ? { ...n, readAt: n.readAt ?? nowIso } : n
      ),
    };
  },

  markAllNotificationsRead(store: StoreSnapshot): StoreSnapshot {
    const nowIso = currentIsoUtc();
    return {
      ...store,
      notifications: store.notifications.map((n) =>
        n.readAt ? n : { ...n, readAt: nowIso }
      ),
    };
  },

  loginAsAdminInspector(store: StoreSnapshot): { next: StoreSnapshot; account: UserAccountEntity } {
    const adminId = 'acc-admin-inspektor';
    const existing = store.accounts.find((a) => a.id === adminId);
    const adminAccount: UserAccountEntity = existing
      ? {
          ...existing,
          role: 'super_administrator',
          employeeStatus: 'verified',
        }
      : {
          id: adminId,
          phone: '+998900000807',
          fullName: 'Inspektor (Admin)',
          role: 'super_administrator',
          employeeStatus: 'verified',
          organizationId: 'org-demo',
          regionId: 'UZ-TK',
          districtId: 'DEMO-UZ-TK',
          department: 'Markaziy boshqaruv',
          policyEpoch: 1,
          isSynthetic: false,
        };
    const now = Date.now();
    const accounts = existing
      ? store.accounts.map((a) => (a.id === adminId ? adminAccount : a))
      : [adminAccount, ...store.accounts];
    return {
      next: {
        ...store,
        accounts,
        preferences: {
          ...store.preferences,
          activeAccountId: adminAccount.id,
          leaseExpiresAtMs: now + 8 * 3600_000,
          lastSyncAtMs: now,
        },
      },
      account: adminAccount,
    };
  },

  updateAccountVerification(
    store: StoreSnapshot,
    accountId: string,
    approve: boolean,
    role = 'verified_employee'
  ): StoreSnapshot {
    const nowIso = currentIsoUtc();
    const target = store.accounts.find((a) => a.id === accountId);
    if (!target) return store;
    const updated: UserAccountEntity = {
      ...target,
      role: approve ? role : 'citizen',
      employeeStatus: approve ? 'verified' : 'rejected',
      policyEpoch: target.policyEpoch + 1,
    };
    const notif: NotificationEntity = {
      id: makeUuid(),
      userId: accountId,
      title: approve ? 'Xodim maqomi tasdiqlandi' : 'Xodim arizasi rad etildi',
      body: `${target.fullName} (${updated.role})`,
      kind: 'account_verification',
      readAt: null,
      createdAt: nowIso,
    };
    return {
      ...store,
      accounts: store.accounts.map((a) => (a.id === accountId ? updated : a)),
      notifications: [notif, ...store.notifications],
    };
  },

  updateCitizenReportStatus(
    store: StoreSnapshot,
    reportId: string,
    status: string,
    resolution: string | null
  ): StoreSnapshot {
    const nowIso = currentIsoUtc();
    const target = store.reports.find((r) => r.id === reportId);
    if (!target) return store;
    const cleanResolution = resolution?.trim() ? resolution.trim() : target.resolution ?? null;
    const updated: CitizenReportEntity = {
      ...target,
      status,
      resolution: cleanResolution,
      updatedAt: nowIso,
    };
    const notif: NotificationEntity = {
      id: makeUuid(),
      userId: target.userId,
      title: `Murojaat holati: ${status}`,
      body: `${reportId}${cleanResolution ? ` — ${cleanResolution}` : ''}`,
      kind: 'report_status',
      readAt: null,
      createdAt: nowIso,
    };
    return {
      ...store,
      reports: store.reports.map((r) => (r.id === reportId ? updated : r)),
      notifications: [notif, ...store.notifications],
    };
  },
};
