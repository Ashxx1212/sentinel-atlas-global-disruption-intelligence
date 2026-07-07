import { withSupabase } from "npm:@supabase/server@^1";

type GdacsAlertLevel = "Green" | "Orange" | "Red";
type SentinelSeverity = "advisory" | "elevated" | "high" | "critical";
type SentinelIncidentStatus = "active" | "resolved";
type SentinelRecordState = "active" | "archived";

type GdacsLinks = { report?: string | null; details?: string | null; geometry?: string | null };
type GdacsSeverityData = { severity?: number | null; severitytext?: string | null; severityunit?: string | null };
type GdacsProperties = {
  eventtype?: string | null;
  eventid?: string | number | null;
  episodeid?: string | number | null;
  eventname?: string | null;
  name?: string | null;
  description?: string | null;
  alertlevel?: string | null;
  alertscore?: number | string | null;
  iscurrent?: boolean | string | null;
  country?: string | null;
  iso3?: string | null;
  fromdate?: string | null;
  todate?: string | null;
  datemodified?: string | null;
  source?: string | null;
  sourceid?: string | null;
  severitydata?: GdacsSeverityData | null;
  url?: GdacsLinks | Record<string, unknown> | null;
};
type GdacsFeature = {
  type?: string | null;
  geometry?: { type?: string | null; coordinates?: unknown } | null;
  properties?: GdacsProperties | null;
};
type GdacsFeatureCollection = { features?: GdacsFeature[] };
type ExistingIncidentRow = { id?: string; canonical_key?: string; title?: string | null; hazard_type?: string | null; status?: string | null; source_updated_at?: string | null };
type ExistingSourceEventRow = { source_event_id?: string; source_updated_at?: string | null; payload?: unknown };
type ExistingIncidentSourceRow = { source_event_id?: string; source_record_url?: string | null; record_state?: string | null; source_updated_at?: string | null };
type NormalizedGdacsEvent = {
  canonicalKey: string;
  sourceEventId: string;
  title: string;
  summary: string;
  hazardType: "cyclone";
  severity: SentinelSeverity;
  status: SentinelIncidentStatus;
  recordState: SentinelRecordState;
  isActive: boolean;
  placeName: string;
  latitude: number;
  longitude: number;
  eventTime: string | null;
  eventEndTime: string | null;
  sourceUpdatedAt: string | null;
  sourceRecordUrl: string | null;
  alertLevel: GdacsAlertLevel | null;
  changeFingerprint: string;
  payload: Record<string, unknown>;
};

type AlertEvaluationSummary = {
  status: "not_run" | "succeeded" | "failed";
  candidate_incident_count: number;
  matching_rule_location_count: number;
  notifications_inserted: number;
  error: string | null;
};

const GDACS_EVENT_LIST_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";
const SOURCE_CODE = "gdacs";
const EVENT_TYPE = "TC";
const LOOKBACK_DAYS = 120;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const REQUEST_TIMEOUT_MS = 20_000;
const jsonHeaders = { "Content-Type": "application/json", Allow: "POST" };

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message.slice(0, 500);
  }

  return "Unknown GDACS ingestion error.";
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : null;
}

function timestampFromValue(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeAlertLevel(value: string | null | undefined): GdacsAlertLevel | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  if (normalized === "green") return "Green";
  if (normalized === "orange") return "Orange";
  if (normalized === "red") return "Red";
  return null;
}

function booleanFromValue(value: boolean | string | null | undefined): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function numberFromValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validPointCoordinates(coordinates: unknown): { latitude: number; longitude: number } | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates;
  if (
    typeof latitude !== "number" || typeof longitude !== "number" ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null;
  return { latitude, longitude };
}

function linkFromProperties(links: GdacsProperties["url"], key: keyof GdacsLinks): string | null {
  if (!links || typeof links !== "object") return null;
  const value = (links as Record<string, unknown>)[key];
  return typeof value === "string" ? normalizeOptionalText(value) : null;
}

function stableLinks(properties: GdacsProperties): string[] {
  const links = [
    linkFromProperties(properties.url, "report"),
    linkFromProperties(properties.url, "details"),
    linkFromProperties(properties.url, "geometry"),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(links)].sort();
}

function fingerprintFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const wrapper = payload as { sentinel_atlas?: { change_fingerprint?: unknown } };
  return typeof wrapper.sentinel_atlas?.change_fingerprint === "string"
    ? wrapper.sentinel_atlas.change_fingerprint
    : null;
}

function normalizeFeature(feature: GdacsFeature): NormalizedGdacsEvent | null {
  const properties = feature.properties ?? {};
  if (normalizeOptionalText(properties.eventtype)?.toUpperCase() !== EVENT_TYPE) return null;

  const eventId = normalizeOptionalText(
    properties.eventid === null || properties.eventid === undefined ? null : String(properties.eventid),
  );
  const episodeId = normalizeOptionalText(
    properties.episodeid === null || properties.episodeid === undefined ? null : String(properties.episodeid),
  );
  const point = feature.geometry?.type === "Point"
    ? validPointCoordinates(feature.geometry.coordinates)
    : null;
  if (!eventId || !episodeId || !point) return null;

  const title = normalizeOptionalText(properties.name) ?? normalizeOptionalText(properties.eventname) ?? `GDACS Tropical Cyclone ${eventId}`;
  const description = normalizeOptionalText(properties.description);
  const alertLevel = normalizeAlertLevel(properties.alertlevel);
  const alertScore = numberFromValue(properties.alertscore);
  const isCurrentValue = booleanFromValue(properties.iscurrent);
  if (isCurrentValue === null) return null;
  const isCurrent = isCurrentValue;
  const eventTime = timestampFromValue(properties.fromdate);
  const eventEndTime = timestampFromValue(properties.todate);
  const sourceUpdatedAt = timestampFromValue(properties.datemodified) ?? eventEndTime ?? eventTime;
  const providerSource = normalizeOptionalText(properties.source);
  const country = normalizeOptionalText(properties.country);
  const reportUrl = linkFromProperties(properties.url, "report");
  const detailsUrl = linkFromProperties(properties.url, "details");
  const geometryUrl = linkFromProperties(properties.url, "geometry");
  const sourceRecordUrl = reportUrl ?? detailsUrl;
  const links = stableLinks(properties);
  const severityData = properties.severitydata ?? {};
  const providerSeverity = numberFromValue(severityData.severity);
  const providerSeverityText = normalizeOptionalText(severityData.severitytext);
  const providerSeverityUnit = normalizeOptionalText(severityData.severityunit);
  const status: SentinelIncidentStatus = isCurrent ? "active" : "resolved";
  const recordState: SentinelRecordState = isCurrent ? "active" : "archived";

  // GDACS alert levels are awareness/coordination metadata, not a universal
  // emergency-severity scale. v1 keeps severity neutral and preserves alert
  // context in the public summary and private source-event payload.
  const severity: SentinelSeverity = "advisory";
  const awarenessLabel = alertLevel ? ` GDACS Awareness Level: ${alertLevel}.` : "";
  const summary = `${description ?? `GDACS source-backed tropical cyclone metadata for ${title}.`}${awarenessLabel} GDACS provides awareness and coordination information; Sentinel Atlas does not treat this as an official emergency warning.`;
  const sourceEventId = `${EVENT_TYPE}:${eventId}:${episodeId}`;
  const changeFingerprint = JSON.stringify({
    version: "gdacs-tc-v1", eventType: EVENT_TYPE, eventId, episodeId, title,
    alertLevel, alertScore, country, isCurrent, eventTime, eventEndTime, sourceUpdatedAt,
    latitude: point.latitude, longitude: point.longitude, providerSource,
    providerSeverity, providerSeverityText, providerSeverityUnit, reportUrl, detailsUrl, links,
  });

  return {
    canonicalKey: `${SOURCE_CODE}:${sourceEventId}`,
    sourceEventId,
    title,
    summary,
    hazardType: "cyclone",
    severity,
    status,
    recordState,
    isActive: isCurrent,
    placeName: country ?? title,
    latitude: point.latitude,
    longitude: point.longitude,
    eventTime,
    eventEndTime,
    sourceUpdatedAt,
    sourceRecordUrl,
    alertLevel,
    changeFingerprint,
    payload: {
      raw_feature: feature,
      sentinel_atlas: {
        change_fingerprint: changeFingerprint,
        fingerprint_version: "gdacs-tc-v1",
        event_type: EVENT_TYPE,
        event_id: eventId,
        episode_id: episodeId,
        gdacs_alert_level: alertLevel,
        gdacs_alert_score: alertScore,
        gdacs_awareness_context: "GDACS awareness and coordination metadata; not an official emergency warning.",
        provider_source: providerSource,
        report_url: reportUrl,
        details_url: detailsUrl,
        geometry_url: geometryUrl,
        source_links: links,
        source_record_url: sourceRecordUrl,
      },
    },
  };
}

