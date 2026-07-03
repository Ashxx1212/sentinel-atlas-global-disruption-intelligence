import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'cyan' | 'critical' | 'elevated' | 'high' | 'neutral';
  sublabel?: string;
  trend?: string;
}

const accentMap = {
  cyan: { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', glow: 'group-hover:shadow-glow-cyan' },
  critical: { text: 'text-error-400', bg: 'bg-error-500/10', border: 'border-error-500/20', glow: 'group-hover:shadow-glow-critical' },
  elevated: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', glow: 'group-hover:shadow-glow-elevated' },
  high: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', glow: 'group-hover:shadow-glow-high' },
  neutral: { text: 'text-slate-300', bg: 'bg-ink-700/40', border: 'border-ink-600/40', glow: '' },
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = 'cyan',
  sublabel,
  trend,
}: MetricCardProps) {
  const a = accentMap[accent];
  return (
    <div
      className={`panel panel-hover group relative overflow-hidden p-5 transition-all duration-300 ${a.glow}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className={`mt-2 font-mono text-3xl font-bold ${a.text}`}>{value}</p>
          {sublabel && (
            <p className="mt-1 text-xs text-slate-500">{sublabel}</p>
          )}
        </div>
        <div className={`rounded-lg ${a.bg} ${a.border} border p-2.5`}>
          <Icon className={`h-5 w-5 ${a.text}`} />
        </div>
      </div>
      {trend && (
        <p className="mt-3 text-xs text-slate-500">{trend}</p>
      )}
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-cyan-500/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-0" />
    </div>
  );
}

export default MetricCard;
