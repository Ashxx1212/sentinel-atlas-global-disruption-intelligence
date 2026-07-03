import type { DataIntegrityStatus, IncidentStatus } from '../types';

const integrityConfig: Record<
  DataIntegrityStatus,
  { label: string; dot: string; text: string; border: string; bg: string }
> = {
  verified: {
    label: 'Verified',
    dot: 'bg-success-500',
    text: 'text-success-400',
    border: 'border-success-500/30',
    bg: 'bg-success-500/10',
  },
  forecast: {
    label: 'Forecast',
    dot: 'bg-electric-400',
    text: 'text-electric-300',
    border: 'border-electric-500/30',
    bg: 'bg-electric-500/10',
  },
  pending: {
    label: 'Pending',
    dot: 'bg-warning-500',
    text: 'text-warning-400',
    border: 'border-warning-500/30',
    bg: 'bg-warning-500/10',
  },
  unavailable: {
    label: 'Unavailable',
    dot: 'bg-slate-500',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/10',
  },
};

const statusConfig: Record<
  IncidentStatus,
  { label: string; text: string; border: string; bg: string }
> = {
  active: {
    label: 'Active',
    text: 'text-error-400',
    border: 'border-error-500/30',
    bg: 'bg-error-500/10',
  },
  monitoring: {
    label: 'Monitoring',
    text: 'text-cyan-300',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/10',
  },
  contained: {
    label: 'Contained',
    text: 'text-success-400',
    border: 'border-success-500/30',
    bg: 'bg-success-500/10',
  },
  resolved: {
    label: 'Resolved',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/10',
  },
};

export function IntegrityBadge({
  status,
  size = 'sm',
}: {
  status: DataIntegrityStatus;
  size?: 'sm' | 'xs';
}) {
  const c = integrityConfig[status];
  const padding = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`chip ${c.bg} ${c.border} ${c.text} ${padding}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const c = statusConfig[status];
  return (
    <span className={`chip ${c.bg} ${c.border} ${c.text}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'active' ? 'bg-error-500 animate-pulse-dot' : 'bg-current'
        }`}
      />
      {c.label}
    </span>
  );
}

export function integrityLabel(status: DataIntegrityStatus): string {
  return integrityConfig[status].label;
}
