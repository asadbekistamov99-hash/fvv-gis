import React, { useEffect } from 'react';
import {
  AlertTriangle,
  Bolt,
  Droplets,
  Flame,
  Fuel,
  Inbox,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react';
import { AppLocale } from '../types/gis';
import { L10n } from '../core/localization';
import { statusColor } from '../theme/colors';

export const StatusPill: React.FC<{ value: string; locale: AppLocale; className?: string }> = ({
  value,
  locale,
  className = '',
}) => {
  const color = statusColor(value);
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${className}`}
      style={{
        color,
        backgroundColor: `${color}2e`,
        borderColor: `${color}80`,
      }}
    >
      {L10n.text(locale, value)}
    </span>
  );
};

export const SyntheticBadge: React.FC<{ locale: AppLocale }> = ({ locale }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-black tracking-wide bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]">
    {L10n.text(locale, 'synthetic')}
  </span>
);

export const SectionCard: React.FC<{
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ title, children, className = '', onClick }) => {
  const baseClass =
    'rounded-[20px] bg-[var(--surface)] border border-[var(--outline)]/45 p-4 text-left w-full';
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} hover:bg-[var(--surface-elevated)]/60 transition-colors cursor-pointer ${className}`}
      >
        {title && (
          <h3 className="font-display text-base font-extrabold text-[var(--primary)] mb-2.5">
            {title}
          </h3>
        )}
        {children}
      </button>
    );
  }
  return (
    <div className={`${baseClass} ${className}`}>
      {title && (
        <h3 className="font-display text-base font-extrabold text-[var(--primary)] mb-2.5">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};

export const DataRowView: React.FC<{
  label: string;
  value?: string | number | null;
  mono?: boolean;
}> = ({ label, value, mono = false }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
    <span className="text-[var(--ink-muted)] font-medium shrink-0">{label}</span>
    <span
      className={`text-[var(--ink)] font-semibold text-right break-words ${
        mono ? 'font-mono tabular-nums' : ''
      }`}
    >
      {value === null || value === undefined || value === '' ? '—' : String(value)}
    </span>
  </div>
);

export const ErrorPanel: React.FC<{
  message: string;
  locale: AppLocale;
  onRetry: () => void;
}> = ({ message, locale, onRetry }) => (
  <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center gap-4">
    <AlertTriangle className="w-12 h-12 text-[var(--error)]" />
    <p className="text-base font-semibold max-w-md text-[var(--ink)]">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] font-bold cursor-pointer hover:opacity-95"
    >
      <RefreshCw className="w-4 h-4" />
      {L10n.text(locale, 'retry')}
    </button>
  </div>
);

export const EmptyPanel: React.FC<{
  locale: AppLocale;
  icon?: React.ReactNode;
}> = ({ locale, icon }) => (
  <div className="w-full py-12 px-6 flex flex-col items-center justify-center text-center gap-3 text-[var(--ink-muted)]">
    {icon ?? <Inbox className="w-12 h-12 opacity-80" />}
    <p className="text-base font-medium">{L10n.text(locale, 'empty')}</p>
  </div>
);

export const CategoryIcon: React.FC<{ categoryId: string; className?: string }> = ({
  categoryId,
  className = 'w-5 h-5',
}) => {
  if (categoryId.includes('hydrant')) return <Flame className={className} />;
  if (categoryId.includes('water') || categoryId.includes('reservoir'))
    return <Droplets className={className} />;
  if (categoryId.includes('gas')) return <Fuel className={className} />;
  if (categoryId.includes('electr') || categoryId.includes('substation'))
    return <Bolt className={className} />;
  return <MapPin className={className} />;
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  locale: AppLocale;
  onConfirm: () => void;
  onDismiss: () => void;
}> = ({ open, title, body, confirmLabel, locale, onConfirm, onDismiss }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--outline)] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">{title}</h3>
        {body && <p className="text-sm text-[var(--ink-muted)]">{body}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl border border-[var(--outline)] text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-elevated)] cursor-pointer"
          >
            {L10n.text(locale, 'cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold hover:opacity-95 cursor-pointer"
          >
            {confirmLabel ?? L10n.text(locale, 'verify')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ModalSheet: React.FC<{
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}> = ({ open, title, subtitle, onClose, children, maxWidthClass = 'max-w-xl' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--outline)]/70 shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[var(--outline)]/35 shrink-0">
            <div>
              {title && (
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">{title}</h3>
              )}
              {subtitle && <p className="text-xs text-[var(--ink-muted)] mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-xl hover:bg-[var(--surface-elevated)] text-[var(--ink-muted)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
      </div>
    </div>
  );
};

export function triggerPhoneCall(number: string, showToast?: (msg: string) => void): void {
  const link = document.createElement('a');
  link.href = `tel:${number}`;
  link.click();
  if (showToast) {
    showToast(`tel:${number}`);
  }
}
