import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  MapPin,
  Settings2,
  ArrowRight,
  ShieldAlert,
  Ruler,
  Bell,
  Info,
} from 'lucide-react';
import {
  mockWatchlist,
  mockIncidents,
  hazardTypeLabels,
} from '../data/mockIncidents';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchSavedWatchlistLocations, type PersistedWatchlistLocation } from '../lib/watchlists';
import type { WatchlistLocation, Incident } from '../types';
import { SeverityBadge } from '../components/SeverityBadge';
import { IntegrityBadge } from '../components/StatusBadge';
import { PageHeader, PrototypeNotice, SectionHeader, EmptyState } from '../components/ui';

interface FeedItem {
  incident: Incident;
  location: WatchlistLocation;
  reason: string;
  ruleIcon: typeof Ruler;
}

interface DisplayedWatchlistLocation {
  id: string;
  label: string;
  sublabel: string;
  radiusKm: number;
  alertRules?: WatchlistLocation['alertRules'];
}

// Build a personalised feed by matching incidents to watchlist locations
function buildFeed(): FeedItem[] {
  const items: FeedItem[] = [];
  const reasons = [
    { text: 'Within 500 km of a watched location', icon: Ruler },
    { text: 'Matches your Earthquake alert rule', icon: Bell },
    { text: 'Matches your Cyclone alert rule', icon: Bell },
    { text: 'Matches your Flood alert rule', icon: Bell },
    { text: 'Within 800 km of a watched location', icon: Ruler },
  ];

  mockWatchlist.forEach((loc, locIdx) => {
    mockIncidents.forEach((inc, incIdx) => {
      if (loc.alertRules.includes(inc.hazardType)) {
        const reason = reasons[(locIdx + incIdx) % reasons.length];
        items.push({
          incident: inc,
          location: loc,
          reason: reason.text,
          ruleIcon: reason.icon,
        });
      }
    });
  });

  return items;
}

const prototypeFeed = buildFeed();