function normalizeFeatures(features: GdacsFeature[]): { normalizedEvents: NormalizedGdacsEvent[]; skippedInvalidCount: number; skippedNoPointCount: number } {
  const normalizedEvents: NormalizedGdacsEvent[] = [];
  let skippedInvalidCount = 0;
  let skippedNoPointCount = 0;
  for (const feature of features) {
    if (feature.geometry?.type !== "Point" || !validPointCoordinates(feature.geometry.coordinates)) {
      skippedNoPointCount += 1;
      continue;
    }
    const event = normalizeFeature(feature);
    if (!event) {
      skippedInvalidCount += 1;
      continue;
    }
    normalizedEvents.push(event);
  }
  return { normalizedEvents, skippedInvalidCount, skippedNoPointCount };
}

function dedupeBySourceEventId(events: NormalizedGdacsEvent[]): NormalizedGdacsEvent[] {
  const eventsById = new Map<string, NormalizedGdacsEvent>();
  for (const event of events) {
    const existing = eventsById.get(event.sourceEventId);
    if (!existing) {
      eventsById.set(event.sourceEventId, event);
      continue;
    }
    const existingTime = timestampFromValue(existing.sourceUpdatedAt);
    const nextTime = timestampFromValue(event.sourceUpdatedAt);
    if (!existingTime || (nextTime && nextTime > existingTime)) eventsById.set(event.sourceEventId, event);
  }
  return [...eventsById.values()];
}

function meaningfulChangeOccurred(
  event: NormalizedGdacsEvent,
  existingIncident: ExistingIncidentRow | undefined,
  existingSourceEvent: ExistingSourceEventRow | undefined,
  existingIncidentSource: ExistingIncidentSourceRow | undefined,
): boolean {
  if (!existingIncident) return true;
  const previousFingerprint = fingerprintFromPayload(existingSourceEvent?.payload);
  if (previousFingerprint) return previousFingerprint !== event.changeFingerprint;

  const eventUpdatedAt = timestampFromValue(event.sourceUpdatedAt);
  return (
    existingIncident.title !== event.title ||
    existingIncident.hazard_type !== event.hazardType ||
    existingIncident.status !== event.status ||
    timestampFromValue(existingIncident.source_updated_at) !== eventUpdatedAt ||
    timestampFromValue(existingSourceEvent?.source_updated_at) !== eventUpdatedAt ||
    existingIncidentSource?.source_record_url !== event.sourceRecordUrl ||
    existingIncidentSource?.record_state !== event.recordState ||
    timestampFromValue(existingIncidentSource?.source_updated_at) !== eventUpdatedAt
  );
}

