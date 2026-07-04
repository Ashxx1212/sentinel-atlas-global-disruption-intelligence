import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  User,
  ArrowRight,
  Server,
  MapPin,
  AlertOctagon,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  mockIncidents,
  mockWatchlist,
  mockSources,
  hazardTypeLabels,
} from '../data/mockIncidents';
import { useLiveUsgsIncidents } from '../hooks/useLiveUsgsIncidents';
import { useAuth } from '../contexts/AuthContext';
import { usePrototypeAlerts } from '../contexts/AlertContext';
import { SeverityBadge } from './SeverityBadge';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: 'incident' | 'location' | 'source' | 'page';
  route: string;
}

function liveSourceLabel(code: string, fallbackName: string): string {
  if (code === 'usgs') return 'USGS Earthquake Catalog';
  if (code === 'eonet') return 'NASA EONET';
  if (code === 'gdacs') return 'GDACS';
  return fallbackName || code.toUpperCase();
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { alerts, unreadCount, markAlertRead } = usePrototypeAlerts();
  const latestAlerts = useMemo(
    () => [...alerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 3),
    [alerts],
  );
  const { records, sources, state } = useLiveUsgsIncidents();
  const { isAuthenticated, user, profile, signOut, isConfigured } = useAuth();
  const profileDisplayName =
    isAuthenticated
      ? profile?.display_name?.trim() || user?.email?.split('@')[0] || 'Signed-in analyst'
      : 'Preview analyst';
  const liveSources = useMemo(
    () => sources.filter((source) => source.source_mode === 'live_source' || source.code === 'usgs' || source.code === 'eonet' || source.code === 'gdacs'),
    [sources],
  );
  const liveSourceCodes = useMemo(() => new Set(liveSources.map((source) => source.code)), [liveSources]);
  const liveRecordCountByCode = useMemo(() => {
    const counts = new Map<string, number>();
    records.forEach((record) => {
      if (!record.source_code) return;
      counts.set(record.source_code, (counts.get(record.source_code) ?? 0) + 1);
    });
    return counts;
  }, [records]);
  const prototypeSourceCount = mockSources.filter((sourceItem) => !liveSourceCodes.has(sourceItem.id)).length;
  const liveSourcesAvailable = liveSources.length > 0 && state !== 'unconfigured' && state !== 'error';
  const statusLabel = liveSourcesAvailable
    ? `Hybrid Mode · ${liveSources.length} live source${liveSources.length === 1 ? '' : 's'} · ${prototypeSourceCount} prototype fixture${prototypeSourceCount === 1 ? '' : 's'}`
    : 'Prototype Mode · 4 simulated sources';

  // Build search results
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    mockIncidents.forEach((inc) => {
      if (
        inc.title.toLowerCase().includes(q) ||
        inc.location.toLowerCase().includes(q) ||
        hazardTypeLabels[inc.hazardType].toLowerCase().includes(q) ||
        inc.source.toLowerCase().includes(q)
      ) {
        results.push({
          id: inc.id,
          label: inc.title,
          sublabel: `${hazardTypeLabels[inc.hazardType]} · ${inc.location}`,
          type: 'incident',
          route: `/incidents/${inc.id}`,
        });
      }
    });

    mockWatchlist.forEach((loc) => {
      if (
        loc.name.toLowerCase().includes(q) ||
        loc.country.toLowerCase().includes(q)
      ) {
        results.push({
          id: loc.id,
          label: loc.name,
          sublabel: `${loc.country} · Watchlist`,
          type: 'location',
          route: '/my-world',
        });
      }
    });

    mockSources.forEach((src) => {
      if (
        src.name.toLowerCase().includes(q) ||
        src.shortName.toLowerCase().includes(q)
      ) {
        results.push({
          id: src.id,
          label: src.shortName,
          sublabel: `${src.name} · Source`,
          type: 'source',
          route: '/data-trust',
        });
      }
    });

    const pages = [
      { label: 'Command Centre', route: '/command-centre' },
      { label: 'Global Map', route: '/global-map' },
      { label: 'My World', route: '/my-world' },
      { label: 'Incident Rooms', route: '/incidents' },
      { label: 'Alerts', route: '/alerts' },
      { label: 'Daily Briefing', route: '/briefing' },
      { label: 'Data Trust', route: '/data-trust' },
      { label: 'Settings', route: '/settings' },
    ];
    pages.forEach((pg) => {
      if (pg.label.toLowerCase().includes(q)) {
        results.push({
          id: pg.route,
          label: pg.label,
          sublabel: 'Page',
          type: 'page',
          route: pg.route,
        });
      }
    });

    return results.slice(0, 8);
  }, [searchQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && searchResults[activeIndex]) {
      e.preventDefault();
      navigate(searchResults[activeIndex].route);
      setSearchOpen(false);
      setSearchQuery('');
      searchInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    searchResults.forEach((r) => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });
    return groups;
  }, [searchResults]);

  const groupLabels: Record<string, string> = {
    incident: 'Incidents',
    location: 'Locations',
    source: 'Sources',
    page: 'Pages',
  };

  const groupIcons: Record<string, typeof AlertOctagon> = {
    incident: AlertOctagon,
    location: MapPin,
    source: Server,
    page: ArrowRight,
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-700/60 bg-ink-950/80 px-4 backdrop-blur-md lg:px-6">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-ink-700/40 hover:text-slate-200 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={handleSearchKey}
          placeholder="Search incidents, locations, sources…"
          aria-label="Global search"
          className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 transition-colors focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
        />

        {/* Search dropdown */}
        {searchOpen && searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 animate-slide-up">
            <div className="panel max-h-80 overflow-y-auto p-2">
              {searchResults.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-slate-500">No matching prototype records found.</p>
                </div>
              ) : (
                Object.entries(groupedResults).map(([type, items]) => {
                  const GroupIcon = groupIcons[type];
                  return (
                    <div key={type} className="mb-1">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {groupLabels[type]}
                      </p>
                      {items.map((result) => {
                        const flatIndex = searchResults.indexOf(result);
                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            onClick={() => {
                              navigate(result.route);
                              setSearchOpen(false);
                              setSearchQuery('');
                              searchInputRef.current?.blur();
                            }}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                              flatIndex === activeIndex
                                ? 'bg-cyan-500/10'
                                : 'hover:bg-ink-700/40'
                            }`}
                          >
                            <GroupIcon className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-200 truncate">
                                {result.label}
                              </p>
                              {result.sublabel && (
                                <p className="text-[10px] text-slate-500 truncate">
                                  {result.sublabel}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-600" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Prototype status with popover */}
      <div className="relative hidden md:block">
        <button
          onClick={() => setStatusOpen((v) => !v)}
          aria-label="Hybrid data status"
          aria-expanded={statusOpen}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
            liveSourcesAvailable
              ? 'border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40'
              : 'border-warning-500/20 bg-warning-500/5 hover:border-warning-500/40'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${liveSourcesAvailable ? 'bg-cyan-400 animate-pulse-dot' : 'bg-warning-500 animate-amber-pulse'}`} />
          <span className="text-xs text-slate-400">
            <span className={`font-medium ${liveSourcesAvailable ? 'text-cyan-300' : 'text-warning-400'}`}>
              {liveSourcesAvailable ? 'Hybrid Mode' : 'Prototype Mode'}
            </span>
            {' · '}{statusLabel.split(' · ').slice(1).join(' · ')}
          </span>
        </button>

        {statusOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-20 w-72 animate-slide-up">
              <div className="panel p-4">
                <div className="border-b border-ink-700/60 pb-3">
                  <p className="text-sm font-semibold text-slate-200">Sentinel Atlas Data Mode</p>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Sentinel Atlas distinguishes stored source-backed records from local prototype fixtures.
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {liveSources.length > 0 ? liveSources.map((source) => {
                    const count = liveRecordCountByCode.get(source.code) ?? 0;
                    const operational = source.ingestion_status === 'operational';

                    return (
                      <div key={source.id} className={`rounded-lg border p-2.5 ${operational ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-ink-700/60 bg-ink-850/30'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-300">{liveSourceLabel(source.code, source.display_name)}</span>
                          <span className={`text-[10px] ${operational ? 'text-cyan-300' : 'text-slate-500'}`}>
                            {source.ingestion_status ?? 'status unavailable'}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Source-backed records · {count} active
                        </p>
                      </div>
                    );
                  }) : (
                    <div className="rounded-lg border border-ink-700/60 bg-ink-850/30 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">LIVE SOURCE RECORDS</span>
                        <span className="text-[10px] text-slate-500">Unavailable</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Live source data is not currently available.
                      </p>
                    </div>
                  )}
                  {mockSources.filter((src) => !liveSourceCodes.has(src.id)).map((src) => (
                    <div key={src.id} className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-850/30 px-2.5 py-2">
                      <span className="text-xs text-slate-400">{src.shortName}</span>
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Prototype fixture
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                  Sentinel Atlas distinguishes stored source-backed records from local prototype fixtures.
                </p>
                <button
                  onClick={() => {
                    navigate('/data-trust');
                    setStatusOpen(false);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10"
                >
                  View Data Trust
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setNotifOpen((v) => !v)}
          aria-label={`Alerts — ${unreadCount} unread`}
          className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-ink-700/40 hover:text-slate-200"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-ink-950">
              {unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-20 w-80 animate-slide-up">
              <div className="panel p-3">
                <div className="flex items-center justify-between border-b border-ink-700/60 pb-2">
                  <p className="text-sm font-semibold text-slate-200">Recent Alerts</p>
                  <span className="text-[10px] text-slate-500">Prototype fixtures</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {latestAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => {
                        markAlertRead(alert.id);
                        navigate(`/incidents/${alert.incidentId}`);
                        setNotifOpen(false);
                      }}
                      className="block w-full rounded-lg border border-ink-700/60 bg-ink-850/40 p-2.5 text-left transition-colors hover:border-cyan-500/20 hover:bg-ink-800/40"
                    >
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={alert.severity} size="xs" />
                        <span className="text-[10px] text-slate-500 truncate">
                          {hazardTypeLabels[alert.hazardType]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-200 leading-snug truncate">
                        {alert.title}
                      </p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    navigate('/alerts');
                    setNotifOpen(false);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10"
                >
                  View all alerts
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => setProfileOpen((v) => !v)}
          aria-label="Open profile menu"
          aria-expanded={profileOpen}
          className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-ink-700/40"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10">
            <User className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium text-slate-200">{profileDisplayName}</p>
            <p className="text-[10px] text-slate-500">{isAuthenticated ? 'Signed in' : isConfigured ? 'Preview mode' : 'Auth unavailable'}</p>
          </div>
          <ChevronDown className="hidden sm:block h-4 w-4 text-slate-500" />
        </button>

        {profileOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setProfileOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 z-20 w-56 animate-slide-up">
              <div className="panel p-2">
                <div className="border-b border-ink-700/60 px-3 py-2">
                  <p className="text-sm font-medium text-slate-200">{profileDisplayName}</p>
                  <p className="text-xs text-slate-500">{isAuthenticated ? user?.email ?? 'Signed in' : 'Local prototype session'}</p>
                </div>
                <div className="mt-1 space-y-0.5">
                  {!isAuthenticated && (
                    <>
                      <button
                        onClick={() => {
                          navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
                          setProfileOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/15"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        Sign in to your workspace
                      </button>
                      <div className="my-1 border-t border-ink-700/60" />
                    </>
                  )}
                  <button
                    onClick={() => {
                      navigate('/settings');
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-ink-700/40 hover:text-slate-200"
                  >
                    <SettingsIcon className="h-3.5 w-3.5" />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      navigate('/data-trust');
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-ink-700/40 hover:text-slate-200"
                  >
                    <Server className="h-3.5 w-3.5" />
                    Data Trust
                  </button>
                  <div className="my-1 border-t border-ink-700/60" />
                  <button
                    onClick={async () => {
                      if (signingOut) return;
                      setSigningOut(true);
                      await signOut();
                      setSigningOut(false);
                      setProfileOpen(false);
                      navigate('/');
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-ink-700/40 hover:text-slate-200"
                    disabled={signingOut}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {signingOut ? 'Signing out...' : isAuthenticated ? 'Sign out' : 'Return to landing'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export default TopBar;
