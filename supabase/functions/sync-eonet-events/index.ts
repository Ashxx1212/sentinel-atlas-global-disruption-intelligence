import { withSupabase } from "npm:@supabase/server@^1";

type EonetCategoryId = "wildfires" | "volcanoes" | "floods" | "severeStorms";
type SentinelHazardType = "wildfire" | "volcano" | "flood" | "severe-weather";
type SentinelSeverity = "advisory" | "elevated" | "high" | "critical";
type SentinelIncidentStatus = "active" | "resolved";
type SentinelRecordState = "active" | "archived";

type EonetCategory = {
  id?: string | null;
  title?: string | null;
};

type EonetSource = {
  id?: string | null;
  title?: string | null;
  source?: string | null;
  url?: string | null;
  link?: string | null;
};

type EonetGeometry = {
  date?: string | null;
  type?: string | null;
  coordinates?: unknown;
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
  magnitudeDescription?: string | null;
};

type EonetEvent = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  link?: string | null;
  closed?: string | null;
  categories?: EonetCategory[];
  sources?: EonetSource[];
  geometry?: EonetGeometry[];
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
  magnitudeDescription?: string | null;
};

type EonetEventsResponse = {
  events?: EonetEvent[];
};

type NormalizedEonetEvent = {
  canonicalKey: string;
  sourceEventId: string;
  title: string;
  summary: string;
  hazardType: SentinelHazardType;
  severity: SentinelSeverity;
  status: SentinelIncidentStatus;
  recordState: SentinelRecordState;
  isActive: boolean;
  placeName: string;
  latitude: number;
  longitude: number;
  sourceUpdatedAt: string | null;
  sourceRecordUrl: string | null;
  isClosed: boolean;
  categoryIds: string[];
  changeFingerprint: string;
  payload: Record<string, unknown>;
};

type ExistingIncidentRow = {
  id?: string;
  canonical_key?: string;
  title?: string | null;
  hazard_type?: string | null;
  status?: string | null;
  source_updated_at?: string | null;
};

type ExistingSourceEventRow = {
  source_event_id?: string;
  source_updated_at?: string | null;
  payload?: unknown;
};

type ExistingIncidentSourceRow = {
  source_event_id?: string;
  source_record_url?: string | null;
  record_state?: string | null;
  source_updated_at?: string | null;
};

const EONET_EVENTS_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";
const EONET_CATEGORY_PRIORITY: readonly EonetCategoryId[] = [
  "wildfires",
  "volcanoes",
  "floods",
  "severeStorms",
];

const INCLUDED_CATEGORIES = EONET_CATEGORY_PRIORITY;
const CATEGORY_QUERY = INCLUDED_CATEGORIES.join(",");
const CLOSED_LOOKBACK_DAYS = 45;
const RESULT_LIMIT = 100;
const REQUEST_TIMEOUT_MS = 15_000;
const SOURCE_CODE = "eonet";

const jsonHeaders = {
  "Content-Type": "application/json",
  Allow: "POST",
};

const categoryToHazard: Record<EonetCategoryId, SentinelHazardType> = {
  wildfires: "wildfire",
  volcanoes: "volcano",
  floods: "flood",
  severeStorms: "severe-weather",
};

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return "Unknown EONET ingestion error.";
}

function isIncludedCategory(value: string | null | undefined): value is EonetCategoryId {
  return INCLUDED_CATEGORIES.includes(value as EonetCategoryId);
}

function timestampFromIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function geometryTimeValue(geometry: EonetGeometry): number {
  const timestamp = timestampFromIso(geometry.date);
  return timestamp ? new Date(timestamp).getTime() : Number.NEGATIVE_INFINITY;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");

  return normalized ? normalized : null;
}

function normalizeSourceUrl(event: EonetEvent): string | null {
  const eventLink = normalizeOptionalText(event.link);
  if (eventLink) {
    return eventLink;
  }

  for (const source of event.sources ?? []) {
    const sourceUrl =
      normalizeOptionalText(source.url) ??
      normalizeOptionalText(source.link) ??
      normalizeOptionalText(source.source);

    if (sourceUrl) {
      return sourceUrl;
    }
  }

  return null;
}

