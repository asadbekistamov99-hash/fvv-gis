import React from 'react';
import {
  AlertTriangle,
  ExternalLink,
  ListChecks,
  Map as MapIcon,
  Phone,
  Send,
} from 'lucide-react';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types/gis';
import { BrandLogo } from '../components/BrandLogo';
import { SectionCard, triggerPhoneCall } from '../components/CommonComponents';

const EMERGENCY_NUMBERS = [
  { num: '112', labelUz: 'Yagona favqulodda xizmat', labelRu: 'Единая служба спасения', labelEn: 'Unified emergency' },
  { num: '101', labelUz: 'Yong‘in xavfsizligi', labelRu: 'Пожарная служба', labelEn: 'Fire & rescue' },
  { num: '102', labelUz: 'Ichki ishlar (Militsiya)', labelRu: 'Органы внутренних дел', labelEn: 'Police' },
  { num: '103', labelUz: 'Tez tibbiy yordam', labelRu: 'Скорая помощь', labelEn: 'Ambulance' },
  { num: '104', labelUz: 'Gaz xizmati', labelRu: 'Аварийная газовая служба', labelEn: 'Gas emergency' },
];

export const HomeScreen: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { state, showMessage } = useApp();
  const locale = state.locale;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Hero Banner */}
      <div className="relative h-56 sm:h-64 rounded-3xl overflow-hidden border border-[var(--outline)]/50 shadow-lg">
        <img
          src="/images/img_gis_hero.jpg"
          alt="FVV GIS Uzbekistan"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,19,32,0.22) 0%, rgba(8,19,32,0.58) 55%, rgba(8,19,32,0.92) 100%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <BrandLogo size="lg" className="shadow-xl ring-2 ring-white/25" />
            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-[0.14em] text-[#4FD8EB] uppercase">
                UZBEKISTAN · GIS REGISTRY
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white truncate mt-0.5">
                {state.account ? state.account.fullName : 'FVV GIS'}
              </h1>
              <p className="text-xs text-slate-300 mt-1">{L10n.text(locale, 'independent')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'map' })}
            data-testid="home_public_map_button"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4FD8EB] text-[#00363E] text-xs font-extrabold hover:opacity-95 cursor-pointer shadow-md"
          >
            <MapIcon className="w-4 h-4" />
            <span>{L10n.text(locale, 'publicMap')}</span>
          </button>
        </div>
      </div>

      {/* Urgent 112 Notice */}
      <div className="rounded-2xl bg-[var(--error-container)]/75 border border-[var(--error)]/55 p-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle className="w-5 h-5 text-[var(--error)] shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-semibold text-[var(--on-error-container)] leading-relaxed">
            {L10n.text(locale, 'emergencyNotice')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => triggerPhoneCall('112', showMessage)}
          data-testid="home_call_112_button"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--error)] text-white text-xs font-extrabold cursor-pointer hover:opacity-95"
        >
          <Phone className="w-4 h-4" />
          <span>112</span>
        </button>
      </div>

      {/* Primary Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigate(state.account ? { name: 'report' } : { name: 'auth' })}
          data-testid="home_send_report_button"
          className="h-14 rounded-2xl bg-[var(--primary)] text-[var(--on-primary)] font-bold text-sm flex items-center justify-center gap-2.5 hover:opacity-95 cursor-pointer shadow-sm"
        >
          <Send className="w-4 h-4" />
          <span>{L10n.text(locale, 'newReport')}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate(state.account ? { name: 'myReports' } : { name: 'auth' })}
          data-testid="home_my_reports_button"
          className="h-14 rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/70 text-[var(--ink)] font-bold text-sm flex items-center justify-center gap-2.5 hover:bg-[var(--surface-elevated)] cursor-pointer"
        >
          <ListChecks className="w-4 h-4 text-[var(--primary)]" />
          <span>{L10n.text(locale, 'reports')}</span>
        </button>
      </div>

      {/* Emergency Contacts Directory */}
      <SectionCard title={L10n.pick(locale, 'Favqulodda aloqa raqamlari', 'Экстренные номера', 'Emergency contacts')}>
        <div className="divide-y divide-[var(--outline)]/35">
          {EMERGENCY_NUMBERS.map((item) => (
            <div
              key={item.num}
              className="py-2.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--ink)]">
                  {L10n.pick(locale, item.labelUz, item.labelRu, item.labelEn)}
                </p>
                <p className="text-xs font-mono text-[var(--ink-muted)] tabular-nums">{item.num}</p>
              </div>
              <button
                type="button"
                onClick={() => triggerPhoneCall(item.num, showMessage)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-xs font-extrabold cursor-pointer hover:opacity-90"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{item.num}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="pt-3 mt-2 border-t border-[var(--outline)]/35 flex items-center justify-between text-xs text-[var(--ink-muted)]">
          <span>
            {L10n.pick(
              locale,
              'Rasmiy normativ manba (Adliya)',
              'Официальный нормативный источник',
              'Regulatory directory source'
            )}
          </span>
          <a
            href="https://advice.adliya.uz/oz/document/3256"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-[var(--primary)] hover:underline"
          >
            <span>advice.adliya.uz</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </SectionCard>
    </div>
  );
};
