import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  LogOut,
  Plus,
  PlusSquare,
  Route,
  Users,
  XCircle,
} from 'lucide-react';
import { localizedCategoryName, localizedRegionName } from '../core/geoUtils';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types/gis';
import { BrandLogo } from '../components/BrandLogo';
import {
  EmptyPanel,
  SectionCard,
  StatusPill,
  SyntheticBadge,
} from '../components/CommonComponents';
import { ObjectFormScreen } from './ObjectFormScreen';
import { PassportScreen } from './PassportScreen';
import { RoutesScreen } from './RoutesScreen';

type AdminTab = 'objects' | 'users' | 'reports' | 'routes';

type AdminSubView =
  | { kind: 'dashboard' }
  | { kind: 'objectForm'; objectId: string | null }
  | { kind: 'passport'; objectId: string }
  | { kind: 'routesDetail' };

const EMPLOYEE_ROLE_OPTIONS = [
  'verified_employee',
  'infrastructure_inspector',
  'data_reviewer',
  'regional_supervisor',
  'system_administrator',
];

const REPORT_STATUS_OPTIONS = ['received', 'triaged', 'in_progress', 'resolved', 'closed'];

export const AdminScreen: React.FC<{
  onCloseAdmin: () => void;
}> = ({ onCloseAdmin }) => {
  const {
    state,
    accounts,
    regions,
    categories,
    allObjects,
    allReports,
    approvedRoutes,
    syncQueue,
    adminUnlocked,
    reviewObject,
    verifyEmployeeApplication,
    updateCitizenReportStatus,
    approveRoute,
    withdrawRoute,
  } = useApp();
  const locale = state.locale;

  const [tab, setTab] = useState<AdminTab>('objects');
  const [subView, setSubView] = useState<AdminSubView>({ kind: 'dashboard' });
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

  const regionsById = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const submittedObjects = useMemo(
    () =>
      allObjects.filter(
        (o) =>
          o.lifecycle === 'submitted' ||
          o.lifecycle === 'draft' ||
          o.lifecycle === 'requires_correction'
      ),
    [allObjects]
  );

  const pendingAccounts = useMemo(
    () => accounts.filter((a) => a.employeeStatus === 'pending_verification'),
    [accounts]
  );

  const pendingSyncCount = useMemo(
    () => syncQueue.filter((op) => op.status !== 'settled').length,
    [syncQueue]
  );

  if (!adminUnlocked) {
    return null;
  }

  const handleInternalNavigate = (route: AppRoute) => {
    if (route.name === 'objectForm') {
      setSubView({ kind: 'objectForm', objectId: route.objectId });
    } else if (route.name === 'passport') {
      setSubView({ kind: 'passport', objectId: route.objectId });
    } else if (route.name === 'routes') {
      setSubView({ kind: 'routesDetail' });
    } else {
      setSubView({ kind: 'dashboard' });
    }
  };

  const adminNavItems = [
    { id: 'objects' as const, labelKey: 'adminSubmittedObjects', Icon: FileText, count: allObjects.length },
    { id: 'users' as const, labelKey: 'adminPendingUsers', Icon: Users, count: pendingAccounts.length },
    { id: 'reports' as const, labelKey: 'adminReportsTriage', Icon: ClipboardList, count: allReports.length },
    { id: 'routes' as const, labelKey: 'adminRoutesControl', Icon: Route, count: approvedRoutes.length },
  ];

  return (
    <div
      data-testid="admin_panel_screen"
      className="h-screen w-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden"
    >
      {/* Dedicated Standalone Admin Top Bar */}
      <header className="h-15 shrink-0 px-4 sm:px-6 border-b border-[var(--outline)]/45 bg-[var(--surface)] flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-sm sm:text-base tracking-tight text-[var(--ink)] truncate">
                FVV GIS · {L10n.text(locale, 'adminPanel')}
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--primary-container)] text-[var(--on-primary-container)] text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                {L10n.text(locale, 'adminWorkspaceTag')}
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-muted)] truncate">
              {state.account?.fullName ?? 'Inspektor (Admin)'} · {state.account?.role ?? 'super_administrator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSubView({ kind: 'objectForm', objectId: null })}
            data-testid="admin_add_object_button"
            className="h-9 px-3 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{L10n.text(locale, 'addRegistryItem')}</span>
          </button>

          <button
            type="button"
            onClick={onCloseAdmin}
            data-testid="admin_lock_button"
            className="h-9 px-3.5 rounded-xl bg-[var(--error)] text-white text-xs font-extrabold inline-flex items-center gap-1.5 hover:opacity-95 cursor-pointer shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{L10n.text(locale, 'adminLockPanel')}</span>
          </button>
        </div>
      </header>

      {/* Isolated Admin Workspace Shell: Separate Sidebar + Admin Main Viewport */}
      <div className="flex-1 flex min-h-0">
        <aside className="hidden md:flex w-60 shrink-0 flex-col justify-between border-r border-[var(--outline)]/40 bg-[var(--surface)] p-3">
          <nav aria-label={L10n.text(locale, 'adminPanel')} className="space-y-1">
            {adminNavItems.map(({ id, labelKey, Icon, count }) => {
              const active = subView.kind === 'dashboard' && tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTab(id);
                    setSubView({ kind: 'dashboard' });
                  }}
                  data-testid={`admin_nav_${id}`}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)]'
                      : 'text-[var(--ink-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{L10n.text(locale, labelKey)}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--bg)]/70 text-[10px] font-mono font-bold tabular-nums shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="pt-2 mt-2 border-t border-[var(--outline)]/30">
              <button
                type="button"
                onClick={() => setSubView({ kind: 'objectForm', objectId: null })}
                data-testid="admin_nav_objectForm"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  subView.kind === 'objectForm'
                    ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)]'
                    : 'text-[var(--ink-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]'
                }`}
              >
                <PlusSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">{L10n.text(locale, 'addRegistryItem')}</span>
              </button>
            </div>
          </nav>

          <div className="rounded-2xl bg-[var(--surface-elevated)]/70 border border-[var(--outline)]/35 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--ink)]">
              <BrandLogo size="xs" />
              <span>{L10n.text(locale, 'adminPanel')}</span>
              <Lock className="w-3 h-3 text-[var(--primary)] ml-auto shrink-0" />
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
              {L10n.text(locale, 'adminPasswordRequiredHint')}
            </p>
          </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          {subView.kind !== 'dashboard' ? (
            <div className="h-full flex flex-col">
              <div className="px-4 sm:px-6 py-3 border-b border-[var(--outline)]/35 bg-[var(--surface)]/70 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSubView({ kind: 'dashboard' })}
                  data-testid="admin_subview_back_button"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--outline)]/60 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-elevated)] cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{L10n.text(locale, 'adminBackToPanel')}</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {subView.kind === 'objectForm' && (
                  <ObjectFormScreen
                    objectId={subView.objectId}
                    onNavigate={handleInternalNavigate}
                    onDone={(savedId) => setSubView({ kind: 'passport', objectId: savedId })}
                  />
                )}
                {subView.kind === 'passport' && (
                  <PassportScreen
                    objectId={subView.objectId}
                    onNavigate={handleInternalNavigate}
                    onBack={() => setSubView({ kind: 'dashboard' })}
                  />
                )}
                {subView.kind === 'routesDetail' && (
                  <RoutesScreen onNavigate={handleInternalNavigate} />
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/45 p-3.5">
                  <p className="text-xs text-[var(--ink-muted)]">{L10n.text(locale, 'registry')}</p>
                  <p className="font-display text-2xl font-extrabold text-[var(--primary)] tabular-nums mt-0.5">
                    {allObjects.length}
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    {L10n.text(locale, 'submitted')}: {submittedObjects.length}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/45 p-3.5">
                  <p className="text-xs text-[var(--ink-muted)]">{L10n.text(locale, 'adminPendingUsers')}</p>
                  <p className="font-display text-2xl font-extrabold text-[var(--ink)] tabular-nums mt-0.5">
                    {accounts.length}
                  </p>
                  <p className="text-[11px] text-[var(--tertiary)] font-bold">
                    Pending: {pendingAccounts.length}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/45 p-3.5">
                  <p className="text-xs text-[var(--ink-muted)]">{L10n.text(locale, 'adminReportsTriage')}</p>
                  <p className="font-display text-2xl font-extrabold text-[var(--ink)] tabular-nums mt-0.5">
                    {allReports.length}
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    {L10n.text(locale, 'received')}:{' '}
                    {allReports.filter((r) => r.status === 'received' || r.status === 'queued_offline').length}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/45 p-3.5">
                  <p className="text-xs text-[var(--ink-muted)]">{L10n.text(locale, 'queue')}</p>
                  <p className="font-display text-2xl font-extrabold text-[var(--ink)] tabular-nums mt-0.5">
                    {pendingSyncCount}
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    {L10n.text(locale, 'route')}: {approvedRoutes.length}
                  </p>
                </div>
              </div>

              {/* Section Tabs (for quick switching on all widths) */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {adminNavItems.map(({ id, labelKey, Icon }) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      data-testid={`admin_tab_${id}`}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold border whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                          : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--outline)]/55'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{L10n.text(locale, labelKey)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Objects review & moderation */}
              {tab === 'objects' && (
                <div className="space-y-3">
                  {allObjects.slice(0, 30).map((obj) => {
                    const cat = categoriesById.get(obj.categoryId);
                    const reg = regionsById.get(obj.regionId);
                    return (
                      <SectionCard key={obj.id}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[var(--primary)]">{obj.code}</span>
                              <span className="text-[11px] font-mono text-[var(--ink-muted)]">v{obj.version}</span>
                            </div>
                            <p className="font-display text-sm font-extrabold text-[var(--ink)]">
                              {obj.name}
                            </p>
                            <p className="text-xs text-[var(--ink-muted)]">
                              {cat ? localizedCategoryName(cat, locale) : obj.categoryId} ·{' '}
                              {reg ? localizedRegionName(reg, locale) : obj.regionId}
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <StatusPill value={obj.operationalStatus} locale={locale} />
                              <StatusPill value={obj.lifecycle} locale={locale} />
                              {obj.isSynthetic && <SyntheticBadge locale={locale} />}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {obj.lifecycle !== 'published' && (
                              <button
                                type="button"
                                onClick={() => reviewObject(obj.id, true)}
                                className="px-3 py-2 rounded-xl bg-[#4CAF50] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{L10n.text(locale, 'publish')}</span>
                              </button>
                            )}
                            {obj.lifecycle === 'submitted' && (
                              <button
                                type="button"
                                onClick={() => reviewObject(obj.id, false)}
                                className="px-3 py-2 rounded-xl bg-[var(--error)] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{L10n.text(locale, 'reject')}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSubView({ kind: 'passport', objectId: obj.id })}
                              className="px-3 py-2 rounded-xl border border-[var(--outline)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-elevated)] cursor-pointer"
                            >
                              {L10n.text(locale, 'technicalPassport')}
                            </button>
                          </div>
                        </div>
                      </SectionCard>
                    );
                  })}
                </div>
              )}

              {/* Tab 2: Users & Employee Applications */}
              {tab === 'users' && (
                <div className="space-y-3">
                  {accounts.map((acc) => {
                    const roleVal =
                      selectedRoles[acc.id] ??
                      (acc.role === 'citizen' || acc.role === 'pending_employee'
                        ? 'verified_employee'
                        : acc.role);
                    return (
                      <SectionCard key={acc.id}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-sm font-extrabold text-[var(--ink)]">
                                {acc.fullName}
                              </span>
                              <span className="text-xs font-mono text-[var(--ink-muted)]">{acc.phone}</span>
                            </div>
                            <p className="text-xs text-[var(--ink-muted)]">
                              {acc.role} {acc.department ? `· ${acc.department}` : ''}
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {acc.employeeStatus && acc.employeeStatus !== 'none' && (
                                <StatusPill value={acc.employeeStatus} locale={locale} />
                              )}
                              {acc.isSynthetic && <SyntheticBadge locale={locale} />}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <select
                              value={roleVal}
                              aria-label={`${acc.fullName} role`}
                              onChange={(e) =>
                                setSelectedRoles((prev) => ({ ...prev, [acc.id]: e.target.value }))
                              }
                              className="h-9 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-2.5 text-xs text-[var(--ink)]"
                            >
                              {EMPLOYEE_ROLE_OPTIONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => verifyEmployeeApplication(acc.id, true, roleVal)}
                              className="px-3 py-2 rounded-xl bg-[#4CAF50] text-white text-xs font-bold cursor-pointer"
                            >
                              {L10n.text(locale, 'adminApproveEmployee')}
                            </button>
                            {acc.employeeStatus === 'pending_verification' && (
                              <button
                                type="button"
                                onClick={() => verifyEmployeeApplication(acc.id, false)}
                                className="px-3 py-2 rounded-xl bg-[var(--error)] text-white text-xs font-bold cursor-pointer"
                              >
                                {L10n.text(locale, 'adminRejectEmployee')}
                              </button>
                            )}
                          </div>
                        </div>
                      </SectionCard>
                    );
                  })}
                </div>
              )}

              {/* Tab 3: Citizen Reports Triage */}
              {tab === 'reports' && (
                <div className="space-y-3">
                  {allReports.length === 0 ? (
                    <EmptyPanel locale={locale} />
                  ) : (
                    allReports.map((rep) => (
                      <SectionCard key={rep.id}>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-[var(--primary)]">{rep.id}</span>
                            <StatusPill value={rep.status} locale={locale} />
                          </div>
                          <p className="text-sm font-semibold text-[var(--ink)]">{rep.description}</p>
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <input
                              type="text"
                              value={resolutionDrafts[rep.id] ?? rep.resolution ?? ''}
                              onChange={(e) =>
                                setResolutionDrafts((prev) => ({ ...prev, [rep.id]: e.target.value }))
                              }
                              placeholder={L10n.pick(
                                locale,
                                'Izoh / yechim...',
                                'Комментарий / решение...',
                                'Resolution note...'
                              )}
                              className="flex-1 h-9 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-xs text-[var(--ink)]"
                            />
                            <div className="flex gap-1.5 flex-wrap">
                              {REPORT_STATUS_OPTIONS.map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() =>
                                    updateCitizenReportStatus(
                                      rep.id,
                                      st,
                                      resolutionDrafts[rep.id] ?? rep.resolution ?? null
                                    )
                                  }
                                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${
                                    rep.status === st
                                      ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                                      : 'bg-[var(--surface-elevated)]/60 text-[var(--ink)] border-[var(--outline)]/50'
                                  }`}
                                >
                                  {L10n.text(locale, st)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    ))
                  )}
                </div>
              )}

              {/* Tab 4: Routes Control */}
              {tab === 'routes' && (
                <div className="space-y-3">
                  {approvedRoutes.length === 0 ? (
                    <EmptyPanel locale={locale} />
                  ) : (
                    approvedRoutes.map((rt) => (
                      <SectionCard key={rt.id}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[var(--primary)]">{rt.id}</span>
                              <StatusPill value={rt.status} locale={locale} />
                            </div>
                            <p className="font-display text-sm font-extrabold text-[var(--ink)]">
                              {rt.destinationName}
                            </p>
                            <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                              {(rt.distanceM / 1000).toFixed(2)} km · {rt.approvedBy ?? '—'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {rt.status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => approveRoute(rt.id)}
                                className="px-3 py-2 rounded-xl bg-[#4CAF50] text-white text-xs font-bold cursor-pointer"
                              >
                                {L10n.text(locale, 'approved')}
                              </button>
                            )}
                            {rt.status === 'approved' && (
                              <button
                                type="button"
                                onClick={() => withdrawRoute(rt.id)}
                                className="px-3 py-2 rounded-xl bg-[var(--error)] text-white text-xs font-bold cursor-pointer"
                              >
                                {L10n.text(locale, 'withdrawn')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSubView({ kind: 'routesDetail' })}
                              className="px-3 py-2 rounded-xl border border-[var(--outline)] text-xs font-bold text-[var(--ink)] cursor-pointer"
                            >
                              {L10n.text(locale, 'route')}
                            </button>
                          </div>
                        </div>
                      </SectionCard>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Dedicated Admin Mobile Bottom Navigation */}
      <nav
        aria-label={L10n.text(locale, 'adminPanel')}
        className="md:hidden h-16 shrink-0 border-t border-[var(--outline)]/45 bg-[var(--surface)] grid grid-cols-4 px-1 z-20"
      >
        {adminNavItems.map(({ id, labelKey, Icon }) => {
          const active = subView.kind === 'dashboard' && tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setSubView({ kind: 'dashboard' });
              }}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold cursor-pointer ${
                active ? 'text-[var(--primary)]' : 'text-[var(--ink-muted)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-full px-1">{L10n.text(locale, labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
