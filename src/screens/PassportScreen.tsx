import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  FileText,
  Navigation,
  Paperclip,
  Send,
  XCircle,
} from 'lucide-react';
import { GeoUtils, localizedCategoryName, localizedRegionName, representativePoint } from '../core/geoUtils';
import { requestBrowserGpsFix } from '../core/locationHelper';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute, canAccountReviewOrPublish } from '../types/gis';
import {
  ConfirmDialog,
  DataRowView,
  EmptyPanel,
  ModalSheet,
  SectionCard,
  StatusPill,
  SyntheticBadge,
} from '../components/CommonComponents';

const PASSPORT_LABEL_KEYS: Record<string, { uz: string; ru: string; en: string }> = {
  measured_pressure_kpa: { uz: 'O‘lchangan bosim (kPa)', ru: 'Давление (кПа)', en: 'Measured pressure (kPa)' },
  flow_lps: { uz: 'Suv sarfi (L/s)', ru: 'Расход воды (л/с)', en: 'Water flow (L/s)' },
  measurement_date: { uz: 'O‘lchov sanasi', ru: 'Дата измерения', en: 'Measurement date' },
  pipe_diameter_mm: { uz: 'Quvur diametri (mm)', ru: 'Диаметр трубы (мм)', en: 'Pipe diameter (mm)' },
  capacity_m3: { uz: 'Sig‘imi (m³)', ru: 'Объём (м³)', en: 'Capacity (m³)' },
  pump_count: { uz: 'Nasoslar soni', ru: 'Число насосов', en: 'Pump count' },
  voltage_kv: { uz: 'Kuchlanish (kV)', ru: 'Напряжение (кВ)', en: 'Voltage (kV)' },
  transformer_mva: { uz: 'Transformator (MVA)', ru: 'Мощность (МВА)', en: 'Capacity (MVA)' },
  owner_org: { uz: 'Balansda saqlovchi', ru: 'Балансодержатель', en: 'Operator / Owner' },
};

