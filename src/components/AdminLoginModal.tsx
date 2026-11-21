import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { ModalSheet } from './CommonComponents';

export const AdminLoginModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ open, onClose, onSuccess }) => {
  const { state, loginAdminPanel } = useApp();
  const locale = state.locale;

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLogin('');
    setPassword('');
    setShowPassword(false);
    const t = window.setTimeout(() => loginInputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = loginAdminPanel(login, password);
    if (res.ok) {
      setLogin('');
      setPassword('');
      onSuccess();
    } else {
      setError(res.error);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={L10n.text(locale, 'adminLoginTitle')}
      subtitle={L10n.text(locale, 'adminLoginSubtitle')}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} data-testid="admin_login_form" className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--primary-container)]/50 border border-[var(--primary)]/30">
          <BrandLogo size="sm" />
          <p className="text-xs font-semibold text-[var(--on-primary-container)]">
            FVV GIS · {L10n.text(locale, 'adminPanel')}
          </p>
        </div>

        <div>
          <label
            htmlFor="admin-login-username"
            className="block text-xs font-semibold text-[var(--ink-muted)] mb-1"
          >
            {L10n.text(locale, 'adminLoginLabel')}
          </label>
          <input
            id="admin-login-username"
            ref={loginInputRef}
            type="text"
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            data-testid="admin_login_username"
            className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div>
          <label
            htmlFor="admin-login-password"
            className="block text-xs font-semibold text-[var(--ink-muted)] mb-1"
          >
            {L10n.text(locale, 'adminPasswordLabel')}
          </label>
          <div className="relative">
            <input
              id="admin-login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="admin_login_password"
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] pl-3.5 pr-10 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] absolute right-2 top-2 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p data-testid="admin_login_error" className="text-xs font-bold text-[var(--error)]">
            {error}
          </p>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[var(--outline)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-elevated)] cursor-pointer"
          >
            {L10n.text(locale, 'cancel')}
          </button>
          <button
            type="submit"
            data-testid="admin_login_submit"
            className="flex-[1.3] h-11 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 hover:opacity-95 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>{L10n.text(locale, 'login')}</span>
          </button>
        </div>
      </form>
    </ModalSheet>
  );
};
