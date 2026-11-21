import React from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCheck,
  Eye,
  Flame,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  AppLocale,
  CATEGORY_GROUP_LABEL_KEY,
  RegistryCategoryGroup,
} from '../types/gis';
import { L10n } from '../core/localization';

interface MapSearchOverlayProps {
  locale: AppLocale;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  visibleGroups: Set<RegistryCategoryGroup>;
  groupCounts: Record<RegistryCategoryGroup, number>;
  onToggleGroup: (group: RegistryCategoryGroup) => void;
  onShowAllGroups: () => void;
  hasActiveSheetFilters: boolean;
  onOpenFiltersSheet: () => void;
}

const GROUPS: RegistryCategoryGroup[] = ['INFRASTRUCTURE', 'HAZARDS', 'EQUIPMENT'];

export const MapSearchOverlay: React.FC<MapSearchOverlayProps> = ({
  locale,
  searchQuery,
  onSearchQueryChange,
  visibleGroups,
  groupCounts,
  onToggleGroup,
  onShowAllGroups,
  hasActiveSheetFilters,
  onOpenFiltersSheet,
}) => {
  const allGroupsSelected = visibleGroups.size === GROUPS.length;

  return (
    <div
      data-testid="map_search_overlay"
      className="absolute top-3 left-3 right-3 z-10 max-w-2xl mx-auto flex flex-col gap-2 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-[var(--surface)]/95 border border-[var(--outline)]/55 shadow-lg px-3 py-1.5 backdrop-blur-sm">
        <Search className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
        <input
          type="text"
          value={String(searchQuery)}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={L10n.text(locale, 'searchByNameOrType')}
          data-testid="map_search_input"
          className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] py-1.5 focus:outline-none min-w-0"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => onSearchQueryChange('')}
            aria-label={L10n.text(locale, 'cancel')}
            data-testid="map_search_clear_button"
            className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--ink-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenFiltersSheet}
          aria-label={L10n.text(locale, 'layers')}
          data-testid="map_layers_button"
          className="relative p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--ink)] cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {hasActiveSheetFilters && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--error)]" />
          )}
        </button>
      </div>

      <div
        data-testid="map_category_chip_group"
        className="pointer-events-auto flex items-center gap-2 overflow-x-auto pb-0.5"
      >
        <button
          type="button"
          onClick={onShowAllGroups}
          data-testid="map_group_chip_all"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap cursor-pointer transition-colors ${
            allGroupsSelected
              ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
              : 'bg-[var(--surface)]/92 text-[var(--ink)] border-[var(--outline)]/55 hover:bg-[var(--surface-elevated)]'
          }`}
        >
          {allGroupsSelected ? <CheckCheck className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{L10n.text(locale, 'all')}</span>
        </button>

        {GROUPS.map((group) => {
          const isVisible = visibleGroups.has(group);
          const count = groupCounts[group] ?? 0;
          const GroupIcon =
            group === 'INFRASTRUCTURE'
              ? Building2
              : group === 'HAZARDS'
              ? AlertTriangle
              : Flame;
          return (
            <button
              key={group}
              type="button"
              onClick={() => onToggleGroup(group)}
              data-testid={`map_group_chip_${group.toLowerCase()}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap cursor-pointer transition-colors ${
                isVisible
                  ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-[var(--primary)]/50'
                  : 'bg-[var(--surface)]/92 text-[var(--ink)] border-[var(--outline)]/55 hover:bg-[var(--surface-elevated)]'
              }`}
            >
              {isVisible ? <Check className="w-3.5 h-3.5" /> : <GroupIcon className="w-3.5 h-3.5" />}
              <span>
                {L10n.text(locale, CATEGORY_GROUP_LABEL_KEY[group])} ({count})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
