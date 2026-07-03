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

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
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
        <div className="rounded-lg border border-ink-700/60 bg-ink-850/60 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning-500 animate-pulse-dot" />
            <span className="text-xs font-medium text-slate-400">Prototype Mode</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
            Mock Intelligence Data — not live or verified.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SideNav;
