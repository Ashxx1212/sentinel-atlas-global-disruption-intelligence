import type { Source } from '../types';
import { IntegrityBadge } from './StatusBadge';

const healthConfig = {
  operational: { label: 'Operational', text: 'text-success-400', dot: 'bg-success-500' },
  degraded: { label: 'Degraded', text: 'text-warning-400', dot: 'bg-warning-500' },
  offline: { label: 'Offline', text: 'text-error-400', dot: 'bg-error-500' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function SourceHealthCard({ source }: { source: Source }) {
  const h = healthConfig[source.health];
  return (
    <div className="panel panel-hover p-4 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{source.shortName}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{source.name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${h.dot} ${source.health === 'operational' ? 'animate-pulse-dot' : ''}`} />
          <span className={`text-xs font-medium ${h.text}`}>{h.label}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400 leading-relaxed">
        {source.description}
      </p>
      <div className="mt-3 space-y-2 border-t border-ink-700/60 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Coverage</span>
          <span className="text-slate-300">{source.coverage}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Data role</span>
          <span className="text-slate-300">{source.dataUseRole}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Last refresh</span>
          <span className="font-mono text-cyan-300">{timeAgo(source.lastSync)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-ink-700/60 pt-3">
        <IntegrityBadge status={source.integrityStatus} size="xs" />
        <span className="font-mono text-[10px] text-slate-600">
          Fixture refreshed
        </span>
      </div>
    </div>
  );
}

export default SourceHealthCard;

export { healthConfig };
