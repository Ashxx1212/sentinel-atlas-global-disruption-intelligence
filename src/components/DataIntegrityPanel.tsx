import { CheckCircle2, CloudSun, Clock3, Ban } from 'lucide-react';
import type { DataIntegrityStatus } from '../types';

const config: Record<
  DataIntegrityStatus,
  {
    label: string;
    description: string;
    icon: typeof CheckCircle2;
    text: string;
    bg: string;
    border: string;
  }
> = {
  verified: {
    label: 'Verified',
    description:
      'A stored source observation or stable record with traceable origin metadata. Sentinel Atlas still does not independently certify the event.',
    icon: CheckCircle2,
    text: 'text-success-400',
    bg: 'bg-success-500/10',
    border: 'border-success-500/30',
  },
  forecast: {
    label: 'Forecast',
    description:
      'Forward-looking or contextual estimate. Useful for briefing context, not a confirmed observation.',
    icon: CloudSun,
    text: 'text-electric-300',
    bg: 'bg-electric-500/10',
    border: 'border-electric-500/30',
  },
  pending: {
    label: 'Pending',
    description:
      'Stored metadata is available but still limited, incomplete, or awaiting reconciliation.',
    icon: Clock3,
    text: 'text-warning-400',
    bg: 'bg-warning-500/10',
    border: 'border-warning-500/30',
  },
  unavailable: {
    label: 'Unavailable',
    description:
      'No source-backed value is available for this field in the current record.',
    icon: Ban,
    text: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
  },
};

export function DataIntegrityPanel({
  variant = 'grid',
}: {
  variant?: 'grid' | 'list';
}) {
  const statuses = Object.keys(config) as DataIntegrityStatus[];

  if (variant === 'list') {
    return (
      <div className="space-y-2">
        {statuses.map((s) => {
          const c = config[s];
          const Icon = c.icon;
          return (
            <div
              key={s}
              className={`flex items-start gap-3 rounded-lg border ${c.border} ${c.bg} p-3`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${c.text}`} />
              <div>
                <p className={`text-sm font-semibold ${c.text}`}>{c.label}</p>
                <p className="text-xs text-slate-400">{c.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {statuses.map((s) => {
        const c = config[s];
        const Icon = c.icon;
        return (
          <div
            key={s}
            className={`rounded-lg border ${c.border} ${c.bg} p-3 transition-all duration-200 hover:scale-[1.02]`}
          >
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${c.text}`} />
              <span className={`text-sm font-semibold ${c.text}`}>{c.label}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              {c.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default DataIntegrityPanel;
