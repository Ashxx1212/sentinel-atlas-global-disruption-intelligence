import { withSupabase } from "npm:@supabase/server@^1";
import type { Database, Json } from "./database.types.ts";

type UsgsProperties = {
  mag?: number | null;
  place?: string | null;
  time?: number | null;
  updated?: number | null;
  title?: string | null;
  url?: string | null;
};

type UsgsFeature = {
  id?: string;
  properties?: UsgsProperties;
  geometry?: {
    coordinates?: [number, number, number?];
  };
};

type UsgsGeoJsonResponse = {
  features?: UsgsFeature[];
};

type NormalizedEarthquake = {
  canonicalKey: string;
  sourceEventId: string;
  title: string;
  summary: string;
  placeName: string;
  latitude: number;
  longitude: number;
  depthKm: number | null;
  magnitude: number | null;
  severity: "advisory" | "elevated" | "high" | "critical";
  eventTime: string | null;
  sourceUpdatedAt: string | null;
  sourceRecordUrl: string | null;
  payload: UsgsFeature;
};

type ExistingIncident = {
  canonical_key: string;
  source_updated_at: string | null;
};

type AlertEvaluationSummary = {
  status: "not_run" | "succeeded" | "failed";
  candidate_incident_count: number;
  matching_rule_location_count: number;
  notifications_inserted: number;
  error: string | null;
};

const USGS_QUERY_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const LOOKBACK_DAYS = 7;
const MIN_MAGNITUDE = 2.5;
const RESULT_LIMIT = 100;
const REQUEST_TIMEOUT_MS = 15_000;

const jsonHeaders = {
  "Content-Type": "application/json",
  Allow: "POST",
};

function timestampFromMilliseconds(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
}

function severityFromMagnitude(
  magnitude: number | null,
): "advisory" | "elevated" | "high" | "critical" {
  if (magnitude !== null && magnitude >= 6.5) {
    return "critical";
  }

  if (magnitude !== null && magnitude >= 5.5) {
    return "high";
  }

  if (magnitude !== null && magnitude >= 4.5) {
    return "elevated";
  }

  return "advisory";
}

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

  return "Unknown ingestion error.";
}

function toJson(value: unknown): Json {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJson(item));
  }

  if (typeof value === "object") {
    const jsonObject: { [key: string]: Json | undefined } = {};

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child !== undefined) {
        jsonObject[key] = toJson(child);
      }
    }

    return jsonObject;
  }

  return null;
}

