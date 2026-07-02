import type { Severity } from '../types';

const config: Record<
  Severity,
  {
    label: string;
    text: string;
    border: string;
    bg: string;
    dot: string;
    glow: string;
  }
> = {
  critical: {
    label: 'Critical',
    text: 'text-error-400',
    border: 'border-error-500/40',
    bg: 'bg-error-500/10',
    dot: 'bg-error-500',
    glow: 'shadow-glow-critical',
  },
  high: {
    label: 'High',
    text: 'text-orange-400',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/10',
    dot: 'bg-orange-500',
    glow: 'shadow-glow-high',
  },
  elevated: {
    label: 'Elevated',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
    dot: 'bg-yellow-500',
    glow: 'shadow-glow-elevated',
  },
  advisory: {
    label: 'Advisory',
    text: 'text-slate-400',
    border: 'border-slate-500/40',
    bg: 'bg-slate-500/10',
    dot: 'bg-slate-500',
    glow: '',
  },
};

export function SeverityBadge({
  severity,
  size = 'sm',
  withGlow = false,
}: {
  severity: Severity;
  size?: 'sm' | 'xs';
  withGlow?: boolean;
}) {
  const c = config[severity];
  const padding = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`chip ${c.bg} ${c.border} ${c.text} ${padding} ${
        withGlow ? c.glow : ''
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function severityColor(severity: Severity): string {
  return config[severity].dot;
}

export function severityText(severity: Severity): string {
  return config[severity].text;
}

export default SeverityBadge;
