import React from 'react';
import { Bell, CheckCheck, Lock } from 'lucide-react';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types/gis';
import { EmptyPanel, SectionCard } from '../components/CommonComponents';

export const NotificationsScreen: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { state, notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const locale = state.locale;

  if (!state.account) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center gap-4">
        <Lock className="w-12 h-12 text-[var(--primary)]" />
        <p className="text-base font-semibold text-[var(--ink)]">
          {L10n.text(locale, 'login')}
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
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
          {L10n.text(locale, 'notifications')}
        </h2>
        <button
          type="button"
          onClick={markAllNotificationsRead}
          aria-label="Mark all read"
          className="p-2.5 rounded-xl border border-[var(--outline)] text-[var(--primary)] hover:bg-[var(--surface-elevated)] cursor-pointer"
        >
          <CheckCheck className="w-4 h-4" />
        </button>
      </div>

      {notifications.length === 0 ? (
        <EmptyPanel locale={locale} icon={<Bell className="w-12 h-12 opacity-70" />} />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const unread = !n.readAt;
            return (
              <SectionCard
                key={n.id}
                onClick={unread ? () => markNotificationRead(n.id) : undefined}
                className={unread ? 'border-[var(--primary)]/60 bg-[var(--primary-container)]/25' : ''}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-[var(--ink)]">{n.title}</span>
                    {unread && <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] shrink-0" />}
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] leading-relaxed">{n.body}</p>
                  <p className="text-[11px] font-mono text-[var(--ink-muted)]">{n.createdAt}</p>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