export const PassportScreen: React.FC<{
  objectId: string;
  onNavigate: (route: AppRoute) => void;
  onBack: () => void;
}> = ({ objectId, onNavigate, onBack }) => {
  const {
    state,
    regions,
    categories,
    getObjectById,
    getInspectionsForObject,
    getAttachmentsForObject,
    submitObjectForReview,
    reviewObject,
    requestRoute,
    simulateConflict,
    showMessage,
  } = useApp();
  const locale = state.locale;

  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const obj = getObjectById(objectId);
  const inspections = getInspectionsForObject(objectId);
  const attachments = getAttachmentsForObject(objectId);

  const parsedPassport = useMemo(() => {
    if (!obj) return {} as Record<string, unknown>;
    try {
      return JSON.parse(obj.passportJson) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }, [obj]);

  if (!obj) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <EmptyPanel locale={locale} />
      </div>
    );
  }

  const category = categories.find((c) => c.id === obj.categoryId);
  const region = regions.find((r) => r.id === obj.regionId);
  const parsedGeom = GeoUtils.parseGeoJson(obj.geometryJson);
  const coord = parsedGeom ? representativePoint(parsedGeom) : null;
  const isReviewer = canAccountReviewOrPublish(state.account);
  const hasMeasurementDate = Boolean(parsedPassport.measurement_date);
  const canSubmit =
    obj.lifecycle === 'draft' ||
    obj.lifecycle === 'requires_correction' ||
    obj.lifecycle === 'rejected';

  const handleRequestRouteClick = async () => {
    const fix = await requestBrowserGpsFix();
    requestRoute(obj.id, fix.point, (res) => {
      if (res.ok) {
        showMessage(
          L10n.pick(
            locale,
            'Marshrut so‘rovi yaratildi',
            'Запрос маршрута создан',
            'Route request created'
          )
        );
        onNavigate({ name: 'routes' });
      } else {
        showMessage(res.error);
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--outline)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-elevated)] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{L10n.pick(locale, 'Orqaga', 'Назад', 'Back')}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ name: 'objectForm', objectId: obj.id })}
          data-testid="passport_edit_button"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-xs font-bold cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{L10n.text(locale, 'edit')}</span>
        </button>
      </div>

      {/* Header card */}
      <SectionCard>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-[var(--primary)]">{obj.code}</span>
            <span className="text-xs font-mono text-[var(--ink-muted)]">v{obj.version}</span>
          </div>
          <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">{obj.name}</h2>
          {obj.description && <p className="text-sm text-[var(--ink-muted)]">{obj.description}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <StatusPill value={obj.operationalStatus} locale={locale} />
            <StatusPill value={obj.lifecycle} locale={locale} />
            {obj.isSynthetic && <SyntheticBadge locale={locale} />}
          </div>
        </div>
      </SectionCard>

      {/* Measurements & Offline Warning */}
      <SectionCard title={L10n.text(locale, 'technicalPassport')}>
        {!hasMeasurementDate && (
          <div className="mb-3 rounded-xl bg-[var(--tertiary-container)]/75 text-[var(--on-tertiary-container)] px-3 py-2.5 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {L10n.pick(
                locale,
                'O‘lchov sanasi ko‘rsatilmagan — dalada tekshiruv o‘lchovini yangilang.',
                'Дата измерения отсутствует — обновите полевые замеры.',
                'Measurement date missing — record field measurements during inspection.'
              )}
            </span>
          </div>
        )}

        <div className="divide-y divide-[var(--outline)]/35">
          <DataRowView
            label={L10n.text(locale, 'category')}
            value={category ? localizedCategoryName(category, locale) : obj.categoryId}
          />
          <DataRowView
            label={L10n.text(locale, 'region')}
            value={region ? localizedRegionName(region, locale) : obj.regionId}
          />
          {coord && (
            <DataRowView
              label={L10n.text(locale, 'coordinates')}
              value={`${coord.lat.toFixed(5)}° N, ${coord.lon.toFixed(5)}° E`}
              mono
            />
          )}
          {obj.accuracyM !== null && (
            <DataRowView label={L10n.text(locale, 'accuracy')} value={`±${obj.accuracyM} m`} mono />
          )}
          <DataRowView
            label={L10n.text(locale, 'pressure')}
            value={parsedPassport.measured_pressure_kpa !== undefined ? `${parsedPassport.measured_pressure_kpa} kPa` : null}
            mono
          />
          <DataRowView
            label={L10n.text(locale, 'flow')}
            value={parsedPassport.flow_lps !== undefined ? `${parsedPassport.flow_lps} L/s` : null}
            mono
          />
          <DataRowView
            label={L10n.text(locale, 'measurement')}
            value={parsedPassport.measurement_date !== undefined ? String(parsedPassport.measurement_date) : null}
            mono
          />
          {Object.entries(parsedPassport)
            .filter(
              ([k]) =>
                !['schema_version', 'measured_pressure_kpa', 'flow_lps', 'measurement_date'].includes(k)
            )
            .map(([k, v]) => {
              const trans = PASSPORT_LABEL_KEYS[k];
              const label = trans ? L10n.pick(locale, trans.uz, trans.ru, trans.en) : k;
              return <DataRowView key={k} label={label} value={v === null ? null : String(v)} />;
            })}
          <DataRowView label={L10n.text(locale, 'updated')} value={obj.updatedAt} mono />
        </div>
      </SectionCard>

      {/* Attachments */}
      <SectionCard title={`${L10n.text(locale, 'attachments')} (${attachments.length})`}>
        {attachments.length === 0 ? (
          <p className="text-xs text-[var(--ink-muted)]">{L10n.text(locale, 'empty')}</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface-elevated)]/55 border border-[var(--outline)]/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="w-4 h-4 text-[var(--primary)] shrink-0" />
                  <span className="text-xs font-semibold text-[var(--ink)] truncate">
                    {att.filename}
                  </span>
                </div>
                {att.uriString.startsWith('data:image') && (
                  <button
                    type="button"
                    onClick={() => setPreviewUri(att.uriString)}
                    className="text-xs font-bold text-[var(--primary)] cursor-pointer shrink-0"
                  >
                    {L10n.pick(locale, 'Ko‘rish', 'Открыть', 'Preview')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Recent inspections count link */}
      <SectionCard title={`${L10n.text(locale, 'inspections')} (${inspections.length})`}>
        {inspections.length === 0 ? (
          <p className="text-xs text-[var(--ink-muted)]">{L10n.text(locale, 'empty')}</p>
        ) : (
          <div className="space-y-2">
            {inspections.slice(0, 3).map((ins) => (
              <div key={ins.id} className="text-xs border-b last:border-b-0 border-[var(--outline)]/30 pb-2 last:pb-0">
                <div className="flex justify-between font-bold text-[var(--ink)]">
                  <span>{ins.inspectorName}</span>
                  <span className="font-mono text-[var(--ink-muted)]">{ins.createdAt.slice(0, 10)}</span>
                </div>
                <p className="text-[var(--ink-muted)] mt-0.5">{ins.notes}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2.5">
        {canSubmit && (
          <button
            type="button"
            onClick={() => setSubmitConfirmOpen(true)}
            data-testid="passport_submit_review_button"
            className="flex-1 min-w-[200px] h-12 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{L10n.text(locale, 'submit')}</span>
          </button>
        )}

        {isReviewer && obj.lifecycle === 'submitted' && (
          <>
            <button
              type="button"
              onClick={() => reviewObject(obj.id, true)}
              data-testid="passport_approve_publish_button"
              className="flex-1 min-w-[180px] h-12 rounded-xl bg-[#4CAF50] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{L10n.text(locale, 'publish')}</span>
            </button>
            <button
              type="button"
              onClick={() => reviewObject(obj.id, false)}
              data-testid="passport_reject_button"
              className="flex-1 min-w-[160px] h-12 rounded-xl bg-[var(--error)] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>{L10n.text(locale, 'reject')}</span>
            </button>
          </>
        )}

        {obj.lifecycle === 'published' && (
          <button
            type="button"
            onClick={handleRequestRouteClick}
            data-testid="passport_request_route_button"
            className="flex-1 min-w-[190px] h-12 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>{L10n.text(locale, 'requestRoute')}</span>
          </button>
        )}
      </div>

      <div className="pt-1 flex justify-end">
        <button
          type="button"
          onClick={() => {
            simulateConflict(obj.id);
            onNavigate({ name: 'sync' });
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--error)] cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Simulate Sync Conflict (409)</span>
        </button>
      </div>

      <ConfirmDialog
        open={submitConfirmOpen}
        title={L10n.text(locale, 'submit')}
        body={`${obj.code} · ${obj.name}`}
        locale={locale}
        onConfirm={() => {
          submitObjectForReview(obj.id);
          setSubmitConfirmOpen(false);
        }}
        onDismiss={() => setSubmitConfirmOpen(false)}
      />

      <ModalSheet open={Boolean(previewUri)} onClose={() => setPreviewUri(null)} title={L10n.text(locale, 'attachments')}>
        {previewUri && <img src={previewUri} alt="Attachment preview" className="w-full rounded-xl object-contain max-h-[65vh]" />}
      </ModalSheet>
    </div>
  );
};
