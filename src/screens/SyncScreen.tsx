import React, { useState } from 'react';
import {
  CloudOff,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { SyncOperationEntity } from '../types/gis';
import {
  DataRowView,
  EmptyPanel,
  ModalSheet,
  SectionCard,
  StatusPill,
} from '../components/CommonComponents';

function formatEpochDateTime(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export const SyncScreen: React.FC = () => {
  const {
    state,
    syncQueue,
    setOfflineMode,
    synchronize,
    renewLease,
    expireLeaseForTesting,
    resolveConflictAcceptServer,
    resolveConflictRetryLocal,
  } = useApp();
  const locale = state.locale;

  const [conflictOp, setConflictOp] = useState<SyncOperationEntity | null>(null);

  const entityLabel = (type: string) => {
    if (type === 'emergency_incident') return L10n.text(locale, 'entityEmergencyIncident');
    if (type === 'citizen_report') return L10n.text(locale, 'entityCitizenReport');
    return L10n.text(locale, 'entityInfrastructure');
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
        {L10n.text(locale, 'queue')}
      </h2>

      <SectionCard>
        <div className="divide-y divide-[var(--outline)]/35">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              {state.isEffectiveOffline ? (
                <CloudOff className="w-4 h-4 text-[var(--tertiary)]" />
              ) : (
                <Wifi className="w-4 h-4 text-[#4CAF50]" />
              )}
              <span className="text-sm font-bold text-[var(--ink)]">
                {L10n.text(locale, 'networkStatusLabel')}
              </span>
            </div>
            <span className="text-xs font-bold text-[var(--primary)]">
              {L10n.text(
                locale,
                state.isEffectiveOffline ? 'networkDeviceOffline' : 'networkOnline'
              )}
            </span>
          </div>

          <DataRowView
            label={L10n.text(locale, 'lastSync')}
            value={formatEpochDateTime(state.lastSyncAtMs)}
            mono
          />

          {state.isEmployee && (
            <DataRowView
              label={L10n.text(locale, 'permission')}
              value={
                state.isLeaseValid
                  ? `${state.leaseRemainingMinutes} ${L10n.text(locale, 'etaMinutes')}`
                  : '0'
              }
              mono
            />
          )}
        </div>

        {/* Offline mode test toggle */}
        <label className="mt-3 pt-3 border-t border-[var(--outline)]/35 flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm font-semibold text-[var(--ink)]">
            {L10n.pick(locale, 'Offline sinov rejimi', 'Тестовый офлайн-режим', 'Offline test mode')}
          </span>
          <input
            type="checkbox"
            checked={state.offlineMode}
            onChange={(e) => setOfflineMode(e.target.checked)}
            data-testid="sync_offline_switch"
            className="w-4 h-4 accent-[var(--primary)] cursor-pointer"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={state.syncing}
            onClick={synchronize}
            data-testid="sync_now_button"
            className="flex-1 min-w-[160px] h-11 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-extrabold inline-flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${state.syncing ? 'animate-spin' : ''}`} />
            <span>{L10n.text(locale, 'sync')}</span>
          </button>

          {state.isEmployee && (
            <>
              <button
                type="button"
                onClick={renewLease}
                className="px-3.5 h-11 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{L10n.pick(locale, 'Ruxsatni yangilash', 'Продлить 8ч', 'Renew 8h')}</span>
              </button>
              <button
                type="button"
                onClick={expireLeaseForTesting}
                className="px-3.5 h-11 rounded-xl border border-[var(--outline)] text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--error)] cursor-pointer"
              >
                {L10n.pick(locale, 'Ruxsatni tugatish (test)', 'Истечь доступ', 'Expire grant')}
              </button>
            </>
          )}
        </div>
      </SectionCard>

      {syncQueue.length === 0 ? (
        <EmptyPanel locale={locale} />
      ) : (
        <div className="space-y-3">
          {syncQueue.map((op) => (
            <SectionCard
              key={op.operationId}
              onClick={op.status === 'conflict' ? () => setConflictOp(op) : undefined}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--primary)]">
                    {entityLabel(op.entityType)} · {op.action.toUpperCase()}
                  </span>
                  <StatusPill value={op.status} locale={locale} />
                </div>
                <p className="text-sm font-extrabold text-[var(--ink)]">{op.objectName}</p>
                {op.errorMessage && (
                  <p className="text-xs font-semibold text-[var(--error)]">{op.errorMessage}</p>
                )}
                <p className="text-[11px] font-mono text-[var(--ink-muted)]">{op.createdAt}</p>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <ModalSheet
        open={Boolean(conflictOp)}
        onClose={() => setConflictOp(null)}
        title={`409 ${L10n.text(locale, 'conflict')}`}
        subtitle={conflictOp?.objectName}
      >
        {conflictOp && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--error)] font-semibold">{conflictOp.errorMessage}</p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  resolveConflictRetryLocal(conflictOp.operationId);
                  setConflictOp(null);
                }}
                className="flex-1 h-11 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold cursor-pointer"
              >
                Retry · LOCAL
              </button>
              <button
                type="button"
                onClick={() => {
                  resolveConflictAcceptServer(conflictOp.operationId);
                  setConflictOp(null);
                }}
                className="flex-1 h-11 rounded-xl border border-[var(--outline)] text-xs font-bold text-[var(--ink)] cursor-pointer"
              >
                Verify · SERVER
              </button>
            </div>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
