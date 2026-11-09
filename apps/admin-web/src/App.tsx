import { copy as localize } from "./copy";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Database,
  Droplets,
  FileCheck2,
  FileText,
  Flame,
  LayoutDashboard,
  LoaderCircle,
  LocateFixed,
  LogOut,
  Map,
  MapPin,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Upload,
  Users,
  Waves,
  WifiOff,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  clearSession,
  displayDate,
  downloadFile,
  patch,
  post,
  queryParams,
  setSession,
  validateGeometry,
} from "./api";
import { dictionary, localizedName, statusKey, translate } from "./i18n";
import type { TranslationKey } from "./i18n";
import type {
  Audit,
  AuthResponse,
  Category,
  Dashboard,
  Geometry,
  Infrastructure,
  Inspection,
  Language,
  Notification,
  Page,
  Region,
  Report,
  User,
  Verification,
} from "./types";
import MapView from "./components/LazyMapView";
import RoutesView from "./components/RoutesView";
import EmployeeAccess from "./components/EmployeeAccess";
type View =
  | "dashboard"
  | "map"
  | "registry"
  | "approvals"
  | "employees"
  | "reports"
  | "inspections"
  | "routes"
  | "notifications"
  | "settings";
const UI = createContext<{
  language: Language;
  t: (key: TranslationKey) => string;
  notify: (message: string, error?: boolean) => void;
  copy: (source: string) => string;
  permissions: string[];
}>({
  language: "uz",
  t: (key) => dictionary.uz[key],
  notify: () => {},
  copy: (source) => source,
  permissions: [],
});
const useUI = () => useContext(UI);
const states = [
  "working",
  "faulty",
  "under_maintenance",
  "temporarily_unavailable",
  "not_inspected",
  "unknown",
];
const employeeRoles = [
  "verified_employee",
  "regional_supervisor",
  "infrastructure_inspector",
  "data_reviewer",
  "system_administrator",
  "super_administrator",
];
const navItems: { id: View; icon: typeof Map; group?: boolean }[] = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "map", icon: Map },
  { id: "registry", icon: Database },
  { id: "approvals", icon: ClipboardCheck },
  { id: "employees", icon: Users, group: true },
  { id: "reports", icon: FileText },
  { id: "inspections", icon: ShieldCheck },
  { id: "routes", icon: LocateFixed },
  { id: "notifications", icon: Bell },
  { id: "settings", icon: Settings, group: true },
];
function usePage<T>(key: unknown[], path: string, enabled = true) {
  return useQuery({
    queryKey: key,
    queryFn: () => api<T>(path),
    enabled,
    refetchInterval: 30000,
  });
}
function Status({ value }: { value: string }) {
  const { t } = useUI();
  return (
    <span className={`status status-${value}`}>
      <i />
      {statusKey[value] ? t(statusKey[value]) : value.replaceAll("_", " ")}
    </span>
  );
}
function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t, copy } = useUI();
  return (
    <div className="error-box" role="alert">
      <CircleAlert size={21} />
      <div>
        <strong>{t("error")}</strong>
        <p>
          {error instanceof ApiError && error.status === 409
            ? copy(
                "Yozuv boshqa foydalanuvchi tomonidan yangilangan. Ma’lumotni yangilang va tahrirlaringizni solishtiring.",
              )
            : error instanceof Error
              ? copy(error.message)
              : String(error)}
        </p>
      </div>
      {retry && (
        <button className="button button-outline" onClick={retry}>
          {t("retry")}
        </button>
      )}
    </div>
  );
}
function Empty({ children }: { children?: ReactNode }) {
  const { t, copy } = useUI();
  return (
    <div className="empty">
      <Database size={32} />
      <strong>{t("noData")}</strong>
      <p>
        {children ||
          copy("Ma’lumotlar serverdan kelganda shu yerda ko‘rinadi.")}
      </p>
    </div>
  );
}
function Loading() {
  const { copy } = useUI();
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <span>{copy("Ma’lumot yuklanmoqda…")}</span>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useUI();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("close")}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  const { copy } = useUI();
  return (
    <label className="field">
      <span>
        {label}
        {required && <b aria-label={copy("required")}> *</b>}
      </span>
      {children}
    </label>
  );
}
function Auth({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const { language, t, copy } = useUI();
  const [phone, setPhone] = useState("+998");
  const [challenge, setChallenge] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [mfaToken, setMfaToken] = useState("");
  const [mfaSetup, setMfaSetup] = useState<{
    secret: string;
    provisioning_uri: string;
  } | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const deviceId = useMemo(() => crypto.randomUUID(), []);
  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (!challenge) {
        const result = await post<AuthResponse>("/auth/login", { phone });
        setChallenge(result.challenge_id || "");
        setDevOtp(result.dev_otp || "");
      } else {
        const result = await post<AuthResponse>(
          mfaToken ? "/auth/mfa/verify" : "/auth/verify-phone",
          mfaToken
            ? { challenge_token: mfaToken, code: otp, device_id: deviceId }
            : { challenge_id: challenge, code: otp, device_id: deviceId },
        );
        const mfa = result as AuthResponse & {
          mfa_challenge_token?: string;
          mfa_setup_required?: boolean;
        };
        if (mfa.mfa_required) {
          setMfaToken(mfa.mfa_challenge_token || "");
          setNeedsSetup(!!mfa.mfa_setup_required);
          setOtp("");
          return;
        }
        setSession(result);
        const user = result.user || (await api<User>("/users/me"));
        onAuthenticated(user);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function enroll() {
    setBusy(true);
    try {
      setMfaSetup(
        await post("/auth/mfa/enroll", { challenge_token: mfaToken }),
      );
      setNeedsSetup(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-brand">
        <Brand />
        <div className="login-grid" aria-hidden="true">
          <div className="contour contour-a" />
          <div className="contour contour-b" />
          <div className="contour contour-c" />
          <span className="grid-point p1" />
          <span className="grid-point p2" />
          <span className="grid-point p3" />
          <span className="grid-point p4" />
        </div>
        <div className="login-intro">
          <span className="eyebrow pale">UZBEKISTAN · GIS PLATFORM</span>
          <h1>{t("loginTitle")}</h1>
          <p>{t("loginBody")}</p>
          <div className="login-features">
            <span>
              <Map size={18} />
              {copy("14 hudud")}
            </span>
            <span>
              <ShieldCheck size={18} />
              {copy("Nazoratli kirish")}
            </span>
            <span>
              <Database size={18} />
              {copy("Yagona reyestr")}
            </span>
          </div>
        </div>
        <div className="login-disclaimer">
          <ShieldCheck size={18} />
          {t("independent")}
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-topline">
          <span>FVV GIS / ADMIN</span>
          <span>{language.toUpperCase()}</span>
        </div>
        <form onSubmit={handleAuth} className="login-form">
          <div className="login-icon">
            <LocateFixed size={29} />
          </div>
          <span className="eyebrow">{copy("BOSHQARUV PLATFORMASI")}</span>
          <h2>{t("loginCard")}</h2>
          <p>
            {mfaToken
              ? copy("Ikki bosqichli tasdiqlash kodini kiriting.")
              : t("loginHint")}
          </p>
          {!challenge ? (
            <Field label={t("phone")} required>
              <input
                type="tel"
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                pattern="\+998[0-9 ]{9,13}"
                required
              />
            </Field>
          ) : (
            <>
              <div className="phone-confirm">
                <CheckCheck size={18} />
                {phone}
                <button
                  type="button"
                  onClick={() => {
                    setChallenge("");
                    setMfaToken("");
                    setMfaSetup(null);
                    setDevOtp("");
                  }}
                >
                  {t("edit")}
                </button>
              </div>
              {devOtp && !mfaToken && (
                <div className="dev-notice">
                  <strong>{t("devOtp")}</strong>
                  <code>{devOtp}</code>
                  <span>{t("synthetic")}</span>
                </div>
              )}
              {needsSetup && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={enroll}
                  disabled={busy}
                >
                  {copy("Authenticator sozlash")}
                </button>
              )}
              {mfaSetup && (
                <div className="dev-notice">
                  <strong>{copy("Authenticator kaliti")}</strong>
                  <code>{mfaSetup.secret}</code>
                  <p>
                    {copy(
                      "Kalitni Authenticator ilovasiga qo‘shing. Uni boshqalar bilan ulashmang.",
                    )}
                  </p>
                </div>
              )}
              <Field
                label={mfaToken ? copy("Authenticator kodi") : t("otp")}
                required
              >
                <input
                  className="otp-input"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                />
              </Field>
            </>
          )}
          {error !== undefined && <ErrorBox error={error} />}
          <button
            className="button button-primary login-submit"
            disabled={busy || needsSetup}
            type="submit"
          >
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : challenge ? (
              t("verify")
            ) : (
              t("sendCode")
            )}
            <ArrowRight size={19} />
          </button>
          <div className="secure-note">
            <ShieldCheck size={18} />
            <p>{t("loginNotice")}</p>
          </div>
        </form>
        <div className="login-bottom">
          <span>© {new Date().getFullYear()} FVV GIS Uzbekistan</span>
          <span>HTTPS · RBAC · Audit</span>
        </div>
      </section>
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Map size={27} />
        <span />
      </div>
      <div>
        <strong>
          FVV<span>GIS</span>
        </strong>
        <small>UZBEKISTAN</small>
      </div>
    </div>
  );
}
export default function App() {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("fvv-language") as Language) || "uz",
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem("fvv-theme") === "dark",
  );
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [sidebar, setSidebar] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [object, setObject] = useState<Infrastructure | null>(null);
  const [editor, setEditor] = useState<Infrastructure | null | undefined>();
  const queryClient = useQueryClient();
  const t = (key: TranslationKey) => translate(language, key);
  const copy = (source: string) => localize(language, source);
  const notify = (message: string, error = false) =>
    setToast({ message, error });
  const categories = usePage<Page<Category>>(
    ["categories"],
    "/categories",
    !!user,
  );
  const regions = usePage<Page<Region>>(["regions"], "/gis/regions", !!user);
  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("fvv-language", language);
  }, [language]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("fvv-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const expired = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("session-expired", expired);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("session-expired", expired);
    };
  }, [queryClient]);
  async function logout() {
    try {
      await post("/auth/logout");
    } catch {
      /* Local credentials are still cleared if the network is unavailable. */
    } finally {
      clearSession();
      queryClient.clear();
      setUser(null);
      setObject(null);
      setEditor(undefined);
    }
  }
  function navigate(next: View) {
    setView(next);
    setSidebar(false);
  }
  return (
    <UI.Provider value={{ language, t, notify, copy, permissions: user?.permissions || [] }}>
      {!user ? (
        <>
          <div className="login-preferences">
            <button
              className="icon-button"
              aria-label={copy("Theme")}
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <select
              aria-label={copy("Language")}
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
          <Auth
            onAuthenticated={(person) => {
              setUser(person);
              setView(
                person.permissions?.includes("infrastructure.review")
                  ? "dashboard"
                  : "map",
              );
            }}
          />
        </>
      ) : (
        <div className="app-shell">
          {sidebar && (
            <button
              className="sidebar-shade"
              onClick={() => setSidebar(false)}
              aria-label={t("close")}
            />
          )}
          <aside className={`sidebar ${sidebar ? "sidebar-open" : ""}`}>
            <Brand />
            <div className="workspace-label">
              <span className="workspace-icon">
                <Building2 size={17} />
              </span>
              <div>
                <strong>{copy("Operativ boshqaruv")}</strong>
                <small>{copy("O‘zbekiston Respublikasi")}</small>
              </div>
              <ChevronDown size={14} />
            </div>
            <span className="nav-label">{copy("ISH MAYDONI")}</span>
            <nav aria-label={copy("Asosiy navigatsiya")}>
              {navItems
                .filter((item) => {
                  const permission: Partial<Record<View, string>> = {
                    dashboard: "infrastructure.review",
                    approvals: "infrastructure.review",
                    employees: "employees.verify",
                    reports: "reports.manage",
                    settings: "settings.manage",
                  };
                  return (
                    !permission[item.id] ||
                    user.permissions?.includes(permission[item.id]!)
                  );
                })
                .map((item) => (
                  <button
                    key={item.id}
                    className={`nav-item ${view === item.id ? "selected" : ""} ${item.group ? "nav-group" : ""}`}
                    onClick={() => navigate(item.id)}
                  >
                    <item.icon size={20} />
                    <span>{t(item.id)}</span>
                    {view === item.id && <span className="nav-active-dot" />}
                  </button>
                ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="scope-note">
                <ShieldCheck size={19} />
                <span>{t("readonly")}</span>
              </div>
              <button
                className="user-menu"
                onClick={logout}
                title={t("logout")}
              >
                <span className="avatar">
                  {(user.full_name || user.phone).slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <strong>{user.full_name || user.phone}</strong>
                  <small>{copy(user.role)}</small>
                </span>
                <LogOut size={17} />
              </button>
            </div>
          </aside>
          <main className="main">
            <header className="topbar">
              <div className="breadcrumb">
                <button
                  className="icon-button mobile-menu"
                  aria-label={copy("Menu")}
                  onClick={() => setSidebar(true)}
                >
                  <Menu />
                </button>
                <span>{copy("Platforma")}</span>
                <ChevronRight size={14} />
                <strong>{t(view)}</strong>
              </div>
              <div className="topbar-actions">
                <span className={`connection ${!online ? "disconnected" : ""}`}>
                  <i />
                  {online ? t("online") : t("offline")}
                </span>
                <select
                  className="language-select"
                  aria-label={copy("Language")}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                >
                  <option value="uz">UZ</option>
                  <option value="ru">RU</option>
                  <option value="en">EN</option>
                </select>
                <button
                  className="icon-button"
                  aria-label={copy("Theme")}
                  onClick={() => setDark((v) => !v)}
                >
                  {dark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button
                  className="icon-button notification-button"
                  aria-label={t("notifications")}
                  onClick={() => navigate("notifications")}
                >
                  <Bell size={20} />
                </button>
              </div>
            </header>
            <div className="content">
              <div className="page-heading">
                <div>
                  <div className="page-kicker">
                    <span className="live-dot" />
                    FVV GIS UZBEKISTAN <span className="kicker-divider">
                      /
                    </span>{" "}
                    {copy("ADMINISTRATSIYA")}
                  </div>
                  <h1>{t(view)}</h1>
                  <p>
                    {view === "dashboard"
                      ? t("operationalOverview")
                      : t("readonly")}
                  </p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button button-outline refresh-button"
                    onClick={() => {
                      queryClient.invalidateQueries();
                      notify(t("refresh"));
                    }}
                  >
                    <RefreshCw size={17} />
                    {t("refresh")}
                  </button>
                  {user.permissions?.includes("infrastructure.write") && (
                    <button
                      className="button button-primary"
                      onClick={() => setEditor(null)}
                    >
                      <Plus size={19} />
                      {t("addObject")}
                    </button>
                  )}
                </div>
              </div>
              {!online && (
                <div className="warning-banner">
                  <WifiOff size={19} />
                  {t("offline")}
                  {copy("· Ko‘rsatilgan ma’lumot eskirgan bo‘lishi mumkin.")}
                </div>
              )}
              {!employeeRoles.includes(user.role) ? (
                <Empty>{t("noPermission")}</Empty>
              ) : (
                <>
                  {view === "dashboard" && (
                    <DashboardView
                      onNavigate={navigate}
                      onSelect={setObject}
                      categories={categories.data?.items || []}
                      regions={regions.data?.items || []}
                    />
                  )}
                  {(view === "registry" || view === "map") && (
                    <RegistryView
                      mapOnly={view === "map"}
                      onSelect={setObject}
                      onEdit={setEditor}
                      categories={categories.data?.items || []}
                      regions={regions.data?.items || []}
                    />
                  )}
                  {view === "approvals" && (
                    <ApprovalsView onSelect={setObject} />
                  )}
                  {view === "employees" && (
                    <>
                      <EmployeesView regions={regions.data?.items || []} />
                      <EmployeeAccess
                        user={user}
                        regions={regions.data?.items || []}
                        categories={categories.data?.items || []}
                        language={language}
                        t={t}
                        copy={copy}
                        notify={notify}
                      />
                    </>
                  )}
                  {view === "reports" && <ReportsView />}
                  {view === "inspections" && <InspectionsView />}
                  {view === "routes" && (
                    <RoutesView
                      user={user}
                      language={language}
                      t={t}
                      copy={copy}
                      notify={notify}
                    />
                  )}
                  {view === "notifications" && (
                    <NotificationsView user={user} />
                  )}
                  {view === "settings" && (
                    <SettingsView categories={categories.data?.items || []} />
                  )}
                </>
              )}
              <footer className="page-footer">
                <span>{t("independent")}</span>
                <span>
                  EPSG:4326 <span>·</span> v0.1.0
                </span>
              </footer>
            </div>
          </main>
          {object && (
            <ObjectDetail
              object={object}
              onClose={() => setObject(null)}
              onEdit={(value) => {
                setObject(null);
                setEditor(value);
              }}
              categories={categories.data?.items || []}
              regions={regions.data?.items || []}
            />
          )}{" "}
          {editor !== undefined && (
            <ObjectEditor
              existing={editor}
              onClose={() => setEditor(undefined)}
              categories={categories.data?.items || []}
              regions={regions.data?.items || []}
            />
          )}
        </div>
      )}
      {toast && (
        <div
          role="status"
          className={`toast ${toast.error ? "toast-error" : ""}`}
        >
          {toast.error ? <CircleAlert size={18} /> : <Check size={18} />}
          <span>{copy(toast.message)}</span>
          <button aria-label={t("close")} onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </UI.Provider>
  );
}
function DashboardView({
  onNavigate,
  onSelect,
  categories,
  regions,
}: {
  onNavigate: (view: View) => void;
  onSelect: (value: Infrastructure) => void;
  categories: Category[];
  regions: Region[];
}) {
  const { t, language, copy } = useUI();
  const stats = usePage<Dashboard>(["dashboard"], "/admin/dashboard");
  const objects = usePage<Page<Infrastructure>>(
    ["infrastructure", "dashboard"],
    "/infrastructure?limit=100",
  );
  const d = stats.data;
  const total = d?.total_objects || 0;
  const cards = [
    {
      title: t("totalObjects"),
      value: d?.total_objects,
      icon: Database,
      tone: "green",
      hint: copy("Markazlashgan reyestr"),
    },
    {
      title: t("working"),
      value: d?.working_objects,
      icon: CheckCheck,
      tone: "mint",
      hint: total
        ? `${Math.round(((d?.working_objects || 0) / total) * 100)}% · qayd etilgan holat`
        : copy("O‘lchov sanasini tekshiring"),
    },
    {
      title: t("faulty"),
      value: d?.faulty_objects,
      icon: CircleAlert,
      tone: "orange",
      hint: copy("E’tibor talab qilinadi"),
    },
    {
      title: t("pending"),
      value: d?.pending_approvals,
      icon: ClipboardCheck,
      tone: "blue",
      hint: copy("Tekshiruv va tasdiqlash"),
    },
  ];
  return (
    <>
      {stats.error && (
        <ErrorBox error={stats.error} retry={() => stats.refetch()} />
      )}
      <div className="stats-grid">
        {cards.map((c) => (
          <div className={`stat-card ${c.tone}`} key={c.title}>
            <div className="stat-top">
              <span>{c.title}</span>
              <span className="stat-icon">
                <c.icon size={19} />
              </span>
            </div>
            <strong className={stats.isLoading ? "skeleton-text" : ""}>
              {c.value === undefined
                ? "—"
                : new Intl.NumberFormat(language).format(c.value)}
            </strong>
            <div className="stat-hint">
              <span className={`tiny-dot ${c.tone}`} />
              {c.hint}
            </div>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {t("map")}
                <span className="live-pill">LIVE</span>
              </h2>
              <p>{copy("Vakolat doirasidagi infratuzilma")}</p>
            </div>
            <button className="text-button" onClick={() => onNavigate("map")}>
              {t("viewAll")}
              <ArrowRight size={16} />
            </button>
          </div>
          <MapView
            objects={objects.data?.items || []}
            language={language}
            onSelect={onSelect}
          />
        </section>
        <section className="panel control-panel">
          <div className="panel-heading">
            <div>
              <h2>{t("activity")}</h2>
              <p>{copy("Ish jarayonining joriy holati")}</p>
            </div>
            <Activity size={19} />
          </div>
          <div className="control-list">
            <button onClick={() => onNavigate("approvals")}>
              <span className="control-icon orange">
                <ClipboardCheck size={21} />
              </span>
              <span>
                <strong>{t("pending")}</strong>
                <small>{copy("Yangi yozuvlarni ko‘rib chiqing")}</small>
              </span>
              <b>{d?.pending_approvals ?? "—"}</b>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => onNavigate("reports")}>
              <span className="control-icon blue">
                <FileText size={21} />
              </span>
              <span>
                <strong>{t("citizenReports")}</strong>
                <small>{copy("Mas’ul xodimga biriktiring")}</small>
              </span>
              <b>{d?.citizen_reports ?? "—"}</b>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => onNavigate("employees")}>
              <span className="control-icon green">
                <Users size={21} />
              </span>
              <span>
                <strong>{t("activeEmployees")}</strong>
                <small>{copy("Ruxsat va vakolat nazorati")}</small>
              </span>
              <b>{d?.active_employees ?? "—"}</b>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="region-overview">
            <span className="section-label">{copy("HUDUDLAR KESIMIDA")}</span>
            {d?.by_region.slice(0, 4).map((row) => (
              <div className="region-line" key={row.region_id}>
                <div>
                  <span>
                    {localizedName(
                      regions.find((r) => r.id === row.region_id),
                      language,
                    )}
                  </span>
                  <strong>{row.count}</strong>
                </div>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${total ? Math.max(3, (row.count / total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {!d?.by_region.length && (
              <p className="muted small">
                {copy("Hududlar statistikasi mavjud emas.")}
              </p>
            )}
          </div>
          <div className="security-card">
            <div>
              <ShieldCheck size={22} />
              <strong>{copy("Nazoratli ma’lumot")}</strong>
            </div>
            <p>
              {copy(
                "Har bir o‘zgarish auditda qayd etiladi. Ommaviy va ichki ma’lumotlar alohida saqlanadi.",
              )}
            </p>
          </div>
        </section>
      </div>
      <section className="panel records-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("recentObjects")}</h2>
            <p>{copy("Eng so‘nggi ma’lumot va texnik holatlar")}</p>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("registry")}
          >
            {t("viewAll")}
            <ArrowRight size={16} />
          </button>
        </div>
        {objects.isLoading ? (
          <Loading />
        ) : objects.error ? (
          <ErrorBox error={objects.error} retry={() => objects.refetch()} />
        ) : (
          <ObjectTable
            objects={(objects.data?.items || []).slice(0, 5)}
            categories={categories}
            regions={regions}
            onSelect={onSelect}
          />
        )}
      </section>
    </>
  );
}
function ObjectTable({
  objects,
  categories,
  regions,
  onSelect,
}: {
  objects: Infrastructure[];
  categories: Category[];
  regions: Region[];
  onSelect: (value: Infrastructure) => void;
}) {
  const { t, language } = useUI();
  if (!objects.length) return <Empty />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("name")}</th>
            <th>{t("category")}</th>
            <th>{t("region")}</th>
            <th>{t("status")}</th>
            <th>{t("updated")}</th>
            <th>
              <span className="sr-only">{t("details")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {objects.map((o) => (
            <tr key={o.id} onClick={() => onSelect(o)}>
              <td>
                <button
                  className="object-cell"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(o);
                  }}
                >
                  <span
                    className={`object-icon ${o.category_id.includes("hydrant") ? "hydrant" : ""}`}
                  >
                    {o.category_id.includes("hydrant") ? (
                      <Flame size={20} />
                    ) : o.category_id.includes("water") ? (
                      <Droplets size={20} />
                    ) : (
                      <MapPin size={20} />
                    )}
                  </span>
                  <span>
                    <strong>{o.name}</strong>
                    <small>
                      {o.code}
                      {o.is_synthetic && (
                        <span className="demo-dot" title={t("synthetic")} />
                      )}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                {localizedName(
                  categories.find((c) => c.id === o.category_id),
                  language,
                ) === "—"
                  ? o.category_id
                  : localizedName(
                      categories.find((c) => c.id === o.category_id),
                      language,
                    )}
              </td>
              <td>
                <span className="region-cell">
                  <MapPin size={14} />
                  {localizedName(
                    regions.find((r) => r.id === o.region_id),
                    language,
                  ) === "—"
                    ? o.region_id
                    : localizedName(
                        regions.find((r) => r.id === o.region_id),
                        language,
                      )}
                </span>
              </td>
              <td>
                <Status value={o.operational_status} />
              </td>
              <td className="date-cell">
                {displayDate(o.updated_at, language)}
              </td>
              <td>
                <ChevronRight size={17} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function RegistryView({
  mapOnly,
  onSelect,
  onEdit,
  categories,
  regions,
}: {
  mapOnly: boolean;
  onSelect: (o: Infrastructure) => void;
  onEdit: (o: Infrastructure | null) => void;
  categories: Category[];
  regions: Region[];
}) {
  const { t, language, notify, copy, permissions } = useUI();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const q = queryParams({
    search,
    region_id: region,
    category_id: category,
    status,
    limit: mapOnly ? 100 : 20,
    offset,
  });
  const records = usePage<Page<Infrastructure>>(
    ["infrastructure", q],
    `/infrastructure${q}`,
  );
  useEffect(() => setOffset(0), [search, region, category, status]);
  async function exportRecords() {
    try {
      await downloadFile(
        `/exports/infrastructure.csv${queryParams({ region_id: region, category_id: category, status, search })}`,
        "infrastructure.csv",
      );
      notify(t("success"));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), true);
    }
  }
  return (
    <>
      <section className="panel filter-panel">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label={t("search")}
            placeholder={t("search")}
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
          {regions.map((r) => (
            <option value={r.id} key={r.id}>
              {localizedName(r, language)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {localizedName(c, language)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t("allStatuses")}</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {t(statusKey[s])}
            </option>
          ))}
        </select>
        <button
          className="icon-button"
          title={copy("Eksport")}
          onClick={exportRecords}
        >
          <ArrowDownToLine size={20} />
        </button>
      </section>
      {records.error && (
        <ErrorBox error={records.error} retry={() => records.refetch()} />
      )}{" "}
      {mapOnly ? (
        <section className="panel">
          <MapView
            objects={records.data?.items || []}
            language={language}
            onSelect={onSelect}
            expanded
          />
          <div className="map-bottom-note">
            {records.data?.items.length || 0} / {records.data?.total || 0}{" "}
            {t("objects")}
            {copy("· Xarita tanlangan filtrlar asosida ko‘rsatiladi.")}
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {t("registry")}{" "}
              <span className="count-pill">{records.data?.total ?? "—"}</span>
            </h2>
            {permissions.includes("infrastructure.write") && <button className="text-button" onClick={() => onEdit(null)}>
              <Plus size={17} />
              {t("addObject")}
            </button>}
          </div>
          {records.isLoading ? (
            <Loading />
          ) : (
            <ObjectTable
              objects={records.data?.items || []}
              categories={categories}
              regions={regions}
              onSelect={onSelect}
            />
          )}
          <div className="pagination">
            <span>
              {offset + 1}–{offset + (records.data?.items.length || 0)} /{" "}
              {records.data?.total || 0}
            </span>
            <div>
              <button
                className="icon-button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                <ArrowLeft size={18} />
              </button>
              <button
                className="icon-button"
                disabled={offset + 20 >= (records.data?.total || 0)}
                onClick={() => setOffset(offset + 20)}
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
function ObjectDetail({
  object: initial,
  onClose,
  onEdit,
  categories,
  regions,
}: {
  object: Infrastructure;
  onClose: () => void;
  onEdit: (o: Infrastructure) => void;
  categories: Category[];
  regions: Region[];
}) {
  const { t, language, notify, copy, permissions } = useUI();
  const qc = useQueryClient();
  const [tab, setTab] = useState<
    "passport" | "history" | "files" | "inspections"
  >("passport");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const detail = usePage<Infrastructure>(
    ["object", initial.id],
    `/infrastructure/${initial.id}`,
  );
  const object = detail.data || initial;
  const history = usePage<Page<Audit>>(
    ["history", object.id],
    `/infrastructure/${object.id}/history`,
    tab === "history",
  );
  const files = usePage<
    Page<{ id: string; filename: string; scan_status: string }>
  >(
    ["files", object.id],
    `/infrastructure/${object.id}/attachments`,
    tab === "files",
  );
  const inspections = usePage<Page<Inspection>>(
    ["object-inspections", object.id],
    `/infrastructure/${object.id}/inspections`,
    tab === "inspections",
  );
  const passport = object.passport || {};
  async function action(name: string) {
    setBusy(true);
    setError(undefined);
    try {
      if (name === "approve")
        await post(`/approvals/${object.id}/approve`, {
          expected_version: object.version,
        });
      else
        await post(`/infrastructure/${object.id}/${name}`, {
          expected_version: object.version,
        });
      await qc.invalidateQueries();
      notify(t("success"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("object_id", object.id);
    setBusy(true);
    try {
      await api("/attachments", { method: "POST", body: form });
      await files.refetch();
      notify(copy("Fayl tekshirish uchun qabul qilindi"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t("details")} onClose={onClose} wide>
      <div className="object-detail-heading">
        <span className="detail-symbol">
          <Flame size={28} />
        </span>
        <div>
          <span className="eyebrow">
            {object.code}{" "}
            <span className="version-chip">v{object.version}</span>
          </span>
          <h3>{object.name}</h3>
          <p>
            <MapPin size={15} />
            {localizedName(
              regions.find((r) => r.id === object.region_id),
              language,
            )}
          </p>
        </div>
        <Status value={object.operational_status} />
      </div>
      {object.is_synthetic && (
        <div className="demo-banner">
          <Database size={16} />
          {t("synthetic")}
          {copy("· Haqiqiy infratuzilma joylashuvi emas.")}
        </div>
      )}
      {error !== undefined && <ErrorBox error={error} />}
      <div className="tabs">
        {(["passport", "inspections", "files", "history"] as const).map((k) => (
          <button
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
            key={k}
          >
            {k === "passport" ? t("details") : t(k)}
          </button>
        ))}
      </div>
      <div className="detail-body">
        {tab === "passport" && (
          <>
            <div className="measurement-grid">
              <div>
                <Droplets size={22} />
                <span>{t("pressure")}</span>
                <strong>
                  {String(passport.measured_pressure_kpa ?? "—")}
                  <small>kPa</small>
                </strong>
              </div>
              <div>
                <Waves size={22} />
                <span>{t("flow")}</span>
                <strong>
                  {String(passport.flow_lps ?? "—")}
                  <small>L/s</small>
                </strong>
              </div>
              <div>
                <Clock3 size={22} />
                <span>{t("measurement")}</span>
                <strong className="measurement-date">
                  {displayDate(
                    String(passport.measurement_date || ""),
                    language,
                  )}
                </strong>
              </div>
            </div>
            <div className="info-notice">
              <CircleAlert size={18} />
              {copy(
                "O‘lchov natijasi doimiy emas. Joriy holatni oxirgi tekshiruv bilan solishtiring.",
              )}
            </div>
            <h4>{t("general")}</h4>
            <dl className="details-grid">
              <div>
                <dt>{t("category")}</dt>
                <dd>
                  {localizedName(
                    categories.find((c) => c.id === object.category_id),
                    language,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("state")}</dt>
                <dd>
                  <Status value={object.lifecycle} />
                </dd>
              </div>
              <div>
                <dt>{t("verification")}</dt>
                <dd>
                  <Status value={object.sensitivity} />
                </dd>
              </div>
              <div>
                <dt>{t("accuracy")}</dt>
                <dd>
                  {object.accuracy_m == null ? "—" : `${object.accuracy_m} m`}
                </dd>
              </div>
              <div>
                <dt>{t("dataSource")}</dt>
                <dd>{object.data_source || "—"}</dd>
              </div>
              <div>
                <dt>{t("updated")}</dt>
                <dd>{displayDate(object.updated_at, language)}</dd>
              </div>
              <div className="span-two">
                <dt>{t("description")}</dt>
                <dd>{object.description || "—"}</dd>
              </div>
            </dl>
            <h4>{t("technical")}</h4>
            <dl className="details-grid">
              {Object.entries(passport).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll("_", " ")}</dt>
                  <dd>
                    {value == null
                      ? "—"
                      : typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="geometry-preview">
              <MapPin size={16} />
              <span>{object.geometry.type} · EPSG:4326</span>
              <code>{JSON.stringify(object.geometry.coordinates)}</code>
            </div>
          </>
        )}
        {tab === "history" &&
          (history.isLoading ? (
            <Loading />
          ) : history.error ? (
            <ErrorBox error={history.error} />
          ) : (
            <div className="timeline">
              {(history.data?.items || []).map((row) => (
                <div key={row.id}>
                  <i />
                  <div>
                    <strong>{row.action || row.state}</strong>
                    <p>{displayDate(row.created_at, language)}</p>
                    <small>{row.actor_id || row.created_by}</small>
                  </div>
                </div>
              ))}
              {!history.data?.items.length && <Empty />}
            </div>
          ))}
        {tab === "files" && (
          <>
            <label className="upload-box">
              <Upload size={25} />
              <strong>{copy("Foto yoki PDF biriktirish")}</strong>
              <span>
                {copy("Fayllar xavfsizlik tekshiruvidan keyin ochiladi")}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                disabled={busy}
                onChange={(e) => {
                  if (e.target.files?.[0]) void upload(e.target.files[0]);
                }}
              />
            </label>
            {files.error && <ErrorBox error={files.error} />}
            <div className="file-list">
              {files.data?.items.map((f) => (
                <div key={f.id}>
                  <FileText size={20} />
                  <span>{f.filename}</span>
                  <Status value={f.scan_status} />
                  <button
                    className="icon-button"
                    aria-label={t("files")}
                    disabled={f.scan_status !== "clean"}
                    onClick={() =>
                      downloadFile(
                        `/attachments/${f.id}/download`,
                        f.filename,
                      ).catch(setError)
                    }
                  >
                    <ArrowDownToLine size={20} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "inspections" &&
          (inspections.isLoading ? (
            <Loading />
          ) : inspections.error ? (
            <ErrorBox error={inspections.error} />
          ) : (
            <>
              {inspections.data?.items.map((i) => (
                <div className="inspection-row" key={i.id}>
                  <ShieldCheck size={22} />
                  <div>
                    <strong>{i.condition}</strong>
                    <p>{i.notes}</p>
                    <small>
                      {displayDate(i.inspected_at || i.created_at, language)}
                    </small>
                  </div>
                </div>
              ))}
              {!inspections.data?.items.length && <Empty />}
            </>
          ))}
      </div>
      <div className="modal-footer">
        {permissions.includes("infrastructure.write") && <button
          className="button button-outline"
          onClick={() => onEdit(object)}
          disabled={busy}
        >
          {t("edit")}
        </button>}
        <div>
          {permissions.includes("infrastructure.write") && ["draft", "requires_correction", "rejected"].includes(
            object.lifecycle,
          ) && (
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => action("submit")}
            >
              {t("submit")}
              <ArrowRight size={17} />
            </button>
          )}
          {permissions.includes("infrastructure.review") && object.lifecycle === "submitted" && (
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => action("review")}
            >
              {t("review")}
            </button>
          )}
          {permissions.includes("infrastructure.review") && object.lifecycle === "under_review" && (
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => action("approve")}
            >
              {t("approve")}
            </button>
          )}
          {permissions.includes("infrastructure.publish") && object.lifecycle === "approved" && (
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => action("publish")}
            >
              {t("publish")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
function ObjectEditor({
  existing,
  onClose,
  categories,
  regions,
}: {
  existing: Infrastructure | null;
  onClose: () => void;
  categories: Category[];
  regions: Region[];
}) {
  const { t, language, notify, copy } = useUI();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [form, setForm] = useState({
    name: existing?.name || "",
    code: existing?.code || "",
    description: existing?.description || "",
    category_id: existing?.category_id || categories[0]?.id || "fire_hydrant",
    region_id: existing?.region_id || regions[0]?.id || "",
    district_id: existing?.district_id || "",
    sensitivity: existing?.sensitivity || "internal",
    operational_status: existing?.operational_status || "unknown",
    accuracy_m: existing?.accuracy_m?.toString() || "",
    data_source: existing?.data_source || "field_survey",
    is_synthetic: existing?.is_synthetic ?? true,
  });
  const [geometryText, setGeometryText] = useState(
    JSON.stringify(
      existing?.geometry,
      null,
      2,
    ) || "",
  );
  const [geometryType, setGeometryType] = useState<Geometry["type"]>(
    existing?.geometry.type || "Point",
  );
  const [passport, setPassport] = useState<Record<string, unknown>>(
    existing?.passport || {},
  );
  const [files, setFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const update = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));
  const steps = [t("general"), t("location"), t("technical"), t("validation")];
  let geometry: Geometry | undefined;
  try {
    const value = JSON.parse(geometryText);
    if (validateGeometry(value)) geometry = value;
  } catch {
    /* Validation is shown on continue. */
  }
  const category = categories.find((c) => c.id === form.category_id);
  const geometryTypes = category?.geometry_types || [
    "Point",
    "LineString",
    "Polygon",
  ];
  const fields = useMemo(() => {
    if (form.category_id.includes("hydrant"))
      return [
        { key: "hydrant_type", label: copy("Gidrant turi"), type: "text" },
        {
          key: "installation_type",
          label: copy("O‘rnatish turi"),
          type: "text",
        },
        {
          key: "connection_diameter_mm",
          label: copy("Ulanish diametri · mm"),
          type: "number",
        },
        {
          key: "nominal_pressure_kpa",
          label: copy("Nominal bosim · kPa"),
          type: "number",
        },
        {
          key: "measured_pressure_kpa",
          label: copy("O‘lchangan bosim · kPa"),
          type: "number",
        },
        {
          key: "flow_lps",
          label: copy("O‘lchangan suv sarfi · L/s"),
          type: "number",
        },
        {
          key: "measurement_date",
          label: copy("O‘lchov sanasi"),
          type: "datetime-local",
        },
        {
          key: "measurement_method",
          label: copy("O‘lchov usuli"),
          type: "text",
        },
      ];
    if (form.category_id.includes("electrical"))
      return [
        { key: "voltage_kv", label: copy("Kuchlanish · kV"), type: "number" },
        { key: "cable_type", label: copy("Kabel turi"), type: "text" },
        {
          key: "installation_method",
          label: copy("O‘rnatish usuli"),
          type: "text",
        },
      ];
    return [
      { key: "diameter_mm", label: copy("Diametr · mm"), type: "number" },
      { key: "material", label: copy("Material"), type: "text" },
      { key: "length_m", label: copy("Uzunlik · m"), type: "number" },
      { key: "depth_m", label: copy("Chuqurlik · m"), type: "number" },
    ];
  }, [form.category_id]);
  function next() {
    setError(undefined);
    if (
      step === 0 &&
      (!form.name.trim() ||
        !form.code.trim() ||
        !form.region_id ||
        !form.category_id)
    ) {
      setError(
        new Error(copy("Nomi, kodi, hududi va kategoriyasini to‘ldiring.")),
      );
      return;
    }
    if (step === 1 && !geometry) {
      setError(
        new Error(
          copy(
            "To‘g‘ri WGS84 GeoJSON geometriyasini kiriting. Polygon halqasi yopiq bo‘lishi kerak.",
          ),
        ),
      );
      return;
    }
    setStep((s) => s + 1);
  }
  async function save(submit: boolean) {
    setError(undefined);
    if (!geometry) {
      setError(new Error(copy("Geometriya noto‘g‘ri.")));
      return;
    }
    if (!confirmed) {
      setError(
        new Error(
          copy("Ma’lumotlarni tekshirib, tasdiqlash belgisini qo‘ying."),
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...form,
        district_id: form.district_id || null,
        accuracy_m: form.accuracy_m === "" ? null : Number(form.accuracy_m),
        geometry,
        passport,
        ...(existing ? { expected_version: existing.version } : {}),
      };
      const result = existing
        ? await patch<Infrastructure>(
            `/infrastructure/${existing.id}`,
            Object.fromEntries(
              Object.entries(body).filter(
                ([key]) => !["is_synthetic", "data_source"].includes(key),
              ),
            ),
          )
        : await post<Infrastructure>("/infrastructure", body);
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        data.append("object_id", result.id);
        await api("/attachments", { method: "POST", body: data });
      }
      if (submit)
        await post(`/infrastructure/${result.id}/submit`, {
          expected_version: result.version,
        });
      await qc.invalidateQueries();
      notify(t("success"));
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={existing ? t("edit") : t("addObject")} onClose={onClose} wide>
      <div className="wizard-steps">
        {steps.map((s, i) => (
          <div
            className={`${i === step ? "active" : ""} ${i < step ? "complete" : ""}`}
            key={s}
          >
            <span>{i < step ? <Check size={15} /> : i + 1}</span>
            <strong>{s}</strong>
          </div>
        ))}
      </div>
      <div className="wizard-body">
        {error !== undefined && <ErrorBox error={error} />}{" "}
        {step === 0 && (
          <div className="form-grid">
            <Field label={t("category")} required>
              <select
                value={form.category_id}
                onChange={(e) => {
                  update("category_id", e.target.value);
                  setPassport({});
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localizedName(c, language)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("region")} required>
              <select
                value={form.region_id}
                onChange={(e) => update("region_id", e.target.value)}
              >
                <option value="">{t("region")}</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {localizedName(r, language)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("name")} required>
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                maxLength={200}
                required
              />
            </Field>
            <Field label={t("code")} required>
              <input
                value={form.code}
                onChange={(e) => update("code", e.target.value)}
                maxLength={80}
                required
              />
            </Field>
            <Field label={copy("Tuman identifikatori")}>
              <input
                value={form.district_id}
                onChange={(e) => update("district_id", e.target.value)}
                placeholder={copy("Ixtiyoriy")}
              />
            </Field>
            <Field label={copy("Ko‘rinish tasnifi")}>
              <select
                value={form.sensitivity}
                onChange={(e) => update("sensitivity", e.target.value)}
              >
                {["internal", "restricted", "confidential", "public"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {t(statusKey[s])}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <div className="span-two">
              <Field label={t("description")}>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </Field>
            </div>
            <label className="checkbox-row span-two">
              <input
                type="checkbox"
                checked={form.is_synthetic}
                onChange={(e) => update("is_synthetic", e.target.checked)}
              />
              <span>
                {copy("Bu sintetik sinov yozuvi. Haqiqiy infratuzilma emas.")}
              </span>
            </label>
          </div>
        )}
        {step === 1 && (
          <>
            <div className="form-grid">
              <Field label={copy("Geometriya turi")}>
                <select
                  value={geometryType}
                  onChange={(e) =>
                    setGeometryType(e.target.value as Geometry["type"])
                  }
                >
                  {geometryTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={copy("GPS aniqligi · m")}>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.accuracy_m}
                  onChange={(e) => update("accuracy_m", e.target.value)}
                  placeholder={copy("Noma’lum")}
                />
              </Field>
            </div>
            <div className="editor-map">
              <MapView
                objects={[]}
                language={language}
                drawType={geometryType}
                onDraw={(g) => setGeometryText(JSON.stringify(g, null, 2))}
              />
            </div>
            <Field label="GeoJSON · EPSG:4326" required>
              <textarea
                className="code-input"
                rows={5}
                value={geometryText}
                onChange={(e) => setGeometryText(e.target.value)}
              />
            </Field>
            <p className="muted small">
              {copy(
                "Nuqta, bir nechta segmentli chiziq yoki yopiq polygon chizing. Server geometriya va topologiyani qayta tekshiradi.",
              )}
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <div className="form-grid">
              <Field label={t("status")}>
                <select
                  value={form.operational_status}
                  onChange={(e) => update("operational_status", e.target.value)}
                >
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {t(statusKey[s])}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("dataSource")}>
                <input
                  value={form.data_source}
                  onChange={(e) => update("data_source", e.target.value)}
                />
              </Field>
              {fields.map((f) => (
                <Field label={f.label} key={f.key}>
                  <input
                    type={f.type}
                    min={f.type === "number" ? 0 : undefined}
                    step={f.type === "number" ? "any" : undefined}
                    value={
                      f.type === "datetime-local" && passport[f.key]
                        ? (() => {
                            const d = new Date(String(passport[f.key]));
                            return new Date(
                              d.getTime() - d.getTimezoneOffset() * 60000,
                            )
                              .toISOString()
                              .slice(0, 16);
                          })()
                        : String(passport[f.key] ?? "")
                    }
                    onChange={(e) =>
                      setPassport((p) => ({
                        ...p,
                        [f.key]:
                          e.target.value === ""
                            ? null
                            : f.type === "number"
                              ? Number(e.target.value)
                              : f.type === "datetime-local"
                                ? new Date(e.target.value).toISOString()
                                : e.target.value,
                      }))
                    }
                    placeholder={copy("Noma’lum")}
                  />
                </Field>
              ))}
            </div>
            <div className="info-notice">
              <CircleAlert size={18} />
              {copy(
                "Noma’lum qiymatlarni bo‘sh qoldiring. Ular nolga almashtirilmaydi.",
              )}
            </div>
            <label className="upload-box">
              <Upload size={24} />
              <strong>{t("files")}</strong>
              <span>
                {copy("JPEG, PNG yoki PDF · xavfsizlik tekshiruvi bilan")}
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              {files.map((f) => (
                <small key={f.name}>
                  {f.name} · {(f.size / 1024).toFixed(0)} KB
                </small>
              ))}
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <div className="review-card">
              <span className="detail-symbol">
                <FileCheck2 size={27} />
              </span>
              <h3>{form.name}</h3>
              <p>
                {form.code} · {localizedName(category, language)}
              </p>
              <div>
                <Status value={form.operational_status} />
                <Status value={form.sensitivity} />
              </div>
            </div>
            <dl className="details-grid">
              <div>
                <dt>{t("region")}</dt>
                <dd>
                  {localizedName(
                    regions.find((r) => r.id === form.region_id),
                    language,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("location")}</dt>
                <dd>{geometry?.type || "—"}</dd>
              </div>
              <div>
                <dt>{copy("Biriktirilgan fayllar")}</dt>
                <dd>{files.length}</dd>
              </div>
              <div>
                <dt>{copy("Pasport maydonlari")}</dt>
                <dd>{Object.keys(passport).length}</dd>
              </div>
            </dl>
            <label className="checkbox-row confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                {copy(
                  "Ma’lumotlarni tekshirdim. Obyekt faqat vakolatli tekshiruv va tasdiqdan keyin operativ xaritaga chiqishini tushunaman.",
                )}
              </span>
            </label>
          </>
        )}
      </div>
      <div className="modal-footer">
        <button
          className="button button-outline"
          onClick={() => (step ? setStep((s) => s - 1) : onClose())}
          disabled={busy}
        >
          {step ? t("back") : t("cancel")}
        </button>
        <div>
          {step < 3 ? (
            <button className="button button-primary" onClick={next}>
              {t("next")}
              <ArrowRight size={17} />
            </button>
          ) : (
            <>
              <button
                className="button button-outline"
                disabled={busy || !confirmed}
                onClick={() => save(false)}
              >
                {busy ? <LoaderCircle className="spin" size={17} /> : null}
                {copy("Qoralama saqlash")}
              </button>
              <button
                className="button button-primary"
                disabled={busy || !confirmed}
                onClick={() => save(true)}
              >
                {t("submit")}
                <ArrowRight size={17} />
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
function ApprovalsView({
  onSelect,
}: {
  onSelect: (o: Infrastructure) => void;
}) {
  const { t, language, notify, copy } = useUI();
  const qc = useQueryClient();
  const records = usePage<Page<Infrastructure>>(
    ["approvals"],
    "/approvals/pending?limit=100",
  );
  const [rejecting, setRejecting] = useState<Infrastructure | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>();
  async function action(o: Infrastructure, name: string) {
    setBusy(o.id);
    setError(undefined);
    try {
      if (name === "reject") {
        if (reason.trim().length < 5)
          throw new Error(
            copy("Rad etish sababini kamida 5 belgi bilan yozing."),
          );
        await post(`/approvals/${o.id}/reject`, {
          reason,
          expected_version: o.version,
        });
        setRejecting(null);
        setReason("");
      } else
        await post(
          name === "approve"
            ? `/approvals/${o.id}/approve`
            : `/infrastructure/${o.id}/${name}`,
          { expected_version: o.version },
        );
      await qc.invalidateQueries();
      notify(t("success"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      {error !== undefined && <ErrorBox error={error} />}
      <div className="info-notice">
        <ShieldCheck size={19} />
        {copy(
          "O‘z yozuvingizni tasdiqlash mumkin emas. Ichki nashr fuqarolarga avtomatik ko‘rinmaydi.",
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {t("approvals")}
            <span className="count-pill">{records.data?.total ?? "—"}</span>
          </h2>
          <ClipboardCheck size={21} />
        </div>
        {records.isLoading ? (
          <Loading />
        ) : records.error ? (
          <ErrorBox error={records.error} retry={() => records.refetch()} />
        ) : !records.data?.items.length ? (
          <Empty />
        ) : (
          <div className="approval-list">
            {records.data.items.map((o) => (
              <div className="approval-row" key={o.id}>
                <span className="object-icon">
                  <FileCheck2 size={23} />
                </span>
                <div className="approval-info">
                  <button className="link-button" onClick={() => onSelect(o)}>
                    {o.name}
                  </button>
                  <p>
                    {o.code} · {displayDate(o.updated_at, language)}
                  </p>
                  <Status value={o.lifecycle} />
                </div>
                <div className="approval-actions">
                  <button
                    className="button button-outline danger-text"
                    disabled={busy === o.id}
                    onClick={() => setRejecting(o)}
                  >
                    {t("reject")}
                  </button>
                  <button
                    className="button button-primary"
                    disabled={busy === o.id}
                    onClick={() =>
                      action(
                        o,
                        o.lifecycle === "submitted"
                          ? "review"
                          : o.lifecycle === "approved"
                            ? "publish"
                            : "approve",
                      )
                    }
                  >
                    {busy === o.id ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Check size={16} />
                    )}{" "}
                    {o.lifecycle === "submitted"
                      ? t("review")
                      : o.lifecycle === "approved"
                        ? t("publish")
                        : t("approve")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {rejecting && (
        <Modal title={t("reject")} onClose={() => setRejecting(null)}>
          <div className="wizard-body">
            <p>{rejecting.name}</p>
            <Field label={copy("Rad etish sababi")} required>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </Field>
          </div>
          <div className="modal-footer">
            <button
              className="button button-outline"
              onClick={() => setRejecting(null)}
            >
              {t("cancel")}
            </button>
            <button
              className="button button-danger"
              disabled={!!busy}
              onClick={() => action(rejecting, "reject")}
            >
              {t("reject")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function EmployeesView({ regions }: { regions: Region[] }) {
  const { t, language, notify, copy } = useUI();
  const qc = useQueryClient();
  const records = usePage<Page<Verification>>(
    ["employees"],
    "/admin/employee-verifications?limit=100",
  );
  const [selected, setSelected] = useState<Verification | null>(null);
  const [role, setRole] = useState("verified_employee");
  const [region, setRegion] = useState("");
  const [organization, setOrganization] = useState("");
  const organizations = usePage<Page<{ id: string; name: string }>>(
    ["organizations"],
    "/organizations",
  );
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function decide(approve: boolean) {
    if (!selected) return;
    setBusy(true);
    setError(undefined);
    try {
      if (approve && (!reference.trim() || !region || !organization))
        throw new Error(copy("Tekshiruv ma’lumotnomasi va hududni kiriting."));
      if (!approve && reason.trim().length < 5)
        throw new Error(copy("Rad etish sababini kiriting."));
      await post(
        `/admin/employee-verifications/${selected.id}/${approve ? "approve" : "reject"}`,
        approve
          ? {
              role,
              region_id: region,
              organization_id: organization,
              district_id:
                region === selected.region_id
                  ? selected.district_id || null
                  : null,
              reference,
            }
          : { reason },
      );
      await qc.invalidateQueries();
      setSelected(null);
      notify(t("success"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="info-notice">
        <ShieldCheck size={19} />
        {copy(
          "Ariza beruvchi tashkilotga tegishli ekanligini tasdiqlangan tashqi jarayon orqali tekshiring. Bu platforma davlat tasdig‘ini bermaydi.",
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {copy("Xodimlik arizalari")}
            <span className="count-pill">{records.data?.total ?? "—"}</span>
          </h2>
          <Users size={21} />
        </div>
        {records.isLoading ? (
          <Loading />
        ) : records.error ? (
          <ErrorBox error={records.error} />
        ) : !records.data?.items.length ? (
          <Empty />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{copy("Xodim")}</th>
                  <th>{copy("Tashkilot")}</th>
                  <th>{t("region")}</th>
                  <th>{t("status")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {records.data.items.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>
                        {v.full_name || v.user?.full_name || v.user_id}
                      </strong>
                      <small className="block muted">
                        {v.phone || v.user?.phone}
                      </small>
                    </td>
                    <td>
                      {v.organization_name || v.organization || "—"}
                      <small className="block muted">{v.department}</small>
                    </td>
                    <td>
                      {localizedName(
                        regions.find((r) => r.id === v.region_id),
                        language,
                      )}
                    </td>
                    <td>
                      <Status value={v.status} />
                    </td>
                    <td>
                      <button
                        className="button button-outline"
                        onClick={() => {
                          setSelected(v);
                          setRegion(v.region_id || "");
                          setOrganization(v.organization_id || "");
                          setRole(
                            v.requested_role &&
                              employeeRoles.includes(v.requested_role)
                              ? v.requested_role
                              : "verified_employee",
                          );
                          setReference("");
                          setReason("");
                          setError(undefined);
                        }}
                      >
                        {copy("Tekshirish")}
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <Modal
          title={copy("Xodim vakolatini tekshirish")}
          onClose={() => setSelected(null)}
        >
          <div className="wizard-body">
            {error !== undefined && <ErrorBox error={error} />}
            <h3>
              {selected.full_name ||
                selected.user?.full_name ||
                selected.user_id}
            </h3>
            <Field label={copy("Tekshiruv ma’lumotnomasi")} required>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={copy(
                  "Tasdiqlangan tashqi tekshiruv havolasi yoki raqami",
                )}
              />
            </Field>
            <Field label={copy("Biriktiriladigan rol")} required>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {employeeRoles
                  .filter((r) => !r.includes("administrator"))
                  .map((r) => (
                    <option key={r} value={r}>
                      {copy(r)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("region")} required>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">{copy("Hudud tanlang")}</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {localizedName(r, language)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy("Tashkilot")} required>
              <select
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
              >
                <option value="">{copy("Tashkilot tanlang")}</option>
                {organizations.data?.items.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy("Rad etish sababi")}>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </Field>
          </div>
          <div className="modal-footer">
            <button
              className="button button-outline danger-text"
              disabled={busy}
              onClick={() => decide(false)}
            >
              {t("reject")}
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => decide(true)}
            >
              <ShieldCheck size={18} />
              {t("approve")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ReportsView() {
  const { t, language, notify, copy } = useUI();
  const qc = useQueryClient();
  const records = usePage<Page<Report>>(["reports"], "/reports?limit=100");
  const [selected, setSelected] = useState<Report | null>(null);
  const [status, setStatus] = useState("received");
  const [assigned, setAssigned] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      await patch(`/reports/${selected.id}`, {
        status,
        assigned_to: assigned || null,
      });
      await qc.invalidateQueries();
      setSelected(null);
      notify(t("success"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="warning-banner">
        <CircleAlert size={19} />
        {t("noOfficialDispatch")}
        {copy("Murojaat tekshirilmaguncha tasdiqlangan hodisa hisoblanmaydi.")}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {t("citizenReports")}
            <span className="count-pill">{records.data?.total ?? "—"}</span>
          </h2>
          <FileText size={21} />
        </div>
        {records.isLoading ? (
          <Loading />
        ) : records.error ? (
          <ErrorBox error={records.error} />
        ) : !records.data?.items.length ? (
          <Empty />
        ) : (
          <div className="report-grid">
            {records.data.items.map((r) => (
              <button
                className="report-card"
                key={r.id}
                onClick={() => {
                  setSelected(r);
                  setStatus(r.status);
                  setAssigned(r.assigned_to || "");
                  setError(undefined);
                }}
              >
                <div>
                  <span className="control-icon orange">
                    <CircleAlert size={21} />
                  </span>
                  <Status value={r.status} />
                </div>
                <h3>{r.category}</h3>
                <p>{r.description}</p>
                <footer>
                  <Clock3 size={14} />
                  {displayDate(r.created_at, language)}
                  <ArrowRight size={17} />
                </footer>
              </button>
            ))}
          </div>
        )}
      </section>
      {selected && (
        <Modal
          title={copy("Murojaatni ko‘rib chiqish")}
          onClose={() => setSelected(null)}
        >
          <div className="wizard-body">
            {error !== undefined && <ErrorBox error={error} />}
            <h3>{selected.category}</h3>
            <p>{selected.description}</p>
            <Field label={t("status")}>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {[
                  "received",
                  "under_review",
                  "assigned",
                  "in_progress",
                  "resolved",
                  "rejected",
                  "closed",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy("Mas’ul xodim identifikatori")}>
              <input
                value={assigned}
                onChange={(e) => setAssigned(e.target.value)}
                placeholder={copy("Xodim UUID")}
              />
            </Field>
          </div>
          <div className="modal-footer">
            <button
              className="button button-outline"
              onClick={() => setSelected(null)}
            >
              {t("cancel")}
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={save}
            >
              {t("save")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function InspectionsView() {
  const { t, language, notify, copy } = useUI();
  const qc = useQueryClient();
  const objects = usePage<Page<Infrastructure>>(
    ["inspection-objects"],
    "/infrastructure?limit=100",
  );
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [condition, setCondition] = useState("unknown");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const records = usePage<Page<Inspection>>(
    ["inspections", selected],
    `/infrastructure/${selected}/inspections`,
    !!selected,
  );
  async function save() {
    setBusy(true);
    try {
      await post("/inspections", {
        object_id: selected,
        condition,
        operational_status: condition,
        notes,
        inspected_at: new Date().toISOString(),
      });
      await qc.invalidateQueries();
      setCreating(false);
      setNotes("");
      notify(t("success"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{t("inspections")}</h2>
          <p>{copy("Obyektni tanlang va tekshiruv tarixini ko‘ring")}</p>
        </div>
        <button
          className="button button-primary"
          disabled={!selected}
          onClick={() => {
            setCreating(true);
            setError(undefined);
          }}
        >
          <Plus size={18} />
          {copy("Tekshiruv qo‘shish")}
        </button>
      </div>
      <div className="section-padding">
        <Field label={t("name")}>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">{copy("Obyekt tanlang")}</option>
            {objects.data?.items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} — {o.name}
              </option>
            ))}
          </select>
        </Field>
        {objects.error && <ErrorBox error={objects.error} />}{" "}
        {!selected ? (
          <Empty>{copy("Tekshiruvlarni ko‘rish uchun obyekt tanlang.")}</Empty>
        ) : records.isLoading ? (
          <Loading />
        ) : records.error ? (
          <ErrorBox error={records.error} />
        ) : !records.data?.items.length ? (
          <Empty />
        ) : (
          records.data.items.map((i) => (
            <div className="inspection-row" key={i.id}>
              <span className="control-icon green">
                <ShieldCheck size={23} />
              </span>
              <div>
                <strong>{i.condition}</strong>
                <p>{i.notes}</p>
                <small>
                  {displayDate(i.inspected_at || i.created_at, language)}
                </small>
              </div>
            </div>
          ))
        )}
      </div>
      {creating && (
        <Modal
          title={copy("Yangi tekshiruv")}
          onClose={() => setCreating(false)}
        >
          <div className="wizard-body">
            {error !== undefined && <ErrorBox error={error} />}
            <Field label={copy("Qayd etilgan holat")}>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                {states.map((s) => (
                  <option key={s} value={s}>
                    {t(statusKey[s])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy("Tekshiruv izohi")} required>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
              />
            </Field>
            <div className="info-notice">
              {copy(
                "Tekshiruv natijasi obyektni avtomatik ishlaydi deb belgilamaydi.",
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="button button-outline"
              onClick={() => setCreating(false)}
            >
              {t("cancel")}
            </button>
            <button
              className="button button-primary"
              disabled={busy || !notes.trim()}
              onClick={save}
            >
              {t("save")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function NotificationsView({ user }: { user: User }) {
  const { t, language, notify, copy } = useUI();
  const qc = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [created, setCreated] = useState<Notification | null>(null);
  const recipients = usePage<Page<User>>(
    ["notification-recipients"],
    "/admin/users",
    composing && !isPublic,
  );
  const canManage = user.permissions?.includes("settings.manage");
  const records = usePage<Page<Notification>>(
    ["notifications", pending],
    `/notifications?limit=100${pending ? "&include_pending=true" : ""}`,
  );
  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const notice = await post<Notification>("/notifications", {
        title,
        body,
        is_public: isPublic,
        user_id: isPublic ? null : recipient,
      });
      setCreated(notice);
      setComposing(false);
      setTitle("");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      notify(
        isPublic ? copy("Ommaviy matn tasdiqlanishni kutmoqda.") : t("success"),
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function approve(notice: Notification) {
    setBusy(true);
    setError(undefined);
    try {
      await post(`/notifications/${notice.id}/approve`);
      setCreated(null);
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      notify(t("success"));
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function read(n: Notification) {
    if (n.is_public) return;
    try {
      await post(`/notifications/${n.id}/read`);
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), true);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{t("notifications")}</h2>
        {canManage ? (
          <button
            className="button button-primary"
            onClick={() => {
              setComposing(true);
              setError(undefined);
            }}
          >
            <Plus size={19} />
            {copy("Yangi bildirishnoma")}
          </button>
        ) : (
          <Bell size={21} />
        )}
      </div>
      {canManage && (
        <label className="checkbox-field section-padding">
          <input
            type="checkbox"
            checked={pending}
            onChange={(event) => setPending(event.target.checked)}
          />
          <span>{copy("Tasdiqlanishni kutayotgan ommaviy matnlar")}</span>
        </label>
      )}
      {error !== undefined && <ErrorBox error={error} />}
      {created?.is_public && (
        <div className="section-padding">
          <div className="warning-banner">
            <div>
              <strong>{created.title}</strong>
              <p>{created.body}</p>
            </div>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => approve(created)}
            >
              {copy("Ommaviy matnni tasdiqlash")}
            </button>
          </div>
        </div>
      )}
      {records.isLoading ? (
        <Loading />
      ) : records.error ? (
        <ErrorBox error={records.error} />
      ) : !records.data?.items.length ? (
        <Empty />
      ) : (
        <div className="notification-list">
          {records.data.items.map((n) => (
            <div
              className={`notification-row ${!n.read_at && !n.is_public ? "unread" : ""}`}
              key={n.id}
            >
              <span className="control-icon green">
                <Bell size={20} />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.body || n.message}</p>
                <small>{displayDate(n.created_at, language)}</small>
              </div>
              {n.is_public && !n.reviewed_by && canManage ? (
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => approve(n)}
                >
                  {copy("Ommaviy matnni tasdiqlash")}
                </button>
              ) : (
                !n.is_public &&
                !n.read_at && (
                  <button
                    className="button button-outline"
                    onClick={() => read(n)}
                  >
                    {copy("O‘qilgan deb belgilash")}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
      {composing && (
        <Modal
          title={copy("Yangi bildirishnoma")}
          onClose={() => setComposing(false)}
        >
          <div className="wizard-body">
            <div className="info-notice">
              {copy(
                "Shaxsiy bildirishnomada tafsilotlar push orqali yuborilmaydi.",
              )}
            </div>
            <Field label={copy("Sarlavha")} required>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label={copy("Xabar")} required>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                maxLength={3000}
              />
            </Field>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
              />
              <span>{copy("Ommaviy e’lon")}</span>
            </label>
            {!isPublic && (
              <Field label={copy("Xodim")} required>
                <select
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                >
                  <option value="">{copy("Tanlanmagan")}</option>
                  {recipients.data?.items.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {error !== undefined && <ErrorBox error={error} />}
          </div>
          <div className="modal-footer">
            <button
              className="button button-outline"
              onClick={() => setComposing(false)}
            >
              {t("cancel")}
            </button>
            <button
              className="button button-primary"
              disabled={
                busy ||
                title.trim().length < 3 ||
                body.trim().length < 3 ||
                (!isPublic && !recipient)
              }
              onClick={create}
            >
              {copy("Yuborish")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function SettingsView({ categories }: { categories: Category[] }) {
  const { t, language, notify, copy } = useUI();
  const qc = useQueryClient();
  const [tab, setTab] = useState("categories");
  const [selected, setSelected] = useState<Category | null>(null);
  const [schema, setSchema] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const audit = usePage<Page<Audit>>(
    ["audit"],
    "/admin/audit?limit=50",
    tab === "audit",
  );
  const backups = usePage<{
    configured: boolean;
    last_verified_at?: string | null;
    status?: string;
    message?: string;
  }>(["backups"], "/admin/backups/status", tab === "backups");
  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      const value = JSON.parse(schema);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(copy("Sxema JSON obyekt bo‘lishi kerak."));
      await patch(`/admin/categories/${selected.id}`, {
        passport_schema: value,
        expected_version: selected.schema_version,
      });
      await qc.invalidateQueries();
      setSelected(null);
      notify(t("success"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="tabs settings-tabs">
        <button
          className={tab === "categories" ? "active" : ""}
          onClick={() => setTab("categories")}
        >
          {copy("Kategoriya va pasportlar")}
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => setTab("audit")}
        >
          {t("security")}
        </button>
        <button
          className={tab === "backups" ? "active" : ""}
          onClick={() => setTab("backups")}
        >
          {copy("Zaxira nusxalar")}
        </button>
      </div>
      {tab === "categories" && (
        <div className="category-grid">
          {categories.map((c) => (
            <button
              className="category-card"
              key={c.id}
              onClick={() => {
                setSelected(c);
                setSchema(JSON.stringify(c.schema || {}, null, 2));
                setError(undefined);
              }}
            >
              <span className="control-icon green">
                <Database size={22} />
              </span>
              <strong>{localizedName(c, language)}</strong>
              <small>{c.id}</small>
              <div>
                <span>
                  {copy("Schema v")}
                  {c.schema_version || 1}
                </span>
                <ChevronRight size={16} />
              </div>
            </button>
          ))}
        </div>
      )}
      {tab === "audit" &&
        (audit.isLoading ? (
          <Loading />
        ) : audit.error ? (
          <ErrorBox error={audit.error} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{copy("Amal")}</th>
                  <th>{copy("Foydalanuvchi")}</th>
                  <th>{copy("Natija")}</th>
                  <th>{copy("Vaqt")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.data?.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.action}</strong>
                      <small className="block muted">{a.target_id}</small>
                    </td>
                    <td className="uuid-cell">{a.actor_id || "System"}</td>
                    <td>{a.outcome || "Qayd etilgan"}</td>
                    <td>{displayDate(a.created_at, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audit.data?.items.length && <Empty />}
          </div>
        ))}
      {tab === "backups" && (
        <div className="section-padding">
          <div className="security-card backup-card">
            <Database size={35} />
            <h3>{copy("Zaxiralash holati")}</h3>
            {backups.isLoading ? (
              <Loading />
            ) : backups.error ? (
              <ErrorBox error={backups.error} />
            ) : (
              <>
                <Status
                  value={
                    backups.data?.configured ? "configured" : "not_configured"
                  }
                />
                <p>
                  {copy("Oxirgi tekshirilgan tiklash:")}{" "}
                  {displayDate(backups.data?.last_verified_at, language)}
                </p>
                <p>
                  {backups.data?.message ||
                    "Zaxira holati faqat tasdiqlangan operatsion dalil mavjud bo‘lsa ko‘rsatiladi."}
                </p>
              </>
            )}
          </div>
          <div className="info-notice">
            <ShieldCheck size={19} />
            {copy(
              "Shaxsiy ma’lumotlarni saqlash va o‘chirish muddatlari operatorning tasdiqlangan siyosati orqali belgilanadi. Nusxadan tiklanganda o‘chirish yozuvlari qayta qo‘llanadi.",
            )}
          </div>
        </div>
      )}
      {selected && (
        <Modal
          title={`${localizedName(selected, language)} · pasport sxemasi`}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="wizard-body">
            {error !== undefined && <ErrorBox error={error} />}
            <div className="info-notice">
              {copy(
                "O‘zgarishlar yangi sxema versiyasini yaratadi. Muhim muhandislik maydonlari turlangan bazaviy jadvallarda saqlanadi.",
              )}
            </div>
            <Field label={copy("Versiyalangan JSON sxema")}>
              <textarea
                className="code-input"
                rows={16}
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
              />
            </Field>
          </div>
          <div className="modal-footer">
            <button
              className="button button-outline"
              onClick={() => setSelected(null)}
            >
              {t("cancel")}
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={save}
            >
              {t("save")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
