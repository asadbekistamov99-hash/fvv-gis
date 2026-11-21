import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Bell,
  ClipboardCheck,
  CloudOff,
  Home,
  ListChecks,
  Map as MapIcon,
  PlusSquare,
  RefreshCw,
  Send,
  User,
} from 'lucide-react';
import { stripAdminRoutes } from './core/adminSession';
import { L10n } from './core/localization';
import { getGoogleMapsApiKey } from './core/mapsConfig';
import { useApp } from './context/AppContext';
import { AppRoute } from './types/gis';
import { AdminLoginModal } from './components/AdminLoginModal';
import { BrandLogo } from './components/BrandLogo';
import { ErrorPanel } from './components/CommonComponents';
import { AdminScreen } from './screens/AdminScreen';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InspectionsScreen } from './screens/InspectionsScreen';
import { MapScreen } from './screens/MapScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ObjectFormScreen } from './screens/ObjectFormScreen';
import { PassportScreen } from './screens/PassportScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RegistryScreen } from './screens/RegistryScreen';
import { MyReportsScreen, ReportScreen } from './screens/ReportScreen';
import { RoutesScreen } from './screens/RoutesScreen';
import { SyncScreen } from './screens/SyncScreen';

interface NavTabItem {
  id: string;
  route: AppRoute;
  labelKey: string;
  Icon: React.FC<{ className?: string }>;
}

const LEASE_PROTECTED_ROUTES = new Set(['registry', 'inspections', 'routes', 'passport']);

