import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bolt,
  CloudUpload,
  Droplets,
  Flame,
  Fuel,
  LocateFixed,
  MapPin,
  Phone,
  Send,
} from 'lucide-react';
import { AppLocale, GeoPoint, RegionEntity } from '../types/gis';
import { GeoUtils, localizedRegionName } from '../core/geoUtils';
import { L10n } from '../core/localization';
import { ModalSheet, triggerPhoneCall } from './CommonComponents';

interface EmergencyHazardPreset {
  id: string;
  categoryId: string;
  labelKey: string;
  Icon: React.FC<{ className?: string }>;
}

const HAZARD_PRESETS: EmergencyHazardPreset[] = [
  { id: 'gas', categoryId: 'gas_pipeline', labelKey: 'hazardGasLeak', Icon: Fuel },
  { id: 'elec', categoryId: 'substation', labelKey: 'hazardElectrical', Icon: Bolt },
  { id: 'water', categoryId: 'water_pipeline', labelKey: 'hazardWaterMain', Icon: Droplets },
  { id: 'hydrant', categoryId: 'fire_hydrant', labelKey: 'hazardHydrantFault', Icon: Flame },
  { id: 'general', categoryId: 'other', labelKey: 'hazardGeneral', Icon: AlertTriangle },
];

interface EmergencyReportSheetProps {
  locale: AppLocale;
  pinLocation: GeoPoint;
  currentUserLocation: GeoPoint | null;
  currentAccuracyM: number | null;
  regions: RegionEntity[];
  submitting: boolean;
  isOffline: boolean;
  onRequestCaptureGps: () => void;
  onClearPin: () => void;
  onSubmitIncident: (
    categoryId: string,
    hazardTitle: string,
    notes: string,
    regionId: string
  ) => void;
}

export const EmergencyReportSheet: React.FC<EmergencyReportSheetProps> = ({
  locale,
  pinLocation,
  currentUserLocation,
  currentAccuracyM,
  regions,
  submitting,
  isOffline,
  onRequestCaptureGps,
  onClearPin,
  onSubmitIncident,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<EmergencyHazardPreset>(HAZARD_PRESETS[0]);
  const [notes, setNotes] = useState('');

  const nearestRegion = useMemo(() => {
    if (regions.length === 0) return null;
    return regions.reduce((best, reg) => {
      const dBest = GeoUtils.distanceMeters(pinLocation, { lat: best.centerLat, lon: best.centerLon });
      const dReg = GeoUtils.distanceMeters(pinLocation, { lat: reg.centerLat, lon: reg.centerLon });
      return dReg < dBest ? reg : best;
    }, regions[0]);
  }, [pinLocation, regions]);

  const resolvedRegionId = nearestRegion?.id ?? 'UZ-TK';
  const resolvedRegionName = nearestRegion ? localizedRegionName(nearestRegion, locale) : 'Tashkent';

  return (
    <ModalSheet open={true} onClose={onClearPin}>
      <div data-testid="emergency_report_sheet" className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--error-container)] text-[var(--error)]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
              {L10n.text(locale, 'emergencySheetTitle')}
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">{resolvedRegionName}</p>
          </div>
        </div>

        {/* Critical 112 non-dispatch reminder */}
        <div className="rounded-xl bg-[var(--error-container)]/70 border border-[var(--error)]/45 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--on-error-container)] font-medium flex-1">
            {L10n.text(locale, 'emergencyNotice')}
          </p>
          <button
            type="button"
            onClick={() => triggerPhoneCall('112')}
            data-testid="emergency_sheet_call_112"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--error)] text-white text-xs font-extrabold shrink-0 cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>112</span>
          </button>
        </div>

        {isOffline && (
          <div
            data-testid="emergency_offline_queue_notice"
            className="rounded-xl bg-[var(--tertiary-container)]/80 border border-[var(--tertiary)] p-3 flex items-center gap-2.5"
          >
            <CloudUpload className="w-5 h-5 text-[var(--on-tertiary-container)] shrink-0" />
            <p className="text-xs font-semibold text-[var(--on-tertiary-container)]">
              {L10n.text(locale, 'emergencyOfflineSheetHint')}
            </p>
          </div>
        )}

        {/* Coordinates Card */}
        <div className="rounded-xl bg-[var(--surface-elevated)]/65 border border-[var(--outline)]/50 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-[var(--error)] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[var(--ink-muted)]">
                {L10n.text(locale, 'emergencyPinCoordinates')}
              </p>
              <p
                data-testid="emergency_pin_coords_text"
                className="text-sm font-mono font-bold tabular-nums text-[var(--ink)]"
              >
                {pinLocation.lat.toFixed(5)}° N, {pinLocation.lon.toFixed(5)}° E
              </p>
            </div>
          </div>

          <div className="h-px bg-[var(--outline)]/40" />

          <div className="flex items-center gap-2.5">
            <LocateFixed className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[var(--ink-muted)]">
                {L10n.text(locale, 'emergencyCurrentGps')}
              </p>
              <p
                className={`text-xs ${
                  currentUserLocation
                    ? 'font-mono font-semibold text-[var(--ink)]'
                    : 'text-[var(--ink-muted)]'
                }`}
              >
                {currentUserLocation
                  ? `${currentUserLocation.lat.toFixed(5)}° N, ${currentUserLocation.lon.toFixed(5)}° E${
                      currentAccuracyM !== null ? ` · ±${Math.round(currentAccuracyM)} m` : ''
                    }`
                  : L10n.text(locale, 'emergencyGpsUnavailable')}
              </p>
            </div>
            <button
              type="button"
              onClick={onRequestCaptureGps}
              data-testid="emergency_capture_gps_button"
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-elevated)] cursor-pointer"
            >
              {L10n.text(locale, 'emergencyCaptureGps')}
            </button>
          </div>
        </div>

        {/* Hazard presets */}
        <div>
          <p className="text-sm font-bold text-[var(--ink)] mb-2">
            {L10n.text(locale, 'emergencyHazardType')}
          </p>
          <div className="flex flex-wrap gap-2">
            {HAZARD_PRESETS.map((preset) => {
              const active = preset.id === selectedPreset.id;
              const Icon = preset.Icon;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPreset(preset)}
                  data-testid={`emergency_hazard_chip_${preset.id}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border cursor-pointer transition-colors ${
                    active
                      ? 'bg-[var(--error-container)] text-[var(--on-error-container)] border-[var(--error)] font-bold'
                      : 'bg-[var(--surface-elevated)]/60 text-[var(--ink)] border-[var(--outline)]/50 font-medium'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{L10n.text(locale, preset.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
            {L10n.text(locale, 'description')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={L10n.text(locale, 'emergencyNotesHint')}
            rows={3}
            data-testid="emergency_notes_input"
            className="w-full rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClearPin}
            disabled={submitting}
            data-testid="emergency_clear_pin_button"
            className="flex-1 h-12 rounded-xl border border-[var(--outline)] text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-elevated)] cursor-pointer disabled:opacity-50"
          >
            {L10n.text(locale, 'emergencyClearPin')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              onSubmitIncident(
                selectedPreset.categoryId,
                L10n.text(locale, selectedPreset.labelKey),
                notes,
                resolvedRegionId
              )
            }
            data-testid="emergency_submit_button"
            className="flex-[1.4] h-12 rounded-xl bg-[var(--error)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer disabled:opacity-50"
          >
            {isOffline ? <CloudUpload className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            <span>
              {L10n.text(locale, isOffline ? 'emergencySaveOfflineCta' : 'emergencySubmitCta')}
            </span>
          </button>
        </div>
      </div>
    </ModalSheet>
  );
};
