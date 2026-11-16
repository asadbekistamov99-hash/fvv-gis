import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, displayDate, post } from "../api";
import type {
  ApprovedRoute,
  Infrastructure,
  OperationsUI,
  Page,
  User,
} from "../types";
import MapView from "./LazyMapView";

export default function RoutesView({
  user,
  language,
  t,
  copy,
  notify,
}: OperationsUI & { user: User }) {
  const cache = useQueryClient();
  const routes = useQuery({
    queryKey: ["routes"],
    queryFn: () => api<Page<ApprovedRoute>>("/routes"),
    refetchInterval: 30000,
  });
  const objects = useQuery({
    queryKey: ["route-destinations"],
    queryFn: () => api<Page<Infrastructure>>("/infrastructure?limit=500"),
  });
  const [selected, setSelected] = useState<ApprovedRoute | null>(null);
  const [destination, setDestination] = useState("");
  const [longitude, setLongitude] = useState("");
  const [latitude, setLatitude] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canApprove = user.permissions?.includes("routes.approve");
  const destinations =
    objects.data?.items.filter((object) => object.lifecycle === "published") ||
    [];
  const current =
    routes.data?.items.find((route) => route.id === selected?.id) || selected;
  async function requestRoute() {
    setError("");
    const lon = Number(longitude),
      lat = Number(latitude);
    if (
      !destination ||
      !longitude ||
      !latitude ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      Math.abs(lon) > 180 ||
      Math.abs(lat) > 90
    ) {
      setError(copy("Obyekt va to‘g‘ri GPS koordinatalarini kiriting."));
      return;
    }
    setBusy(true);
    try {
      const route = await post<ApprovedRoute>("/routes", {
        destination_object_id: destination,
        origin: { type: "Point", coordinates: [lon, lat] },
      });
      setSelected(route);
      await cache.invalidateQueries({ queryKey: ["routes"] });
      notify(copy("Rahbar tasdig‘i kerak"));
    } catch (failure) {
      setError(
        copy(failure instanceof Error ? failure.message : String(failure)),
      );
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError(t("gpsUnavailable"));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLongitude(position.coords.longitude.toFixed(7));
        setLatitude(position.coords.latitude.toFixed(7));
        setAccuracy(position.coords.accuracy);
        setBusy(false);
      },
      () => {
        setError(t("gpsDenied"));
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  async function decide(route: ApprovedRoute, action: "approve" | "withdraw") {
    setBusy(true);
    setError("");
    try {
      const updated = await post<ApprovedRoute>(
        `/routes/${route.id}/${action}`,
      );
      setSelected(updated);
      await cache.invalidateQueries({ queryKey: ["routes"] });
      notify(t("success"));
    } catch (failure) {
      setError(
        copy(failure instanceof Error ? failure.message : String(failure)),
      );
    } finally {
      setBusy(false);
    }
  }
  const status = (value: string) =>
    value === "approved"
      ? t("approved")
      : value === "pending"
        ? copy("Rahbar tasdig‘i kerak")
        : value === "expired"
          ? copy("Muddati tugagan")
          : copy("Bekor qilingan");
  return (
    <>
      <div className="info-notice">
        <ShieldCheck size={22} />
        {copy("Faqat tekshirilgan yo‘l bo‘yicha harakatlaning.")}{" "}
        {copy(
          "Marshrut oddiy yo‘l ma’lumotlari asosida tuziladi; favqulodda harakat uchun yaroqlilikni operator tekshiradi.",
        )}
      </div>
      {(error || routes.error) && (
        <div className="error-box" role="alert">
          {error ||
            copy(
              routes.error instanceof Error
                ? routes.error.message
                : String(routes.error),
            )}
        </div>
      )}
      <section className="panel route-request">
        <div className="panel-heading">
          <h2>
            <Navigation size={22} />
            {copy("Marshrut so‘rash")}
          </h2>
        </div>
        <div className="section-padding route-form">
          <label className="field">
            <span>{copy("Manzil obyekti")}</span>
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="">{copy("Obyekt tanlang")}</option>
              {destinations.map((object) => (
                <option key={object.id} value={object.id}>
                  {object.code} · {object.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{copy("Uzunlik")}</span>
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{copy("Kenglik")}</span>
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
          </label>
          <button
            className="button button-outline"
            disabled={busy}
            onClick={locate}
          >
            <LocateFixed size={20} />
            {copy("GPS orqali olish")}
          </button>
          <button
            className="button button-primary"
            disabled={busy || !destination}
            onClick={requestRoute}
          >
            <Navigation size={20} />
            {copy("Marshrut so‘rash")}
          </button>
          {accuracy !== null && (
            <p className="muted">GPS ±{Math.round(accuracy)} m</p>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {t("routes")}
            <span className="count-pill">{routes.data?.total ?? "—"}</span>
          </h2>
          <button
            className="icon-button"
            aria-label={t("refresh")}
            onClick={() => routes.refetch()}
          >
            <RefreshCw size={20} />
          </button>
        </div>
        {routes.isLoading ? (
          <div className="loading">{copy("Ma’lumot yuklanmoqda…")}</div>
        ) : !routes.data?.items.length ? (
          <div className="empty">
            <MapPin size={30} />
            <strong>{t("noData")}</strong>
            <p>
              {copy(
                "Marshrutlar xususiy yo‘l xizmati orqali hisoblanadi. Xizmat ishlamasa soxta yo‘l ko‘rsatilmaydi.",
              )}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{copy("Manzil obyekti")}</th>
                  <th>{t("status")}</th>
                  <th>{t("distance")}</th>
                  <th>{copy("Manba sanasi")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {routes.data.items.map((route) => (
                  <tr key={route.id}>
                    <td>
                      <strong>
                        {objects.data?.items.find(
                          (object) => object.id === route.destination_object_id,
                        )?.name || route.destination_object_id}
                      </strong>
                      <small className="block muted">
                        {displayDate(route.created_at, language)}
                      </small>
                    </td>
                    <td>
                      <span className={`status status-${route.status}`}>
                        <i />
                        {status(route.status)}
                      </span>
                    </td>
                    <td>{(route.distance_m / 1000).toFixed(2)} km</td>
                    <td>
                      {route.source_date === "unknown"
                        ? t("unknown")
                        : route.source_date}
                    </td>
                    <td>
                      <button
                        className="button button-outline"
                        onClick={() => setSelected(route)}
                      >
                        {copy("Yo‘l tafsilotlari")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {current && (
        <section className="panel route-detail">
          <div className="panel-heading">
            <h2>
              <Navigation size={22} />
              {copy("Yo‘l tafsilotlari")}
            </h2>
            <button
              className="icon-button"
              aria-label={t("close")}
              onClick={() => setSelected(null)}
            >
              <X size={22} />
            </button>
          </div>
          <div className="section-padding">
            <div className="detail-summary">
              <span className={`status status-${current.status}`}>
                <i />
                {status(current.status)}
              </span>
              <strong>
                {(current.distance_m / 1000).toFixed(2)} km ·{" "}
                {Math.ceil(current.duration_s / 60)} min
              </strong>
              <p>
                {copy("Manba sanasi")}: {current.source_date}
              </p>
              <p>
                {copy("Amal qilish muddati")}:{" "}
                {displayDate(current.expires_at, language)}
              </p>
            </div>
            {current.status !== "approved" && (
              <div className="warning-banner">
                {copy(
                  "Bu yo‘l faqat oldindan ko‘rish uchun. Tasdiqsiz yoki muddati tugagan marshrutdan operativ foydalanmang.",
                )}
              </div>
            )}
          </div>
          <MapView
            objects={destinations.filter(
              (object) => object.id === current.destination_object_id,
            )}
            language={language}
            routeGeometry={current.geometry}
          />
          <div className="section-padding">
            {current.steps.map((step, index) => (
              <div className="route-step" key={index}>
                <strong>{index + 1}.</strong>
                <span>{step.name || copy("Nomsiz yo‘l")}</span>
                <span>{Math.round(step.distance_m)} m</span>
              </div>
            ))}
          </div>
          {canApprove && (
            <div className="modal-footer">
              {current.status === "pending" &&
                current.requested_by !== user.id && (
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => decide(current, "approve")}
                  >
                    <Check size={20} />
                    {t("approve")}
                  </button>
                )}
              {current.status === "approved" && (
                <button
                  className="button button-danger"
                  disabled={busy}
                  onClick={() => decide(current, "withdraw")}
                >
                  {copy("Tasdiqni bekor qilish")}
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
