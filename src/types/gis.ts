export type AppLocale = 'uz' | 'ru' | 'en';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface GeoBounds {
  northLat: number;
  southLat: number;
  eastLon: number;
  westLon: number;
}

export interface MapViewport {
  centerLat: number;
  centerLon: number;
  zoom: number;
}

export const DEFAULT_VIEWPORT: MapViewport = {
  centerLat: 41.35,
  centerLon: 64.55,
  zoom: 1.0,
};

export type ParsedGeometry =
  | { type: 'Point'; point: GeoPoint }
  | { type: 'LineString'; points: GeoPoint[] }
  | { type: 'Polygon'; rings: GeoPoint[][] };

export interface RegionEntity {
  id: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  centerLat: number;
  centerLon: number;
}

export interface CategoryEntity {
  id: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  geometryTypesCsv: string;
  iconName: string;
  colorHex: string;
}

export interface UserAccountEntity {
  id: string;
  phone: string;
  fullName: string;
  role: string;
  employeeStatus: string | null;
  organizationId: string | null;
  regionId: string | null;
  districtId: string | null;
  department?: string | null;
  verificationReference?: string | null;
  policyEpoch: number;
  isSynthetic: boolean;
}

export const EMPLOYEE_ROLES = new Set([
  'verified_employee',
  'regional_supervisor',
  'infrastructure_inspector',
  'data_reviewer',
  'system_administrator',
  'super_administrator',
]);

export const REVIEWER_ROLES = new Set([
  'data_reviewer',
  'regional_supervisor',
  'system_administrator',
  'super_administrator',
]);

export const SUPERVISOR_ROLES = new Set([
  'regional_supervisor',
  'system_administrator',
  'super_administrator',
]);

export function isAccountEmployee(acc: UserAccountEntity | null | undefined): boolean {
  return Boolean(acc && EMPLOYEE_ROLES.has(acc.role) && acc.employeeStatus === 'verified');
}

export function canAccountReviewOrPublish(acc: UserAccountEntity | null | undefined): boolean {
  return isAccountEmployee(acc) && Boolean(acc && REVIEWER_ROLES.has(acc.role));
}

export function canAccountApproveRoutes(acc: UserAccountEntity | null | undefined): boolean {
  return isAccountEmployee(acc) && Boolean(acc && SUPERVISOR_ROLES.has(acc.role));
}

export interface InfrastructureObjectEntity {
  id: string;
  code: string;
  name: string;
  description: string;
  categoryId: string;
  regionId: string;
  districtId: string | null;
  geometryJson: string;
  operationalStatus: string;
  lifecycle: string;
  sensitivity: string;
  version: number;
  passportJson: string;
  accuracyM: number | null;
  updatedAt: string;
  isSynthetic: boolean;
  isPublicProjected: boolean;
}

export interface InspectionEntity {
  id: string;
  objectId: string;
  inspectorName: string;
  condition: string;
  operationalStatus: string;
  notes: string;
  nextInspectionDate: string | null;
  createdAt: string;
}

