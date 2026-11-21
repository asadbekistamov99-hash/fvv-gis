import React, { useMemo, useState } from 'react';
import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { STREET_VIEW_PANORAMAS } from '../data/mapLayersData';
import { AppLocale, GeoPoint, StreetViewPanorama } from '../types/gis';
import { L10n } from '../core/localization';

interface StreetViewDockProps {
  locale: AppLocale;
  viewportCenter: GeoPoint;
  streetViewActive: boolean;
  onToggleStreetViewMode: () => void;
  onSelectPanorama: (pano: StreetViewPanorama) => void;
}

const PanoramaMiniThumb: React.FC<{ pano: StreetViewPanorama }> = ({ pano }) => {
  const { palette } = pano;
  return (
    <svg viewBox="0 0 64 42" className="w-full h-full">
      <defs>
        <linearGradient id={`sky_${pano.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.skyTop} />
          <stop offset="100%" stopColor={palette.skyBottom} />
        </linearGradient>
      </defs>
      <rect width="64" height="25" fill={`url(#sky_${pano.id})`} />
      <rect y="25" width="64" height="17" fill={palette.ground} />
      {/* Horizon silhouette */}
      <path
        d="M0 25 L8 21 L16 25 L26 17 L35 25 L46 19 L55 25 L64 22 L64 27 L0 27 Z"
        fill={palette.horizon}
        opacity="0.88"
      />
      {/* Focal monument/road perspective */}
      <polygon points="24,42 30,26 34,26 40,42" fill="#94A3B8" opacity="0.55" />
      <circle cx="32" cy="18" r="4" fill={palette.accent} opacity="0.9" />
    </svg>
  );
};

const PegmanIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg viewBox="0 0 28 36" className="w-5 h-6">
    {/* Head */}
    <circle cx="14" cy="7.5" r="4.8" fill={active ? '#F59E0B' : '#FBBF24'} />
    {/* Collar/neck detail */}
    <path d="M11 13 L14 17 L17 13 Z" fill="#D97706" />
    {/* Torso */}
    <rect x="9.5" y="13" width="9" height="11" rx="3" fill={active ? '#F59E0B' : '#FBBF24'} />
    {/* Arms */}
    <rect x="5.8" y="14" width="3.2" height="8.5" rx="1.6" fill={active ? '#F59E0B' : '#FBBF24'} />
    <rect x="19" y="14" width="3.2" height="8.5" rx="1.6" fill={active ? '#F59E0B' : '#FBBF24'} />
    {/* Legs */}
    <rect x="9.8" y="23.5" width="3.6" height="9" rx="1.8" fill={active ? '#F59E0B' : '#FBBF24'} />
    <rect x="14.6" y="23.5" width="3.6" height="9" rx="1.8" fill={active ? '#F59E0B' : '#FBBF24'} />
  </svg>
);

export const StreetViewDock: React.FC<StreetViewDockProps> = ({
  locale,
  viewportCenter,
  streetViewActive,
  onToggleStreetViewMode,
  onSelectPanorama,
}) => {
  const [expanded, setExpanded] = useState(true);

  const nearbyThumbs = useMemo(() => {
    return [...STREET_VIEW_PANORAMAS]
      .sort((a, b) => {
        const da =
          (a.point.lat - viewportCenter.lat) ** 2 + (a.point.lon - viewportCenter.lon) ** 2;
        const db =
          (b.point.lat - viewportCenter.lat) ** 2 + (b.point.lon - viewportCenter.lon) ** 2;
        return da - db;
      })
      .slice(0, 3);
  }, [viewportCenter.lat, viewportCenter.lon]);

  return (
    <div
      data-testid="street_view_dock"
      className={`inline-flex items-center rounded-2xl bg-[#20242A]/95 border shadow-xl backdrop-blur-md transition-all ${
        streetViewActive ? 'border-sky-400 ring-2 ring-sky-400/50' : 'border-white/15'
      }`}
    >
      {/* Left Golden Pegman Toggle */}
      <button
        type="button"
        onClick={onToggleStreetViewMode}
        title={L10n.text(locale, 'layerStreetView')}
        data-testid="street_view_pegman_button"
        className={`h-11 px-2.5 rounded-l-2xl flex items-center justify-center cursor-pointer transition-colors ${
          streetViewActive ? 'bg-sky-500/20' : 'hover:bg-white/10'
        }`}
      >
        <PegmanIcon active={streetViewActive} />
      </button>

      {/* Vertical Divider */}
      <div className="w-px h-7 bg-white/15" />

      {/* 3 Clickable Panorama Thumbnails */}
      {expanded && (
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {nearbyThumbs.map((pano) => {
            const title =
              locale === 'ru' ? pano.titleRu : locale === 'en' ? pano.titleEn : pano.titleUz;
            return (
              <button
                key={pano.id}
                type="button"
                onClick={() => onSelectPanorama(pano)}
                title={title}
                data-testid={`street_view_thumb_${pano.id}`}
                className="relative w-11 h-7 rounded-[4px] overflow-hidden border border-white/25 hover:border-sky-400 hover:scale-105 transition-all cursor-pointer shrink-0 group"
              >
                <PanoramaMiniThumb pano={pano} />
                <span className="sr-only">{title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Right Expand/Collapse Double-Chevron */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Collapse street view thumbnails' : 'Expand street view thumbnails'}
        data-testid="street_view_expand_button"
        className="h-11 px-2.5 rounded-r-2xl flex items-center justify-center text-white/90 hover:bg-white/10 cursor-pointer"
      >
        {expanded ? <ChevronsDown className="w-4 h-4" /> : <ChevronsUp className="w-4 h-4" />}
      </button>
    </div>
  );
};