export function MyWorldPage() {
  const { isAuthenticated, user } = useAuth();
  const [savedLocations, setSavedLocations] = useState<PersistedWatchlistLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [tooltipReason, setTooltipReason] = useState<string | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  const loadLocations = useCallback(async () => {
    if (!isAuthenticated || !user || !supabase) {
      setSavedLocations([]);
      setLocationsError(null);
      setLoadingLocations(false);
      return;
    }

    setLoadingLocations(true);
    setLocationsError(null);
    try {
      const locations = await fetchSavedWatchlistLocations(supabase, user.id);
      if (!mountedRef.current) return;
      setSavedLocations(locations);
      setSelectedLocation((current) =>
        current && !locations.some((location) => location.id === current) ? null : current,
      );
    } catch {
      if (!mountedRef.current) return;
      setLocationsError('Could not sync your saved watchlist.');
    } finally {
      if (mountedRef.current) {
        setLoadingLocations(false);
      }
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    mountedRef.current = true;
    void loadLocations();
    return () => {
      mountedRef.current = false;
    };
  }, [loadLocations]);

  const displayedLocations: DisplayedWatchlistLocation[] = isAuthenticated
    ? savedLocations.map((location) => ({
      id: location.id,
      label: location.label,
      sublabel: location.country_code ?? location.region_name ?? 'Saved location',
      radiusKm: location.radius_km,
    }))
    : mockWatchlist.map((location) => ({
      id: location.id,
      label: location.name,
      sublabel: location.country,
      radiusKm: 500,
      alertRules: location.alertRules,
    }));

  const filteredFeed = selectedLocation && !isAuthenticated
    ? prototypeFeed.filter((item) => item.location.id === selectedLocation)
    : prototypeFeed;

  const selectedLocationName = selectedLocation
    ? displayedLocations.find((location) => location.id === selectedLocation)?.label ?? null
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="My World"
        subtitle={isAuthenticated ? 'A personalised intelligence feed grounded in your saved watchlist locations and alert context.' : 'Sign in to save and manage your watchlist locations across Sentinel Atlas.'}
      >
        <PrototypeNotice />
      </PageHeader>

      {/* Watchlist Summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SectionHeader title="Watchlist Summary" icon={Heart} />
          <div className="panel p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
                <Heart className="h-6 w-6 text-cyan-300" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-cyan-300">
                  {isAuthenticated ? savedLocations.length : mockWatchlist.length}
                </p>
                <p className="text-xs text-slate-500">Watched locations</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-ink-700/60 pt-4">
              {isAuthenticated && loadingLocations && savedLocations.length === 0 && (
                <p className="rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2.5 text-sm text-slate-500">
                  Loading saved watchlist...
                </p>
              )}
              {isAuthenticated && locationsError && (
                <button
                  type="button"
                  onClick={() => void loadLocations()}
                  className="w-full rounded-lg border border-error-500/20 bg-error-500/5 px-3 py-2.5 text-left text-sm text-error-300 transition-colors hover:border-error-500/40"
                >
                  Could not sync — Retry
                </button>
              )}
              {displayedLocations.map((loc) => (
                  <button
                    type="button"
                    key={loc.id}
                    onClick={() =>
                      setSelectedLocation((prev) =>
                        prev === loc.id ? null : loc.id,
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-lg border p-3 cursor-pointer transition-all hover:border-ink-600 ${
                      selectedLocation === loc.id
                        ? 'border-cyan-500/40 bg-cyan-500/5'
                        : 'border-ink-700/60 bg-ink-850/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{loc.label}</p>
                        <p className="text-[10px] text-slate-500">{loc.sublabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded border border-ink-600/60 bg-ink-800/60 px-1.5 py-0.5 text-[9px] text-slate-400">
                        {loc.radiusKm} km
                      </span>
                      {loc.alertRules?.map((rule) => (
                        <span
                          key={rule}
                          className="rounded border border-ink-600/60 bg-ink-800/60 px-1.5 py-0.5 text-[9px] text-slate-400"
                        >
                          {hazardTypeLabels[rule].slice(0, 4)}
                        </span>
                      ))}
                    </div>
                  </button>
              ))}
            </div>

            <Link to="/settings" className="btn-secondary mt-4 w-full">
              <Settings2 className="h-4 w-4" />
              {isAuthenticated ? 'Manage Watchlist' : 'Sign in to manage watchlist'}
            </Link>
          </div>
        </div>

        {/* Personalised feed */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <SectionHeader title="Personalised Feed" icon={ShieldAlert} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-medium text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Personal relevance
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            {selectedLocationName ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Filtered: {selectedLocationName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                Showing all locations
              </span>
            )}
          </div>
          {filteredFeed.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No relevant incidents"
              message="No active incidents match your watched locations or alert rules. This is a prototype state."
            />
          ) : (
            <div
              key={selectedLocation}
              className="stagger-children animate-fade-in space-y-3"
            >
              {filteredFeed.map((item, idx) => (
                <Link
                  key={`${item.incident.id}-${item.location.id}-${idx}`}
                  to={`/incidents/${item.incident.id}`}
                  className="panel panel-hover group block p-4 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                      <MapPin className="h-4 w-4 text-cyan-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge severity={item.incident.severity} size="xs" />
                        <span className="text-xs text-slate-500">
                          {hazardTypeLabels[item.incident.hazardType]}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {item.incident.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {item.incident.summary}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        <span className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setTooltipReason(
                                tooltipReason === item.reason ? null : item.reason,
                              );
                            }}
                            className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300 cursor-pointer transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
                          >
                            <item.ruleIcon className="h-3 w-3" />
                            {item.reason}
                            <Info className="h-3 w-3 ml-0.5 text-cyan-400/70" />
                          </button>
                          {tooltipReason === item.reason && (
                            <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg border border-cyan-500/30 bg-ink-900/95 p-3 shadow-xl backdrop-blur-sm">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] leading-relaxed text-slate-300">
                                  This relevance signal is calculated from local prototype fixture rules. It is not a live proximity calculation.
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTooltipReason(null);
                                  }}
                                  className="flex-shrink-0 text-slate-500 hover:text-slate-200 transition-colors"
                                  aria-label="Close tooltip"
                                >
                                  ×
                                </button>
                              </div>
                              <div className="absolute left-4 top-full h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-cyan-500/30" />
                            </div>
                          )}
                        </span>
                        <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
                          <MapPin className="h-3 w-3" />
                          {item.location.name}
                        </span>
                        <IntegrityBadge status={item.incident.integrity} size="xs" />
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-600 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Click-outside overlay to dismiss tooltip */}
      {tooltipReason && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setTooltipReason(null)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default MyWorldPage;