async function fetchGdacsCyclones(): Promise<{
  endpoint: string;
  features: GdacsFeature[];
  providerWarnings: string[];
  pagesFetched: number;
}> {
  const now = new Date();
  const fromDate = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const toDate = now.toISOString().slice(0, 10);
  const features: GdacsFeature[] = [];
  const endpoints: string[] = [];

  // GDACS pages are 1-based. Page 0 repeats the first page, so begin at 1.
  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const url = new URL(GDACS_EVENT_LIST_URL);
    url.searchParams.set("eventlist", EVENT_TYPE);
    url.searchParams.set("fromdate", fromDate);
    url.searchParams.set("todate", toDate);
    url.searchParams.set("alertlevel", "Green;Orange;Red");
    url.searchParams.set("pagesize", String(PAGE_SIZE));
    url.searchParams.set("pagenumber", String(pageNumber));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`GDACS returned HTTP ${response.status} for page ${pageNumber}.`);
      }

      const payload = (await response.json()) as GdacsFeatureCollection;
      if (!Array.isArray(payload.features)) {
        throw new Error("GDACS response did not contain a GeoJSON features array.");
      }

      endpoints.push(url.toString());
      features.push(...payload.features);

      if (payload.features.length < PAGE_SIZE) {
        return {
          endpoint: endpoints.join(" | "),
          features,
          providerWarnings: [],
          pagesFetched: pageNumber,
        };
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    endpoint: endpoints.join(" | "),
    features,
    providerWarnings: [
      `GDACS returned ${MAX_PAGES} full pages of ${PAGE_SIZE} cyclone records; additional matching records may be omitted.`,
    ],
    pagesFetched: MAX_PAGES,
  };
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ success: false, error: "Method not allowed. Use POST." }, { status: 405, headers: jsonHeaders });
    }

    const expectedToken = Deno.env.get("SENTINEL_INGESTION_TOKEN");
    const receivedToken = request.headers.get("x-sentinel-ingestion-token");
    if (!expectedToken || !receivedToken || receivedToken !== expectedToken) {
      return Response.json({ success: false, error: "Unauthorized ingestion request." }, { status: 401, headers: jsonHeaders });
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
      if (sourceError || !source) throw new Error("GDACS source registry record was not found.");
      sourceId = source.id;

      const { data: ingestionRun, error: runError } = await db
        .from("ingestion_runs")
        .insert({ source_id: sourceId, status: "running", metadata: { source: SOURCE_CODE, event_types: [EVENT_TYPE], lookback_days: LOOKBACK_DAYS, page_size: PAGE_SIZE, max_pages: MAX_PAGES } })
        .select("id")
        .single();
      if (runError || !ingestionRun) throw new Error("Unable to create GDACS ingestion audit record.");
      ingestionRunId = ingestionRun.id;

      const { endpoint, features, providerWarnings, pagesFetched } = await fetchGdacsCyclones();
      const { normalizedEvents: normalizedBeforeDedupe, skippedInvalidCount, skippedNoPointCount } = normalizeFeatures(features);
      const normalizedEvents = dedupeBySourceEventId(normalizedBeforeDedupe);
      const canonicalKeys = normalizedEvents.map((event) => event.canonicalKey);
      const sourceEventIds = normalizedEvents.map((event) => event.sourceEventId);

      const { data: existingIncidents, error: existingIncidentsError } = canonicalKeys.length
        ? await db.from("incidents").select("id, canonical_key, title, hazard_type, status, source_updated_at").in("canonical_key", canonicalKeys).like("canonical_key", `${SOURCE_CODE}:%`)
        : { data: [], error: null };
      if (existingIncidentsError) throw new Error("Unable to check existing GDACS incidents.");
      const existingIncidentByKey = new Map<string, ExistingIncidentRow>((existingIncidents ?? []).map((incident) => [incident.canonical_key, incident]));
      const existingKeys = new Set(existingIncidentByKey.keys());

      const { data: existingSourceEvents, error: existingSourceEventsError } = sourceEventIds.length
        ? await db.from("source_events").select("source_event_id, source_updated_at, payload").eq("source_id", sourceId).in("source_event_id", sourceEventIds)
        : { data: [], error: null };
      if (existingSourceEventsError) throw new Error("Unable to check existing GDACS source events.");
      const existingSourceEventById = new Map<string, ExistingSourceEventRow>((existingSourceEvents ?? []).map((event) => [event.source_event_id, event]));

      const { data: existingIncidentSources, error: existingIncidentSourcesError } = sourceEventIds.length
        ? await db.from("incident_sources").select("source_event_id, source_record_url, record_state, source_updated_at").eq("source_id", sourceId).in("source_event_id", sourceEventIds)
        : { data: [], error: null };
      if (existingIncidentSourcesError) throw new Error("Unable to check existing GDACS incident evidence records.");
      const existingIncidentSourceByEventId = new Map<string, ExistingIncidentSourceRow>((existingIncidentSources ?? []).map((event) => [event.source_event_id, event]));

      const changedEvents = normalizedEvents.filter((event) => meaningfulChangeOccurred(event, existingIncidentByKey.get(event.canonicalKey), existingSourceEventById.get(event.sourceEventId), existingIncidentSourceByEventId.get(event.sourceEventId)));

      let alertCandidateIncidentIds: string[] = [];
      let alertEvaluation: AlertEvaluationSummary = {
        status: "not_run",
        candidate_incident_count: 0,
        matching_rule_location_count: 0,
        notifications_inserted: 0,
        error: null,
      };

      if (normalizedEvents.length > 0) {
        const { error: sourceEventsError } = await db.from("source_events").upsert(
          normalizedEvents.map((event) => ({ source_id: sourceId, ingestion_run_id: ingestionRunId, source_event_id: event.sourceEventId, source_updated_at: event.sourceUpdatedAt, fetched_at: fetchedAt, payload: event.payload })),
          { onConflict: "source_id,source_event_id" },
        );
        if (sourceEventsError) throw new Error("Unable to save GDACS source-event audit records.");

        const { data: storedIncidents, error: incidentsError } = await db.from("incidents").upsert(
          normalizedEvents.map((event) => ({
            canonical_key: event.canonicalKey, primary_source_id: sourceId, hazard_type: event.hazardType,
            severity: event.severity, status: event.status, integrity_status: "verified", data_mode: "live_source",
            title: event.title, summary: event.summary, place_name: event.placeName, latitude: event.latitude,
            longitude: event.longitude, event_time: event.eventTime, event_end_time: event.eventEndTime,
            source_updated_at: event.sourceUpdatedAt, last_source_fetched_at: fetchedAt, magnitude: null,
            depth_km: null, is_active: event.isActive,
          })),
          { onConflict: "canonical_key" },
        ).select("id, canonical_key");
        if (incidentsError || !storedIncidents) throw new Error("Unable to upsert canonical GDACS incidents.");
        const incidentIdByCanonicalKey = new Map(storedIncidents.map((incident) => [incident.canonical_key, incident.id]));

        alertCandidateIncidentIds = changedEvents
          .map((event) => incidentIdByCanonicalKey.get(event.canonicalKey))
          .filter((incidentId): incidentId is string => Boolean(incidentId));

        const incidentSourceRows = normalizedEvents.map((event) => {
          const incidentId = incidentIdByCanonicalKey.get(event.canonicalKey);
          return incidentId ? {
            incident_id: incidentId, source_id: sourceId, source_event_id: event.sourceEventId,
            source_record_url: event.sourceRecordUrl, source_record_title: event.title, record_state: event.recordState,
            integrity_status: "verified", data_mode: "live_source", source_event_time: event.eventTime,
            source_updated_at: event.sourceUpdatedAt, fetched_at: fetchedAt,
          } : null;
        }).filter((row) => row !== null);
        if (incidentSourceRows.length > 0) {
          const { error: incidentSourcesError } = await db.from("incident_sources").upsert(incidentSourceRows, { onConflict: "source_id,source_event_id" });
          if (incidentSourcesError) throw new Error("Unable to upsert GDACS incident evidence records.");
        }

        const incidentUpdateRows = changedEvents.map((event) => {
          const incidentId = incidentIdByCanonicalKey.get(event.canonicalKey);
          if (!incidentId) return null;
          const isNew = !existingKeys.has(event.canonicalKey);
          return {
            incident_id: incidentId, source_id: sourceId,
            update_type: isNew ? "source_record_ingested" : "source_record_updated",
            title: isNew ? "GDACS cyclone source record ingested" : "GDACS cyclone source record updated",
            body: event.isActive
              ? `GDACS source-backed tropical cyclone metadata was stored. GDACS Awareness Level: ${event.alertLevel ?? "unavailable"}. Sentinel Atlas does not treat this as an official emergency warning.`
              : "GDACS metadata indicates this cyclone record is no longer current. Sentinel Atlas does not treat this as an official emergency warning.",
            occurred_at: event.sourceUpdatedAt ?? event.eventTime ?? fetchedAt,
            data_mode: "live_source", integrity_status: "verified",
          };
        }).filter((row) => row !== null);
        if (incidentUpdateRows.length > 0) {
          const { error: updatesError } = await db.from("incident_updates").insert(incidentUpdateRows);
          if (updatesError) throw new Error("Unable to create GDACS incident timeline records.");
        }
      }

      if (alertCandidateIncidentIds.length > 0) {
        const { data: alertEvaluationData, error: alertEvaluationError } = await db
          .rpc("evaluate_alert_candidates", {
            p_incident_ids: alertCandidateIncidentIds,
          });

        if (alertEvaluationError) {
          alertEvaluation = {
            status: "failed",
            candidate_incident_count: alertCandidateIncidentIds.length,
            matching_rule_location_count: 0,
            notifications_inserted: 0,
            error: safeErrorMessage(alertEvaluationError),
          };

          console.error(
            "GDACS alert evaluation failed; ingestion will continue:",
            alertEvaluation.error,
          );
        } else {
          const evaluationResult = Array.isArray(alertEvaluationData)
            ? alertEvaluationData[0]
            : alertEvaluationData;
          const resultRecord =
            evaluationResult &&
            typeof evaluationResult === "object"
              ? evaluationResult as Record<string, unknown>
              : {};

          alertEvaluation = {
            status: "succeeded",
            candidate_incident_count: numberOrZero(
              resultRecord.candidate_incident_count,
            ),
            matching_rule_location_count: numberOrZero(
              resultRecord.matching_rule_location_count,
            ),
            notifications_inserted: numberOrZero(
              resultRecord.notifications_inserted,
            ),
            error: null,
          };
        }
      }

      const recordsCreated = normalizedEvents.filter((event) => !existingKeys.has(event.canonicalKey)).length;
      const recordsUpdated = changedEvents.filter((event) => existingKeys.has(event.canonicalKey)).length;
      const resolvedClosedCount = changedEvents.filter((event) => !event.isActive && existingKeys.has(event.canonicalKey)).length;
      const runStatus = providerWarnings.length > 0 ? "partial" : "succeeded";

      const { error: sourceStatusError } = await db.from("data_sources").update({
        source_mode: "live_source", ingestion_status: "operational", last_success_at: fetchedAt,
        last_error_at: null, last_error_message: null,
      }).eq("id", sourceId);
      if (sourceStatusError) throw new Error("Unable to update the GDACS source operational state.");

      const { error: completeRunError } = await db.from("ingestion_runs").update({
        status: runStatus, completed_at: new Date().toISOString(), records_received: features.length,
        records_created: recordsCreated, records_updated: recordsUpdated,
        metadata: {
          source: SOURCE_CODE,
          endpoint,
          event_types: [EVENT_TYPE],
          lookback_days: LOOKBACK_DAYS,
          page_size: PAGE_SIZE,
          pages_fetched: pagesFetched,
          max_pages: MAX_PAGES,
          normalized_records: normalizedEvents.length,
          provider_warnings: providerWarnings,
          skipped_invalid_records: skippedInvalidCount,
          skipped_no_point_records: skippedNoPointCount,
          alert_evaluation: alertEvaluation,
        },
      }).eq("id", ingestionRunId);
      if (completeRunError) throw new Error("Unable to complete GDACS ingestion audit record.");

      return Response.json({
        success: true, source: SOURCE_CODE, fetched_event_count: features.length, pages_fetched: pagesFetched,
        normalized_count: normalizedEvents.length, skipped_invalid_count: skippedInvalidCount,
        skipped_no_point_count: skippedNoPointCount, created_count: recordsCreated,
        updated_count: recordsUpdated, resolved_closed_count: resolvedClosedCount,
        incident_update_count: changedEvents.length,
        alert_evaluation: {
          status: alertEvaluation.status,
          candidate_incident_count: alertEvaluation.candidate_incident_count,
          matching_rule_location_count: alertEvaluation.matching_rule_location_count,
          notifications_inserted: alertEvaluation.notifications_inserted,
        },
        provider_warning: providerWarnings.length ? providerWarnings.join(" ") : null,
        run_status: runStatus, run_id: ingestionRunId,
      }, { headers: jsonHeaders });
    } catch (error) {
      const errorMessage = safeErrorMessage(error);
      console.error("GDACS cyclone ingestion failed:", errorMessage);
      if (ingestionRunId) {
        await db.from("ingestion_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: errorMessage }).eq("id", ingestionRunId);
      }
      if (sourceId) {
        await db.from("data_sources").update({ ingestion_status: "degraded", last_error_at: new Date().toISOString(), last_error_message: errorMessage }).eq("id", sourceId);
      }
      return Response.json({
        success: false, source: SOURCE_CODE, run_status: "failed",
        error: "GDACS cyclone ingestion failed. Existing stored records were retained.",
      }, { status: 500, headers: jsonHeaders });
    }
  }),
};
