import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Heart,
  Bell,
  Palette,
  Clock,
  ShieldCheck,
  Plus,
  Check,
  Search,
  Loader2,
  Trash2,
} from 'lucide-react';
import { mockWatchlist, hazardTypeLabels } from '../data/mockIncidents';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchSavedWatchlistLocations,
  removeWatchlistLocation,
  saveWatchlistLocation,
  searchLocationResults,
  updateWatchlistLocationRadius,
  type PersistedWatchlistLocation,
  type LocationSearchResult,
} from '../lib/watchlists';
import type { HazardType } from '../types';
import { PageHeader, PrototypeNotice, SectionHeader } from '../components/ui';

const allHazardTypes: HazardType[] = [
  'earthquake',
  'wildfire',
  'flood',
  'cyclone',
  'volcano',
  'severe-weather',
];

const alertChannels = [
  { id: 'in-app', label: 'In-app notifications', enabled: true },
  { id: 'email', label: 'Email digest', enabled: true },
  { id: 'push', label: 'Push notifications', enabled: false },
];

const severityThresholds = [
  { value: 'critical', label: 'Critical', enabled: true },
  { value: 'high', label: 'High', enabled: true },
  { value: 'elevated', label: 'Elevated', enabled: true },
  { value: 'advisory', label: 'Advisory', enabled: false },
];

const radiusOptions = [100, 250, 500, 800, 1800];
type WatchlistStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'updating' | 'removing' | 'error';

