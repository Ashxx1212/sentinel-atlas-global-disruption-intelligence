import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const SOURCE_NOTE = 'Location search results are provided by Open-Meteo Geocoding / GeoNames.';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

interface SearchRequestBody {
  query?: unknown;
}

interface GeocodingResult {
  id?: number;
  name?: string;
  admin1?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

function normaliseQuery(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    return null;
  }

  return trimmed;
}

function buildErrorResponse(status: number, message: string) {
  return Response.json(
    {
      success: false,
      error: message,
      sourceNote: SOURCE_NOTE,
    },
    {
      status,
      headers: jsonHeaders,
    },
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return buildErrorResponse(405, 'Method not allowed. Use POST.');
  }

  let body: SearchRequestBody;
  try {
    body = await req.json() as SearchRequestBody;
  } catch {
    return buildErrorResponse(400, 'Request body must be valid JSON.');
  }

  const query = normaliseQuery(body.query);
  if (!query) {
    return buildErrorResponse(400, 'Search query must be between 2 and 100 characters.');
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return buildErrorResponse(401, 'Authentication required.');
  }

  const accessToken = authHeader.slice('Bearer '.length).trim();
  if (!accessToken) {
    return buildErrorResponse(401, 'Authentication required.');
  }

  const url = new URL(OPEN_METEO_GEOCODING_URL);
  url.searchParams.set('name', query);
  url.searchParams.set('count', '10');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return buildErrorResponse(429, 'Location search is temporarily rate limited. Please try again shortly.');
      }

      return buildErrorResponse(502, 'Location provider returned an error.');
    }

    const payload = await response.json() as GeocodingResponse;
    const results = Array.isArray(payload.results) ? payload.results : [];

    const normalisedResults = results
      .filter((item) => typeof item?.name === 'string' && item.name.trim())
      .slice(0, 10)
      .map((item) => ({
        provider_location_id: item.id != null ? String(item.id) : null,
        place_name: item.name?.trim() ?? '',
        region_name: item.admin1?.trim() || null,
        country: item.country?.trim() || 'Unknown',
        country_code: item.country_code?.trim().toUpperCase() || null,
        latitude: typeof item.latitude === 'number' ? item.latitude : 0,
        longitude: typeof item.longitude === 'number' ? item.longitude : 0,
        timezone: item.timezone?.trim() || null,
      }));

    return Response.json(
      {
        success: true,
        results: normalisedResults,
        sourceNote: SOURCE_NOTE,
      },
      {
        headers: jsonHeaders,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown location search error.';
    if (/429|rate limit/i.test(message)) {
      return buildErrorResponse(429, 'Location search is temporarily rate limited. Please try again shortly.');
    }

    return buildErrorResponse(502, 'Location search could not be completed.');
  }
});
