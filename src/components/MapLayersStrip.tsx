import React from 'react';
import { Check, Layers } from 'lucide-react';
import { AppLocale, BaseMapType, MapDetailLayer } from '../types/gis';
import { L10n } from '../core/localization';

interface MapLayersStripProps {
  locale: AppLocale;
  baseMapType: BaseMapType;
  activeDetails: Set<MapDetailLayer>;
  onToggleDetail: (layer: MapDetailLayer) => void;
  onOpenMore: () => void;
}

const ReliefGraphic: React.FC = () => (
  <svg viewBox="0 0 56 56" className="w-full h-full">
    <rect width="56" height="56" fill="#7D8878" />
    <path d="M0 18 Q18 10 34 22 T56 16 L56 56 L0 56 Z" fill="#63705E" />
    <path d="M0 34 Q16 24 30 38 T56 30 L56 56 L0 56 Z" fill="#8C9685" />
    <path d="M26 0 L38 56 L56 56 L56 0 Z" fill="#525D4F" opacity="0.65" />
    <path
      d="M-2 24 C10 22, 16 4, 28 8 C39 11, 14 26, 20 35 C25 43, 42 29, 44 42 C45 48, 39 54, 42 58"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="4.5"
      strokeLinecap="round"
    />
  </svg>
);

const TrafficGraphic: React.FC = () => (
  <svg viewBox="0 0 56 56" className="w-full h-full">
    <rect width="56" height="56" fill="#EDEBE6" />
    <rect x="0" y="0" width="21" height="21" rx="3" fill="#C4EAD6" />
    <rect x="35" y="0" width="21" height="21" rx="3" fill="#C4EAD6" />
    {/* Road cross */}
    <rect x="21" y="0" width="14" height="56" fill="#B6C0CC" />
    <rect x="0" y="21" width="56" height="14" fill="#B6C0CC" />
    <circle cx="28" cy="28" r="10" fill="#B6C0CC" />
    {/* Traffic color overlays */}
    <path d="M25 0 L25 18 Q25 25 18 25 L0 25" fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M31 0 L31 20" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
    <path d="M25 56 L25 41" fill="none" stroke="#991B1B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M25 41 L25 36 Q25 25 36 25 L41 25" fill="none" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M41 25 L56 25" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const TransitGraphic: React.FC = () => (
  <svg viewBox="0 0 56 56" className="w-full h-full">
    <rect width="56" height="56" fill="#F1F3F5" />
    <rect x="0" y="18" width="56" height="20" fill="#DFE4EA" />
    {/* Metro blue badge */}
    <rect x="32" y="4" width="16" height="16" rx="3.5" fill="#1A73E8" />
    <text
      x="40"
      y="16"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="11"
      fontWeight="800"
      fontFamily="sans-serif"
    >
      M
    </text>
    {/* Bus blue badge */}
    <rect x="13" y="37" width="16" height="16" rx="3.5" fill="#1A73E8" />
    <rect x="17" y="40" width="8" height="7" rx="1.5" fill="#FFFFFF" />
    <circle cx="18.5" cy="49.5" r="1.1" fill="#FFFFFF" />
    <circle cx="23.5" cy="49.5" r="1.1" fill="#FFFFFF" />
    {/* Blue and purple transit lines */}
    <line x1="0" y1="24" x2="56" y2="24" stroke="#2563EB" strokeWidth="3.2" />
    <line x1="0" y1="31" x2="56" y2="31" stroke="#A21CAF" strokeWidth="3" />
    <path d="M8 10 L18 10 M15 7 L18 10 L15 13" stroke="#94A3B8" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </svg>
);

