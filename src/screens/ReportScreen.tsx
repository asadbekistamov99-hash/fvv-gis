import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  LocateFixed,
  Send,
  Trash2,
} from 'lucide-react';
import { localizedRegionName } from '../core/geoUtils';
import { requestBrowserGpsFix } from '../core/locationHelper';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute, GeoPoint } from '../types/gis';
import {
  EmptyPanel,
  SectionCard,
  StatusPill,
  SyntheticBadge,
} from '../components/CommonComponents';

const REPORT_CATEGORIES = [
  { id: 'infrastructure_fault', uz: 'Infratuzilma nosozligi', ru: 'Неисправность объекта', en: 'Infrastructure fault' },
  { id: 'fire', uz: 'Yong‘in xavfi', ru: 'Пожарная опасность', en: 'Fire hazard' },
  { id: 'flood', uz: 'Suv toshqini / Sizib chiqish', ru: 'Подтопление / Утечка', en: 'Flood / Leak' },
  { id: 'gas_leak', uz: 'Gaz hidi / Quvur', ru: 'Запах газа / Трубопровод', en: 'Gas leak / Pipeline' },
  { id: 'other', uz: 'Boshqa', ru: 'Другое', en: 'Other' },
];

export const ReportScreen: React.FC<{ onSubmitted: () => void }> = ({ onSubmitted }) => {
  const { state, regions, submitCitizenReport, showMessage } = useApp();
  const locale = state.locale;

  const [category, setCategory] = useState(REPORT_CATEGORIES[0].id);
  const [regionId, setRegionId] = useState(regions[0]?.id ?? 'UZ-TK');
  const [description, setDescription] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<GeoPoint | null>(null);
  const [photos, setPhotos] = useState<{ name: string; dataUrl: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleToggleGps = async (checked: boolean) => {
    setIncludeLocation(checked);
    if (checked && !gpsLocation) {
      const fix = await requestBrowserGpsFix();
      setGpsLocation(fix.point);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotos((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = description.trim();
    if (trimmed.length < 10) {
      setError(
        L10n.pick(
          locale,
          'Tavsif kamida 10 ta belgidan iborat bo‘lishi kerak.',
          'Описание должно содержать не менее 10 символов.',
          'Description must be at least 10 characters.'
        )
      );
      return;
    }
    if (trimmed.length > 4000) {
      setError('Max 4000 characters');
      return;
    }

    submitCitizenReport(
      category,
      trimmed,
      regionId,
      includeLocation ? gpsLocation : null,
      photos.length,
      (rep) => {
        showMessage(
          rep.status === 'queued_offline'
            ? L10n.text(locale, 'emergencyQueuedMsg')
            : `${L10n.text(locale, 'received')} · ${rep.id}`
        );
        onSubmitted();
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="rounded-2xl bg-[var(--error-container)]/75 border border-[var(--error)]/50 p-3.5 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-[var(--error)] shrink-0" />
        <p className="text-xs font-semibold text-[var(--on-error-container)]">
          {L10n.text(locale, 'nonEmergency')} · {L10n.text(locale, 'emergencyNotice')}
        </p>
      </div>

      <SectionCard title={L10n.text(locale, 'newReport')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
            >
              {REPORT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {L10n.pick(locale, c.uz, c.ru, c.en)}
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
              {L10n.text(locale, 'description')}
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="report_description_input"
              className="w-full rounded-xl border border-[var(--outline)] bg-[var(--bg)] p-3 text-sm text-[var(--ink)]"
            />
          </div>

          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-elevated)]/55 border border-[var(--outline)]/40 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <LocateFixed className="w-4 h-4 text-[var(--primary)]" />
              <div>
                <p className="text-xs font-bold text-[var(--ink)]">
                  {L10n.text(locale, 'includeLocation')}
                </p>
                {gpsLocation && (
                  <p className="text-[11px] font-mono text-[var(--ink-muted)]">
                    {gpsLocation.lat.toFixed(5)}°, {gpsLocation.lon.toFixed(5)}°
                  </p>
                )}
              </div>
            </div>
            <input
              type="checkbox"
              checked={includeLocation}
              onChange={(e) => void handleToggleGps(e.target.checked)}
              className="w-4 h-4 accent-[var(--primary)]"
            />
          </label>

          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-xs font-bold cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              <span>{L10n.text(locale, 'addPhoto')}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </label>

            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pt-3">
                {photos.map((p, idx) => (
                  <div key={`${p.name}-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[var(--outline)]">
                    <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/65 text-white cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {state.isEffectiveOffline && (
            <div className="rounded-xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] px-3 py-2 text-xs font-semibold">
              {L10n.text(locale, 'emergencyOfflineSheetHint')}
            </div>
          )}

          {error && <p className="text-xs font-semibold text-[var(--error)]">{error}</p>}

          <button
            type="submit"
            data-testid="report_submit_button"
            className="w-full h-12 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{L10n.text(locale, 'send')}</span>
          </button>
        </form>
      </SectionCard>
    </div>
  );
};

export const MyReportsScreen: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { state, myReports } = useApp();
  const locale = state.locale;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
          {L10n.text(locale, 'reports')}
        </h2>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'report' })}
          className="px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold cursor-pointer"
        >
          + {L10n.text(locale, 'newReport')}
        </button>
      </div>

      {myReports.length === 0 ? (
        <EmptyPanel locale={locale} />
      ) : (
        <div className="space-y-3">
          {myReports.map((rep) => (
            <SectionCard key={rep.id}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[var(--primary)]">{rep.id}</span>
                  <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                    {rep.createdAt.slice(0, 10)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--ink)]">{rep.description}</p>
                {rep.resolution && (
                  <p className="text-xs text-[var(--secondary)] flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{rep.resolution}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusPill value={rep.status} locale={locale} />
                  {rep.isSynthetic && <SyntheticBadge locale={locale} />}
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
};
