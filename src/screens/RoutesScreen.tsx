import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Lock,
  Navigation,
  Route,
  Square,
  XCircle,
} from 'lucide-react';
import { GeoUtils, allGeometryPoints } from '../core/geoUtils';
import { requestBrowserGpsFix } from '../core/locationHelper';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute, GeoPoint, MapViewport, canAccountApproveRoutes } from '../types/gis';
import {
  DataRowView,
  EmptyPanel,
  SectionCard,
  StatusPill,
} from '../components/CommonComponents';
import { UzbekistanGisCanvas } from '../components/UzbekistanGisCanvas';

interface RouteStepParsed {
  name: string;
  distance_m: number;
  duration_s: number;
}

export const RoutesScreen: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { state, regions, approvedRoutes, approveRoute, withdrawRoute, showMessage } = useApp();
  const locale = state.locale;

  const [selectedRouteId, setSelectedRouteId] = useState<string>(approvedRoutes[0]?.id ?? '');
  const [navActive, setNavActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [userGps, setUserGps] = useState<GeoPoint | null>(null);
  const [previewViewport, setPreviewViewport] = useState<MapViewport>({
    centerLat: 41.31,
    centerLon: 69.25,
    zoom: 5.5,
  });

  const selectedRoute = useMemo(
    () => approvedRoutes.find((r) => r.id === selectedRouteId) ?? approvedRoutes[0] ?? null,
    [approvedRoutes, selectedRouteId]
  );

  const routePoints = useMemo(() => {
    if (!selectedRoute) return [];
    const parsed = GeoUtils.parseGeoJson(selectedRoute.geometryJson);
    return parsed ? allGeometryPoints(parsed) : [];
  }, [selectedRoute]);

  const steps = useMemo<RouteStepParsed[]>(() => {
    if (!selectedRoute) return [];
    try {
      const arr = JSON.parse(selectedRoute.stepsJson);
      return Array.isArray(arr) ? (arr as RouteStepParsed[]) : [];
    } catch {
      return [];
    }
  }, [selectedRoute]);

  if (!state.isEmployee) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center gap-4">
        <Lock className="w-12 h-12 text-[var(--primary)]" />
        <p className="text-base font-semibold text-[var(--ink)] max-w-md">
          {L10n.text(locale, 'employeeRequiredForAdd')}
        </p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'auth' })}
          className="px-5 py-3 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold cursor-pointer"
        >
          {L10n.text(locale, 'login')}
        </button>
      </div>
    );
  }

  const isSupervisor = canAccountApproveRoutes(state.account);
  const canNavigateSelected =
    Boolean(selectedRoute) &&
    state.isLeaseValid &&
    selectedRoute?.status === 'approved' &&
    (selectedRoute?.expiresAtEpochMs ?? 0) > state.currentTimeMs;

  const handleSelectRoute = (id: string) => {
    setSelectedRouteId(id);
    setNavActive(false);
    setStepIndex(0);
    const found = approvedRoutes.find((r) => r.id === id);
    if (found) {
      const parsed = GeoUtils.parseGeoJson(found.geometryJson);
      const pts = parsed ? allGeometryPoints(parsed) : [];
      if (pts[0]) {
        setPreviewViewport({ centerLat: pts[0].lat, centerLon: pts[0].lon, zoom: 6.5 });
      }
    }
  };

  const handleToggleNav = async () => {
    if (navActive) {
      setNavActive(false);
      return;
    }
    if (!canNavigateSelected) {
      showMessage(
        L10n.pick(
          locale,
          'Marshrut tasdiqlanmagan yoki muddati tugagan.',
          'Маршрут не одобрен или срок действия истёк.',
          'Route must be approved and active within your lease.'
        )
      );
      return;
    }
    const fix = await requestBrowserGpsFix();
    setUserGps(fix.point);
    setStepIndex(0);
    setNavActive(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
          {L10n.text(locale, 'route')}
        </h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          {L10n.pick(
            locale,
            'Operativ marshrutlar faqat tasdiqlangan va 8 soatlik ruxsat muddati ichida ishlaydi.',
            'Оперативные маршруты активны только после утверждения и в пределах 8-часового доступа.',
            'Approved operational routes remain active strictly within your 8-hour lease window.'
          )}
        </p>
      </div>

      {approvedRoutes.length === 0 ? (
        <EmptyPanel locale={locale} icon={<Route className="w-12 h-12 opacity-75" />} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {approvedRoutes.map((rt) => {
              const selected = selectedRoute?.id === rt.id;
              return (
                <SectionCard
                  key={rt.id}
                  onClick={() => handleSelectRoute(rt.id)}
                  className={selected ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]' : ''}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[var(--primary)]">{rt.id}</span>
                      <StatusPill value={rt.status} locale={locale} />
                    </div>
                    <p className="font-display text-sm font-extrabold text-[var(--ink)]">
                      {rt.destinationName}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                      {(rt.distanceM / 1000).toFixed(2)} km · {Math.max(1, Math.round(rt.durationS / 60))}{' '}
                      {L10n.text(locale, 'etaMinutes')}
                    </p>
                  </div>
                </SectionCard>
              );
            })}
          </div>

          {selectedRoute && (
            <>
              <div className="h-64 rounded-2xl overflow-hidden border border-[var(--outline)]/55 relative">
                <UzbekistanGisCanvas
                  markers={[]}
                  regions={regions}
                  localeCode={locale}
                  darkTheme={state.darkTheme}
                  viewport={previewViewport}
                  onViewportChange={setPreviewViewport}
                  measurePoints={[]}
                  routePoints={routePoints}
                  routeIsWarning={selectedRoute.status !== 'approved'}
                  userLocation={userGps}
                  emergencyPin={null}
                  downloadPreviewBounds={null}
                  savedAreaBounds={[]}
                  selectedObjectId={null}
                  onMarkerTap={() => {}}
                  onClusterTap={() => {}}
                />
              </div>

              <SectionCard title={selectedRoute.destinationName}>
                <div className="divide-y divide-[var(--outline)]/35">
                  <DataRowView
                    label={L10n.text(locale, 'status')}
                    value={L10n.text(locale, selectedRoute.status)}
                  />
                  <DataRowView
                    label={L10n.text(locale, 'measure')}
                    value={`${(selectedRoute.distanceM / 1000).toFixed(2)} km`}
                    mono
                  />
                  <DataRowView
                    label="ETA"
                    value={`${Math.max(1, Math.round(selectedRoute.durationS / 60))} ${L10n.text(locale, 'etaMinutes')}`}
                    mono
                  />
                  <DataRowView label="Approved by" value={selectedRoute.approvedBy} />
                </div>

                <div className="flex flex-wrap gap-2.5 mt-4">
                  {isSupervisor && selectedRoute.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => approveRoute(selectedRoute.id)}
                      className="px-4 py-2.5 rounded-xl bg-[#4CAF50] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{L10n.text(locale, 'approved')}</span>
                    </button>
                  )}

                  {isSupervisor && selectedRoute.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => {
                        withdrawRoute(selectedRoute.id);
                        setNavActive(false);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[var(--error)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{L10n.text(locale, 'withdrawn')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!canNavigateSelected && !navActive}
                    onClick={() => void handleToggleNav()}
                    className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 ${
                      navActive
                        ? 'bg-[var(--error)] text-white'
                        : 'bg-[var(--primary)] text-[var(--on-primary)]'
                    }`}
                  >
                    {navActive ? <Square className="w-3.5 h-3.5" /> : <Navigation className="w-4 h-4" />}
                    <span>
                      {navActive
                        ? L10n.pick(locale, 'Navigatsiyani to‘xtatish', 'Остановить навигацию', 'Stop navigation')
                        : L10n.pick(locale, 'Navigatsiyani boshlash', 'Начать навигацию', 'Start navigation')}
                    </span>
                  </button>
                </div>
              </SectionCard>

              {steps.length > 0 && (
                <SectionCard title={L10n.text(locale, 'turnByTurnSteps')}>
                  <div className="space-y-2">
                    {steps.map((st, idx) => {
                      const current = navActive && idx === stepIndex;
                      return (
                        <div
                          key={`${st.name}-${idx}`}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                            current
                              ? 'bg-[var(--primary-container)] border-[var(--primary)]'
                              : 'bg-[var(--surface-elevated)]/40 border-[var(--outline)]/40'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-[var(--ink)]">
                              {idx + 1}. {st.name}
                            </p>
                            <p className="text-[11px] font-mono text-[var(--ink-muted)]">
                              {st.distance_m} m · {Math.max(1, Math.round(st.duration_s / 60))}{' '}
                              {L10n.text(locale, 'etaMinutes')}
                            </p>
                          </div>
                          {current && idx < steps.length - 1 && (
                            <button
                              type="button"
                              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                              className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
