import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleAlert,
  Database,
  FileText,
  LoaderCircle,
  LocateFixed,
  LogOut,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError, displayDate, patch, queryParams } from "./api";
import { localizedName, statusKey } from "./i18n";
import type {
  Infrastructure,
  OperationsUI,
  Page,
  PublicCollection,
  PublicConfig,
  PublicFeature,
  PublicLayer,
  Region,
  Report,
  ReportAttachment,
  SessionInfo,
  User,
} from "./types";
import MapView from "./components/LazyMapView";

const states = [
  "working",
  "faulty",
  "under_maintenance",
  "temporarily_unavailable",
  "not_inspected",
  "unknown",
];
export const reportCategories = [
  "infrastructure_fault",
  "fire",
  "flood",
  "gas_leak",
  "other",
];

export function usePublicConfig() {
  return useQuery({
    queryKey: ["public-config"],
    queryFn: () => api<PublicConfig>("/public/config"),
    staleTime: 300000,
  });
}
function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: () => api<Page<Region>>("/gis/regions"),
    staleTime: 300000,
  });
}

function Busy({ ui }: { ui: OperationsUI }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <span>{ui.copy("Ma’lumot yuklanmoqda…")}</span>
    </div>
  );
}
function Problem({
  ui,
  error,
  retry,
}: {
  ui: OperationsUI;
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <CircleAlert size={21} />
      <div>
        <strong>{ui.t("error")}</strong>
        <p>{error instanceof Error ? ui.copy(error.message) : String(error)}</p>
      </div>
      {retry && (
        <button className="button button-outline" onClick={retry}>
          {ui.t("retry")}
        </button>
      )}
    </div>
  );
}
function Nothing({ ui, children }: { ui: OperationsUI; children: ReactNode }) {
  return (
    <div className="empty">
      <Database size={32} />
      <strong>{ui.t("noData")}</strong>
      <p>{children}</p>
    </div>
  );
}
function StatusPill({ ui, value }: { ui: OperationsUI; value: string }) {
  return (
    <span className={`status status-${value}`}>
      <i />
      {statusKey[value] ? ui.t(statusKey[value]) : ui.copy(value)}
    </span>
  );
}
function Dialog({
  ui,
  title,
  onClose,
  children,
  wide = false,
}: {
  ui: OperationsUI;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={ui.t("close")}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Labeled({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {children}
    </label>
  );
}

/** The public projection has no code, passport or sensitivity; fill neutral values for the shared map. */
function asMapObject(feature: PublicFeature): Infrastructure {
  const p = feature.properties;
  return {
    id: String(p.id),
    code: "",
    name: p.name,
    category_id: p.category_id,
    region_id: p.region_id,
    district_id: p.district_id,
    geometry: feature.geometry,
    operational_status: p.operational_status,
    lifecycle: "published",
    sensitivity: "public",
    version: 1,
    passport: {},
    updated_at: p.updated_at || "",
    is_synthetic: p.is_synthetic,
  };
}

export function EmergencyNotice({ ui }: { ui: OperationsUI }) {
  return (
    <div className="emergency-banner" role="note">
      <CircleAlert size={22} />
      <p>
        {ui.copy(
          "Favqulodda vaziyatda 112 raqamiga qo‘ng‘iroq qiling. Sayt rasmiy dispetcherlik tizimiga ulanmagan.",
        )}
      </p>
      <a className="button button-danger" href="tel:112">
        <Phone size={17} />
        112
      </a>
    </div>
  );
}

export function PublicMap({ ui }: { ui: OperationsUI }) {
  const { language, t, copy } = ui;
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Infrastructure | null>(null);
  const term = useDeferredValue(search.trim());
  const regions = useRegions();
  const layers = useQuery({
    queryKey: ["public-layers"],
    queryFn: () => api<Page<PublicLayer>>("/public/gis/layers"),
    staleTime: 60000,
  });
  const records = useQuery({
    queryKey: ["public-objects", term, region, category, status],
    queryFn: () =>
      api<PublicCollection>(
        `/public/gis/objects${queryParams({ search: term, region_id: region, category_id: category, status, limit: 2000 })}`,
      ),
    refetchInterval: 60000,
  });
  const objects = useMemo(
    () => (records.data?.features || []).map(asMapObject),
    [records.data],
  );
  const regionName = (id?: string | null) =>
    localizedName(
      regions.data?.items.find((item) => item.id === id),
      language,
    );
  const categoryName = (id?: string | null) =>
    localizedName(
      layers.data?.items.find((item) => item.id === id),
      language,
    );
  return (
    <>
      <section className="panel filter-panel">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label={t("search")}
            placeholder={copy("Obyekt nomini qidiring…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label={t("region")}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="">{t("allRegions")}</option>
          {(regions.data?.items || []).map((item) => (
            <option value={item.id} key={item.id}>
              {localizedName(item, language)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t("allCategories")}</option>
          {(layers.data?.items || []).map((item) => (
            <option value={item.id} key={item.id}>
              {localizedName(item, language)} ({item.count})
            </option>
          ))}
        </select>
        <select
          aria-label={t("status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t("allStatuses")}</option>
          {states.map((value) => (
            <option key={value} value={value}>
              {t(statusKey[value])}
            </option>
          ))}
        </select>
      </section>
      {records.error && (
        <Problem ui={ui} error={records.error} retry={() => records.refetch()} />
      )}
      <section className="panel">
        <MapView
          objects={objects}
          language={language}
          onSelect={setSelected}
          title={t("publicMap")}
          expanded
        />
        <div className="map-bottom-note">
          {objects.length} / {records.data?.total ?? 0} {t("objects")}
          {copy("· Faqat ommaviy nashr qilingan obyektlar ko‘rsatiladi.")}
        </div>
      </section>
      {selected && (
        <section className="panel public-object" aria-live="polite">
          <div className="panel-heading">
            <div>
              <h2>{selected.name}</h2>
              <p>
                {categoryName(selected.category_id)} ·{" "}
                {regionName(selected.region_id)}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label={t("close")}
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
          </div>
          <div className="public-object-facts">
            <StatusPill ui={ui} value={selected.operational_status} />
            {selected.is_synthetic && (
              <span className="synthetic-tag">{t("synthetic")}</span>
            )}
            {selected.updated_at && (
              <span>
                {copy("Yangilangan")}: {displayDate(selected.updated_at, language)}
              </span>
            )}
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {copy("Ommaviy obyektlar")}
            <span className="count-pill">{records.data?.total ?? "—"}</span>
          </h2>
          <MapPin size={21} />
        </div>
        {records.isLoading ? (
          <Busy ui={ui} />
        ) : !objects.length ? (
          <Nothing ui={ui}>
            {copy("Tanlangan filtrlar bo‘yicha ommaviy obyekt topilmadi.")}
          </Nothing>
        ) : (
          <div className="public-list">
            {objects.slice(0, 60).map((item) => (
              <button
                key={item.id}
                className={`public-list-item ${selected?.id === item.id ? "selected" : ""}`}
                onClick={() => setSelected(item)}
              >
                <strong>{item.name}</strong>
                <span>
                  {categoryName(item.category_id)} · {regionName(item.region_id)}
                </span>
                <StatusPill ui={ui} value={item.operational_status} />
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ReportForm({
  ui,
  onClose,
  onCreated,
}: {
  ui: OperationsUI;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { language, t, copy, notify } = ui;
  const config = usePublicConfig();
  const regions = useRegions();
  const live = !!config.data?.live_intake_enabled;
  const [category, setCategory] = useState(reportCategories[0]);
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [contact, setContact] = useState("");
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  // A retry of the same content reuses its key; any edit gets a fresh one so the server never sees a mismatch.
  const idempotency = useRef({ body: "", key: "" });
  function locate() {
    if (!navigator.geolocation) {
      setError(new Error(t("gpsUnavailable")));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint([position.coords.longitude, position.coords.latitude]);
        setLocating(false);
      },
      () => {
        setError(new Error(t("gpsDenied")));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const body = JSON.stringify({
        category,
        description: description.trim(),
        geometry: point ? { type: "Point", coordinates: point } : null,
        contact_phone: contact.trim() || null,
        region_id: region || null,
        is_synthetic: !live,
      });
      if (idempotency.current.body !== body)
        idempotency.current = { body, key: crypto.randomUUID() };
      const created = await api<Report>("/reports", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotency.current.key },
      });
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("report_id", created.id);
        try {
          await api("/attachments", { method: "POST", body: form });
        } catch (uploadError) {
          notify(
            `${copy("Murojaat saqlandi, lekin fayl yuklanmadi.")} ${uploadError instanceof Error ? copy(uploadError.message) : ""}`,
            true,
          );
          onCreated();
          return;
        }
      }
      notify(copy("Murojaat qabul qilindi."));
      onCreated();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 503
          ? new Error(
              copy(
                "Murojaat qabul qilish hozircha yopiq. Operator siyosati tasdiqlangach ochiladi.",
              ),
            )
          : e,
      );
    } finally {
      setBusy(false);
    }
  }
  const marker: Infrastructure[] = point
    ? [
        asMapObject({
          type: "Feature",
          id: "report-location",
          geometry: { type: "Point", coordinates: point },
          properties: {
            id: "report-location",
            name: copy("Murojaat joyi"),
            category_id: "",
            region_id: region,
            operational_status: "unknown",
            is_synthetic: !live,
          },
        }),
      ]
    : [];
  return (
    <Dialog ui={ui} title={copy("Yangi murojaat")} onClose={onClose} wide>
      <form onSubmit={submit} className="report-form">
        <div className="warning-banner">
          <CircleAlert size={19} />
          {copy(
            "Bu shakl shoshilinch bo‘lmagan murojaatlar uchun. Xavf bo‘lsa darhol 112 ga qo‘ng‘iroq qiling.",
          )}
        </div>
        {!live && (
          <div className="dev-notice">
            <strong>{t("synthetic")}</strong>
            <p>
              {copy(
                "Haqiqiy murojaatlar qabuli yopiq. Yuborilgan yozuv sinov namunasi sifatida saqlanadi.",
              )}
            </p>
          </div>
        )}
        <div className="form-grid">
          <Labeled label={t("category")} required>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {reportCategories.map((value) => (
                <option key={value} value={value}>
                  {copy(value)}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label={t("region")} required={live}>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required={live}
            >
              <option value="">{copy("Hududni tanlang")}</option>
              {(regions.data?.items || []).map((item) => (
                <option value={item.id} key={item.id}>
                  {localizedName(item, language)}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
        <Labeled label={copy("Nima sodir bo‘ldi?")} required>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minLength={5}
            maxLength={10000}
            placeholder={copy("Vaziyatni qisqa va aniq yozing.")}
            required
          />
        </Labeled>
        <Labeled label={copy("Aloqa uchun telefon (ixtiyoriy)")}>
          <input
            type="tel"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={80}
            placeholder="+998 90 123 45 67"
          />
        </Labeled>
        <div className="field">
          <span>{copy("Joylashuv (ixtiyoriy)")}</span>
          <div className="location-row">
            <button
              type="button"
              className="button button-outline"
              onClick={locate}
              disabled={locating}
            >
              {locating ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <LocateFixed size={17} />
              )}
              {copy("Joylashuvimni aniqlash")}
            </button>
            {point ? (
              <>
                <code>
                  {point[1].toFixed(5)}, {point[0].toFixed(5)}
                </code>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setPoint(null)}
                >
                  {copy("Tozalash")}
                </button>
              </>
            ) : (
              <small>{copy("Yoki xaritada nuqtani bosing.")}</small>
            )}
          </div>
          <div className="report-map">
            <MapView
              objects={marker}
              language={language}
              drawType="Point"
              title={copy("Murojaat joyi")}
              onDraw={(geometry) => {
                if (geometry.type === "Point")
                  setPoint(geometry.coordinates as [number, number]);
              }}
            />
          </div>
        </div>
        <Labeled label={copy("Rasm yoki hujjat (ixtiyoriy)")}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </Labeled>
        {error !== undefined && <Problem ui={ui} error={error} />}
        <div className="modal-footer">
          <button type="button" className="button button-outline" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? <LoaderCircle size={18} className="spin" /> : <Check size={18} />}
            {copy("Murojaatni yuborish")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ReportDetail({
  ui,
  report,
  onClose,
}: {
  ui: OperationsUI;
  report: Report;
  onClose: () => void;
}) {
  const { language, copy } = ui;
  const regions = useRegions();
  const attachments = useQuery({
    queryKey: ["report-attachments", report.id],
    queryFn: () =>
      api<Page<ReportAttachment>>(`/reports/${report.id}/attachments`),
  });
  const coordinates = report.geometry?.coordinates;
  return (
    <Dialog ui={ui} title={copy(report.category)} onClose={onClose}>
      <div className="report-detail">
        <div className="public-object-facts">
          <StatusPill ui={ui} value={report.status} />
          {report.is_synthetic && (
            <span className="synthetic-tag">{ui.t("synthetic")}</span>
          )}
        </div>
        <p className="report-text">{report.description}</p>
        <dl className="fact-list">
          <dt>{copy("Yuborilgan")}</dt>
          <dd>{displayDate(report.created_at, language)}</dd>
          <dt>{copy("Yangilangan")}</dt>
          <dd>{displayDate(report.updated_at, language)}</dd>
          {report.closed_at && (
            <>
              <dt>{copy("Yopilgan")}</dt>
              <dd>{displayDate(report.closed_at, language)}</dd>
            </>
          )}
          {report.region_id && (
            <>
              <dt>{ui.t("region")}</dt>
              <dd>
                {localizedName(
                  regions.data?.items.find((item) => item.id === report.region_id),
                  language,
                )}
              </dd>
            </>
          )}
          {coordinates && (
            <>
              <dt>{copy("Koordinata")}</dt>
              <dd>
                {coordinates[1].toFixed(5)}, {coordinates[0].toFixed(5)}
              </dd>
            </>
          )}
          <dt>{copy("Murojaat raqami")}</dt>
          <dd>
            <code>{report.id}</code>
          </dd>
        </dl>
        {!!attachments.data?.items.length && (
          <ul className="attachment-list">
            {attachments.data.items.map((item) => (
              <li key={item.id}>
                <FileText size={17} />
                <span>{item.filename}</span>
                <StatusPill ui={ui} value={item.scan_status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

export function CitizenReports({ ui }: { ui: OperationsUI }) {
  const { language, copy } = ui;
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const records = useQuery({
    queryKey: ["my-reports"],
    queryFn: () => api<Page<Report>>("/reports/my?limit=100"),
    refetchInterval: 30000,
  });
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {copy("Mening murojaatlarim")}
            <span className="count-pill">{records.data?.total ?? "—"}</span>
          </h2>
          <button
            className="button button-primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={18} />
            {copy("Yangi murojaat")}
          </button>
        </div>
        {records.isLoading ? (
          <Busy ui={ui} />
        ) : records.error ? (
          <Problem ui={ui} error={records.error} retry={() => records.refetch()} />
        ) : !records.data?.items.length ? (
          <Nothing ui={ui}>
            {copy("Hali murojaat yubormagansiz. Yangi murojaat tugmasini bosing.")}
          </Nothing>
        ) : (
          <div className="report-grid">
            {records.data.items.map((report) => (
              <button
                className="report-card"
                key={report.id}
                onClick={() => setSelected(report)}
              >
                <div>
                  <span className="control-icon orange">
                    <CircleAlert size={21} />
                  </span>
                  <StatusPill ui={ui} value={report.status} />
                </div>
                <h3>{copy(report.category)}</h3>
                <p>{report.description}</p>
                <footer>
                  <span>{displayDate(report.created_at, language)}</span>
                </footer>
              </button>
            ))}
          </div>
        )}
      </section>
      {creating && (
        <ReportForm
          ui={ui}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            queryClient.invalidateQueries({ queryKey: ["my-reports"] });
          }}
        />
      )}
      {selected && (
        <ReportDetail ui={ui} report={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

export function ProfileView({
  ui,
  user,
  onUser,
  onLogout,
  onDeleted,
}: {
  ui: OperationsUI;
  user: User;
  onUser: (user: User) => void;
  onLogout: () => void;
  onDeleted: () => void;
}) {
  const { language, t, copy, notify } = ui;
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.full_name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api<Page<SessionInfo>>("/auth/sessions"),
  });
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const save = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      onUser(await patch<User>("/users/me", { full_name: name.trim(), language }));
      notify(t("success"));
    });
  };
  const revoke = (id: string) =>
    run(async () => {
      await api(`/auth/sessions/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      notify(copy("Sessiya yopildi."));
    });
  const remove = () =>
    run(async () => {
      await api("/users/me", { method: "DELETE" });
      notify(copy("Hisobingiz o‘chirildi."));
      onDeleted();
    });
  return (
    <div className="profile-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{copy("Shaxsiy ma’lumotlar")}</h2>
            <p>
              {user.phone} · {copy(user.role)}
            </p>
          </div>
          <ShieldCheck size={21} />
        </div>
        {user.role === "pending_employee" && (
          <div className="warning-banner">
            <CircleAlert size={19} />
            {copy(
              "Xodimlik arizangiz ko‘rib chiqilmoqda. Tasdiqlangach operativ bo‘limlar ochiladi.",
            )}
          </div>
        )}
        <form onSubmit={save} className="profile-form">
          <Labeled label={copy("To‘liq ism")} required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={200}
              required
            />
          </Labeled>
          <div className="modal-footer">
            <button type="button" className="button button-outline" onClick={onLogout}>
              <LogOut size={17} />
              {t("logout")}
            </button>
            <button className="button button-primary" disabled={busy} type="submit">
              <Check size={18} />
              {t("save")}
            </button>
          </div>
        </form>
        {error !== undefined && <Problem ui={ui} error={error} />}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {copy("Faol sessiyalar")}
            <span className="count-pill">{sessions.data?.total ?? "—"}</span>
          </h2>
        </div>
        {sessions.isLoading ? (
          <Busy ui={ui} />
        ) : sessions.error ? (
          <Problem ui={ui} error={sessions.error} />
        ) : (
          <ul className="session-list">
            {(sessions.data?.items || []).map((session) => (
              <li key={session.id}>
                <div>
                  <strong>{displayDate(session.created_at, language)}</strong>
                  <small>
                    {copy("Amal qiladi")}: {displayDate(session.expires_at, language)}
                  </small>
                </div>
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => revoke(session.id)}
                >
                  {copy("Yopish")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel danger-zone">
        <div className="panel-heading">
          <div>
            <h2>{copy("Hisobni o‘chirish")}</h2>
            <p>
              {copy(
                "Hisob o‘chirilgach barcha sessiyalar yopiladi va bu amalni qaytarib bo‘lmaydi.",
              )}
            </p>
          </div>
          <Trash2 size={21} />
        </div>
        {!confirming ? (
          <button className="button button-danger" onClick={() => setConfirming(true)}>
            {copy("Hisobni o‘chirish")}
          </button>
        ) : (
          <div className="danger-confirm">
            <label>
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
              />
              {copy("Tushundim, hisobim butunlay o‘chirilsin.")}
            </label>
            <div className="modal-footer">
              <button
                className="button button-outline"
                onClick={() => {
                  setConfirming(false);
                  setUnderstood(false);
                }}
              >
                {t("cancel")}
              </button>
              <button
                className="button button-danger"
                disabled={!understood || busy}
                onClick={remove}
              >
                {copy("Ha, o‘chirish")}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
