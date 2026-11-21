import React, { useState } from 'react';
import {
  Edit3,
  Globe,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Route,
  Trash2,
} from 'lucide-react';
import { APP_LOCALES, L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types/gis';
import { BrandLogo } from '../components/BrandLogo';
import {
  ConfirmDialog,
  DataRowView,
  ModalSheet,
  SectionCard,
  StatusPill,
} from '../components/CommonComponents';

export const ProfileScreen: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { state, setLocale, setDarkTheme, updateProfileName, logout, deleteAccount } = useApp();
  const locale = state.locale;

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState(state.account?.fullName ?? '');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
        {L10n.text(locale, 'profile')}
      </h2>

      {/* Account Summary */}
      <SectionCard>
        {state.account ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <BrandLogo size="md" />
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-extrabold text-[var(--ink)] truncate">
                    {state.account.fullName}
                  </h3>
                  <p className="text-xs font-mono text-[var(--ink-muted)]">{state.account.phone}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNameInput(state.account?.fullName ?? '');
                  setEditModalOpen(true);
                }}
                className="p-2 rounded-xl border border-[var(--outline)] text-[var(--primary)] cursor-pointer"
                aria-label={L10n.text(locale, 'edit')}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-[var(--outline)]/35">
              <DataRowView label="Role" value={state.account.role} />
              {state.account.employeeStatus && state.account.employeeStatus !== 'none' && (
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-sm text-[var(--ink-muted)] font-medium">
                    {L10n.text(locale, 'status')}
                  </span>
                  <StatusPill value={state.account.employeeStatus} locale={locale} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BrandLogo size="md" />
              <div className="min-w-0">
                <p className="font-display text-sm font-extrabold text-[var(--ink)]">FVV GIS</p>
                <p className="text-xs text-[var(--ink-muted)] truncate">{L10n.text(locale, 'publicMap')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'auth' })}
              className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>{L10n.text(locale, 'login')}</span>
            </button>
          </div>
        )}
      </SectionCard>

      {/* Appearance & Locale */}
      <SectionCard>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Moon className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-sm font-semibold text-[var(--ink)]">
                {L10n.text(locale, 'darkMode')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={state.darkTheme}
              onChange={(e) => setDarkTheme(e.target.checked)}
              data-testid="profile_dark_mode_switch"
              className="w-4 h-4 accent-[var(--primary)] cursor-pointer"
            />
          </label>

          <div className="h-px bg-[var(--outline)]/35" />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-sm font-semibold text-[var(--ink)]">
                {L10n.text(locale, 'language')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {APP_LOCALES.map((loc) => {
                const active = locale === loc.code;
                return (
                  <button
                    key={loc.code}
                    type="button"
                    onClick={() => setLocale(loc.code)}
                    data-testid={`profile_locale_${loc.code}`}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      active
                        ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                        : 'bg-[var(--surface-elevated)]/55 text-[var(--ink)] border-[var(--outline)]/50'
                    }`}
                  >
                    {loc.displayName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Operational Tools Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigate({ name: 'routes' })}
          className="h-12 px-4 rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/60 text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 hover:bg-[var(--surface-elevated)] cursor-pointer"
        >
          <Route className="w-4 h-4 text-[var(--primary)]" />
          <span>{L10n.text(locale, 'route')}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ name: 'sync' })}
          className="h-12 px-4 rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/60 text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 hover:bg-[var(--surface-elevated)] cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-[var(--primary)]" />
          <span>{L10n.text(locale, 'queue')}</span>
        </button>
      </div>

      {/* Account Actions */}
      {state.account && (
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => logout(() => onNavigate({ name: 'home' }))}
            data-testid="profile_logout_button"
            className="w-full h-12 rounded-xl border border-[var(--outline)] text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 hover:bg-[var(--surface-elevated)] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{L10n.text(locale, 'logout')}</span>
          </button>

          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            data-testid="profile_delete_button"
            className="w-full h-12 rounded-xl bg-[var(--error-container)]/65 text-[var(--on-error-container)] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{L10n.text(locale, 'deleteAccount')}</span>
          </button>
        </div>
      )}

      <p className="text-center text-xs text-[var(--ink-muted)] pt-2">
        {L10n.text(locale, 'independent')}
      </p>

      <ModalSheet open={editModalOpen} onClose={() => setEditModalOpen(false)} title={L10n.text(locale, 'edit')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nameInput.trim().length >= 2) {
              updateProfileName(nameInput.trim());
              setEditModalOpen(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'name')}
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
            />
          </div>
          <button
            type="submit"
            className="w-full h-11 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold cursor-pointer"
          >
            {L10n.text(locale, 'save')}
          </button>
        </form>
      </ModalSheet>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={L10n.text(locale, 'deleteAccount')}
        body={L10n.text(locale, 'deleteConfirm')}
        locale={locale}
        onConfirm={() => {
          setDeleteDialogOpen(false);
          deleteAccount(() => onNavigate({ name: 'home' }));
        }}
        onDismiss={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
};
