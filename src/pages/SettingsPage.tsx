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
import {
  createAlertRule,
  deleteAlertRule,
  fetchSavedAlertRules,
  updateAlertRuleEnabled,
  updateAlertRuleLocationScope,
  type AlertRuleSeverity,
  type PersistedAlertRule,
} from '../lib/alertRules';
import { PageHeader, SectionHeader } from '../components/ui';

const alertRuleHazards = [
  'earthquake',
  'wildfire',
  'flood',
  'cyclone',
  'volcano',
  'severe-weather',
] as const;

const alertRuleSeverities: AlertRuleSeverity[] = [
  'advisory',
  'elevated',
  'high',
  'critical',
];

const radiusOptions = [100, 250, 500, 800, 1800];
type WatchlistStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'updating' | 'removing' | 'error';
type AlertRuleStatus = 'idle' | 'loading' | 'creating' | 'updating' | 'removing' | 'error';

function humanize(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function alertRuleHazardLabel(hazardType: string | null): string {
  if (!hazardType) {
    return 'All hazards';
  }

  return (
    hazardTypeLabels[hazardType as keyof typeof hazardTypeLabels] ??
    humanize(hazardType)
  );
}

function alertRuleDistanceLabel(maximumDistanceKm: number | null): string {
  return maximumDistanceKm === null
    ? 'Uses saved-location radius'
    : `${maximumDistanceKm.toLocaleString()} km maximum`;
}

function alertRuleLocationScopeLabel(
  rule: PersistedAlertRule,
  locations: PersistedWatchlistLocation[],
): string {
  if (!rule.watchlist_location_id) {
    return 'All saved locations';
  }

  const location = locations.find((item) => item.id === rule.watchlist_location_id);
  return location ? `Only ${location.label}` : 'Selected saved location';
}

function sortSavedLocations(locations: PersistedWatchlistLocation[]): PersistedWatchlistLocation[] {
  return [...locations].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, profile, isConfigured } = useAuth();

  const [theme, setTheme] = useState('midnight');
  const [timezone, setTimezone] = useState('UTC');
  const [alertRules, setAlertRules] = useState<PersistedAlertRule[]>([]);
  const [alertRuleStatus, setAlertRuleStatus] = useState<AlertRuleStatus>('idle');
  const [alertRuleError, setAlertRuleError] = useState<string | null>(null);
  const [draftRuleName, setDraftRuleName] = useState('');
  const [draftRuleHazard, setDraftRuleHazard] = useState<string>('all');
  const [draftRuleSeverity, setDraftRuleSeverity] = useState<AlertRuleSeverity>('high');
  const [draftRuleDistanceCap, setDraftRuleDistanceCap] = useState<string>('watchlist-radius');
  const [draftRuleLocationScope, setDraftRuleLocationScope] = useState<string>('all-locations');
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);
  const [removingRuleId, setRemovingRuleId] = useState<string | null>(null);
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

  const savedAlertRulesLabel = useMemo(() => {
    if (alertRuleStatus === 'loading') return 'Loading rules...';
    if (alertRuleStatus === 'creating') return 'Creating rule...';
    if (alertRuleStatus === 'updating') return 'Updating rule...';
    if (alertRuleStatus === 'removing') return 'Removing rule...';
    if (alertRuleStatus === 'error') return 'Could not sync';
    return `${alertRules.length} saved`;
  }, [alertRuleStatus, alertRules.length]);

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

  const loadAlertRules = useCallback(async () => {
    if (!isAuthenticated || !user || !supabase || !isConfigured) {
      setAlertRules([]);
      setAlertRuleStatus('idle');
      setAlertRuleError(null);
      return;
    }

    setAlertRuleStatus('loading');
    setAlertRuleError(null);

    try {
      const rules = await fetchSavedAlertRules(supabase, user.id);
      if (!mountedRef.current) return;
      setAlertRules(rules);
      setAlertRuleStatus('idle');
    } catch {
      if (!mountedRef.current) return;
      setAlertRules([]);
      setAlertRuleError('Could not sync your saved alert rules.');
      setAlertRuleStatus('error');
    }
  }, [isAuthenticated, isConfigured, user]);

  useEffect(() => {
    void loadAlertRules();
  }, [loadAlertRules]);

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

    const scopedRules = alertRules.filter(
      (rule) => rule.watchlist_location_id === locationId,
    );

    if (scopedRules.length > 0) {
      const location = savedLocations.find((item) => item.id === locationId);
      const ruleNames = scopedRules.map((rule) => `"${rule.name}"`).join(', ');
      setWatchlistError(
        `${location?.label ?? 'This location'} is targeted by ${ruleNames}. Re-scope or remove the affected rule before deleting this location.`,
      );
      setWatchlistStatus('error');
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

  const handleCreateAlertRule = async () => {
    if (!supabase || !user || alertRuleStatus === 'creating') {
      return;
    }

    const name = draftRuleName.trim();

    if (!name) {
      setAlertRuleError('Give this alert rule a clear name before saving it.');
      return;
    }

    if (name.length > 120) {
      setAlertRuleError('Alert rule names must be 120 characters or fewer.');
      return;
    }

    if (savedLocations.length === 0) {
      setAlertRuleError('Add at least one saved monitoring location before creating a rule.');
      return;
    }

    const selectedLocationId =
      draftRuleLocationScope === 'all-locations'
        ? null
        : draftRuleLocationScope;

    if (
      selectedLocationId &&
      !savedLocations.some((location) => location.id === selectedLocationId)
    ) {
      setAlertRuleError('Choose a current saved location or apply this rule to all saved locations.');
      return;
    }

    const maximumDistanceKm =
      draftRuleDistanceCap === 'watchlist-radius'
        ? null
        : Number(draftRuleDistanceCap);

    if (
      maximumDistanceKm !== null &&
      (!Number.isFinite(maximumDistanceKm) || maximumDistanceKm <= 0)
    ) {
      setAlertRuleError('Choose a valid distance cap.');
      return;
    }

    setAlertRuleStatus('creating');
    setAlertRuleError(null);

    try {
      const created = await createAlertRule(supabase, user.id, {
        name,
        hazard_type: draftRuleHazard === 'all' ? null : draftRuleHazard,
        minimum_severity: draftRuleSeverity,
        maximum_distance_km: maximumDistanceKm,
        watchlist_location_id: selectedLocationId,
      });

      if (!mountedRef.current) return;

      setAlertRules((current) => [created, ...current]);
      setDraftRuleName('');
      setDraftRuleHazard('all');
      setDraftRuleSeverity('high');
      setDraftRuleDistanceCap('watchlist-radius');
      setDraftRuleLocationScope('all-locations');
      setAlertRuleStatus('idle');
      showSavedToast();
    } catch {
      if (!mountedRef.current) return;
      setAlertRuleError('Could not create this alert rule. Please try again.');
      setAlertRuleStatus('error');
    }
  };

  const handleAlertRuleEnabledChange = async (rule: PersistedAlertRule) => {
    if (!supabase || !user || updatingRuleId === rule.id) {
      return;
    }

    setUpdatingRuleId(rule.id);
    setAlertRuleStatus('updating');
    setAlertRuleError(null);

    try {
      const updated = await updateAlertRuleEnabled(
        supabase,
        user.id,
        rule.id,
        !rule.enabled,
      );

      if (!mountedRef.current) return;

      setAlertRules((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setAlertRuleStatus('idle');
      showSavedToast();
    } catch {
      if (!mountedRef.current) return;
      setAlertRuleError('Could not update this alert rule. Please try again.');
      setAlertRuleStatus('error');
    } finally {
      if (mountedRef.current) {
        setUpdatingRuleId(null);
      }
    }
  };

  const handleAlertRuleLocationScopeChange = async (
    rule: PersistedAlertRule,
    nextScope: string,
  ) => {
    if (!supabase || !user || updatingRuleId === rule.id) {
      return;
    }

    const watchlistLocationId =
      nextScope === 'all-locations'
        ? null
        : nextScope;

    if (
      watchlistLocationId &&
      !savedLocations.some((location) => location.id === watchlistLocationId)
    ) {
      setAlertRuleError('Choose a current saved location or apply this rule to all saved locations.');
      setAlertRuleStatus('error');
      return;
    }

    setUpdatingRuleId(rule.id);
    setAlertRuleStatus('updating');
    setAlertRuleError(null);

    try {
      const updated = await updateAlertRuleLocationScope(
        supabase,
        user.id,
        rule.id,
        watchlistLocationId,
      );

      if (!mountedRef.current) return;

      setAlertRules((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setAlertRuleStatus('idle');
      showSavedToast();
    } catch {
      if (!mountedRef.current) return;
      setAlertRuleError('Could not update the alert rule location scope. Please try again.');
      setAlertRuleStatus('error');
    } finally {
      if (mountedRef.current) {
        setUpdatingRuleId(null);
      }
    }
  };

  const handleRemoveAlertRule = async (ruleId: string) => {
    if (!supabase || !user || removingRuleId === ruleId) {
      return;
    }

    setRemovingRuleId(ruleId);
    setAlertRuleStatus('removing');
    setAlertRuleError(null);

    try {
      await deleteAlertRule(supabase, user.id, ruleId);

      if (!mountedRef.current) return;

      setAlertRules((current) => current.filter((rule) => rule.id !== ruleId));
      setAlertRuleStatus('idle');
      showSavedToast();
    } catch {
      if (!mountedRef.current) return;
      setAlertRuleError('Could not remove this alert rule. Please try again.');
      setAlertRuleStatus('error');
    } finally {
      if (mountedRef.current) {
        setRemovingRuleId(null);
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Settings"
        subtitle="Manage account-scoped watchlists and alert rules. Theme and timezone controls remain prototype preferences."
      />

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

        {/* Alert rules */}
        <div className="panel p-5">
          <SectionHeader title="Alert Rules" icon={Bell} />

          {!isAuthenticated ? (
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-4">
              <p className="text-sm font-medium text-slate-200">
                Sign in to manage private alert rules.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Rules are stored under your account and scoped to your primary watchlist.
                They do not create browser-generated notifications.
              </p>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="btn-secondary mt-3"
              >
                <Plus className="h-3.5 w-3.5" />
                Sign in to manage alert rules
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div className="flex items-start gap-2">
                  <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Rules can target all locations or one saved location
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      This account currently has {savedLocations.length} saved monitoring
                      location{savedLocations.length === 1 ? '' : 's'}. Server-side matching
                      evaluates newly changed active source records against these rules. A new
                      rule does not backfill historic notifications.
                    </p>
                  </div>
                </div>
              </div>

              <form
                className="rounded-lg border border-ink-700/60 bg-ink-850/30 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateAlertRule();
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Create alert rule
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Each rule is private to this account. Choose all saved locations or one specific location.
                    </p>
                  </div>
                  <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
                    {savedLocations.length} watched location{savedLocations.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-slate-400">Rule name</span>
                    <input
                      value={draftRuleName}
                      onChange={(event) => setDraftRuleName(event.target.value)}
                      maxLength={120}
                      placeholder="Example: High-severity earthquake watch"
                      className="mt-1 w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">Hazard</span>
                    <select
                      value={draftRuleHazard}
                      onChange={(event) => setDraftRuleHazard(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/40 focus:outline-none"
                    >
                      <option value="all">All hazards</option>
                      {alertRuleHazards.map((hazard) => (
                        <option key={hazard} value={hazard}>
                          {hazardTypeLabels[hazard]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">
                      Minimum severity
                    </span>
                    <select
                      value={draftRuleSeverity}
                      onChange={(event) =>
                        setDraftRuleSeverity(event.target.value as AlertRuleSeverity)
                      }
                      className="mt-1 w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/40 focus:outline-none"
                    >
                      {alertRuleSeverities.map((severity) => (
                        <option key={severity} value={severity}>
                          {humanize(severity)} or higher
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-slate-400">
                      Target location
                    </span>
                    <select
                      value={draftRuleLocationScope}
                      onChange={(event) => setDraftRuleLocationScope(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/40 focus:outline-none"
                    >
                      <option value="all-locations">
                        All saved locations in Primary watchlist
                      </option>
                      {savedLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          Only {location.label} · {location.place_name}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[10px] leading-relaxed text-slate-600">
                      A single-location rule checks only that saved location. An all-location
                      rule keeps the existing nearest-match behaviour across your watchlist.
                    </span>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-slate-400">
                      Rule distance cap
                    </span>
                    <select
                      value={draftRuleDistanceCap}
                      onChange={(event) => setDraftRuleDistanceCap(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink-700/60 bg-ink-850/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/40 focus:outline-none"
                    >
                      <option value="watchlist-radius">
                        Use each saved location&apos;s radius
                      </option>
                      {radiusOptions.map((radius) => (
                        <option key={radius} value={radius}>
                          {radius.toLocaleString()} km maximum
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[10px] leading-relaxed text-slate-600">
                      A saved location&apos;s own radius remains the default boundary. A rule
                      cap can make future matching stricter.
                    </span>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="btn-secondary"
                    disabled={
                      alertRuleStatus === 'creating' || savedLocations.length === 0
                    }
                  >
                    {alertRuleStatus === 'creating' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {alertRuleStatus === 'creating'
                      ? 'Creating rule...'
                      : 'Create alert rule'}
                  </button>
                  {savedLocations.length === 0 ? (
                    <span className="text-xs text-warning-300">
                      Add a saved monitoring location before creating a rule.
                    </span>
                  ) : null}
                </div>

                {alertRuleError && alertRuleStatus !== 'error' ? (
                  <p className="mt-3 text-xs leading-relaxed text-error-300">
                    {alertRuleError}
                  </p>
                ) : null}
              </form>

              <div className="rounded-lg border border-ink-700/60 bg-ink-850/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Saved alert rules
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Choose scope per rule
                    </p>
                  </div>

                  {alertRuleStatus === 'error' ? (
                    <button
                      type="button"
                      onClick={() => void loadAlertRules()}
                      className="text-[10px] font-medium text-error-300 transition-colors hover:text-error-200"
                    >
                      Could not sync — Retry
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      {savedAlertRulesLabel}
                    </span>
                  )}
                </div>

                {alertRuleError && alertRuleStatus === 'error' ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-error-300">
                    {alertRuleError}
                  </p>
                ) : null}

                {alertRuleStatus === 'loading' && alertRules.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Loading saved alert rules...</p>
                ) : alertRules.length === 0 ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    No saved alert rules yet. Create one above to match newly changed active
                    source records against a saved location scope.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {alertRules.map((rule) => {
                      const updating = updatingRuleId === rule.id;
                      const removing = removingRuleId === rule.id;

                      return (
                        <div
                          key={rule.id}
                          className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-slate-200">
                                  {rule.name}
                                </p>
                                <span
                                  className={`chip ${
                                    rule.enabled
                                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                                      : 'border-ink-600/60 bg-ink-800/60 text-slate-400'
                                  }`}
                                >
                                  {rule.enabled ? 'Enabled' : 'Paused'}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                {alertRuleHazardLabel(rule.hazard_type)} ·{' '}
                                {humanize(rule.minimum_severity)} or higher ·{' '}
                                {alertRuleDistanceLabel(rule.maximum_distance_km)} ·{' '}
                                {alertRuleLocationScopeLabel(rule, savedLocations)}
                              </p>
                              <label className="mt-3 block max-w-sm">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                  Target scope
                                </span>
                                <select
                                  value={rule.watchlist_location_id ?? 'all-locations'}
                                  onChange={(event) =>
                                    void handleAlertRuleLocationScopeChange(
                                      rule,
                                      event.target.value,
                                    )
                                  }
                                  disabled={updating || removing}
                                  className="mt-1 w-full rounded border border-ink-700/60 bg-ink-850/60 px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-500/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Target scope for ${rule.name}`}
                                >
                                  <option value="all-locations">
                                    All saved locations
                                  </option>
                                  {savedLocations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                      Only {location.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleAlertRuleEnabledChange(rule)}
                                disabled={updating || removing}
                                className="flex items-center gap-1.5 rounded border border-ink-700/60 bg-ink-850/50 px-2 py-1 text-[10px] text-slate-400 transition-colors hover:border-cyan-500/30 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label={
                                  rule.enabled
                                    ? `Pause ${rule.name}`
                                    : `Enable ${rule.name}`
                                }
                              >
                                {updating ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                {updating
                                  ? 'Saving...'
                                  : rule.enabled
                                    ? 'Pause'
                                    : 'Enable'}
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleRemoveAlertRule(rule.id)}
                                disabled={updating || removing}
                                className="flex items-center gap-1 rounded border border-ink-700/60 bg-ink-850/50 px-2 py-1 text-[10px] text-slate-400 transition-colors hover:border-error-500/30 hover:text-error-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {removing ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-ink-700/60 bg-ink-850/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Delivery status
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2.5">
                    <div>
                      <p className="font-medium text-slate-200">In-app notification inbox</p>
                      <p className="mt-1 leading-relaxed text-slate-500">
                        Private inbox receives source-backed matches from the server-side evaluator.
                        It is not an official emergency-warning channel.
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-cyan-300">Ready</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2.5">
                    <span className="text-slate-400">Email digest</span>
                    <span className="text-slate-500">Not configured</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2.5">
                    <span className="text-slate-400">Push notifications</span>
                    <span className="text-slate-500">Not configured</span>
                  </div>
                </div>
              </div>
            </div>
          )}
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