function normalizedOfficialSourceUrls(event: EonetEvent): string[] {
  const urls = [
    normalizeOptionalText(event.link),
    ...(event.sources ?? []).flatMap((source) => [
      normalizeOptionalText(source.url),
      normalizeOptionalText(source.link),
      normalizeOptionalText(source.source),
    ]),
  ].filter((url): url is string => Boolean(url));

  return [...new Set(urls)].sort();
}

function validPointCoordinates(coordinates: unknown): { latitude: number; longitude: number } | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function latestValidPointGeometry(event: EonetEvent): {
  geometry: EonetGeometry;
  latitude: number;
  longitude: number;
} | null {
  const validPoints = (event.geometry ?? [])
    .filter((geometry) => geometry.type === "Point")
    .map((geometry) => {
      const point = validPointCoordinates(geometry.coordinates);
      if (!point) {
        return null;
      }

      return {
        geometry,
        latitude: point.latitude,
        longitude: point.longitude,
      };
    })
    .filter((point): point is { geometry: EonetGeometry; latitude: number; longitude: number } =>
      point !== null
    );

  if (validPoints.length === 0) {
    return null;
  }

  return validPoints.sort((a, b) => geometryTimeValue(b.geometry) - geometryTimeValue(a.geometry))[0];
}

function normalizeEvent(event: EonetEvent): NormalizedEonetEvent | null {
  const sourceEventId = event.id?.trim();
  const title = event.title?.trim();
  const categoryIds = (event.categories ?? [])
    .map((category) => category.id?.trim())
    .filter((categoryId): categoryId is string => Boolean(categoryId));
  const primaryCategory = EONET_CATEGORY_PRIORITY.find((category) => categoryIds.includes(category));
  const currentPoint = latestValidPointGeometry(event);

  if (!sourceEventId || !title || !primaryCategory || !currentPoint) {
    return null;
  }

  const sourceUpdatedAt = timestampFromIso(currentPoint.geometry.date);
  const closedAt = timestampFromIso(event.closed);
  const isClosed = Boolean(closedAt);
  const sourceRecordUrl = normalizeSourceUrl(event);
  const hazardType = categoryToHazard[primaryCategory];
  const status: SentinelIncidentStatus = isClosed ? "resolved" : "active";
  const recordState: SentinelRecordState = isClosed ? "archived" : "active";
  const normalizedDescription = normalizeOptionalText(event.description);
const officialSourceUrls = normalizedOfficialSourceUrls(event);

const summary =
  normalizedDescription ||
  `NASA EONET source-backed metadata for ${title}. Sentinel Atlas has not independently validated this source record.`;

const changeFingerprint = JSON.stringify({
  version: "eonet-v1",
  categoryIds: [...categoryIds].sort(),
  closedAt,
  description: normalizedDescription,
  geometryDate: sourceUpdatedAt,
  hazardType,
  latitude: currentPoint.latitude,
  longitude: currentPoint.longitude,
  magnitudeDescription: normalizeOptionalText(
    currentPoint.geometry.magnitudeDescription ?? event.magnitudeDescription,
  ),
  magnitudeUnit: normalizeOptionalText(
    currentPoint.geometry.magnitudeUnit ?? event.magnitudeUnit,
  ),
  magnitudeValue: currentPoint.geometry.magnitudeValue ?? event.magnitudeValue ?? null,
  sourceRecordUrl,
  sourceUrls: officialSourceUrls,
  status,
  title: normalizeOptionalText(title) ?? title,
});

  return {
    canonicalKey: `${SOURCE_CODE}:${sourceEventId}`,
    sourceEventId,
    title,
    summary,
    hazardType,
    // EONET has no universal impact or emergency-severity scale. The shared
    // schema requires a severity, so v1 uses the least assertive supported
    // value and relies on source/data-integrity labels for user interpretation.
    severity: "advisory",
    status,
    recordState,
    isActive: !isClosed,
    placeName: title,
    latitude: currentPoint.latitude,
    longitude: currentPoint.longitude,
    sourceUpdatedAt,
    sourceRecordUrl,
    isClosed,
    categoryIds,
    changeFingerprint,
    payload: {
      raw_event: event,
      sentinel_atlas: {
        category_ids: categoryIds,
        change_fingerprint: changeFingerprint,
        current_point_geometry: currentPoint.geometry,
        excluded_categories: [
          "earthquakes",
          "drought",
          "dustHaze",
          "landslides",
          "manmade",
          "seaLakeIce",
          "snow",
          "tempExtremes",
          "waterColor",
        ],
        hazard_type: hazardType,
        lifecycle_status: status,
        record_state: recordState,
        severity_fallback: "advisory",
        source_record_url: sourceRecordUrl,
      },
    },
  };
}