const CyclingGraphic: React.FC = () => (
  <svg viewBox="0 0 56 56" className="w-full h-full">
    <rect width="56" height="56" fill="#CFECE0" />
    {/* Roundabout white roads */}
    <line x1="0" y1="18" x2="20" y2="25" stroke="#E5EAF0" strokeWidth="8" />
    <line x1="36" y1="26" x2="56" y2="18" stroke="#E5EAF0" strokeWidth="8" />
    <line x1="25" y1="36" x2="18" y2="56" stroke="#E5EAF0" strokeWidth="8" />
    <circle cx="28" cy="27" r="11" fill="#CFECE0" stroke="#E5EAF0" strokeWidth="7" />
    {/* Green bike paths */}
    <path
      d="M0 18 L18 25 A10 10 0 0 1 38 27"
      fill="none"
      stroke="#15803D"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d="M38 27 A10 10 0 0 1 25 37 L18 56"
      fill="none"
      stroke="#22C55E"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  </svg>
);

export const MapLayersStrip: React.FC<MapLayersStripProps> = ({
  locale,
  baseMapType,
  activeDetails,
  onToggleDetail,
  onOpenMore,
}) => {
  const isReliefActive = activeDetails.has('relief') || baseMapType === 'terrain';
  const isTrafficActive = activeDetails.has('traffic');
  const isTransitActive = activeDetails.has('transit');
  const isCyclingActive = activeDetails.has('cycling');
  const hasMoreActive = baseMapType !== 'standard' || activeDetails.has('streetView');

  const items: {
    id: string;
    label: string;
    active: boolean;
    onClick: () => void;
    graphic: React.ReactNode;
    testId: string;
  }[] = [
    {
      id: 'relief',
      label: L10n.text(locale, 'layerRelief'),
      active: isReliefActive,
      onClick: () => onToggleDetail('relief'),
      graphic: <ReliefGraphic />,
      testId: 'map_layer_tile_relief',
    },
    {
      id: 'traffic',
      label: L10n.text(locale, 'layerTraffic'),
      active: isTrafficActive,
      onClick: () => onToggleDetail('traffic'),
      graphic: <TrafficGraphic />,
      testId: 'map_layer_tile_traffic',
    },
    {
      id: 'transit',
      label: L10n.text(locale, 'layerTransit'),
      active: isTransitActive,
      onClick: () => onToggleDetail('transit'),
      graphic: <TransitGraphic />,
      testId: 'map_layer_tile_transit',
    },
    {
      id: 'cycling',
      label: L10n.text(locale, 'layerCycling'),
      active: isCyclingActive,
      onClick: () => onToggleDetail('cycling'),
      graphic: <CyclingGraphic />,
      testId: 'map_layer_tile_cycling',
    },
    {
      id: 'more',
      label: L10n.text(locale, 'layerMore'),
      active: hasMoreActive,
      onClick: onOpenMore,
      graphic: (
        <div className="w-full h-full flex items-center justify-center bg-[var(--surface-elevated)] text-[var(--ink)]">
          <Layers className="w-6 h-6" />
        </div>
      ),
      testId: 'map_layer_tile_more',
    },
  ];

  return (
    <div
      data-testid="map_layers_strip"
      className="rounded-2xl bg-[var(--surface)]/95 border border-[var(--outline)]/50 shadow-xl backdrop-blur-md px-2.5 py-2 flex items-start gap-2 sm:gap-3"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          data-testid={item.testId}
          className="flex flex-col items-center gap-1 w-[50px] sm:w-[58px] shrink-0 cursor-pointer group"
        >
          <div
            className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden transition-all ${
              item.active
                ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)] scale-[1.03] shadow-md'
                : 'border border-[var(--outline)]/40 group-hover:scale-[1.03]'
            }`}
          >
            {item.graphic}
            {item.active && item.id !== 'more' && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center shadow">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            )}
            {item.active && item.id === 'more' && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--primary)]" />
            )}
          </div>
          <span
            className={`text-[10px] sm:text-[11px] leading-[1.15] text-center break-words line-clamp-2 ${
              item.active
                ? 'font-extrabold text-[var(--primary)]'
                : 'font-semibold text-[var(--ink-muted)]'
            }`}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
};
