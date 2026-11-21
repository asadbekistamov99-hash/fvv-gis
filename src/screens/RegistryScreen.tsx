import React, { useMemo, useState } from 'react';
import { Lock, Search } from 'lucide-react';
import { localizedCategoryName, localizedRegionName } from '../core/geoUtils';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute, canAccountReviewOrPublish } from '../types/gis';
import {
  CategoryIcon,
  EmptyPanel,
  SectionCard,
  StatusPill,
  SyntheticBadge,
} from '../components/CommonComponents';

export const RegistryScreen: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { state, allObjects, regions, categories } = useApp();
  const locale = state.locale;
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const regionsById = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const isReviewer = canAccountReviewOrPublish(state.account);

  const filterChips = useMemo(() => {
    const base = ['all', 'working', 'faulty', 'under_maintenance', 'unknown'];
    if (isReviewer) base.push('submitted');
    return base;
  }, [isReviewer]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allObjects.filter((obj) => {
      if (statusFilter === 'submitted') {
        if (obj.lifecycle !== 'submitted') return false;
      } else if (statusFilter !== 'all' && obj.operationalStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const cat = categoriesById.get(obj.categoryId);
      const reg = regionsById.get(obj.regionId);
      const catName = cat ? localizedCategoryName(cat, locale).toLowerCase() : '';
      const regName = reg ? localizedRegionName(reg, locale).toLowerCase() : '';
      return (
        obj.name.toLowerCase().includes(q) ||
        obj.code.toLowerCase().includes(q) ||
        obj.description.toLowerCase().includes(q) ||
        catName.includes(q) ||
        regName.includes(q)
      );
    });
  }, [allObjects, query, statusFilter, categoriesById, regionsById, locale]);

  if (!state.isEmployee) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center gap-4">
        <Lock className="w-12 h-12 text-[var(--primary)]" />
        <p className="text-base font-semibold text-[var(--ink)] max-w-md">
          {L10n.text(locale, 'employeeRequiredForAdd')}
        </p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'auth' })}
          className="px-5 py-3 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold cursor-pointer"
        >
          {L10n.text(locale, 'login')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
            {L10n.text(locale, 'registry')}
          </h2>
          <p className="text-xs text-[var(--ink-muted)] tabular-nums">
            {filtered.length} / {allObjects.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'objectForm', objectId: null })}
          data-testid="registry_add_button"
          className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-extrabold cursor-pointer hover:opacity-95"
        >
          + {L10n.text(locale, 'addRegistryItem')}
        </button>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--outline)]/55 px-3.5 py-2">
        <Search className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={L10n.text(locale, 'search')}
          data-testid="registry_search_input"
          className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterChips.map((chip) => {
          const active = statusFilter === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setStatusFilter(chip)}
              data-testid={`registry_filter_${chip}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                  : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--outline)]/50'
              }`}
            >
              {L10n.text(locale, chip)}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyPanel locale={locale} />
      ) : (
        <div className="space-y-3">
          {filtered.map((obj) => {
            const cat = categoriesById.get(obj.categoryId);
            const reg = regionsById.get(obj.regionId);
            return (
              <SectionCard
                key={obj.id}
                onClick={() => onNavigate({ name: 'passport', objectId: obj.id })}
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--primary-container)] text-[var(--on-primary-container)] flex items-center justify-center shrink-0">
                    <CategoryIcon categoryId={obj.categoryId} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[var(--primary)]">{obj.code}</span>
                      <span className="text-[11px] font-mono text-[var(--ink-muted)]">v{obj.version}</span>
                    </div>
                    <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
                      {obj.name}
                    </h3>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {cat ? localizedCategoryName(cat, locale) : obj.categoryId} ·{' '}
                      {reg ? localizedRegionName(reg, locale) : obj.regionId}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <StatusPill value={obj.operationalStatus} locale={locale} />
                      <StatusPill value={obj.lifecycle} locale={locale} />
                      {obj.isSynthetic && <SyntheticBadge locale={locale} />}
                    </div>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
