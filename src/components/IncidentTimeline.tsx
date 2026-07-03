import { Clock } from 'lucide-react';
import type { TimelineEntry } from '../types';
import { IntegrityBadge } from './StatusBadge';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC';
}

export function IncidentTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="relative">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-500/40 via-ink-600 to-transparent" />
      <div className="space-y-5">
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className="relative flex gap-4 animate-slide-up"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="relative z-10 mt-1.5 flex-shrink-0">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-500/60 bg-ink-900" />
              {idx === 0 && (
                <div className="absolute inset-0 h-3.5 w-3.5 rounded-full border-2 border-cyan-400 animate-ping-slow" />
              )}
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-slate-100">
                  {entry.title}
                </h4>
                <IntegrityBadge status={entry.integrity} size="xs" />
              </div>
              <p className="mt-1 text-sm text-slate-400">{entry.description}</p>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(entry.timestamp)}
                </span>
                <span className="text-slate-600">·</span>
                <span>{entry.source}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IncidentTimeline;
