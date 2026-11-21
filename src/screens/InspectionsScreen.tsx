import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Lock, Plus } from 'lucide-react';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types/gis';
import {
  EmptyPanel,
  ModalSheet,
  SectionCard,
  StatusPill,
} from '../components/CommonComponents';

export const InspectionsScreen: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { state, allObjects, getInspectionsForObject, addInspection } = useApp();
  const locale = state.locale;

  const [selectedObjectId, setSelectedObjectId] = useState<string>(allObjects[0]?.id ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [condition, setCondition] = useState('good');
  const [operationalStatus, setOperationalStatus] = useState('working');
  const [notes, setNotes] = useState('');
  const [nextDate, setNextDate] = useState('');

  const inspections = useMemo(
    () => (selectedObjectId ? getInspectionsForObject(selectedObjectId) : []),
    [selectedObjectId, getInspectionsForObject]
  );

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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObjectId || notes.trim().length === 0) return;
    addInspection(
      selectedObjectId,
      condition,
      operationalStatus,
      notes.trim(),
      nextDate.trim() || null
    );
    setNotes('');
    setNextDate('');
    setModalOpen(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
          {L10n.text(locale, 'inspections')}
        </h2>
        <button
          type="button"
          disabled={!selectedObjectId}
          onClick={() => setModalOpen(true)}
          data-testid="inspections_add_button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-extrabold cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>{L10n.text(locale, 'check')}</span>
        </button>
      </div>

      <SectionCard>
        <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1.5">
          {L10n.text(locale, 'registry')}
        </label>
        <select
          value={selectedObjectId}
          onChange={(e) => setSelectedObjectId(e.target.value)}
          className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
        >
          {allObjects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} · {o.name}
            </option>
          ))}
        </select>
      </SectionCard>

      {inspections.length === 0 ? (
        <EmptyPanel locale={locale} icon={<ClipboardCheck className="w-12 h-12 opacity-70" />} />
      ) : (
        <div className="space-y-3">
          {inspections.map((ins) => (
            <SectionCard key={ins.id}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-[var(--ink)]">
                    {ins.inspectorName}
                  </span>
                  <span className="text-xs font-mono text-[var(--ink-muted)]">
                    {ins.createdAt.slice(0, 10)}
                  </span>
                </div>
                <p className="text-sm text-[var(--ink)]">{ins.notes}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusPill value={ins.condition} locale={locale} />
                  <StatusPill value={ins.operationalStatus} locale={locale} />
                  {ins.nextInspectionDate && (
                    <span className="text-xs font-mono text-[var(--ink-muted)]">
                      Next: {ins.nextInspectionDate}
                    </span>
                  )}
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <ModalSheet open={modalOpen} onClose={() => setModalOpen(false)} title={L10n.text(locale, 'check')}>
        <form onSubmit={handleAddSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.pick(locale, 'Texnik holat', 'Состояние', 'Condition')}
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
            >
              {['good', 'fair', 'poor', 'unknown'].map((c) => (
                <option key={c} value={c}>
                  {L10n.text(locale, c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'status')}
            </label>
            <select
              value={operationalStatus}
              onChange={(e) => setOperationalStatus(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
            >
              {['working', 'faulty', 'under_maintenance', 'temporarily_unavailable', 'unknown'].map(
                (st) => (
                  <option key={st} value={st}>
                    {L10n.text(locale, st)}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'description')}
            </label>
            <textarea
              rows={3}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[var(--outline)] bg-[var(--bg)] p-3 text-sm text-[var(--ink)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.pick(locale, 'Keyingi tekshiruv (YYYY-MM-DD)', 'Следующая проверка', 'Next inspection (YYYY-MM-DD)')}
            </label>
            <input
              type="text"
              placeholder="2027-01-15"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm font-mono text-[var(--ink)]"
            />
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold cursor-pointer"
          >
            {L10n.text(locale, 'save')}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
