import React, { useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  KeyRound,
  LogIn,
  Map as MapIcon,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { localizedRegionName } from '../core/geoUtils';
import { L10n } from '../core/localization';
import { SeedData } from '../data/seedData';
import { useApp } from '../context/AppContext';
import { AppRoute, isAccountEmployee } from '../types/gis';
import { BrandLogo } from '../components/BrandLogo';
import { SectionCard } from '../components/CommonComponents';

const PHONE_REGEX = /^\+998\d{9}$/;

export const AuthScreen: React.FC<{
  onAuthenticated: (nextRoute: AppRoute) => void;
  onOpenPublicMap: () => void;
}> = ({ onAuthenticated, onOpenPublicMap }) => {
  const {
    state,
    regions,
    requestLoginOtp,
    requestRegisterOtp,
    verifyOtp,
    cancelAuthChallenge,
  } = useApp();
  const locale = state.locale;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('+998900000011');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [isEmployeeApp, setIsEmployeeApp] = useState(false);
  const [organizationId, setOrganizationId] = useState(SeedData.demoOrganizations[0].id);
  const [regionId, setRegionId] = useState(regions[0]?.id ?? 'UZ-TK');
  const [department, setDepartment] = useState('');
  const [verificationRef, setVerificationRef] = useState('');
  const [otpCode, setOtpCode] = useState('123456');
  const [localError, setLocalError] = useState<string | null>(null);

  const challenge = state.authChallenge;

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanPhone = phone.trim();
    if (!PHONE_REGEX.test(cleanPhone)) {
      setLocalError(
        L10n.pick(
          locale,
          'Telefon raqami +998XXXXXXXXX formatida bo‘lishi kerak.',
          'Телефон должен быть в формате +998XXXXXXXXX.',
          'Phone number must match +998XXXXXXXXX.'
        )
      );
      return;
    }

    if (mode === 'login') {
      requestLoginOtp(cleanPhone);
      return;
    }

    if (fullName.trim().length < 2) {
      setLocalError(
        L10n.pick(
          locale,
          'To‘liq ism kamida 2 ta belgidan iborat bo‘lishi kerak.',
          'Полное имя должно содержать минимум 2 символа.',
          'Full name must be at least 2 characters.'
        )
      );
      return;
    }

    const hasLetter = /[A-Za-zА-Яа-яЁё]/.test(password);
    const hasDigit = /\d/.test(password);
    if (password.length < 8 || !hasLetter || !hasDigit) {
      setLocalError(L10n.text(locale, 'password_rules'));
      return;
    }

    requestRegisterOtp({
      phone: cleanPhone,
      fullName: fullName.trim(),
      isEmployeeApplication: isEmployeeApp,
      organizationId: isEmployeeApp ? organizationId : null,
      regionId: isEmployeeApp ? regionId : null,
      department: isEmployeeApp ? department.trim() : null,
      verificationReference: isEmployeeApp ? verificationRef.trim() : null,
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setLocalError(
        L10n.pick(
          locale,
          '6 xonali tasdiqlash kodini kiriting.',
          'Введите 6-значный код подтверждения.',
          'Enter the 6-digit verification code.'
        )
      );
      return;
    }
    verifyOtp(otpCode.trim(), (acc) => {
      onAuthenticated(isAccountEmployee(acc) ? { name: 'registry' } : { name: 'home' });
    });
  };

  if (challenge) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-col items-center text-center gap-2 pt-1">
          <BrandLogo size="lg" />
          <p className="font-display text-lg font-extrabold text-[var(--ink)]">FVV GIS</p>
        </div>
        <SectionCard>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  {L10n.text(locale, 'verify')}
                </h2>
                <p className="text-xs font-mono text-[var(--ink-muted)]">{challenge.phone}</p>
              </div>
            </div>

            <div className="rounded-xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] px-3.5 py-2.5 text-xs font-bold flex items-center justify-between">
              <span>{L10n.pick(locale, 'Demo OTP kodi', 'Демо OTP-код', 'Demo OTP code')}</span>
              <span className="font-mono text-sm tracking-widest" data-testid="auth_demo_otp_badge">
                {challenge.devOtp}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                {L10n.text(locale, 'code')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                data-testid="auth_otp_input"
                className="w-full h-12 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-4 text-base font-mono tracking-[0.25em] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            {(localError || state.authError) && (
              <p className="text-xs font-semibold text-[var(--error)]">{localError ?? state.authError}</p>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  cancelAuthChallenge();
                }}
                className="h-12 px-4 rounded-xl border border-[var(--outline)] text-sm font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{L10n.text(locale, 'cancel')}</span>
              </button>
              <button
                type="submit"
                disabled={state.authBusy}
                data-testid="auth_verify_otp_button"
                className="flex-1 h-12 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
              >
                <BadgeCheck className="w-4 h-4" />
                <span>{L10n.text(locale, 'verify')}</span>
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-col items-center text-center gap-2 pt-1">
        <BrandLogo size="xl" />
        <div>
          <h1 className="font-display text-xl font-extrabold text-[var(--ink)]">FVV GIS</h1>
          <p className="text-xs text-[var(--ink-muted)]">{L10n.text(locale, 'publicMap')}</p>
        </div>
      </div>

      <div className="flex rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/50 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setLocalError(null);
          }}
          data-testid="auth_mode_login"
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            mode === 'login'
              ? 'bg-[var(--primary)] text-[var(--on-primary)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <LogIn className="w-4 h-4" />
          <span>{L10n.text(locale, 'login')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setLocalError(null);
          }}
          data-testid="auth_mode_register"
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            mode === 'register'
              ? 'bg-[var(--primary)] text-[var(--on-primary)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>{L10n.text(locale, 'register')}</span>
        </button>
      </div>

      {/* Quick Demo Accounts */}
      {mode === 'login' && (
        <SectionCard
          title={L10n.pick(locale, 'Tezkor demo hisoblar', 'Быстрый вход (Демо)', 'Quick demo accounts')}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPhone('+998900000001')}
              data-testid="demo_phone_citizen"
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                phone === '+998900000001'
                  ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)]'
                  : 'bg-[var(--surface-elevated)]/60 text-[var(--ink)] border-[var(--outline)]/50'
              }`}
            >
              {L10n.text(locale, 'citizen')} · 0001
            </button>
            <button
              type="button"
              onClick={() => setPhone('+998900000011')}
              data-testid="demo_phone_employee"
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                phone === '+998900000011'
                  ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)]'
                  : 'bg-[var(--surface-elevated)]/60 text-[var(--ink)] border-[var(--outline)]/50'
              }`}
            >
              Inspector · 0011
            </button>
            <button
              type="button"
              onClick={() => setPhone('+998900000031')}
              data-testid="demo_phone_supervisor"
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                phone === '+998900000031'
                  ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)]'
                  : 'bg-[var(--surface-elevated)]/60 text-[var(--ink)] border-[var(--outline)]/50'
              }`}
            >
              Supervisor · 0031
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <form onSubmit={handleRequestOtp} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'phone')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998901234567"
              data-testid="auth_phone_input"
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                  {L10n.text(locale, 'name')}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  data-testid="auth_fullname_input"
                  className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                  {L10n.text(locale, 'password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={L10n.text(locale, 'password_rules')}
                  data-testid="auth_password_input"
                  className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="pt-1">
                <p className="text-xs font-semibold text-[var(--ink-muted)] mb-2">
                  {L10n.pick(locale, 'Hisob turi', 'Тип аккаунта', 'Account type')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEmployeeApp(false)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      !isEmployeeApp
                        ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)]'
                        : 'bg-[var(--surface-elevated)]/40 text-[var(--ink)] border-[var(--outline)]/50'
                    }`}
                  >
                    {L10n.text(locale, 'citizen')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEmployeeApp(true)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1 ${
                      isEmployeeApp
                        ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)]'
                        : 'bg-[var(--surface-elevated)]/40 text-[var(--ink)] border-[var(--outline)]/50'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="truncate">{L10n.text(locale, 'employee')}</span>
                  </button>
                </div>
              </div>

              {isEmployeeApp && (
                <div className="space-y-3 pt-1 border-t border-[var(--outline)]/35">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                      {L10n.text(locale, 'organization')}
                    </label>
                    <select
                      value={organizationId}
                      onChange={(e) => setOrganizationId(e.target.value)}
                      className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
                    >
                      {SeedData.demoOrganizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                      {L10n.text(locale, 'region')}
                    </label>
                    <select
                      value={regionId}
                      onChange={(e) => setRegionId(e.target.value)}
                      className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
                    >
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {localizedRegionName(r, locale)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                      {L10n.text(locale, 'department')}
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                      {L10n.text(locale, 'reference')}
                    </label>
                    <input
                      type="text"
                      value={verificationRef}
                      onChange={(e) => setVerificationRef(e.target.value)}
                      className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {(localError || state.authError) && (
            <p className="text-xs font-semibold text-[var(--error)]">{localError ?? state.authError}</p>
          )}

          <button
            type="submit"
            disabled={state.authBusy}
            data-testid="auth_continue_button"
            className="w-full h-12 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold hover:opacity-95 cursor-pointer"
          >
            {L10n.text(locale, 'continue')}
          </button>
        </form>
      </SectionCard>

      <button
        type="button"
        onClick={onOpenPublicMap}
        data-testid="auth_public_map_button"
        className="w-full h-12 rounded-xl border border-[var(--outline)] bg-[var(--surface)] text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 hover:bg-[var(--surface-elevated)] cursor-pointer"
      >
        <MapIcon className="w-4 h-4 text-[var(--primary)]" />
        <span>{L10n.text(locale, 'publicMap')}</span>
      </button>

      <p className="text-center text-xs text-[var(--ink-muted)]">
        {L10n.text(locale, 'independent')}
      </p>
    </div>
  );
};