function normalizeEvents(events: EonetEvent[]): {
  normalizedEvents: NormalizedEonetEvent[];
  skippedInvalidCount: number;
  skippedNoPointCount: number;
} {
  const normalizedEvents: NormalizedEonetEvent[] = [];
  let skippedInvalidCount = 0;
  let skippedNoPointCount = 0;

  for (const event of events) {
    if (!latestValidPointGeometry(event)) {
      skippedNoPointCount += 1;
      continue;
    }

    const normalizedEvent = normalizeEvent(event);
    if (!normalizedEvent) {
      skippedInvalidCount += 1;
      continue;
    }

    normalizedEvents.push(normalizedEvent);
  }

  return {
    normalizedEvents,
    skippedInvalidCount,
    skippedNoPointCount,
  };
}

async function fetchEonetEvents(params: Record<string, string>): Promise<{
  endpoint: string;
  events: EonetEvent[];
}> {
  const url = new URL(EONET_EVENTS_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`NASA EONET returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as EonetEventsResponse;
    if (!Array.isArray(payload.events)) {
      throw new Error("NASA EONET response did not contain an events array.");
    }

    return {
      endpoint: url.toString(),
      events: payload.events,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeByEventId(events: EonetEvent[]): EonetEvent[] {
  const eventById = new Map<string, EonetEvent>();

  for (const event of events) {
    const id = event.id?.trim();
    if (!id) {
      continue;
    }

    const existing = eventById.get(id);
    if (!existing) {
      eventById.set(id, event);
      continue;
    }

    const existingGeometry = latestValidPointGeometry(existing);
    const nextGeometry = latestValidPointGeometry(event);
    const existingTime = existingGeometry ? geometryTimeValue(existingGeometry.geometry) : Number.NEGATIVE_INFINITY;
    const nextTime = nextGeometry ? geometryTimeValue(nextGeometry.geometry) : Number.NEGATIVE_INFINITY;

    if (timestampFromIso(event.closed) && !timestampFromIso(existing.closed)) {
      eventById.set(id, event);
    } else if (nextTime > existingTime) {
      eventById.set(id, event);
    }
  }

  return [...eventById.values()];
}

function fingerprintFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const wrapper = payload as { sentinel_atlas?: { change_fingerprint?: unknown } };
  return typeof wrapper.sentinel_atlas?.change_fingerprint === "string"
    ? wrapper.sentinel_atlas.change_fingerprint
    : null;
}

function meaningfulChangeOccurred(
  event: NormalizedEonetEvent,
  existingIncident: ExistingIncidentRow | undefined,
  existingSourceEvent: ExistingSourceEventRow | undefined,
  existingIncidentSource: ExistingIncidentSourceRow | undefined,
): boolean {
  if (!existingIncident) {
    return true;
  }

  const previousFingerprint = fingerprintFromPayload(existingSourceEvent?.payload);

  // Once an EONET fingerprint exists, it is the single source of truth for
  // timeline-change detection. Matching fingerprints must not fall through to
  // raw database timestamp comparisons, which can differ only in formatting.
  if (previousFingerprint) {
    return previousFingerprint !== event.changeFingerprint;
  }

  // Legacy fallback for rows created before the fingerprint convention.
  // Normalize timestamps before comparing them to avoid false updates caused
  // by equivalent timestamptz strings with different formatting.
  const eventSourceUpdatedAt = timestampFromIso(event.sourceUpdatedAt);
  const incidentSourceUpdatedAt = timestampFromIso(existingIncident.source_updated_at);
  const sourceEventUpdatedAt = timestampFromIso(existingSourceEvent?.source_updated_at);
  const incidentEvidenceUpdatedAt = timestampFromIso(existingIncidentSource?.source_updated_at);

  return (
    existingIncident.title !== event.title ||
    existingIncident.hazard_type !== event.hazardType ||
    existingIncident.status !== event.status ||
    incidentSourceUpdatedAt !== eventSourceUpdatedAt ||
    sourceEventUpdatedAt !== eventSourceUpdatedAt ||
    existingIncidentSource?.source_record_url !== event.sourceRecordUrl ||
    existingIncidentSource?.record_state !== event.recordState ||
    incidentEvidenceUpdatedAt !== eventSourceUpdatedAt
  );
}

async function fetchEonetSourceRecords(): Promise<{
  allEvents: EonetEvent[];
  endpoints: string[];
  providerWarnings: string[];
}> {
  const openResult = await fetchEonetEvents({
    category: CATEGORY_QUERY,
    status: "open",
    limit: String(RESULT_LIMIT),
  });

  const closedResult = await fetchEonetEvents({
    category: CATEGORY_QUERY,
    status: "closed",
    days: String(CLOSED_LOOKBACK_DAYS),
    limit: String(RESULT_LIMIT),
  });

  const providerWarnings: string[] = [];
  if (openResult.events.length >= RESULT_LIMIT) {
    providerWarnings.push("Open EONET query returned the configured limit; additional open records may be omitted.");
  }

  if (closedResult.events.length >= RESULT_LIMIT) {
    providerWarnings.push("Closed EONET query returned the configured limit; additional recently closed records may be omitted.");
  }

  return {
    allEvents: [...openResult.events, ...closedResult.events],
    endpoints: [openResult.endpoint, closedResult.endpoint],
    providerWarnings,
  };
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json(
        {
          success: false,
          error: "Method not allowed. Use POST.",
        },
        {
          status: 405,
          headers: jsonHeaders,
        },
      );
    }

    const expectedToken = Deno.env.get("SENTINEL_INGESTION_TOKEN");
    const receivedToken = request.headers.get("x-sentinel-ingestion-token");

    if (!expectedToken || !receivedToken || receivedToken !== expectedToken) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized ingestion request.",
        },
        {
          status: 401,
          headers: jsonHeaders,
        },
      );
    }

    const db = context.supabaseAdmin;
    const fetchedAt = new Date().toISOString();

    let sourceId: string | null = null;
    let ingestionRunId: string | null = null;

    try {
      const { data: source, error: sourceError } = await db
        .from("data_sources")
        .select("id, code, display_name, source_mode, ingestion_status")
        .eq("code", SOURCE_CODE)
        .single();

      if (sourceError || !source) {
        throw new Error("NASA EONET source registry record was not found.");
      }

      sourceId = source.id;

      const { data: ingestionRun, error: runError } = await db
        .from("ingestion_runs")
        .insert({
          source_id: sourceId,
          status: "running",
          metadata: {
            source: SOURCE_CODE,
            categories: INCLUDED_CATEGORIES,
            closed_lookback_days: CLOSED_LOOKBACK_DAYS,
            result_limit: RESULT_LIMIT,
          },
        })
        .select("id")
        .single();

      if (runError || !ingestionRun) {
        throw new Error("Unable to create EONET ingestion audit record.");
      }

      ingestionRunId = ingestionRun.id;

      const { allEvents, endpoints, providerWarnings } = await fetchEonetSourceRecords();
      const dedupedEvents = dedupeByEventId(allEvents);
      const { normalizedEvents, skippedInvalidCount, skippedNoPointCount } = normalizeEvents(dedupedEvents);
      const canonicalKeys = normalizedEvents.map((event) => event.canonicalKey);
      const sourceEventIds = normalizedEvents.map((event) => event.sourceEventId);

      const { data: existingIncidents, error: existingIncidentsError } = canonicalKeys.length
        ? await db
          .from("incidents")
          .select("id, canonical_key, title, hazard_type, status, source_updated_at")
          .in("canonical_key", canonicalKeys)
          .like("canonical_key", `${SOURCE_CODE}:%`)
        : { data: [], error: null };

      if (existingIncidentsError) {
        throw new Error("Unable to check existing EONET incidents.");
      }

      const existingIncidentByKey = new Map<string, ExistingIncidentRow>(
        (existingIncidents ?? []).map((incident) => [incident.canonical_key, incident]),
      );
      const existingKeys = new Set(existingIncidentByKey.keys());

      const { data: existingSourceEvents, error: existingSourceEventsError } = sourceEventIds.length
        ? await db
          .from("source_events")
          .select("source_event_id, source_updated_at, payload")
          .eq("source_id", sourceId)
          .in("source_event_id", sourceEventIds)
        : { data: [], error: null };

      if (existingSourceEventsError) {
        throw new Error("Unable to check existing EONET source events.");
      }

      const existingSourceEventById = new Map<string, ExistingSourceEventRow>(
        (existingSourceEvents ?? []).map((sourceEvent) => [sourceEvent.source_event_id, sourceEvent]),
      );

      const { data: existingIncidentSources, error: existingIncidentSourcesError } = sourceEventIds.length
        ? await db
          .from("incident_sources")
          .select("source_event_id, source_record_url, record_state, source_updated_at")
          .eq("source_id", sourceId)
          .in("source_event_id", sourceEventIds)
        : { data: [], error: null };

      if (existingIncidentSourcesError) {
        throw new Error("Unable to check existing EONET incident evidence records.");
      }

      const existingIncidentSourceByEventId = new Map<string, ExistingIncidentSourceRow>(
  (existingIncidentSources ?? []).map((incidentSource) => [incidentSource.source_event_id, incidentSource]),
);

const changedEvents = normalizedEvents.filter((event) =>
  meaningfulChangeOccurred(
    event,
    existingIncidentByKey.get(event.canonicalKey),
    existingSourceEventById.get(event.sourceEventId),
    existingIncidentSourceByEventId.get(event.sourceEventId),
  ),
);

if (normalizedEvents.length > 0) {
        const { error: sourceEventsError } = await db
          .from("source_events")
          .upsert(
            normalizedEvents.map((event) => ({
              source_id: sourceId,
              ingestion_run_id: ingestionRunId,
              source_event_id: event.sourceEventId,
              source_updated_at: event.sourceUpdatedAt,
              fetched_at: fetchedAt,
              payload: event.payload,
            })),
            {
              onConflict: "source_id,source_event_id",
            },
          );

        if (sourceEventsError) {
          throw new Error("Unable to save EONET source-event audit records.");
        }

        const { data: storedIncidents, error: incidentsError } = await db
          .from("incidents")
          .upsert(
            normalizedEvents.map((event) => ({
              canonical_key: event.canonicalKey,
              primary_source_id: sourceId,
              hazard_type: event.hazardType,
              severity: event.severity,
              status: event.status,
              integrity_status: "verified",
              data_mode: "live_source",
              title: event.title,
              summary: event.summary,
              place_name: event.placeName,
              latitude: event.latitude,
              longitude: event.longitude,
              event_time: event.sourceUpdatedAt,
              source_updated_at: event.sourceUpdatedAt,
              last_source_fetched_at: fetchedAt,
              magnitude: null,
              depth_km: null,
              is_active: event.isActive,
            })),
            {
              onConflict: "canonical_key",
            },
          )
          .select("id, canonical_key");

        if (incidentsError || !storedIncidents) {
          throw new Error("Unable to upsert canonical EONET incidents.");
        }

        const incidentIdByCanonicalKey = new Map(
          storedIncidents.map((incident) => [incident.canonical_key, incident.id]),
        );

        const incidentSourceRows = normalizedEvents
          .map((event) => {
            const incidentId = incidentIdByCanonicalKey.get(event.canonicalKey);
            if (!incidentId) {
              return null;
            }

            return {
              incident_id: incidentId,
              source_id: sourceId,
              source_event_id: event.sourceEventId,
              source_record_url: event.sourceRecordUrl,
              source_record_title: event.title,
              record_state: event.recordState,
              integrity_status: "verified",
              data_mode: "live_source",
              source_event_time: event.sourceUpdatedAt,
              source_updated_at: event.sourceUpdatedAt,
              fetched_at: fetchedAt,
            };
          })
          .filter((row) => row !== null);

        if (incidentSourceRows.length > 0) {
          const { error: incidentSourcesError } = await db
            .from("incident_sources")
            .upsert(incidentSourceRows, {
              onConflict: "source_id,source_event_id",
            });

          if (incidentSourcesError) {
            throw new Error("Unable to upsert EONET incident evidence records.");
          }
        }

        const incidentUpdateRows = changedEvents
  .map((event) => {
            const incidentId = incidentIdByCanonicalKey.get(event.canonicalKey);
            if (!incidentId) {
              return null;
            }

            const isNew = !existingKeys.has(event.canonicalKey);

            return {
              incident_id: incidentId,
              source_id: sourceId,
              update_type: isNew ? "source_record_ingested" : "source_record_updated",
              title: isNew ? "NASA EONET source record ingested" : "NASA EONET source record updated",
              body: event.isClosed
                ? "NASA EONET metadata indicates this event is now closed. Sentinel Atlas has not independently validated this source record."
                : "NASA EONET source-backed metadata was stored in Sentinel Atlas. Sentinel Atlas has not independently validated this source record.",
              occurred_at: event.sourceUpdatedAt ?? fetchedAt,
              data_mode: "live_source",
              integrity_status: "verified",
            };
          })
          .filter((row) => row !== null);

        if (incidentUpdateRows.length > 0) {
          const { error: updatesError } = await db
            .from("incident_updates")
            .insert(incidentUpdateRows);

          if (updatesError) {
            throw new Error("Unable to create EONET incident timeline records.");
          }
        }
      }

      const recordsCreated = normalizedEvents.filter(
  (event) => !existingKeys.has(event.canonicalKey),
).length;

const recordsUpdated = changedEvents.filter(
  (event) => existingKeys.has(event.canonicalKey),
).length;

const resolvedClosedCount = changedEvents.filter(
  (event) => event.isClosed && existingKeys.has(event.canonicalKey),
).length;

const incidentUpdateCount = changedEvents.length;
      const runStatus = providerWarnings.length > 0 ? "partial" : "succeeded";

      const { error: sourceStatusError } = await db
        .from("data_sources")
        .update({
          source_mode: "live_source",
          ingestion_status: "operational",
          last_success_at: fetchedAt,
          last_error_at: null,
          last_error_message: null,
        })
        .eq("id", sourceId);

      if (sourceStatusError) {
        throw new Error("Unable to update the EONET source operational state.");
      }

      const { error: completeRunError } = await db
        .from("ingestion_runs")
        .update({
          status: runStatus,
          completed_at: new Date().toISOString(),
          records_received: allEvents.length,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          metadata: {
            source: SOURCE_CODE,
            categories: INCLUDED_CATEGORIES,
            closed_lookback_days: CLOSED_LOOKBACK_DAYS,
            endpoints,
            result_limit: RESULT_LIMIT,
            deduplicated_records: dedupedEvents.length,
            normalized_records: normalizedEvents.length,
            provider_warnings: providerWarnings,
            skipped_invalid_records: skippedInvalidCount,
            skipped_no_point_records: skippedNoPointCount,
          },
        })
        .eq("id", ingestionRunId);

      if (completeRunError) {
        throw new Error("Unable to complete the EONET ingestion audit record.");
      }

      return Response.json(
        {
          success: true,
          source: SOURCE_CODE,
          fetched_event_count: allEvents.length,
          deduplicated_event_count: dedupedEvents.length,
          normalized_count: normalizedEvents.length,
          skipped_invalid_count: skippedInvalidCount,
          skipped_no_point_count: skippedNoPointCount,
          created_count: recordsCreated,
          updated_count: recordsUpdated,
          resolved_closed_count: resolvedClosedCount,
          incident_update_count: incidentUpdateCount,
          provider_warning: providerWarnings.length > 0 ? providerWarnings.join(" ") : null,
          run_status: runStatus,
          run_id: ingestionRunId,
        },
        {
          headers: jsonHeaders,
        },
      );
    } catch (error) {
      const errorMessage = safeErrorMessage(error);

      console.error("NASA EONET ingestion failed:", errorMessage);

      if (ingestionRunId) {
        await db
          .from("ingestion_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .eq("id", ingestionRunId);
      }

      if (sourceId) {
        await db
          .from("data_sources")
          .update({
            ingestion_status: "degraded",
            last_error_at: new Date().toISOString(),
            last_error_message: errorMessage,
          })
          .eq("id", sourceId);
      }

      return Response.json(
        {
          success: false,
          source: SOURCE_CODE,
          run_status: "failed",
          error: "NASA EONET ingestion failed. Existing stored records were retained.",
        },
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }
  }),
};
