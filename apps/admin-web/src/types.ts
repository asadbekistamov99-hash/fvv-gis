export type Language = "uz" | "ru" | "en";
export interface User {
  id: string;
  phone: string;
  full_name: string;
  role: string;
  status?: string;
  region_id?: string;
  organization_id?: string;
  mfa_required?: boolean;
  roles?: string[];
  permissions?: string[];
  employee_status?: string;
  is_active?: boolean;
  district_id?: string | null;
  assignments?: RoleScope[];
  assignments_complete?: boolean;
}
export interface RoleScope {
  role_id: string;
  region_id?: string | null;
  district_id?: string | null;
  organization_id?: string | null;
  max_sensitivity: string;
  categories: string[];
}
export interface OperationsUI {
  language: Language;
  t: (key: import("./i18n").TranslationKey) => string;
  copy: (source: string) => string;
  notify: (message: string, error?: boolean) => void;
}
export interface ApprovedRoute {
  id: string;
  requested_by: string;
  destination_object_id: string;
  geometry: import("geojson").LineString;
  steps: { name: string; distance_m: number; duration_s: number }[];
  distance_m: number;
  duration_s: number;
  status: string;
  approved_by?: string | null;
  expires_at?: string | null;
  source_date: string;
  version: number;
  created_at: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  next_cursor?: string | null;
}
export interface Region {
  id: string;
  name_uz: string;
  name_ru?: string;
  name_en?: string;
}
export interface Category extends Region {
  geometry_types?: string[];
  schema_version?: number;
  schema?: Record<string, unknown>;
}
export type Geometry =
  | import("geojson").Point
  | import("geojson").LineString
  | import("geojson").MultiLineString
  | import("geojson").Polygon
  | import("geojson").MultiPolygon;
export interface Infrastructure {
  id: string;
  code: string;
  name: string;
  description?: string;
  category_id: string;
  region_id: string;
  district_id?: string | null;
  organization_id?: string | null;
  responsible_employee_id?: string | null;
  geometry: Geometry;
  operational_status: string;
  lifecycle: string;
  sensitivity: string;
  version: number;
  passport: Record<string, unknown>;
  accuracy_m?: number | null;
  updated_at: string;
  is_synthetic: boolean;
  survey_date?: string | null;
  data_source?: string;
}
export interface Dashboard {
  total_objects: number;
  working_objects: number;
  faulty_objects: number;
  pending_approvals: number;
  active_employees: number;
  citizen_reports: number;
  by_category: { category_id: string; count: number }[];
  by_region: { region_id: string; count: number }[];
}
export interface Report {
  id: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
  user_id?: string;
  assigned_to?: string | null;
  contact_phone?: string;
  is_synthetic?: boolean;
}
export interface Verification {
  id: string;
  user_id: string;
  full_name?: string;
  phone?: string;
  organization?: string;
  department?: string;
  region_id?: string;
  district_id?: string;
  status: string;
  reference?: string;
  organization_id?: string;
  organization_name?: string;
  verification_reference?: string;
  requested_role?: string;
  user?: User;
  created_at?: string;
}
export interface Audit {
  id: string;
  action: string;
  actor_id?: string;
  target_id?: string;
  created_at: string;
  outcome?: string;
  details?: Record<string, unknown>;
  version?: number;
  state?: string;
  created_by?: string;
}
export interface Inspection {
  id: string;
  object_id: string;
  condition: string;
  notes?: string;
  inspected_at?: string;
  created_at?: string;
  inspector_id?: string;
}
export interface Notification {
  id: string;
  title: string;
  body?: string;
  message?: string;
  read_at?: string | null;
  created_at: string;
  is_public?: boolean;
  reviewed_by?: string | null;
}
export interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: User;
  mfa_required?: boolean;
  mfa_challenge_id?: string;
  challenge_id?: string;
  dev_otp?: string;
}