export const App: React.FC = () => {
  const {
    state,
    syncQueue,
    notifications,
    adminUnlocked,
    lockAdminPanel,
    clearMessage,
    renewLease,
  } = useApp();
  const locale = state.locale;
  const initialMapsLocaleRef = useRef(locale);
  const googleMapsApiKey = getGoogleMapsApiKey();
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const [history, setHistory] = useState<AppRoute[]>([{ name: 'home' }]);
  const currentRoute = history[history.length - 1] ?? { name: 'home' };
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Global Ctrl+Shift+S shortcut: always requires password modal when Admin Panel is locked
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        e.stopPropagation();
        if (!adminUnlocked) {
          setAdminModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [adminUnlocked]);

  const handleCloseAdmin = () => {
    setAdminModalOpen(false);
    lockAdminPanel();
    setHistory((prev) => stripAdminRoutes(prev));
  };

  // Auto-dismiss snackbar messages
  useEffect(() => {
    if (!state.message) return;
    const t = window.setTimeout(() => clearMessage(), 3500);
    return () => window.clearTimeout(t);
  }, [state.message, clearMessage]);

  const navigateTo = (route: AppRoute) => {
    setHistory((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.name === route.name && JSON.stringify(top) === JSON.stringify(route)) {
        return prev;
      }
      return [...prev.slice(-15), route];
    });
  };

  const switchTopTab = (route: AppRoute) => {
    setHistory([route]);
  };

  const goBack = () => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : [{ name: 'home' }]));
  };

  const navItems: NavTabItem[] = useMemo(() => {
    if (state.isEmployee) {
      return [
        { id: 'map', route: { name: 'map' }, labelKey: 'map', Icon: MapIcon },
        { id: 'registry', route: { name: 'registry' }, labelKey: 'registry', Icon: ListChecks },
        { id: 'objectForm', route: { name: 'objectForm', objectId: null }, labelKey: 'add', Icon: PlusSquare },
        { id: 'inspections', route: { name: 'inspections' }, labelKey: 'inspections', Icon: ClipboardCheck },
        { id: 'profile', route: { name: 'profile' }, labelKey: 'profile', Icon: User },
      ];
    }
    return [
      { id: 'home', route: { name: 'home' }, labelKey: 'home', Icon: Home },
      { id: 'map', route: { name: 'map' }, labelKey: 'map', Icon: MapIcon },
      {
        id: 'report',
        route: state.account ? { name: 'report' } : { name: 'auth' },
        labelKey: 'report',
        Icon: Send,
      },
      {
        id: 'myReports',
        route: state.account ? { name: 'myReports' } : { name: 'auth' },
        labelKey: 'reports',
        Icon: ListChecks,
      },
      { id: 'profile', route: { name: 'profile' }, labelKey: 'profile', Icon: User },
    ];
  }, [state.isEmployee, state.account]);

  const pendingSyncCount = useMemo(
    () => syncQueue.filter((op) => op.status === 'pending' || op.status === 'conflict').length,
    [syncQueue]
  );

  const unreadNotifsCount = useMemo(
    () => (state.account ? notifications.filter((n) => !n.readAt).length : 0),
    [state.account, notifications]
  );

  const leaseBlocked =
    state.isEmployee &&
    !state.isLeaseValid &&
    LEASE_PROTECTED_ROUTES.has(currentRoute.name);

  const isMapScreen = currentRoute.name === 'map' && !leaseBlocked;

  const renderScreen = () => {
    if (leaseBlocked) {
      return (
        <ErrorPanel
          locale={locale}
          message={L10n.pick(
            locale,
            '8 soatlik operativ ruxsat muddati tugadi. Davom etish uchun sinxronlang.',
            'Срок 8-часового оперативного допуска истёк. Синхронизируйтесь для продления.',
            'Your 8-hour operational access lease has expired. Synchronize to renew access.'
          )}
          onRetry={renewLease}
        />
      );
    }

    switch (currentRoute.name) {
      case 'home':
        return <HomeScreen onNavigate={navigateTo} />;
      case 'map':
        return <MapScreen onNavigate={navigateTo} />;
      case 'auth':
        return (
          <AuthScreen
            onAuthenticated={(next) => setHistory([next])}
            onOpenPublicMap={() => setHistory([{ name: 'map' }])}
          />
        );
      case 'registry':
        return <RegistryScreen onNavigate={navigateTo} />;
      case 'objectForm':
        return (
          <ObjectFormScreen
            objectId={currentRoute.objectId}
            onNavigate={navigateTo}
            onDone={(savedId) => navigateTo({ name: 'passport', objectId: savedId })}
          />
        );
      case 'passport':
        return (
          <PassportScreen
            objectId={currentRoute.objectId}
            onNavigate={navigateTo}
            onBack={goBack}
          />
        );
      case 'report':
        return <ReportScreen onSubmitted={() => setHistory([{ name: 'myReports' }])} />;
      case 'myReports':
        return <MyReportsScreen onNavigate={navigateTo} />;
      case 'inspections':
        return <InspectionsScreen onNavigate={navigateTo} />;
      case 'routes':
        return <RoutesScreen onNavigate={navigateTo} />;
      case 'sync':
        return <SyncScreen />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigateTo} />;
      case 'profile':
        return <ProfileScreen onNavigate={navigateTo} />;
      case 'admin':
      default:
        return <HomeScreen onNavigate={navigateTo} />;
    }
  };

  const appShell = (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      {/* Top Application Bar */}
      <header className="h-14 shrink-0 px-4 border-b border-[var(--outline)]/45 bg-[var(--surface)] flex items-center justify-between gap-3 z-20">
        <button
          type="button"
          onClick={() => switchTopTab({ name: 'home' })}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <BrandLogo size="sm" />
          <div className="text-left">
            <span className="font-display font-extrabold text-sm sm:text-base tracking-tight text-[var(--ink)]">
              FVV GIS
            </span>
            <span className="hidden sm:inline text-xs text-[var(--ink-muted)] ml-2">
              {L10n.text(locale, state.isEmployee ? 'operationalMap' : 'publicMap')}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigateTo({ name: 'sync' })}
            aria-label={L10n.text(locale, 'queue')}
            data-testid="topbar_sync_button"
            className="relative p-2.5 rounded-xl hover:bg-[var(--surface-elevated)] text-[var(--ink)] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${state.syncing ? 'animate-spin' : ''}`} />
            {pendingSyncCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--tertiary)] text-[var(--on-tertiary-container)] text-[10px] font-black flex items-center justify-center">
                {pendingSyncCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigateTo({ name: 'notifications' })}
            aria-label={L10n.text(locale, 'notifications')}
            data-testid="topbar_notifications_button"
            className="relative p-2.5 rounded-xl hover:bg-[var(--surface-elevated)] text-[var(--ink)] cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifsCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--error)] text-white text-[10px] font-black flex items-center justify-center">
                {unreadNotifsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Global Banners */}
      {state.isEffectiveOffline && (
        <button
          type="button"
          onClick={() => navigateTo({ name: 'sync' })}
          data-testid="global_offline_banner"
          className="w-full shrink-0 px-4 py-1.5 bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border-b border-[var(--tertiary)]/40"
        >
          <CloudOff className="w-3.5 h-3.5 shrink-0" />
          <span>{L10n.text(locale, 'offline')}</span>
        </button>
      )}

      {state.account?.employeeStatus === 'pending_verification' && (
        <div className="w-full shrink-0 px-4 py-1.5 bg-[var(--secondary-container)] text-[var(--on-secondary-container)] text-xs font-semibold flex items-center justify-center gap-2 border-b border-[var(--outline)]/30">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{L10n.text(locale, 'pendingVerification')}</span>
        </div>
      )}

      {/* Body with responsive NavigationRail (md+) + Main Viewport */}
      <div className="flex-1 flex min-h-0 relative">
        <aside className="hidden md:flex w-20 lg:w-52 shrink-0 flex-col justify-between gap-2 border-r border-[var(--outline)]/40 bg-[var(--surface)] p-2.5">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = currentRoute.name === item.id;
              const Icon = item.Icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTopTab(item.route)}
                  data-testid={`nav_rail_${item.id}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)]'
                      : 'text-[var(--ink-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden lg:inline truncate">{L10n.text(locale, item.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[var(--surface-elevated)]/60 border border-[var(--outline)]/30">
            <BrandLogo size="xs" />
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-[var(--ink)] leading-tight truncate">
                FVV GIS
              </p>
              <p className="text-[10px] text-[var(--ink-muted)] truncate">
                Uzbekistan GIS
              </p>
            </div>
          </div>
        </aside>

        <main
          className={`flex-1 min-w-0 min-h-0 flex flex-col ${
            isMapScreen ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {renderScreen()}
        </main>
      </div>

      {/* Bottom Navigation Bar (< md) */}
      <nav className="md:hidden h-16 shrink-0 border-t border-[var(--outline)]/45 bg-[var(--surface)] grid grid-cols-5 px-1 z-20">
        {navItems.map((item) => {
          const active = currentRoute.name === item.id;
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTopTab(item.route)}
              data-testid={`nav_bar_${item.id}`}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold cursor-pointer ${
                active ? 'text-[var(--primary)]' : 'text-[var(--ink-muted)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-full px-1">{L10n.text(locale, item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* Floating Toast Snackbar */}
      {state.message && (
        <div
          role="status"
          data-testid="app_snackbar"
          className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[var(--ink)] text-[var(--bg)] text-xs font-bold shadow-2xl flex items-center gap-3 max-w-[90vw]"
        >
          <span className="truncate">{state.message}</span>
          <button
            type="button"
            onClick={clearMessage}
            className="text-[var(--primary)] font-black cursor-pointer shrink-0"
          >
            OK
          </button>
        </div>
      )}
      <AdminLoginModal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onSuccess={() => {
          setAdminModalOpen(false);
        }}
      />
    </div>
  );

  const activeShell = adminUnlocked ? (
    <>
      <AdminScreen onCloseAdmin={handleCloseAdmin} />
      {state.message && (
        <div
          role="status"
          data-testid="app_snackbar"
          className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[var(--ink)] text-[var(--bg)] text-xs font-bold shadow-2xl flex items-center gap-3 max-w-[90vw]"
        >
          <span className="truncate">{state.message}</span>
          <button
            type="button"
            onClick={clearMessage}
            className="text-[var(--primary)] font-black cursor-pointer shrink-0"
          >
            OK
          </button>
        </div>
      )}
    </>
  ) : (
    appShell
  );

  if (googleMapsApiKey) {
    return (
      <APIProvider
        apiKey={googleMapsApiKey}
        language={initialMapsLocaleRef.current}
        region="UZ"
        libraries={['marker', 'maps', 'streetView']}
        onError={() => window.dispatchEvent(new CustomEvent('gmp-load-error'))}
      >
        {activeShell}
      </APIProvider>
    );
  }

  return activeShell;
};

export default App;
