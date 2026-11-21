import React, { useMemo } from 'react';
import {
  CloudDownload,
  Crop,
  Crosshair,
  Download,
  Globe,
  Pause,
  Play,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { AppLocale, GeoBounds, MapViewport, RegionEntity } from '../types/gis';
import { localizedRegionName } from '../core/geoUtils';
import { L10n } from '../core/localization';
import {
  OfflineAreaRecord,
  OfflineTileEstimator,
  TILE_DETAIL_PRESETS,
  TileDetailPreset,
} from '../core/offlineMapManager';
import { ModalSheet } from './CommonComponents';

export type DownloadAreaMode = 'CURRENT_VIEW' | 'REGION';

interface DownloadAreaSheetProps {
  locale: AppLocale;
  regions: RegionEntity[];
  currentViewport: MapViewport;
  savedAreas: OfflineAreaRecord[];
  creatingDownload: boolean;
  selectedAreaMode: DownloadAreaMode;
  selectedRegionId: string | null;
  selectedPreset: TileDetailPreset;
  previewBounds: GeoBounds;
  onSelectMode: (mode: DownloadAreaMode) => void;
  onSelectRegion: (regionId: string) => void;
  onSelectPreset: (preset: TileDetailPreset) => void;
  onStartDownload: (areaName: string) => void;
  onTogglePauseResume: (areaId: number) => void;
  onJumpToArea: (area: OfflineAreaRecord) => void;
  onDeleteArea: (areaId: number) => void;
  onDismiss: () => void;
}

export const DownloadAreaSheet: React.FC<DownloadAreaSheetProps> = ({
  locale,
  regions,
  currentViewport,
  savedAreas,
  creatingDownload,
  selectedAreaMode,
  selectedRegionId,
  selectedPreset,
  previewBounds,
  onSelectMode,
  onSelectRegion,
  onSelectPreset,
  onStartDownload,
  onTogglePauseResume,
  onJumpToArea,
  onDeleteArea,
  onDismiss,
}) => {
  const selectedRegion = useMemo(
    () => regions.find((r) => r.id === selectedRegionId) ?? regions[0] ?? null,
    [regions, selectedRegionId]
  );

  const estimatedTiles = useMemo(
    () =>
      OfflineTileEstimator.estimateTileCount(
        previewBounds,
        selectedPreset.minZoom,
        selectedPreset.maxZoom
      ),
    [previewBounds, selectedPreset]
  );

  const estimatedBytes = useMemo(
    () => OfflineTileEstimator.estimateBytes(estimatedTiles),
    [estimatedTiles]
  );

  const proposedAreaName = useMemo(() => {
    if (selectedAreaMode === 'REGION' && selectedRegion) {
      return localizedRegionName(selectedRegion, locale);
    }
    return `${L10n.text(locale, 'currentMapView')} (${currentViewport.centerLat.toFixed(2)}°, ${currentViewport.centerLon.toFixed(2)}°)`;
  }, [selectedAreaMode, selectedRegion, currentViewport, locale]);

  return (
    <ModalSheet
      open={true}
      onClose={onDismiss}
      title={L10n.text(locale, 'downloadArea')}
      subtitle={L10n.text(locale, 'offlineMaps')}
    >
      <div data-testid="download_area_sheet" className="space-y-4">
        <p className="text-sm text-[var(--ink-muted)]">{L10n.text(locale, 'offlineAreaHint')}</p>

        {/* Area selection mode */}
        <div>
          <p className="text-xs font-bold text-[var(--ink)] mb-2">
            {L10n.text(locale, 'areaSelectionMode')}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onSelectMode('CURRENT_VIEW')}
              data-testid="download_mode_current_view"
              className={`h-11 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedAreaMode === 'CURRENT_VIEW'
                  ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)]'
                  : 'bg-[var(--surface-elevated)]/50 text-[var(--ink)] border-[var(--outline)]/50'
              }`}
            >
              <Crop className="w-4 h-4 shrink-0" />
              <span className="truncate">{L10n.text(locale, 'currentMapView')}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectMode('REGION')}
              data-testid="download_mode_region"
              className={`h-11 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedAreaMode === 'REGION'
                  ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)]'
                  : 'bg-[var(--surface-elevated)]/50 text-[var(--ink)] border-[var(--outline)]/50'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span className="truncate">{L10n.text(locale, 'selectUzbekistanRegion')}</span>
            </button>
          </div>
        </div>

        {/* Region chips */}
        {selectedAreaMode === 'REGION' && regions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {regions.map((reg) => {
              const active = selectedRegion?.id === reg.id;
              return (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => onSelectRegion(reg.id)}
                  data-testid={`download_region_chip_${reg.id}`}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                      : 'bg-[var(--surface-elevated)]/55 text-[var(--ink)] border-[var(--outline)]/50'
                  }`}
                >
                  {localizedRegionName(reg, locale)}
                </button>
              );
            })}
          </div>
        )}

        {/* Tile detail level */}
        <div>
          <p className="text-xs font-bold text-[var(--ink)] mb-2">
            {L10n.text(locale, 'tileDetailLevel')}
          </p>
          <div className="flex flex-wrap gap-2">
            {TILE_DETAIL_PRESETS.map((preset) => {
              const active = preset.id === selectedPreset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  data-testid={`download_preset_${preset.id.toLowerCase()}`}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    active
                      ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)] font-bold'
                      : 'bg-[var(--surface-elevated)]/55 text-[var(--ink)] border-[var(--outline)]/50'
                  }`}
                >
                  {L10n.text(locale, preset.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Estimate card */}
        <div className="rounded-2xl bg-[var(--surface-elevated)]/60 border border-[var(--outline)]/50 p-3.5 space-y-2">
          <p className="text-sm font-extrabold text-[var(--ink)]">{proposedAreaName}</p>
          <p className="text-xs font-mono text-[var(--ink-muted)] tabular-nums">
            {previewBounds.southLat.toFixed(3)}°..{previewBounds.northLat.toFixed(3)}° N ·{' '}
            {previewBounds.westLon.toFixed(3)}°..{previewBounds.eastLon.toFixed(3)}° E
          </p>
          <div className="h-px bg-[var(--outline)]/40" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[var(--ink-muted)]">
                {L10n.text(locale, 'estimatedTiles')}
              </p>
              <p className="text-sm font-bold text-[var(--ink)] tabular-nums">
                {estimatedTiles} {L10n.text(locale, 'tilesLabel')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-[var(--ink-muted)]">
                {L10n.text(locale, 'estimatedSize')}
              </p>
              <p className="text-sm font-bold text-[var(--primary)] tabular-nums">
                {OfflineTileEstimator.formatBytes(estimatedBytes)}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={creatingDownload}
          onClick={() => onStartDownload(proposedAreaName)}
          data-testid="download_area_start_button"
          className="w-full h-12 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          <span>
            {L10n.text(locale, creatingDownload ? 'downloadingTiles' : 'downloadNow')}
          </span>
        </button>

        <div className="h-px bg-[var(--outline)]/40" />

        {/* Saved areas */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-[var(--ink)]">
            {L10n.text(locale, 'savedOfflineAreas')}
          </h4>
          <span className="text-sm font-extrabold text-[var(--primary)] tabular-nums">
            {savedAreas.length}
          </span>
        </div>

        {savedAreas.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-elevated)]/40 p-3.5 flex items-center gap-2.5 text-[var(--ink-muted)]">
            <CloudDownload className="w-5 h-5 shrink-0" />
            <p className="text-xs">{L10n.text(locale, 'noSavedOfflineAreas')}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {savedAreas.map((area) => {
              const denom = Math.max(1, area.requiredResources);
              const frac = area.isComplete ? 1 : Math.min(1, area.completedResources / denom);
              const pct = Math.round(frac * 100);
              return (
                <div
                  key={area.id}
                  data-testid={`offline_area_card_${area.id}`}
                  className="rounded-2xl bg-[var(--surface-elevated)]/50 border border-[var(--outline)]/45 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[var(--ink)] truncate">
                        {area.name}
                      </p>
                      <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                        Z{Math.round(area.minZoom)}–Z{Math.round(area.maxZoom)} ·{' '}
                        {OfflineTileEstimator.formatBytes(area.completedBytes)} ·{' '}
                        {area.completedResources}/
                        {Math.max(area.requiredResources, area.completedResources)}{' '}
                        {L10n.text(locale, 'tilesLabel')}
                      </p>
                    </div>
                    {area.isComplete ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--secondary-container)] text-[var(--on-secondary-container)] text-[11px] font-bold shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {L10n.text(locale, 'offlineReadyBadge')}
                      </span>
                    ) : (
                      <span className="text-xs font-extrabold text-[var(--primary)] tabular-nums">
                        {pct}%
                      </span>
                    )}
                  </div>

                  {(!area.isComplete || area.isActive) && (
                    <div className="w-full h-1.5 rounded-full bg-[var(--outline)]/40 overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {!area.isComplete && (
                      <button
                        type="button"
                        onClick={() => onTogglePauseResume(area.id)}
                        data-testid={`offline_area_toggle_${area.id}`}
                        className="px-3 h-10 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {area.isActive ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {L10n.text(locale, area.isActive ? 'pauseDownload' : 'resumeDownload')}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onJumpToArea(area)}
                      data-testid={`offline_area_jump_${area.id}`}
                      className="flex-1 h-10 rounded-xl border border-[var(--outline)] text-xs font-semibold text-[var(--ink)] inline-flex items-center justify-center gap-1.5 hover:bg-[var(--surface-elevated)] cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>{L10n.text(locale, 'jumpToArea')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteArea(area.id)}
                      aria-label={L10n.text(locale, 'deleteArea')}
                      data-testid={`offline_area_delete_${area.id}`}
                      className="p-2.5 rounded-xl text-[var(--error)] hover:bg-[var(--error-container)]/50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalSheet>
  );
};
