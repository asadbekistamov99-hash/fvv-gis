import React, { useMemo } from 'react';
import {
  Ban,
  Car,
  Flame,
  HeartPulse,
  LocateFixed,
  Map as MapIcon,
  Route,
  Shield,
} from 'lucide-react';
import { AppLocale, GeoPoint, GisRegistryItem } from '../types/gis';
import {
  ACCESSIBILITY_STATUS_LABEL_KEY,
  EMERGENCY_VEHICLE_PROFILES,
  EmergencyPathResult,
  EmergencyVehicleProfile,
} from '../core/emergencyPathfinder';
import { GeoUtils } from '../core/geoUtils';
import { L10n } from '../core/localization';
import { GisColors } from '../theme/colors';
import { ModalSheet } from './CommonComponents';

function formatDist(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

interface PathfindingSheetProps {
  locale: AppLocale;
  originLocation: GeoPoint | null;
  destinationMarker: GisRegistryItem | null;
  availableMarkers: GisRegistryItem[];
  selectedProfile: EmergencyVehicleProfile;
  avoidFaultyHazards: boolean;
  pathResult: EmergencyPathResult | null;
  onSelectDestination: (marker: GisRegistryItem) => void;
  onSelectProfile: (profile: EmergencyVehicleProfile) => void;
  onToggleAvoidHazards: (v: boolean) => void;
  onRequestGpsFix: () => void;
  onClearRoute: () => void;
  onShowOnMap: () => void;
  onDismiss: () => void;
}

export const PathfindingSheet: React.FC<PathfindingSheetProps> = ({
  locale,
  originLocation,
  destinationMarker,
  availableMarkers,
  selectedProfile,
  avoidFaultyHazards,
  pathResult,
  onSelectDestination,
  onSelectProfile,
  onToggleAvoidHazards,
  onRequestGpsFix,
  onClearRoute,
  onShowOnMap,
  onDismiss,
}) => {
  const sortedMarkers = useMemo(() => {
    const ref = originLocation ?? { lat: 41.2995, lon: 69.2401 };
    return [...availableMarkers].sort(
      (a, b) =>
        GeoUtils.distanceMeters(ref, a.markerCoordinate) -
        GeoUtils.distanceMeters(ref, b.markerCoordinate)
    );
  }, [availableMarkers, originLocation]);

  const statusTone =
    pathResult?.accessibilityStatus === 'FULLY_ACCESSIBLE'
      ? GisColors.StatusWorking
      : pathResult?.accessibilityStatus === 'DETOUR_APPLIED'
      ? GisColors.CyanAccent
      : GisColors.StatusMaintenance;

  return (
    <ModalSheet open={true} onClose={onDismiss}>
      <div data-testid="pathfinding_sheet" className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)]">
            <Route className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
              {L10n.text(locale, 'pathfindingTitle')}
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              {L10n.text(locale, selectedProfile.specsKey)}
            </p>
          </div>
        </div>

        {/* Origin & Destination Card */}
        <div className="rounded-2xl bg-[var(--surface-elevated)]/55 border border-[var(--outline)]/50 p-3.5 space-y-3">
          <div className="flex items-center gap-2.5">
            <LocateFixed className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[var(--ink-muted)]">
                {L10n.text(locale, 'routeOriginGps')}
              </p>
              <p className="text-xs font-mono font-semibold text-[var(--ink)]">
                {originLocation
                  ? `${originLocation.lat.toFixed(5)}° N, ${originLocation.lon.toFixed(5)}° E`
                  : L10n.text(locale, 'emergencyGpsUnavailable')}
              </p>
            </div>
            <button
              type="button"
              onClick={onRequestGpsFix}
              data-testid="pathfinding_capture_gps_button"
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-elevated)] cursor-pointer"
            >
              {L10n.text(locale, 'emergencyCaptureGps')}
            </button>
          </div>

          <div className="h-px bg-[var(--outline)]/40" />

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'routeDestination')}
            </label>
            <select
              value={destinationMarker?.id ?? ''}
              onChange={(e) => {
                const found = sortedMarkers.find((m) => m.id === e.target.value);
                if (found) onSelectDestination(found);
              }}
              data-testid="pathfinding_destination_dropdown"
              className="w-full rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="" disabled>
                {L10n.text(locale, 'selectDestinationMarker')}
              </option>
              {sortedMarkers.slice(0, 25).map((candidate) => {
                const distLabel = originLocation
                  ? ` (${formatDist(GeoUtils.distanceMeters(originLocation, candidate.markerCoordinate))})`
                  : '';
                return (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.code} · {candidate.name}
                    {distLabel}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Vehicle profile selector */}
        <div>
          <p className="text-sm font-bold text-[var(--ink)] mb-2">
            {L10n.text(locale, 'vehicleProfile')}
          </p>
          <div className="flex flex-wrap gap-2">
            {EMERGENCY_VEHICLE_PROFILES.map((profile) => {
              const selected = profile.id === selectedProfile.id;
              const Icon =
                profile.id === 'fire_engine'
                  ? Flame
                  : profile.id === 'rescue_4x4'
                  ? Car
                  : HeartPulse;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onSelectProfile(profile)}
                  data-testid={`pathfinding_vehicle_${profile.id}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] font-bold'
                      : 'bg-[var(--surface-elevated)]/55 text-[var(--ink)] border-[var(--outline)]/50 font-medium'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{L10n.text(locale, profile.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Faulty hazard avoidance */}
        <label
          data-testid="pathfinding_avoid_hazards_toggle"
          className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-elevated)]/45 border border-[var(--outline)]/40 px-3.5 py-2.5 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-sm font-semibold text-[var(--ink)]">
              {L10n.text(locale, 'bypassFaultyHazards')}
            </span>
          </div>
          <input
            type="checkbox"
            checked={avoidFaultyHazards}
            onChange={(e) => onToggleAvoidHazards(e.target.checked)}
            className="w-4 h-4 accent-[var(--primary)] cursor-pointer"
          />
        </label>

        {/* Path summary & segments */}
        {pathResult && (
          <>
            <div
              className="rounded-2xl p-3.5 border space-y-2.5"
              style={{
                backgroundColor: `${statusTone}1f`,
                borderColor: `${statusTone}a6`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p
                    data-testid="pathfinding_summary_metrics"
                    className="font-display text-xl font-extrabold text-[var(--ink)] tabular-nums"
                  >
                    {formatDist(pathResult.totalDistanceMeters)} · {pathResult.estimatedMinutes}{' '}
                    {L10n.text(locale, 'etaMinutes')}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                    {L10n.text(locale, 'roadWidthWeight')}: {pathResult.minRoadWidthMeters.toFixed(1)} m ·{' '}
                    {Math.round(pathResult.minWeightLimitTons)} t
                  </p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-[var(--ink)]"
                  style={{ backgroundColor: `${statusTone}33` }}
                >
                  {L10n.text(locale, ACCESSIBILITY_STATUS_LABEL_KEY[pathResult.accessibilityStatus])}
                </span>
              </div>

              {pathResult.avoidedObstacleKeys.length > 0 && (
                <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
                  <p className="text-xs font-bold text-[var(--ink-muted)]">
                    {L10n.text(locale, 'avoidedObstacles')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pathResult.avoidedObstacleKeys.map((key) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--surface)]/80 border border-[var(--outline)]/50 text-[11px] font-semibold text-[var(--ink)]"
                      >
                        <Ban className="w-3 h-3 text-[var(--error)]" />
                        <span>{L10n.text(locale, key)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-bold text-[var(--ink)] mb-2">
                {L10n.text(locale, 'turnByTurnSteps')}
              </p>
              <div className="space-y-2">
                {pathResult.steps.map((step, idx) => (
                  <div
                    key={`${step.roadName}-${idx}`}
                    className="rounded-xl bg-[var(--surface-elevated)]/40 border border-[var(--outline)]/35 p-3 flex items-center gap-3"
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        step.cautionReasonKey
                          ? 'bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]'
                          : 'bg-[var(--primary-container)] text-[var(--on-primary-container)]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--ink)] truncate">
                        {step.roadName} · {L10n.text(locale, step.roadClass.labelKey)}
                      </p>
                      <p
                        className={`text-[11px] ${
                          step.cautionReasonKey ? 'text-[var(--tertiary)] font-semibold' : 'text-[var(--ink-muted)]'
                        }`}
                      >
                        {step.widthMeters.toFixed(1)} m · {Math.round(step.maxWeightTons)} t
                        {step.cautionReasonKey ? ` · ${L10n.text(locale, step.cautionReasonKey)}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[var(--primary)] tabular-nums shrink-0">
                      {formatDist(step.distanceMeters)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClearRoute}
            data-testid="pathfinding_clear_button"
            className="flex-1 h-12 rounded-xl border border-[var(--outline)] text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-elevated)] cursor-pointer"
          >
            {L10n.text(locale, 'clearRoute')}
          </button>
          <button
            type="button"
            disabled={!pathResult}
            onClick={onShowOnMap}
            data-testid="pathfinding_show_on_map_button"
            className="flex-[1.3] h-12 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer disabled:opacity-45"
          >
            <MapIcon className="w-4 h-4" />
            <span>{L10n.text(locale, 'showOnMap')}</span>
          </button>
        </div>
      </div>
    </ModalSheet>
  );
};
