import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe2,
  Heart,
  DoorClosed,
  Bell,
  FileText,
  ShieldCheck,
  Settings,
  X,
} from 'lucide-react';
import { mockSources } from '../data/mockIncidents';
import { useLiveUsgsIncidents } from '../hooks/useLiveUsgsIncidents';

const navItems = [
  { to: '/command-centre', label: 'Command Centre', icon: LayoutDashboard },
  { to: '/global-map', label: 'Global Map', icon: Globe2 },
  { to: '/my-world', label: 'My World', icon: Heart },
  { to: '/incidents', label: 'Incident Rooms', icon: DoorClosed },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/briefing', label: 'Daily Briefing', icon: FileText },
  { to: '/data-trust', label: 'Data Trust', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function sourceLabel(code: string, fallbackName: string): string {
  if (code === 'usgs') return 'USGS';
  if (code === 'gdacs') return 'GDACS';
  if (code === 'eonet') return 'EONET';
  return fallbackName || code.toUpperCase();
}

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { records, sources, state } = useLiveUsgsIncidents();

  const liveSources = sources.filter(
    (source) =>
      source.source_mode === 'live_source' ||
      source.code === 'usgs' ||
      source.code === 'gdacs' ||
      source.code === 'eonet',
  );
  const liveSourceCodes = new Set(liveSources.map((source) => source.code));
  const prototypeSourceCount = mockSources.filter(
    (sourceItem) => !liveSourceCodes.has(sourceItem.id),
  ).length;
  const liveSourceNames = liveSources
    .map((source) => sourceLabel(source.code, source.display_name))
    .join(' · ');
  const liveSourcesAvailable =
    liveSources.length > 0 && state !== 'unconfigured' && state !== 'error';

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-ink-700/60">
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-lg bg-cyan-500/20 blur-md" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-ink-850">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" opacity="0.4" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-slate-100 leading-tight">
            SENTINEL ATLAS
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-cyan-500/60">
            Disruption Intel
          </p>
        </div>
        {onNavigate && (
          <button
            onClick={onNavigate}
            aria-label="Close navigation menu"
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-ink-700/40 hover:text-slate-200 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          Operations
        </p>
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : ''}`
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-ink-700/60 p-4">
        <div
          className={`rounded-lg border p-3 ${
            liveSourcesAvailable
              ? 'border-cyan-500/20 bg-cyan-500/5'
              : 'border-warning-500/20 bg-warning-500/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full animate-pulse-dot ${
                liveSourcesAvailable ? 'bg-cyan-400' : 'bg-warning-500'
              }`}
            />
            <span
              className={`text-xs font-medium ${
                liveSourcesAvailable ? 'text-cyan-300' : 'text-warning-300'
              }`}
            >
              {liveSourcesAvailable ? 'Hybrid Mode' : 'Prototype Mode'}
            </span>
          </div>
          {liveSourcesAvailable ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              {liveSources.length} live source{liveSources.length === 1 ? '' : 's'} ·{' '}
              {prototypeSourceCount} prototype fixture{prototypeSourceCount === 1 ? '' : 's'}.
              {records.length > 0 ? ` ${records.length} source-backed records loaded.` : ''}
              {liveSourceNames ? ` ${liveSourceNames}.` : ''}
            </p>
          ) : (
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
              Live source status is unavailable in this session. Prototype fixtures remain visible.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SideNav;
