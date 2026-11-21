import React from 'react';
import { Crosshair, FileText, Navigation } from 'lucide-react';
import { AppLocale, GisRegistryItem } from '../types/gis';
import { L10n } from '../core/localization';
import {
  CategoryIcon,
  DataRowView,
  ModalSheet,
  StatusPill,
  SyntheticBadge,
} from './CommonComponents';

interface RegistryMarkerDetailSheetProps {
  marker: GisRegistryItem | null;
  locale: AppLocale;
  isEmployee: boolean;
  onDismiss: () => void;
  onCenterOnMarker: (marker: GisRegistryItem) => void;
  onFindRoute: (marker: GisRegistryItem) => void;
  onOpenPassport: (objectId: string) => void;
}

export const RegistryMarkerDetailSheet: React.FC<RegistryMarkerDetailSheetProps> = ({
  marker,
  locale,
  isEmployee,
  onDismiss,
  onCenterOnMarker,
  onFindRoute,
  onOpenPassport,
}) => {
  if (!marker) return null;

  const geometryLabel =
    marker.geometryType === 'POINT'
      ? L10n.text(locale, 'point')
      : marker.geometryType === 'LINE'
      ? L10n.text(locale, 'line')
      : L10n.text(locale, 'polygon');

  return (
    <ModalSheet open={true} onClose={onDismiss}>
      <div data-testid="registry_marker_detail_sheet" className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-container)] text-[var(--on-primary-container)] flex items-center justify-center shrink-0">
            <CategoryIcon categoryId={marker.categoryId} className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-[var(--primary)]">{marker.code}</p>
            <h3 className="font-display text-lg font-extrabold text-[var(--ink)] leading-snug">
              {marker.name}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={marker.operationalStatus} locale={locale} />
          {isEmployee && <StatusPill value={marker.lifecycle} locale={locale} />}
          {marker.isSynthetic && <SyntheticBadge locale={locale} />}
        </div>

        {marker.description.trim().length > 0 && (
          <p className="text-sm text-[var(--ink-muted)]">{marker.description}</p>
        )}

        <div className="rounded-2xl bg-[var(--surface-elevated)]/65 border border-[var(--outline)]/40 px-4 py-2 divide-y divide-[var(--outline)]/35">
          <DataRowView label={L10n.text(locale, 'itemType')} value={marker.categoryName} />
          <DataRowView label={L10n.text(locale, 'region')} value={marker.regionName} />
          <DataRowView label={L10n.text(locale, 'geometry')} value={geometryLabel} />
          <DataRowView
            label={L10n.text(locale, 'coordinates')}
            value={`${marker.markerCoordinate.lat.toFixed(5)}° N, ${marker.markerCoordinate.lon.toFixed(5)}° E`}
            mono
          />
          {marker.accuracyM !== null && (
            <DataRowView
              label={L10n.text(locale, 'accuracy')}
              value={`±${marker.accuracyM.toFixed(1)} m`}
              mono
            />
          )}
          <DataRowView label={L10n.text(locale, 'updated')} value={marker.updatedAt} mono />
        </div>

        <button
          type="button"
          onClick={() => onFindRoute(marker)}
          data-testid="marker_sheet_route_button"
          className="w-full h-12 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
        >
          <Navigation className="w-4 h-4" />
          <span>{L10n.text(locale, 'shortestRoute')}</span>
        </button>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => onCenterOnMarker(marker)}
            data-testid="marker_sheet_center_button"
            className="flex-1 h-12 rounded-xl border border-[var(--outline)] text-[var(--ink)] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[var(--surface-elevated)] cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
            <span className="truncate">{L10n.text(locale, 'centerOnMap')}</span>
          </button>

          {isEmployee && (
            <button
              type="button"
              onClick={() => onOpenPassport(marker.id)}
              data-testid="map_open_passport_button"
              className="flex-1 h-12 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span className="truncate">{L10n.text(locale, 'technicalPassport')}</span>
            </button>
          )}
        </div>
      </div>
    </ModalSheet>
  );
};