function hasSourceRecordChanged(
  earthquake: NormalizedEarthquake,
  existingIncident: ExistingIncident | undefined,
): boolean {
  if (!existingIncident) {
    return true;
  }

  if (!earthquake.sourceUpdatedAt) {
    return false;
  }

  if (!existingIncident.source_updated_at) {
    return true;
  }

  const incomingTimestamp = Date.parse(earthquake.sourceUpdatedAt);
  const storedTimestamp = Date.parse(existingIncident.source_updated_at);

  if (
    Number.isFinite(incomingTimestamp) &&
    Number.isFinite(storedTimestamp)
  ) {
    return incomingTimestamp !== storedTimestamp;
  }

  return earthquake.sourceUpdatedAt !== existingIncident.source_updated_at;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeFeature(
  feature: UsgsFeature,
): NormalizedEarthquake | null {
  const sourceEventId = feature.id?.trim();
  const coordinates = feature.geometry?.coordinates;
  const properties = feature.properties ?? {};

  if (
    !sourceEventId ||
    !coordinates ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number" ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    return null;
  }

  const [longitude, latitude, depthValue] = coordinates;
  const magnitude =
    typeof properties.mag === "number" && Number.isFinite(properties.mag)
      ? properties.mag
      : null;

  const placeName = properties.place?.trim() || "Location unavailable from source";
  const title =
    properties.title?.trim() ||
    `Magnitude ${magnitude?.toFixed(1) ?? "unavailable"} earthquake near ${placeName}`;

  const depthKm =
    typeof depthValue === "number" && Number.isFinite(depthValue)
      ? depthValue
      : null;

  return {
    canonicalKey: `usgs:${sourceEventId}`,
    sourceEventId,
    title,
    summary:
      `USGS source record: magnitude ${
        magnitude?.toFixed(1) ?? "unavailable"
      } earthquake near ${placeName}. ` +
      "Sentinel Atlas has not independently validated this source record.",
    placeName,
    latitude,
    longitude,
    depthKm,
    magnitude,
    severity: severityFromMagnitude(magnitude),
    eventTime: timestampFromMilliseconds(properties.time),
    sourceUpdatedAt: timestampFromMilliseconds(properties.updated),
    sourceRecordUrl: properties.url?.trim() || null,
    payload: feature,
  };
}

async function fetchUsgsEarthquakes(): Promise<{
  earthquakes: UsgsFeature[];
  endpoint: string;
}> {
  const now = new Date();
  const startDate = new Date(
    now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  const params = new URLSearchParams({
  format: "geojson",
  starttime: startDate.toISOString(),
  endtime: now.toISOString(),
  minmagnitude: String(MIN_MAGNITUDE),
  orderby: "time",
  limit: String(RESULT_LIMIT),
});

  const endpoint = `${USGS_QUERY_URL}?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: "application/geo+json, application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`USGS returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as UsgsGeoJsonResponse;

    if (!Array.isArray(payload.features)) {
      throw new Error("USGS response did not contain a GeoJSON features array.");
    }

    return {
      earthquakes: payload.features,
      endpoint,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (request, context) => {
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

    const db = context.supabaseAdmin;
    const expectedToken = Deno.env.get("SENTINEL_INGESTION_TOKEN");
const receivedToken = request.headers.get("x-sentinel-ingestion-token");

if (
  !expectedToken ||
  !receivedToken ||
  receivedToken !== expectedToken
) {
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

    const fetchedAt = new Date().toISOString();

    let sourceId: string | null = null;
    let ingestionRunId: string | null = null;

    try {
      const { data: source, error: sourceError } = await db
        .from("data_sources")
        .select("id")
        .eq("code", "usgs")
        .single();

      if (sourceError || !source) {
        throw new Error("USGS source registry record was not found.");
      }

      const activeSourceId = source.id;
      sourceId = activeSourceId;

      const { data: ingestionRun, error: runError } = await db
        .from("ingestion_runs")
        .insert({
          source_id: activeSourceId,
          status: "running",
          metadata: toJson({
            source: "usgs",
            lookback_days: LOOKBACK_DAYS,
            min_magnitude: MIN_MAGNITUDE,
            result_limit: RESULT_LIMIT,
          }),
        })
        .select("id")
        .single();

      if (runError || !ingestionRun) {
        throw new Error("Unable to create USGS ingestion audit record.");
      }

      const activeIngestionRunId = ingestionRun.id;
      ingestionRunId = activeIngestionRunId;

      const { earthquakes, endpoint } = await fetchUsgsEarthquakes();
      const normalizedEarthquakes = earthquakes
        .map(normalizeFeature)
        .filter((earthquake): earthquake is NormalizedEarthquake => earthquake !== null);

      const canonicalKeys = normalizedEarthquakes.map(
        (earthquake) => earthquake.canonicalKey,
      );

      const { data: existingIncidents, error: existingError } = canonicalKeys.length
        ? await db
          .from("incidents")
          .select("canonical_key, source_updated_at")
          .in("canonical_key", canonicalKeys)
        : { data: [], error: null };

      if (existingError) {
        throw new Error("Unable to check existing Sentinel Atlas incidents.");
      }

      const existingIncidentByCanonicalKey = new Map(
        ((existingIncidents ?? []) as ExistingIncident[]).map((incident) => [
          incident.canonical_key,
          incident,
        ]),
      );
      const existingKeys = new Set(existingIncidentByCanonicalKey.keys());
      const alertCandidateCanonicalKeys = new Set(
        normalizedEarthquakes
          .filter((earthquake) =>
            hasSourceRecordChanged(
              earthquake,
              existingIncidentByCanonicalKey.get(earthquake.canonicalKey),
            )
          )
          .map((earthquake) => earthquake.canonicalKey),
      );

      let alertCandidateIncidentIds: string[] = [];
      let alertEvaluation: AlertEvaluationSummary = {
        status: "not_run",
        candidate_incident_count: 0,
        matching_rule_location_count: 0,
        notifications_inserted: 0,
        error: null,
      };

      if (normalizedEarthquakes.length > 0) {
        const { error: sourceEventsError } = await db
          .from("source_events")
          .upsert(
            normalizedEarthquakes.map((earthquake) => ({
              source_id: activeSourceId,
              ingestion_run_id: activeIngestionRunId,
              source_event_id: earthquake.sourceEventId,
              source_updated_at: earthquake.sourceUpdatedAt,
              fetched_at: fetchedAt,
              payload: toJson(earthquake.payload),
            })),
            {
              onConflict: "source_id,source_event_id",
            },
          );

        if (sourceEventsError) {
          throw new Error("Unable to save USGS source-event audit records.");
        }

        const { data: storedIncidents, error: incidentsError } = await db
          .from("incidents")
          .upsert(
            normalizedEarthquakes.map((earthquake) => ({
              canonical_key: earthquake.canonicalKey,
              primary_source_id: activeSourceId,
              hazard_type: "earthquake",
              severity: earthquake.severity,
              status: "active",
              integrity_status: "verified",
              data_mode: "live_source",
              title: earthquake.title,
              summary: earthquake.summary,
              place_name: earthquake.placeName,
              latitude: earthquake.latitude,
              longitude: earthquake.longitude,
              event_time: earthquake.eventTime,
              source_updated_at: earthquake.sourceUpdatedAt,
              last_source_fetched_at: fetchedAt,
              magnitude: earthquake.magnitude,
              depth_km: earthquake.depthKm,
              is_active: true,
            })),
            {
              onConflict: "canonical_key",
            },
          )
          .select("id, canonical_key");

        if (incidentsError || !storedIncidents) {
          throw new Error("Unable to upsert canonical USGS incidents.");
        }

        const incidentIdByCanonicalKey = new Map(
          storedIncidents.map((incident) => [incident.canonical_key, incident.id]),
        );

        alertCandidateIncidentIds = Array.from(alertCandidateCanonicalKeys)
          .map((canonicalKey) => incidentIdByCanonicalKey.get(canonicalKey))
          .filter((incidentId): incidentId is string => Boolean(incidentId));

        const incidentSourceRows = normalizedEarthquakes
          .map((earthquake) => {
            const incidentId = incidentIdByCanonicalKey.get(
              earthquake.canonicalKey,
            );

            if (!incidentId) {
              return null;
            }

            return {
              incident_id: incidentId,
              source_id: activeSourceId,
              source_event_id: earthquake.sourceEventId,
              source_record_url: earthquake.sourceRecordUrl,
              source_record_title: earthquake.title,
              record_state: "active",
              integrity_status: "verified",
              data_mode: "live_source",
              source_event_time: earthquake.eventTime,
              source_updated_at: earthquake.sourceUpdatedAt,
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
            throw new Error("Unable to upsert USGS incident evidence records.");
          }
        }

        const newIncidentTimelineRows = normalizedEarthquakes
          .filter((earthquake) => !existingKeys.has(earthquake.canonicalKey))
          .map((earthquake) => {
            const incidentId = incidentIdByCanonicalKey.get(
              earthquake.canonicalKey,
            );

            if (!incidentId) {
              return null;
            }

            return {
              incident_id: incidentId,
              source_id: activeSourceId,
              update_type: "source_record_ingested",
              title: "USGS source record ingested",
              body:
                "A source-backed earthquake record was added to Sentinel Atlas. " +
                "Sentinel Atlas has not independently validated this observation.",
              occurred_at: earthquake.eventTime ?? fetchedAt,
              data_mode: "live_source",
              integrity_status: "verified",
            };
          })
          .filter((row) => row !== null);

        if (newIncidentTimelineRows.length > 0) {
          const { error: updatesError } = await db
            .from("incident_updates")
            .insert(newIncidentTimelineRows);

          if (updatesError) {
            throw new Error("Unable to create USGS incident timeline records.");
          }
        }
      }

      if (alertCandidateIncidentIds.length > 0) {
        // The committed database type snapshot is generated from the schema.
        // Bind the client method so the evaluator remains callable even while
        // generated RPC types are refreshed in a later maintenance change.
        const evaluateCandidatesRpc = db.rpc.bind(db) as unknown as (
          functionName: string,
          args: { p_incident_ids: string[] },
        ) => Promise<{ data: unknown; error: unknown }>;
        const { data: alertEvaluationData, error: alertEvaluationError } = await evaluateCandidatesRpc(
          "evaluate_alert_candidates",
          {
            p_incident_ids: alertCandidateIncidentIds,
          },
        );

        if (alertEvaluationError) {
          alertEvaluation = {
            status: "failed",
            candidate_incident_count: alertCandidateIncidentIds.length,
            matching_rule_location_count: 0,
            notifications_inserted: 0,
            error: safeErrorMessage(alertEvaluationError),
          };

          console.error(
            "USGS alert evaluation failed; ingestion will continue:",
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

      const recordsCreated = normalizedEarthquakes.filter(
        (earthquake) => !existingKeys.has(earthquake.canonicalKey),
      ).length;

      const recordsUpdated = normalizedEarthquakes.filter(
        (earthquake) =>
          existingKeys.has(earthquake.canonicalKey) &&
          alertCandidateCanonicalKeys.has(earthquake.canonicalKey),
      ).length;

      const { error: sourceStatusError } = await db
        .from("data_sources")
        .update({
          source_mode: "live_source",
          ingestion_status: "operational",
          last_success_at: fetchedAt,
          last_error_at: null,
          last_error_message: null,
        })
        .eq("id", activeSourceId);

      if (sourceStatusError) {
        throw new Error("Unable to update the USGS source operational state.");
      }

      const { error: completeRunError } = await db
        .from("ingestion_runs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          records_received: earthquakes.length,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          metadata: toJson({
            source: "usgs",
            endpoint,
            lookback_days: LOOKBACK_DAYS,
            min_magnitude: MIN_MAGNITUDE,
            result_limit: RESULT_LIMIT,
            valid_records: normalizedEarthquakes.length,
            skipped_records: earthquakes.length - normalizedEarthquakes.length,
            alert_evaluation: alertEvaluation,
          }),
        })
        .eq("id", activeIngestionRunId);

      if (completeRunError) {
        throw new Error("Unable to complete the USGS ingestion audit record.");
      }

      return Response.json(
        {
          success: true,
          source_status: "operational",
          records_received: earthquakes.length,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          alert_evaluation: {
            status: alertEvaluation.status,
            candidate_incident_count: alertEvaluation.candidate_incident_count,
            matching_rule_location_count: alertEvaluation.matching_rule_location_count,
            notifications_inserted: alertEvaluation.notifications_inserted,
          },
          run_id: activeIngestionRunId,
        },
        {
          headers: jsonHeaders,
        },
      );
    } catch (error) {
      const errorMessage = safeErrorMessage(error);

      console.error("USGS earthquake ingestion failed:", errorMessage);

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
          source_status: "degraded",
          error: "USGS ingestion failed. Existing stored records were retained.",
        },
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }
  }),
};