function sortSavedLocations(locations: PersistedWatchlistLocation[]): PersistedWatchlistLocation[] {
  return [...locations].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, profile, isConfigured } = useAuth();

  const [channels, setChannels] = useState(alertChannels);
  const [thresholds, setThresholds] = useState(severityThresholds);
  const [theme, setTheme] = useState('midnight');
  const [timezone, setTimezone] = useState('UTC');
  const [hazardTypes, setHazardTypes] = useState<Record<HazardType, boolean>>({
    earthquake: true,
    wildfire: true,
    flood: true,
    cyclone: true,
    volcano: true,
    'severe-weather': true,
  });
  const [savedToast, setSavedToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<LocationSearchResult | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [radiusKm, setRadiusKm] = useState(500);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savedLocations, setSavedLocations] = useState<PersistedWatchlistLocation[]>([]);
  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatus>('idle');
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [updatingRadiusId, setUpdatingRadiusId] = useState<string | null>(null);
  const [removingLocationId, setRemovingLocationId] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const toastResetRef = useRef<number | null>(null);
  const searchInFlightRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const statusResetRef = useRef<number | null>(null);

  const profileDisplayName = useMemo(() => {
    if (!isAuthenticated) {
      return 'Analyst';
    }

    return profile?.display_name?.trim() || user?.email?.split('@')[0] || 'Signed-in analyst';
  }, [isAuthenticated, profile?.display_name, user?.email]);

  const savedWatchlistLabel = useMemo(() => {
    if (watchlistStatus === 'loading') return 'Loading saved watchlist...';
    if (watchlistStatus === 'saving') return 'Saving location...';
    if (watchlistStatus === 'saved') return 'Saved';
    if (watchlistStatus === 'updating') return 'Updating radius...';
    if (watchlistStatus === 'removing') return 'Removing location...';
    if (watchlistStatus === 'error') return 'Could not sync';
    return `${savedLocations.length} saved`;
  }, [savedLocations.length, watchlistStatus]);

  const showSavedToast = () => {
    if (toastResetRef.current !== null) {
      window.clearTimeout(toastResetRef.current);
    }

    setSavedToast(true);
    toastResetRef.current = window.setTimeout(() => {
      if (mountedRef.current) {
        setSavedToast(false);
      }
      toastResetRef.current = null;
    }, 2000);
  };

  const toggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
    showSavedToast();
  };

  const toggleThreshold = (value: string) => {
    setThresholds((prev) =>
      prev.map((t) => (t.value === value ? { ...t, enabled: !t.enabled } : t))
    );
    showSavedToast();
  };

  const toggleHazard = (ht: HazardType) => {
    setHazardTypes((prev) => ({ ...prev, [ht]: !prev[ht] }));
    showSavedToast();
  };

  const resetSavedStatusSoon = useCallback(() => {
    if (statusResetRef.current !== null) {
      window.clearTimeout(statusResetRef.current);
    }

    statusResetRef.current = window.setTimeout(() => {
      setWatchlistStatus((current) => (current === 'saved' ? 'idle' : current));
      statusResetRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (statusResetRef.current !== null) {
        window.clearTimeout(statusResetRef.current);
      }
      if (toastResetRef.current !== null) {
        window.clearTimeout(toastResetRef.current);
      }
    };
  }, []);

  const reconcileSavedLocation = useCallback((location: PersistedWatchlistLocation) => {
    setSavedLocations((current) => sortSavedLocations([
      location,
      ...current.filter((item) => item.id !== location.id),
    ]));
  }, []);

  const loadSavedLocations = useCallback(async () => {
    if (!isAuthenticated || !user || !supabase || !isConfigured) {
      setSavedLocations([]);
      setWatchlistStatus('idle');
      setWatchlistError(null);
      return;
    }

    setWatchlistStatus('loading');
    setWatchlistError(null);
    try {
      const locations = await fetchSavedWatchlistLocations(supabase, user.id);
      if (!mountedRef.current) return;
      setSavedLocations(sortSavedLocations(locations));
      setWatchlistStatus('idle');
    } catch {
      if (!mountedRef.current) return;
      setWatchlistError('Could not sync your saved watchlist.');
      setWatchlistStatus('error');
    }
  }, [isAuthenticated, isConfigured, user]);

  useEffect(() => {
    void loadSavedLocations();
  }, [loadSavedLocations]);

  const runLocationSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (searchInFlightRef.current || searching) {
      return;
    }

    if (!query || !supabase || !isAuthenticated) {
      setSearchResults([]);
      setSearchMessage(null);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    searchInFlightRef.current = true;

    setSearching(true);
    setSearchResults([]);
    setSearchMessage('Searching worldwide...');
    setSelectedResult(null);
    setDraftLabel('');

    try {
      const { results, note } = await searchLocationResults(supabase, query);
      if (!mountedRef.current || requestId !== searchRequestIdRef.current) {
        return;
      }

      setSearchResults(results);
      if (results.length === 0) {
        setSearchMessage('No locations matched that query. Try a broader city or region name.');
      } else {
        setSearchMessage(note);
      }
    } catch {
      if (mountedRef.current && requestId === searchRequestIdRef.current) {
        setSearchMessage('Location search is unavailable. Please try again.');
      }
    } finally {
      if (mountedRef.current && requestId === searchRequestIdRef.current) {
        setSearching(false);
        searchInFlightRef.current = false;
      }
    }
  }, [isAuthenticated, searchQuery, searching]);

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    if (selectedResult) {
      setSelectedResult(null);
      setDraftLabel('');
      setRadiusKm(500);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setSearchMessage(null);
    }
  };

  const confirmLocation = (result: LocationSearchResult) => {
    setSelectedResult(result);
    setDraftLabel(result.place_name);
    setRadiusKm(500);
    setSearchResults([]);
    setSearchMessage('Adjust the radius and save the watchlist location.');
  };

  const handleSaveLocation = async () => {
    if (!supabase || !user || !selectedResult || savingLocation) {
      return;
    }

    const label = draftLabel.trim();
    if (!label) {
      setSearchMessage('Add a friendly label before saving this location.');
      return;
    }

    setSavingLocation(true);
    setWatchlistStatus('saving');
    setWatchlistError(null);
    setSearchMessage(null);

    try {
      const savedLocation = await saveWatchlistLocation(supabase, user.id, {
        label,
        place_name: selectedResult.place_name,
        country_code: selectedResult.country_code,
        region_name: selectedResult.region_name,
        latitude: selectedResult.latitude,
        longitude: selectedResult.longitude,
        timezone: selectedResult.timezone,
        radius_km: radiusKm,
        provider: 'open-meteo-geocoding',
        provider_location_id: selectedResult.provider_location_id,
      });
      if (!mountedRef.current) return;
      reconcileSavedLocation(savedLocation);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedResult(null);
      setDraftLabel('');
      setRadiusKm(500);
      setSearchMessage('Location saved to your watchlist.');
      setWatchlistStatus('saved');
      resetSavedStatusSoon();
      showSavedToast();
    } catch {
      if (!mountedRef.current) return;
      setWatchlistError('Could not save this location.');
      setWatchlistStatus('error');
      setSearchMessage('Could not save this location. Please try again.');
    } finally {
      if (mountedRef.current) {
        setSavingLocation(false);
      }
    }
  };

  const handleRadiusUpdate = async (locationId: string, nextRadius: number) => {
    if (!supabase) {
      return;
    }

    const currentLocation = savedLocations.find((location) => location.id === locationId);
    if (currentLocation?.radius_km === nextRadius || updatingRadiusId === locationId) {
      return;
    }

    setUpdatingRadiusId(locationId);
    setWatchlistStatus('updating');
    setWatchlistError(null);
    try {
      const updatedLocation = await updateWatchlistLocationRadius(supabase, locationId, nextRadius);
      if (!mountedRef.current) return;
      reconcileSavedLocation(updatedLocation);
      setWatchlistStatus('saved');
      resetSavedStatusSoon();
    } catch {
      if (!mountedRef.current) return;
      setWatchlistError('Could not update the radius.');
      setWatchlistStatus('error');
      setSearchMessage('Could not update the radius. Please try again.');
    } finally {
      if (mountedRef.current) {
        setUpdatingRadiusId(null);
      }
    }
  };

  const handleRemoveLocation = async (locationId: string) => {
    if (!supabase || removingLocationId === locationId) {
      return;
    }

    setRemovingLocationId(locationId);
    setWatchlistStatus('removing');
    setWatchlistError(null);
    try {
      await removeWatchlistLocation(supabase, locationId);
      if (!mountedRef.current) return;
      setSavedLocations((current) => current.filter((location) => location.id !== locationId));
      setWatchlistStatus('saved');
      resetSavedStatusSoon();
    } catch {
      if (!mountedRef.current) return;
      setWatchlistError('Could not remove this location.');
      setWatchlistStatus('error');
      setSearchMessage('Could not remove this location. Please try again.');
    } finally {
      if (mountedRef.current) {
        setRemovingLocationId(null);
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, watchlist, alert preferences, and privacy. Uses prototype fixture data."
      >
        <PrototypeNotice />
      </PageHeader>

      <div className="space-y-6">
        {/* Profile card */}
        <div className="panel p-5">
          <SectionHeader title="Profile" icon={User} />
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10">
              <User className="h-8 w-8 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                {profileDisplayName}
              </h3>
              <p className="text-sm text-slate-500">
                {isAuthenticated ? 'Signed in and ready for persistent watchlist management' : 'Prototype preview'}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {isAuthenticated ? user?.email : 'analyst@sentinel-atlas.prototype'}
              </p>
            </div>
          </div>
        </div>

        {/* Watchlist settings */}
        <div className="panel p-5">
          <SectionHeader title="Watchlist" icon={Heart} />

          {!isAuthenticated ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-4">
                <p className="text-sm font-medium text-slate-200">Sign in to save a personal watchlist.</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Your saved locations stay attached to your Supabase account and power future personalised alert context.
                </p>
                <button onClick={() => navigate('/auth')} className="btn-secondary mt-3">
                  <Plus className="h-3.5 w-3.5" />
                  Sign in to manage watchlist
                </button>
              </div>

              <div className="rounded-lg border border-ink-700/60 bg-ink-850/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Guest preview locations</p>
                <div className="mt-3 space-y-2">
                  {mockWatchlist.map((loc) => (
                    <div key={loc.id} className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-850/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{loc.name}</p>
                        <p className="text-[10px] text-slate-500">{loc.country}</p>
                      </div>
                      <span className="text-[10px] text-slate-500">Preview only</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div className="flex items-start gap-2">
                  <Search className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">Search worldwide for a monitoring location</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Add a city, region, or landmark. Sentinel Atlas stores the location as a radius-based monitored area, not as a country-wide watch.
                    </p>
                  </div>
                </div>
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runLocationSearch();
                  }}
                >
                  <input
                    value={searchQuery}
                    onChange={(e) => handleSearchQueryChange(e.target.value)}
                    placeholder="Search cities or regions"
                    className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="btn-secondary whitespace-nowrap"
                    disabled={searching || !searchQuery.trim()}
                  >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {searching ? 'Searching worldwide...' : 'Search'}
                  </button>
                </form>
                {searchMessage && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{searchMessage}</p>}
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.provider_location_id ?? `${result.place_name}-${result.longitude}`}
                      onClick={() => confirmLocation(result)}
                      className="flex w-full items-start justify-between rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-3 text-left transition-colors hover:border-cyan-500/30 hover:bg-ink-800/40"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-200">{result.place_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {result.region_name ? `${result.region_name}, ` : ''}{result.country}
                        </p>
                      </div>
                      <span className="text-[10px] text-cyan-300">Select</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedResult && (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{selectedResult.place_name}</p>
                      <p className="text-[11px] text-slate-500">{selectedResult.country}{selectedResult.region_name ? ` · ${selectedResult.region_name}` : ''}</p>
                    </div>
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-medium text-cyan-300">
                      Radius-based monitoring
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm text-slate-300">
                      Label this location
                      <input
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                        placeholder="Example: Home base"
                      />
                    </label>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Monitoring radius</p>
                      <div className="flex flex-wrap gap-2">
                        {radiusOptions.map((option) => (
                          <button
                            key={option}
                            onClick={() => setRadiusKm(option)}
                            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                              radiusKm === option
                                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                                : 'border-ink-700/60 bg-ink-850/40 text-slate-400 hover:border-cyan-500/20'
                            }`}
                          >
                            {option} km
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2 text-[11px] text-slate-500">
                      <span>{selectedResult.timezone ?? 'Timezone unavailable'}</span>
                      <span>{selectedResult.latitude.toFixed(2)}, {selectedResult.longitude.toFixed(2)}</span>
                    </div>
                    <button onClick={() => void handleSaveLocation()} className="btn-secondary" disabled={savingLocation || !draftLabel.trim()}>
                      {savingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {savingLocation ? 'Saving location...' : 'Save location'}
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-ink-700/60 bg-ink-850/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saved watchlist</p>
                  {watchlistStatus === 'error' ? (
                    <button
                      type="button"
                      onClick={() => void loadSavedLocations()}
                      className="text-[10px] font-medium text-error-300 transition-colors hover:text-error-200"
                    >
                      Could not sync — Retry
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500">{savedWatchlistLabel}</span>
                  )}
                </div>
                {watchlistError && watchlistStatus === 'error' && (
                  <p className="mt-2 text-[11px] leading-relaxed text-error-300">{watchlistError}</p>
                )}
                {watchlistStatus === 'loading' && savedLocations.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Loading saved watchlist...</p>
                ) : savedLocations.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No saved locations yet. Search above to add one.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {savedLocations.map((location) => (
                      <div key={location.id} className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-200">{location.label}</p>
                            <p className="text-[10px] text-slate-500">
                              {location.place_name}{location.region_name ? ` · ${location.region_name}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-medium text-cyan-300">
                            {location.radius_km} km radius
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {radiusOptions.map((option) => (
                            <button
                              key={`${location.id}-${option}`}
                              onClick={() => void handleRadiusUpdate(location.id, option)}
                              className={`rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
                                location.radius_km === option
                                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                                  : 'border-ink-700/60 bg-ink-850/40 text-slate-400 hover:border-cyan-500/20'
                              }`}
                              disabled={updatingRadiusId === location.id}
                            >
                              {updatingRadiusId === location.id ? <Loader2 className="h-3 w-3 animate-spin" /> : option} km
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-[10px] text-slate-500">Stored as a radius-based monitoring area</p>
                          <button
                            onClick={() => void handleRemoveLocation(location.id)}
                            className="flex items-center gap-1 rounded border border-ink-700/60 bg-ink-850/50 px-2 py-1 text-[10px] text-slate-400 transition-colors hover:border-error-500/30 hover:text-error-300"
                            disabled={removingLocationId === location.id}
                          >
                            {removingLocationId === location.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alert preferences */}
        <div className="panel p-5">
          <SectionHeader title="Alert Preferences" icon={Bell} />

          {/* Channels */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-slate-400">Delivery Channels</p>
            <div className="space-y-2">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => toggleChannel(channel.id)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-ink-700/60 bg-ink-850/40 p-3 transition-colors hover:border-ink-600"
                >
                  <span className="text-sm text-slate-200">{channel.label}</span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      channel.enabled ? 'bg-cyan-500' : 'bg-ink-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        channel.enabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity thresholds */}
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">Severity Thresholds</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {thresholds.map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleThreshold(t.value)}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    t.enabled
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-ink-700/60 bg-ink-850/40 text-slate-500'
                  }`}
                >
                  {t.enabled && <Check className="h-3 w-3" />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hazard types */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-400">Hazard Types</p>
            <div className="flex flex-wrap gap-2">
              {allHazardTypes.map((ht) => (
                <button
                  key={ht}
                  onClick={() => toggleHazard(ht)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    hazardTypes[ht]
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-ink-700/60 bg-ink-850/40 text-slate-500'
                  }`}
                >
                  {hazardTypes[ht] && <Check className="h-3 w-3" />}
                  {hazardTypeLabels[ht]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Theme preference */}
        <div className="panel p-5">
          <SectionHeader title="Theme Preference" icon={Palette} />
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'midnight', label: 'Midnight', colors: ['#070a12', '#0d1320', '#22d3ee'] },
              { id: 'graphite', label: 'Graphite', colors: ['#1a1a1a', '#2a2a2a', '#3b82f6'] },
              { id: 'tactical', label: 'Tactical', colors: ['#0a0e0a', '#111811', '#10b981'] },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  showSavedToast();
                }}
                className={`cursor-pointer rounded-lg border p-3 transition-all ${
                  theme === t.id
                    ? 'border-cyan-500/40 bg-cyan-500/5'
                    : 'border-ink-700/60 bg-ink-850/40 hover:border-ink-600'
                }`}
              >
                <div className="flex gap-1.5 mb-2">
                  {t.colors.map((c) => (
                    <span
                      key={c}
                      className="h-4 w-4 rounded-full border border-ink-600/40"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${theme === t.id ? 'text-cyan-300' : 'text-slate-400'}`}>
                  {t.label}
                </p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-600">
            Theme switching is a placeholder in this prototype.
          </p>
        </div>

        {/* Timezone */}
        <div className="panel p-5">
          <SectionHeader title="Timezone" icon={Clock} />
          <select
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
              showSavedToast();
            }}
            className="w-full cursor-pointer rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2.5 text-sm text-slate-200 transition-colors focus:border-cyan-500/40 focus:outline-none"
          >
            <option value="UTC">UTC (Coordinated Universal Time)</option>
            <option value="IST">IST (India Standard Time)</option>
            <option value="MYT">MYT (Malaysia Time)</option>
            <option value="EST">EST (Eastern Standard Time)</option>
            <option value="PST">PST (Pacific Standard Time)</option>
            <option value="CET">CET (Central European Time)</option>
          </select>
          <p className="mt-2 text-[10px] text-slate-600">
            Timezone selection is a placeholder in this prototype.
          </p>
        </div>

        {/* Privacy and data-use */}
        <div className="panel p-5">
          <SectionHeader title="Privacy & Data Use" icon={ShieldCheck} />
          <div className="space-y-3">
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
              <h4 className="text-sm font-medium text-slate-200">Watchlist Privacy</h4>
              <p className="mt-1 text-xs text-slate-500">
                {isAuthenticated
                  ? 'Your watched locations are stored with your Sentinel Atlas account and protected by user-level access rules.'
                  : 'Guest preview locations stay local to this prototype session.'}
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
              <h4 className="text-sm font-medium text-slate-200">Data Use</h4>
              <p className="mt-1 text-xs text-slate-500">
                Sentinel Atlas uses your watchlist and alert preferences solely to filter
                and prioritise intelligence. We do not sell or share your data.
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
              <h4 className="text-sm font-medium text-slate-200">Prototype Limitations</h4>
              <p className="mt-1 text-xs text-slate-500">
                Public intelligence screens can still use prototype fixtures. Signed-in watchlist locations are saved to your account.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Saved toast */}
      {savedToast && (
        <div className="animate-toast-in fixed bottom-6 right-6 flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-ink-850/90 px-4 py-3 shadow-lg backdrop-blur">
          <Check className="h-4 w-4 text-cyan-300" />
          <span className="text-sm text-slate-200">Saved</span>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
