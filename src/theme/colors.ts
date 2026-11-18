export const GisColors = {
  CyanAccent: '#5DE6F5',
  DeepTeal: '#006879',
  MidnightBg: '#081320',
  MidnightCard: '#102136',
  MidnightElevated: '#172D47',
  LightBg: '#F0F4F8',
  LightCard: '#FFFFFF',
  LightInk: '#102136',

  StatusWorking: '#36D698',
  StatusFaulty: '#FF8A91',
  StatusMaintenance: '#FFCD73',
  StatusUnknown: '#9EB4CC',
  OfflineBanner: '#6B4100',
} as const;

export function statusColor(value: string): string {
  switch (value) {
    case 'working':
    case 'approved':
    case 'published':
    case 'resolved':
      return GisColors.StatusWorking;
    case 'faulty':
    case 'rejected':
      return GisColors.StatusFaulty;
    case 'under_maintenance':
    case 'requires_correction':
    case 'submitted':
    case 'in_progress':
    case 'pending':
    case 'queued_offline':
      return GisColors.StatusMaintenance;
    default:
      return GisColors.StatusUnknown;
  }
}

export function statusMapHex(status: string): string {
  switch (status) {
    case 'working':
      return '#16A34A';
    case 'faulty':
      return '#DC2626';
    case 'under_maintenance':
      return '#D97706';
    case 'temporarily_unavailable':
      return '#EA580C';
    case 'not_inspected':
      return '#0284C7';
    default:
      return '#64748B';
  }
}
