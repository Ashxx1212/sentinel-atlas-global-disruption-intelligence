import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersistedWatchlistLocation {
  id: string;
  watchlist_id: string;
  user_id: string;
  label: string;
  place_name: string;
  country_code: string | null;
  region_name: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  radius_km: number;
  provider: string | null;
  provider_location_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationSearchResult {
  provider_location_id: string | null;
  place_name: string;
  region_name: string | null;
  country: string;
  country_code: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

export interface SaveWatchlistLocationInput {
  label: string;
  place_name: string;
  country_code: string | null;
  region_name: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  radius_km: number;
  provider: string | null;
  provider_location_id: string | null;
}

const WATCHLIST_PROVIDER = 'open-meteo-geocoding';

function normaliseLocationText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function isSameSavedLocation(
  savedLocation: PersistedWatchlistLocation,
  payload: SaveWatchlistLocationInput,
): boolean {
  if (
    savedLocation.provider_location_id &&
    payload.provider_location_id &&
    savedLocation.provider_location_id === payload.provider_location_id
  ) {
    return true;
  }

  const samePlace =
    normaliseLocationText(savedLocation.place_name) === normaliseLocationText(payload.place_name) &&
    normaliseLocationText(savedLocation.country_code) === normaliseLocationText(payload.country_code);
  const sameCoordinates =
    typeof savedLocation.latitude === 'number' &&
    typeof savedLocation.longitude === 'number' &&
    Math.abs(savedLocation.latitude - payload.latitude) < 0.000001 &&
    Math.abs(savedLocation.longitude - payload.longitude) < 0.000001;

  return samePlace && sameCoordinates;
}

export async function ensureDefaultWatchlist(
  client: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await client
    .from('watchlists')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.id) {
    return data.id;
  }

  const { data: created, error: createError } = await client
    .from('watchlists')
    .insert({
      user_id: userId,
      name: 'Primary watchlist',
      is_default: true,
    })
    .select('id')
    .single();

  if (createError || !created) {
    throw createError ?? new Error('Unable to create a personal watchlist.');
  }

  return created.id;
}

export async function fetchSavedWatchlistLocations(
  client: SupabaseClient,
  userId: string,
): Promise<PersistedWatchlistLocation[]> {
  const watchlistId = await ensureDefaultWatchlist(client, userId);

  const { data, error } = await client
    .from('watchlist_locations')
    .select('*')
    .eq('user_id', userId)
    .eq('watchlist_id', watchlistId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PersistedWatchlistLocation[];
}

export async function searchLocationResults(
  client: SupabaseClient,
  query: string,
): Promise<{ results: LocationSearchResult[]; note: string }> {
  const { data, error } = await client.functions.invoke('search-locations', {
    body: { query },
  });

  if (error) {
    throw new Error('Location search is unavailable. Please try again.');
  }

  return {
    results: (data?.results ?? []) as LocationSearchResult[],
    note: data?.sourceNote ?? 'Location search results are provided by Open-Meteo Geocoding / GeoNames.',
  };
}

export async function saveWatchlistLocation(
  client: SupabaseClient,
  userId: string,
  payload: SaveWatchlistLocationInput,
): Promise<PersistedWatchlistLocation> {
  const watchlistId = await ensureDefaultWatchlist(client, userId);
  const provider = payload.provider ?? WATCHLIST_PROVIDER;

  const { data: existingLocations, error: existingError } = await client
    .from('watchlist_locations')
    .select('*')
    .eq('user_id', userId)
    .eq('watchlist_id', watchlistId);

  if (existingError) {
    throw new Error('Could not check your saved watchlist. Please try again.');
  }

  const existingLocation = ((existingLocations ?? []) as PersistedWatchlistLocation[])
    .find((location) => isSameSavedLocation(location, payload));

  if (existingLocation) {
    const { data: updated, error: updateError } = await client
      .from('watchlist_locations')
      .update({
        label: payload.label,
        place_name: payload.place_name,
        country_code: payload.country_code,
        region_name: payload.region_name,
        latitude: payload.latitude,
        longitude: payload.longitude,
        timezone: payload.timezone,
        radius_km: payload.radius_km,
        provider,
        provider_location_id: payload.provider_location_id,
      })
      .eq('id', existingLocation.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new Error('Could not update this saved location. Please try again.');
    }

    return updated as PersistedWatchlistLocation;
  }

  const { data, error } = await client
    .from('watchlist_locations')
    .insert({
      watchlist_id: watchlistId,
      user_id: userId,
      label: payload.label,
      place_name: payload.place_name,
      country_code: payload.country_code,
      region_name: payload.region_name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      timezone: payload.timezone,
      radius_km: payload.radius_km,
      provider,
      provider_location_id: payload.provider_location_id,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Could not save this location. Please try again.');
  }

  return data as PersistedWatchlistLocation;
}

export async function updateWatchlistLocationRadius(
  client: SupabaseClient,
  locationId: string,
  radiusKm: number,
): Promise<PersistedWatchlistLocation> {
  const { data, error } = await client
    .from('watchlist_locations')
    .update({ radius_km: radiusKm })
    .eq('id', locationId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Could not update the monitoring radius. Please try again.');
  }

  return data as PersistedWatchlistLocation;
}

export async function removeWatchlistLocation(
  client: SupabaseClient,
  locationId: string,
): Promise<void> {
  const { error } = await client.from('watchlist_locations').delete().eq('id', locationId);

  if (error) {
    throw new Error('Could not remove this location. Please try again.');
  }
}
