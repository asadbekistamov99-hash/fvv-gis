import type { AuthResponse } from "./types";
const base = import.meta.env.VITE_API_URL || "/api/v1";
let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshing: Promise<void> | null = null;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function setSession(response: AuthResponse) {
  accessToken = response.access_token ?? null;
  refreshToken = response.refresh_token ?? null;
}
export function clearSession() {
  accessToken = null;
  refreshToken = null;
}
export function hasSession() {
  return !!accessToken;
}
function errorMessage(body: unknown): string {
  if (typeof body === "object" && body) {
    const b = body as Record<string, unknown>;
    const d = b.detail ?? b.message ?? b.error;
    if (typeof d === "string") return d;
    if (Array.isArray(d))
      return d
        .map((v) =>
          typeof v === "object" && v && "msg" in v ? String(v.msg) : String(v),
        )
        .join("; ");
    if (d && typeof d === "object" && "message" in d) return String(d.message);
  }
  return "So‘rov bajarilmadi. Qayta urinib ko‘ring.";
}
async function request(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      0,
      "Server bilan bog‘lanib bo‘lmadi. Internet va API manzilini tekshiring.",
    );
  }
  if (
    response.status === 401 &&
    retry &&
    refreshToken &&
    !path.startsWith("/auth/")
  ) {
    if (!refreshing)
      refreshing = request(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        false,
      )
        .then((response) => response.json() as Promise<AuthResponse>)
        .then(setSession)
        .catch((error) => {
          clearSession();
          window.dispatchEvent(new Event("session-expired"));
          throw error;
        })
        .finally(() => {
          refreshing = null;
        });
    await refreshing;
    return request(path, options, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, errorMessage(body), body);
  }
  return response;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await request(path, options);
  return (response.status === 204 ? null : await response.json()) as T;
}
export async function downloadFile(
  path: string,
  filename: string,
): Promise<void> {
  const response = await request(path);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export function queryParams(
  values: Record<string, string | number | undefined | null>,
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  return p.size ? `?${p}` : "";
}
export function displayDate(value?: string | null, lang = "uz") {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(
        lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      ).format(date);
}
export function validateGeometry(
  geometry: unknown,
): geometry is import("./types").Geometry {
  if (!geometry || typeof geometry !== "object") return false;
  const g = geometry as { type?: string; coordinates?: unknown };
  const point = (p: unknown): boolean =>
    Array.isArray(p) &&
    p.length === 2 &&
    p.every((v) => typeof v === "number" && Number.isFinite(v)) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 90;
  if (g.type === "Point") return point(g.coordinates);
  if (g.type === "LineString")
    return (
      Array.isArray(g.coordinates) &&
      g.coordinates.length >= 2 &&
      g.coordinates.every(point)
    );
  if (g.type === "MultiLineString")
    return Array.isArray(g.coordinates) && g.coordinates.length > 0 && g.coordinates.every((line) => Array.isArray(line) && line.length >= 2 && line.every(point));
  if (g.type === "Polygon")
    return (
      Array.isArray(g.coordinates) &&
      g.coordinates.length > 0 &&
      g.coordinates.every(
        (r) =>
          Array.isArray(r) &&
          r.length >= 4 &&
          r.every(point) &&
          JSON.stringify(r[0]) === JSON.stringify(r[r.length - 1]),
      )
    );
  if (g.type === "MultiPolygon")
    return Array.isArray(g.coordinates) && g.coordinates.length > 0 && g.coordinates.every((polygon) => validateGeometry({ type: "Polygon", coordinates: polygon }));
  return false;
}