export interface CitizenReportEntity {
  id: string;
  userId: string;
  category: string;
  description: string;
  regionId: string | null;
  geometryJson: string | null;
  contactPhone: string | null;
  status: string;
  resolution?: string | null;
  attachmentCount: number;
  isSynthetic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovedRouteEntity {
  id: string;
  destinationObjectId: string;
  destinationName: string;
  requestedBy: string;
  geometryJson: string;
  stepsJson: string;
  distanceM: number;
  durationS: number;
  status: string;
  approvedBy: string | null;
  expiresAtEpochMs: number | null;
  sourceDate: string;
  version: number;
  createdAt: string;
}

export interface SyncOperationEntity {
  operationId: string;
  entityType: string;
  action: string;
  objectId: string | null;
  objectName: string;
  expectedVersion: number | null;
  payloadJson: string;
  status: 'pending' | 'conflict' | 'settled';
  errorMessage?: string | null;
  createdAt: string;
}

export interface NotificationEntity {
  id: string;
  userId: string | null;
  title: string;
  body: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
}

export interface ObjectAttachmentEntity {
  id: string;
  objectId: string | null;
  reportId: string | null;
  filename: string;
  mimeType: string;
  uriString: string;
  scanStatus: string;
  createdAt: string;
}

export interface AppPreferences {
  locale: AppLocale;
  darkTheme: boolean;
  activeAccountId: string | null;
  offlineMode: boolean;
  leaseExpiresAtMs: number;
  lastSyncAtMs: number;
}

export type RegistryGeometryType = 'POINT' | 'LINE' | 'POLYGON';

export type RegistryCategoryGroup = 'INFRASTRUCTURE' | 'HAZARDS' | 'EQUIPMENT';

export const CATEGORY_GROUP_LABEL_KEY: Record<RegistryCategoryGroup, string> = {
  INFRASTRUCTURE: 'groupInfrastructure',
  HAZARDS: 'groupHazards',
  EQUIPMENT: 'groupEquipment',
};

export function categoryGroupFromId(categoryId: string): RegistryCategoryGroup {
  if (
    categoryId === 'gas_pipeline' ||
    categoryId === 'gas_valve' ||
    categoryId === 'electrical_cable' ||
    categoryId === 'substation'
  ) {
    return 'HAZARDS';
  }
  if (
    categoryId === 'fire_hydrant' ||
    categoryId === 'pumping_station' ||
    categoryId === 'emergency_water_source'
  ) {
    return 'EQUIPMENT';
  }
  return 'INFRASTRUCTURE';
}

export type MarkerSeverity = 'OPERATIONAL' | 'MAINTENANCE' | 'FAULTY' | 'UNAVAILABLE' | 'UNKNOWN';

export function severityFromStatus(status: string): MarkerSeverity {
  switch (status) {
    case 'working':
      return 'OPERATIONAL';
    case 'under_maintenance':
      return 'MAINTENANCE';
    case 'faulty':
      return 'FAULTY';
    case 'temporarily_unavailable':
      return 'UNAVAILABLE';
    default:
      return 'UNKNOWN';
  }
}

export interface GisRegistryItem {
  id: string;
  code: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryGroup: RegistryCategoryGroup;
  regionId: string;
  regionName: string;
  operationalStatus: string;
  severity: MarkerSeverity;
  lifecycle: string;
  geometryType: RegistryGeometryType;
  markerCoordinate: GeoPoint;
  parsedGeometry: ParsedGeometry;
  accuracyM: number | null;
  updatedAt: string;
  isSynthetic: boolean;
  isPublicProjected: boolean;
}

export interface MarkerCluster {
  id: string;
  center: GeoPoint;
  items: GisRegistryItem[];
}

export function getClusterWorstStatus(items: GisRegistryItem[]): string {
  const priority = [
    'faulty',
    'temporarily_unavailable',
    'under_maintenance',
    'not_inspected',
    'unknown',
    'working',
  ];
  for (const st of priority) {
    if (items.some((it) => it.operationalStatus === st)) return st;
  }
  return items[0]?.operationalStatus ?? 'unknown';
}

export interface OtpChallenge {
  challengeId: string;
  phone: string;
  devOtp: string;
  isRegister: boolean;
  pendingAccount: UserAccountEntity | null;
}

export interface EmergencySubmissionResult {
  code: string;
  entity: InfrastructureObjectEntity | null;
  queuedOffline: boolean;
}

export interface SyncFlushResult {
  pushedReports: number;
  pushedInfrastructure: number;
  conflicts: number;
}

export type AppRoute =
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'registry' }
  | { name: 'objectForm'; objectId: string | null }
  | { name: 'passport'; objectId: string }
  | { name: 'report' }
  | { name: 'myReports' }
  | { name: 'inspections' }
  | { name: 'routes' }
  | { name: 'sync' }
  | { name: 'notifications' }
  | { name: 'profile' }
  | { name: 'auth' };
