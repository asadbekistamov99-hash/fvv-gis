import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Save, ShieldCheck, Users, X } from "lucide-react";
import { api, post } from "../api";
import { localizedName } from "../i18n";
import type { Category, OperationsUI, Page, Region, User } from "../types";

export default function EmployeeAccess({
  user,
  regions,
  categories,
  language,
  t,
  copy,
  notify,
}: OperationsUI & { user: User; regions: Region[]; categories: Category[] }) {
  const cache = useQueryClient();
  const records = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<Page<User>>("/admin/users"),
    refetchInterval: 30000,
  });
  const organizations = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api<Page<{ id: string; name: string }>>("/organizations"),
  });
  const [selected, setSelected] = useState<User | null>(null);
  const [role, setRole] = useState("verified_employee");
  const [region, setRegion] = useState("");
  const [organization, setOrganization] = useState("");
  const [district, setDistrict] = useState("");
  const [sensitivity, setSensitivity] = useState("internal");
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
  const [reference, setReference] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  const districts = useQuery({
    queryKey: ["districts", region],
    queryFn: () =>
      api<Page<Region>>(
        `/gis/districts?region_id=${encodeURIComponent(region)}`,
      ),
    enabled: !!selected && !!region,
  });
  const roles = [
    "verified_employee",
    "infrastructure_inspector",
    "data_reviewer",
    "regional_supervisor",
    ...(user.roles?.includes("super_administrator")
      ? ["system_administrator", "super_administrator"]
      : []),
  ];
  function open(person: User, suspend: boolean) {
    const scope = person.assignments?.[0];
    setRole(scope?.role_id || person.role);
    setRegion(scope?.region_id || person.region_id || "");
    setOrganization(scope?.organization_id || person.organization_id || "");
    setDistrict(scope?.district_id || person.district_id || "");
    setSensitivity(scope?.max_sensitivity || "internal");
    setAllowedCategories(scope?.categories || []);
    setReference("");
    setError("");
    setSuspending(suspend);
    setSelected(person);
  }
  async function save() {
    if (!selected) return;
    if (!reference.trim()) {
      setError(copy("Ko‘rib chiqish asosi majburiy."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post(
        `/admin/users/${selected.id}/${suspending ? "suspend" : "roles"}`,
        suspending
          ? {}
          : {
              role,
              region_id: region || null,
              district_id: district || null,
              organization_id: organization || null,
              max_sensitivity: sensitivity,
              categories: allowedCategories,
              reference,
            },
      );
      await cache.invalidateQueries();
      setSelected(null);
      notify(t("success"));
    } catch (failure) {
      setError(
        copy(failure instanceof Error ? failure.message : String(failure)),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel access-panel">
      <div className="panel-heading">
        <h2>
          <Users size={23} />
          {copy("Faol xodimlar")}
          <span className="count-pill">
            {records.data?.items.filter(
              (person) => person.employee_status === "verified",
            ).length ?? "—"}
          </span>
        </h2>
        <ShieldCheck size={23} />
      </div>
      {records.error ? (
        <div className="error-box" role="alert">
          {copy(
            records.error instanceof Error
              ? records.error.message
              : String(records.error),
          )}
        </div>
      ) : records.isLoading ? (
        <div className="loading">{copy("Ma’lumot yuklanmoqda…")}</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{copy("Xodim")}</th>
                <th>{t("region")}</th>
                <th>{copy("Rol")}</th>
                <th>{t("status")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {records.data?.items
                .filter((person) => person.employee_status === "verified")
                .map((person) => (
                  <tr key={person.id}>
                    <td>
                      <strong>{person.full_name}</strong>
                      <small className="block muted">{person.phone}</small>
                    </td>
                    <td>
                      {localizedName(
                        regions.find((entry) => entry.id === person.region_id),
                        language,
                      )}
                    </td>
                    <td>{copy(person.role)}</td>
                    <td>
                      <span
                        className={`status status-${person.is_active ? "working" : "archived"}`}
                      >
                        <i />
                        {person.is_active ? copy("Faol") : copy("To‘xtatilgan")}
                      </span>
                    </td>
                    <td>
                      <div className="action-stack">
                        <button
                          className="button button-outline"
                  disabled={person.id === user.id || !person.is_active || person.assignments_complete === false || (person.role.includes("administrator") && !user.roles?.includes("super_administrator"))}
                          onClick={() => open(person, false)}
                        >
                          {copy("Ruxsatlarni saqlash")}
                        </button>
                        <button
                          className="button button-outline danger-text"
                          disabled={person.id === user.id || !person.is_active}
                          onClick={() => open(person, true)}
                        >
                          <LockKeyhole size={17} />
                          {copy("Kirishni to‘xtatish")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <dialog
          className="modal"
          ref={dialog}
          onCancel={(event) => {
            event.preventDefault();
            setSelected(null);
          }}
        >
          <div className="modal-head">
            <h2>
              {suspending
                ? copy("Kirishni to‘xtatish")
                : copy("Ruxsatlarni saqlash")}
            </h2>
            <button
              className="icon-button"
              aria-label={t("close")}
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
          </div>
          <div className="wizard-body">
            <strong>{selected.full_name}</strong>
            <div className="warning-banner">
              {copy("Ruxsat o‘zgarsa, mavjud sessiyalar bekor qilinadi.")}
            </div>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            {!suspending && (
              <>
                <label className="field">
                  <span>{copy("Rol")}</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    {roles.map((value) => (
                      <option key={value} value={value}>
                        {copy(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("region")}</span>
                  <select
                    value={region}
                    onChange={(event) => {
                      setRegion(event.target.value);
                      setDistrict("");
                    }}
                  >
                    <option value="">{t("allRegions")}</option>
                    {regions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {localizedName(entry, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{copy("Tuman")}</span>
                  <select
                    value={district}
                    onChange={(event) => setDistrict(event.target.value)}
                  >
                    <option value="">{copy("Barcha ruxsatli tumanlar")}</option>
                    {districts.data?.items.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {localizedName(entry, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{copy("Tashkilot")}</span>
                  <select
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                  >
                    <option value="">
                      {copy("Barcha ruxsatli tashkilotlar")}
                    </option>
                    {organizations.data?.items.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{copy("Eng yuqori maxfiylik")}</span>
                  <select
                    value={sensitivity}
                    onChange={(event) => setSensitivity(event.target.value)}
                  >
                    {["public", "internal", "restricted", "confidential"].map(
                      (value) => (
                        <option value={value} key={value}>
                          {copy(value)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <fieldset className="category-permissions">
                  <legend>{copy("Ruxsatli kategoriyalar")}</legend>
                  <p className="muted">
                    {copy(
                      "Hech biri tanlanmasa barcha ruxsatli kategoriyalar qo‘llanadi.",
                    )}
                  </p>
                  {categories.map((category) => (
                    <label className="checkbox-field" key={category.id}>
                      <input
                        type="checkbox"
                        checked={allowedCategories.includes(category.id)}
                        onChange={(event) =>
                          setAllowedCategories(
                            event.target.checked
                              ? [...allowedCategories, category.id]
                              : allowedCategories.filter(
                                  (value) => value !== category.id,
                                ),
                          )
                        }
                      />
                      <span>{localizedName(category, language)}</span>
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            <label className="field">
              <span>{copy("Ko‘rib chiqish asosi")} *</span>
              <textarea
                required
                rows={3}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
          </div>
          <div className="modal-footer">
            <button
              className="button button-outline"
              onClick={() => setSelected(null)}
            >
              {t("cancel")}
            </button>
            <button
              className={`button ${suspending ? "button-danger" : "button-primary"}`}
              disabled={busy || !reference.trim()}
              onClick={save}
            >
              <Save size={18} />
              {suspending ? copy("Kirishni to‘xtatish") : t("save")}
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
