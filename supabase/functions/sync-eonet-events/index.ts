import { withSupabase } from "npm:@supabase/server@^1";
import type { Database, Json } from "./database.types.ts";
import {
  canStartProviderAttempt,
  classifyHttpStatus,
  classifyNetworkFailure,
  createProviderFailureSummary,
  EONET_RESILIENCE_LIMITS,
  finalProviderOutcome,
  ProviderFailureSummary,
  retryDelayForFailure,
  shouldRetryProviderFailure,
} from "./eonetResilience.ts";

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
  payload: Json;
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

type ClosedPartitionOutcome =
  | "accepted"
  | "split"
  | "minimum_window_saturated"
  | "provider_failure"
  | "request_cap_reached"
  | "time_budget_reached";

type ClosedPartitionMetadata = {
  category: EonetCategoryId;
  start: string;
  end: string;
  records_returned: number;
  outcome: ClosedPartitionOutcome;
};

type EonetFetchState = {
  allEvents: EonetEvent[];
  endpoints: string[];
  providerWarnings: string[];
  providerRequestCount: number;
  successfulProviderResponseCount: number;
  retryCount: number;
  retryableFailureCount: number;
  providerStatus: Record<string, number>;
  providerFailureSummaries: ProviderFailureSummary[];
  fetchStartedAt: number;
  closedPartitions: ClosedPartitionMetadata[];
  saturatedOpenCategories: EonetCategoryId[];
  closedCategoriesRequiringPartitions: EonetCategoryId[];
  saturatedClosedCategories: EonetCategoryId[];
  closedRangeStart: string;
  closedRangeEnd: string;
  providerFetchStopped: boolean;
};

const EONET_EVENTS_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";
const EONET_CATEGORY_PRIORITY: readonly EonetCategoryId[] = [
  "wildfires",
  "volcanoes",
  "floods",
  "severeStorms",
];

const INCLUDED_CATEGORIES = EONET_CATEGORY_PRIORITY;
const CLOSED_LOOKBACK_DAYS = 45;
const RESULT_LIMIT = 100;
const MAX_EONET_PROVIDER_REQUESTS = EONET_RESILIENCE_LIMITS.maxProviderAttempts;
const FETCH_BUDGET_MS = 95_000;
const REQUEST_TIMEOUT_MS = EONET_RESILIENCE_LIMITS.requestTimeoutMs;
const RETRY_BUDGET_GUARD_MS = EONET_RESILIENCE_LIMITS.retryBudgetGuardMs;
const SOURCE_CODE = "eonet";
const CLOSED_PARTITION_STRATEGY = "category-first-event-date-bisection";
const DATABASE_LOOKUP_BATCH_SIZE = 100;

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

  if (value instanceof Date) {
    return value.toISOString();
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

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateFromUtcDateString(value: string): Date {
  const parts = value.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(value: string, days: number): string {
  const date = dateFromUtcDateString(value);
  date.setUTCDate(date.getUTCDate() + days);

  return utcDateString(date);
}

function midpointUtcDate(start: string, end: string): string {
  const startTime = dateFromUtcDateString(start).getTime();
  const endTime = dateFromUtcDateString(end).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const daySpan = Math.floor((endTime - startTime) / dayMs);

  return addUtcDays(start, Math.floor(daySpan / 2));
}

function closedEventDateRange(referenceIso: string): { start: string; end: string } {
  const end = utcDateString(new Date(referenceIso));

  return {
    start: addUtcDays(end, -(CLOSED_LOOKBACK_DAYS - 1)),
    end,
  };
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
    payload: toJson({
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
  }),
};

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

class EonetHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterHeader: string | null,
  ) {
    super(`NASA EONET returned HTTP ${status}.`);
  }
}

class EonetDataError extends Error {
  constructor(readonly safeStatus: string, message: string) {
    super(message);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function providerFailureFromError(error: unknown): {
  status: string;
  retryable: boolean;
  retryAfterHeader: string | null;
} {
  if (error instanceof EonetHttpError) {
    return {
      ...classifyHttpStatus(error.status),
      retryAfterHeader: error.retryAfterHeader,
    };
  }

  if (error instanceof EonetDataError) {
    return {
      status: error.safeStatus,
      retryable: false,
      retryAfterHeader: null,
    };
  }

  const classification = classifyNetworkFailure(isAbortError(error) ? "timeout" : "network");

  return {
    ...classification,
    retryAfterHeader: null,
  };
}

async function fetchEonetEvents(params: Record<string, string>): Promise<{
  endpoint: string;
  events: EonetEvent[];
  status: number;
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
      throw new EonetHttpError(response.status, response.headers.get("Retry-After"));
    }

    let payload: EonetEventsResponse;
    try {
      payload = (await response.json()) as EonetEventsResponse;
    } catch {
      throw new EonetDataError("invalid_json", "NASA EONET response was not valid JSON.");
    }

    if (!Array.isArray(payload.events)) {
      throw new EonetDataError(
        "invalid_events_array",
        "NASA EONET response did not contain an events array.",
      );
    }

    return {
      endpoint: url.toString(),
      events: payload.events,
      status: response.status,
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
function chunkValues<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
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

function addProviderWarning(state: EonetFetchState, warning: string): void {
  if (!state.providerWarnings.includes(warning)) {
    state.providerWarnings.push(warning);
  }
}

function addProviderStatus(state: EonetFetchState, status: string): void {
  state.providerStatus[status] = (state.providerStatus[status] ?? 0) + 1;
}

function addUniqueCategory(categories: EonetCategoryId[], category: EonetCategoryId): void {
  if (!categories.includes(category)) {
    categories.push(category);
  }
}

function remainingFetchBudgetMs(state: EonetFetchState): number {
  return Math.max(0, FETCH_BUDGET_MS - (Date.now() - state.fetchStartedAt));
}

function providerFailureOutcome(
  state: EonetFetchState,
  partitionRetryCount: number,
  retryDelayMs: number | null,
): string {
  if (partitionRetryCount >= EONET_RESILIENCE_LIMITS.maxRetriesPerPartition) {
    return "partition_retry_limit_reached";
  }

  if (state.retryCount >= EONET_RESILIENCE_LIMITS.maxRetriesPerRun) {
    return "run_retry_limit_reached";
  }

  if (!canStartProviderAttempt(state.providerRequestCount, MAX_EONET_PROVIDER_REQUESTS)) {
    return "request_cap_reached";
  }

  if (
    retryDelayMs !== null &&
    remainingFetchBudgetMs(state) <
      retryDelayMs + REQUEST_TIMEOUT_MS + RETRY_BUDGET_GUARD_MS
  ) {
    return "time_budget_reached";
  }

  return "retry_exhausted";
}

function addProviderFailureSummary(
  state: EonetFetchState,
  category: EonetCategoryId,
  partition: string,
  status: string,
  attempts: number,
  outcome: string,
): void {
  const summary = createProviderFailureSummary({
    category,
    partition,
    status,
    attempts,
    outcome,
  });

  state.providerFailureSummaries.push(summary);
  addProviderWarning(
    state,
    `EONET provider partition failed: category=${summary.category}, partition=${summary.partition}, status=${summary.status}, outcome=${summary.outcome}; preserved records fetched so far.`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopProviderFetches(
  state: EonetFetchState,
  reason: "request_cap_reached" | "time_budget_reached",
  description: string,
): void {
  if (state.providerFetchStopped) {
    return;
  }

  state.providerFetchStopped = true;

  if (reason === "request_cap_reached") {
    addProviderWarning(
      state,
      `EONET provider request cap of ${MAX_EONET_PROVIDER_REQUESTS} reached before fetching ${description}; preserved records fetched so far.`,
    );
    return;
  }

  addProviderWarning(
    state,
    `EONET fetch time budget of ${FETCH_BUDGET_MS} ms would be exceeded before fetching ${description}; preserved records fetched so far.`,
  );
}

function canStartProviderRequest(
  state: EonetFetchState,
  category: EonetCategoryId,
  partition: string,
  description: string,
  skippedPartition?: { category: EonetCategoryId; start: string; end: string },
): boolean {
  if (state.providerFetchStopped) {
    return false;
  }

  if (!canStartProviderAttempt(state.providerRequestCount, MAX_EONET_PROVIDER_REQUESTS)) {
    stopProviderFetches(state, "request_cap_reached", description);
    addProviderFailureSummary(
      state,
      category,
      partition,
      "request_cap_reached",
      0,
      "skipped_request_cap",
    );
    if (skippedPartition) {
      state.closedPartitions.push({
        ...skippedPartition,
        records_returned: 0,
        outcome: "request_cap_reached",
      });
    }
    return false;
  }

  const elapsedMs = Date.now() - state.fetchStartedAt;
  if (elapsedMs + REQUEST_TIMEOUT_MS > FETCH_BUDGET_MS) {
    stopProviderFetches(state, "time_budget_reached", description);
    addProviderFailureSummary(
      state,
      category,
      partition,
      "time_budget_reached",
      0,
      "skipped_time_budget",
    );
    if (skippedPartition) {
      state.closedPartitions.push({
        ...skippedPartition,
        records_returned: 0,
        outcome: "time_budget_reached",
      });
    }
    return false;
  }

  return true;
}

async function fetchTrackedEonetEvents(
  state: EonetFetchState,
  params: Record<string, string>,
  scope: {
    category: EonetCategoryId;
    partition: string;
    description: string;
    skippedPartition?: { category: EonetCategoryId; start: string; end: string };
  },
): Promise<{ endpoint: string; events: EonetEvent[] } | null> {
  let attempts = 0;
  let partitionRetryCount = 0;

  while (true) {
    if (
      !canStartProviderRequest(
        state,
        scope.category,
        scope.partition,
        scope.description,
        scope.skippedPartition,
      )
    ) {
      return null;
    }

    state.providerRequestCount += 1;
    attempts += 1;

    try {
      const result = await fetchEonetEvents(params);
      state.successfulProviderResponseCount += 1;
      addProviderStatus(state, `http_${result.status}`);
      state.endpoints.push(result.endpoint);

      return result;
    } catch (error) {
      const failure = providerFailureFromError(error);
      const retryDelayMs = retryDelayForFailure(failure, failure.retryAfterHeader);
      addProviderStatus(state, failure.status);

      if (failure.retryable) {
        state.retryableFailureCount += 1;
      }

      if (
        retryDelayMs !== null &&
        shouldRetryProviderFailure({
          partitionRetryCount,
          runRetryCount: state.retryCount,
          providerAttemptCount: state.providerRequestCount,
          remainingBudgetMs: remainingFetchBudgetMs(state),
          retryDelayMs,
          maxProviderAttempts: MAX_EONET_PROVIDER_REQUESTS,
          requestTimeoutMs: REQUEST_TIMEOUT_MS,
          retryBudgetGuardMs: RETRY_BUDGET_GUARD_MS,
        })
      ) {
        state.retryCount += 1;
        partitionRetryCount += 1;
        await sleep(retryDelayMs);
        continue;
      }

      const outcome = failure.retryable
        ? providerFailureOutcome(state, partitionRetryCount, retryDelayMs)
        : "non_retryable";

      addProviderFailureSummary(
        state,
        scope.category,
        scope.partition,
        failure.status,
        attempts,
        outcome,
      );

      if (scope.skippedPartition) {
        state.closedPartitions.push({
          ...scope.skippedPartition,
          records_returned: 0,
          outcome: "provider_failure",
        });
      }

      return null;
    }
  }
}

async function fetchClosedEventDatePartition(
  state: EonetFetchState,
  category: EonetCategoryId,
  start: string,
  end: string,
): Promise<EonetEvent[]> {
  const result = await fetchTrackedEonetEvents(
    state,
    {
      category,
      status: "closed",
      start,
      end,
      limit: String(RESULT_LIMIT),
    },
    {
      category,
      partition: "closed_partition",
      description: `closed EONET event-date partition for ${category} (${start}..${end})`,
      skippedPartition: { category, start, end },
    },
  );

  if (!result) {
    return [];
  }

  const events = [...result.events];
  if (result.events.length < RESULT_LIMIT) {
    state.closedPartitions.push({
      category,
      start,
      end,
      records_returned: result.events.length,
      outcome: "accepted",
    });

    return events;
  }

  if (start === end) {
    state.closedPartitions.push({
      category,
      start,
      end,
      records_returned: result.events.length,
      outcome: "minimum_window_saturated",
    });
    addUniqueCategory(state.saturatedClosedCategories, category);
    addProviderWarning(
      state,
      `Closed EONET event-date partition for ${category} (${start}) returned the configured limit; additional records may be omitted.`,
    );

    return events;
  }

  state.closedPartitions.push({
    category,
    start,
    end,
    records_returned: result.events.length,
    outcome: "split",
  });

  const midpoint = midpointUtcDate(start, end);
  const nextStart = addUtcDays(midpoint, 1);
  const leftEvents = await fetchClosedEventDatePartition(state, category, start, midpoint);
  const rightEvents = state.providerFetchStopped
    ? []
    : await fetchClosedEventDatePartition(state, category, nextStart, end);

  return [...events, ...leftEvents, ...rightEvents];
}

async function fetchEonetSourceRecords(referenceIso: string): Promise<{
  allEvents: EonetEvent[];
  endpoints: string[];
  providerWarnings: string[];
  providerRequestCount: number;
  successfulProviderResponseCount: number;
  retryCount: number;
  retryableFailureCount: number;
  providerStatus: Record<string, number>;
  providerFailureSummaries: ProviderFailureSummary[];
  closedRangeStart: string;
  closedRangeEnd: string;
  saturatedOpenCategories: EonetCategoryId[];
  closedCategoriesRequiringPartitions: EonetCategoryId[];
  saturatedClosedCategories: EonetCategoryId[];
  closedPartitions: ClosedPartitionMetadata[];
}> {
  const closedRange = closedEventDateRange(referenceIso);
  const state: EonetFetchState = {
    allEvents: [],
    endpoints: [],
    providerWarnings: [],
    providerRequestCount: 0,
    successfulProviderResponseCount: 0,
    retryCount: 0,
    retryableFailureCount: 0,
    providerStatus: {},
    providerFailureSummaries: [],
    fetchStartedAt: Date.now(),
    closedPartitions: [],
    saturatedOpenCategories: [],
    closedCategoriesRequiringPartitions: [],
    saturatedClosedCategories: [],
    closedRangeStart: closedRange.start,
    closedRangeEnd: closedRange.end,
    providerFetchStopped: false,
  };

  for (const category of INCLUDED_CATEGORIES) {
    const openResult = await fetchTrackedEonetEvents(
      state,
      {
        category,
        status: "open",
        limit: String(RESULT_LIMIT),
      },
      {
        category,
        partition: "open",
        description: `open EONET category ${category}`,
      },
    );

    if (!openResult) {
      if (state.providerFetchStopped) {
        break;
      }
      continue;
    }

    state.allEvents.push(...openResult.events);
    if (openResult.events.length >= RESULT_LIMIT) {
      addUniqueCategory(state.saturatedOpenCategories, category);
      addProviderWarning(
        state,
        `Open EONET category ${category} returned the configured limit; additional open records may be omitted.`,
      );
    }
  }

  for (const category of INCLUDED_CATEGORIES) {
    if (state.providerFetchStopped) {
      break;
    }

    const closedResult = await fetchTrackedEonetEvents(
      state,
      {
        category,
        status: "closed",
        days: String(CLOSED_LOOKBACK_DAYS),
        limit: String(RESULT_LIMIT),
      },
      {
        category,
        partition: "closed_days",
        description: `closed EONET days query for ${category}`,
      },
    );

    if (!closedResult) {
      if (state.providerFetchStopped) {
        break;
      }
      continue;
    }

    state.allEvents.push(...closedResult.events);
    if (closedResult.events.length < RESULT_LIMIT) {
      continue;
    }

    addUniqueCategory(state.closedCategoriesRequiringPartitions, category);
    const midpoint = midpointUtcDate(closedRange.start, closedRange.end);
    const nextStart = addUtcDays(midpoint, 1);
    const firstPartitionEvents = await fetchClosedEventDatePartition(
      state,
      category,
      closedRange.start,
      midpoint,
    );
    const secondPartitionEvents = state.providerFetchStopped
      ? []
      : await fetchClosedEventDatePartition(
        state,
        category,
        nextStart,
        closedRange.end,
      );
    state.allEvents.push(...firstPartitionEvents, ...secondPartitionEvents);
  }

  return {
    allEvents: state.allEvents,
    endpoints: state.endpoints,
    providerWarnings: state.providerWarnings,
    providerRequestCount: state.providerRequestCount,
    successfulProviderResponseCount: state.successfulProviderResponseCount,
    retryCount: state.retryCount,
    retryableFailureCount: state.retryableFailureCount,
    providerStatus: state.providerStatus,
    providerFailureSummaries: state.providerFailureSummaries,
    closedRangeStart: state.closedRangeStart,
    closedRangeEnd: state.closedRangeEnd,
    saturatedOpenCategories: state.saturatedOpenCategories,
    closedCategoriesRequiringPartitions: state.closedCategoriesRequiringPartitions,
    saturatedClosedCategories: state.saturatedClosedCategories,
    closedPartitions: state.closedPartitions,
  };
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

      const activeSourceId = source.id;
sourceId = activeSourceId;

      const { data: ingestionRun, error: runError } = await db
        .from("ingestion_runs")
        .insert({
          source_id: sourceId,
          status: "running",
          metadata: toJson({
  source: SOURCE_CODE,
  categories: [...INCLUDED_CATEGORIES],
  closed_lookback_days: CLOSED_LOOKBACK_DAYS,
  result_limit: RESULT_LIMIT,
}),
        })
        .select("id")
        .single();

      if (runError || !ingestionRun) {
        throw new Error("Unable to create EONET ingestion audit record.");
      }

      const activeIngestionRunId = ingestionRun.id;
ingestionRunId = activeIngestionRunId;

      const {
        allEvents,
        providerWarnings,
        providerRequestCount,
        successfulProviderResponseCount,
        retryCount,
        retryableFailureCount,
        providerStatus,
        providerFailureSummaries,
        closedRangeStart,
        closedRangeEnd,
        saturatedOpenCategories,
        closedCategoriesRequiringPartitions,
        saturatedClosedCategories,
        closedPartitions,
      } = await fetchEonetSourceRecords(fetchedAt);
      const dedupedEvents = dedupeByEventId(allEvents);
      const { normalizedEvents, skippedInvalidCount, skippedNoPointCount } = normalizeEvents(dedupedEvents);
      const providerOutcome = finalProviderOutcome({
        successfulProviderResponseCount,
        providerFailureSummaryCount: providerFailureSummaries.length,
        providerWarningCount: providerWarnings.length,
      });
      const providerMetadata = toJson({
        source: SOURCE_CODE,
        categories: [...INCLUDED_CATEGORIES],
        closed_lookback_days: CLOSED_LOOKBACK_DAYS,
        result_limit: RESULT_LIMIT,
        deduplicated_records: dedupedEvents.length,
        normalized_records: normalizedEvents.length,
        provider_warnings: providerWarnings,
        skipped_invalid_records: skippedInvalidCount,
        skipped_no_point_records: skippedNoPointCount,
        provider_request_count: providerRequestCount,
        max_provider_requests: MAX_EONET_PROVIDER_REQUESTS,
        fetch_budget_ms: FETCH_BUDGET_MS,
        closed_partition_strategy: CLOSED_PARTITION_STRATEGY,
        closed_range_start: closedRangeStart,
        closed_range_end: closedRangeEnd,
        saturated_open_categories: saturatedOpenCategories,
        closed_categories_requiring_partitions: closedCategoriesRequiringPartitions,
        saturated_closed_categories: saturatedClosedCategories,
        closed_partitions: closedPartitions,
        retry_count: retryCount,
        retryable_failure_count: retryableFailureCount,
        provider_status: providerStatus,
        final_provider_outcome: providerOutcome,
        retained_stored_records: providerOutcome !== "succeeded",
        provider_failure_summaries: providerFailureSummaries,
});

      if (providerOutcome === "failed") {
        const safeFailureMessage =
          "NASA EONET provider fetch failed. Existing stored records were retained.";

        const { error: sourceStatusError } = await db
          .from("data_sources")
          .update({
            ingestion_status: "degraded",
            last_error_at: fetchedAt,
            last_error_message: safeFailureMessage,
          })
          .eq("id", sourceId);

        if (sourceStatusError) {
          throw new Error("Unable to update the EONET source degraded state.");
        }

        const { error: completeRunError } = await db
          .from("ingestion_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            records_received: allEvents.length,
            records_created: 0,
            records_updated: 0,
            error_message: safeFailureMessage,
            metadata: providerMetadata,
          })
          .eq("id", ingestionRunId);

        if (completeRunError) {
          throw new Error("Unable to complete the failed EONET ingestion audit record.");
        }

        return Response.json(
          {
            success: false,
            source: SOURCE_CODE,
            run_status: "failed",
            error: safeFailureMessage,
          },
          {
            status: 500,
            headers: jsonHeaders,
          },
        );
      }

      const canonicalKeys = normalizedEvents.map((event) => event.canonicalKey);
      const sourceEventIds = normalizedEvents.map((event) => event.sourceEventId);

      const existingIncidents: ExistingIncidentRow[] = [];

for (const canonicalKeyBatch of chunkValues(
  canonicalKeys,
  DATABASE_LOOKUP_BATCH_SIZE,
)) {
  const { data, error: existingIncidentsError } = await db
    .from("incidents")
    .select("id, canonical_key, title, hazard_type, status, source_updated_at")
    .in("canonical_key", canonicalKeyBatch);

  if (existingIncidentsError) {
    console.error("EONET existing-incidents lookup failed:", {
      code: existingIncidentsError.code ?? "unknown",
    });

    throw new Error("Unable to check existing EONET incidents.");
  }

  existingIncidents.push(...(data ?? []));
}

      const existingIncidentByKey = new Map<string, ExistingIncidentRow>(
  existingIncidents
    .filter(
      (incident): incident is ExistingIncidentRow & { canonical_key: string } =>
        typeof incident.canonical_key === "string",
    )
    .map((incident) => [incident.canonical_key, incident] as const),
);
      const existingKeys = new Set(existingIncidentByKey.keys());

      const existingSourceEvents: ExistingSourceEventRow[] = [];

for (const sourceEventIdBatch of chunkValues(
  sourceEventIds,
  DATABASE_LOOKUP_BATCH_SIZE,
)) {
  const { data, error: existingSourceEventsError } = await db
    .from("source_events")
    .select("source_event_id, source_updated_at, payload")
    .eq("source_id", activeSourceId)
    .in("source_event_id", sourceEventIdBatch);

  if (existingSourceEventsError) {
    console.error("EONET existing-source-events lookup failed:", {
      code: existingSourceEventsError.code ?? "unknown",
    });

    throw new Error("Unable to check existing EONET source events.");
  }

  existingSourceEvents.push(...(data ?? []));
}

      const existingSourceEventById = new Map<string, ExistingSourceEventRow>(
  existingSourceEvents
    .filter(
      (sourceEvent): sourceEvent is ExistingSourceEventRow & { source_event_id: string } =>
        typeof sourceEvent.source_event_id === "string",
    )
    .map((sourceEvent) => [sourceEvent.source_event_id, sourceEvent] as const),
);

      const existingIncidentSources: ExistingIncidentSourceRow[] = [];

for (const sourceEventIdBatch of chunkValues(
  sourceEventIds,
  DATABASE_LOOKUP_BATCH_SIZE,
)) {
  const { data, error: existingIncidentSourcesError } = await db
    .from("incident_sources")
    .select("source_event_id, source_record_url, record_state, source_updated_at")
    .eq("source_id", sourceId)
    .in("source_event_id", sourceEventIdBatch);

  if (existingIncidentSourcesError) {
    console.error("EONET existing-incident-sources lookup failed:", {
      code: existingIncidentSourcesError.code ?? "unknown",
    });

    throw new Error("Unable to check existing EONET incident evidence records.");
  }

  existingIncidentSources.push(...(data ?? []));
}

      const existingIncidentSourceByEventId = new Map<string, ExistingIncidentSourceRow>(
  existingIncidentSources
    .filter(
      (incidentSource): incidentSource is ExistingIncidentSourceRow & { source_event_id: string } =>
        typeof incidentSource.source_event_id === "string",
    )
    .map((incidentSource) => [incidentSource.source_event_id, incidentSource] as const),
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
              source_id: activesourceId,
              ingestion_run_id: activeIngestionRunId
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
              primary_source_id: activeSourceId
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
      const runStatus = providerOutcome;
      const sourceStatusUpdate = runStatus === "succeeded"
        ? {
          source_mode: "live_source",
          ingestion_status: "operational",
          last_success_at: fetchedAt,
          last_error_at: null,
          last_error_message: null,
        }
        : {
          source_mode: "live_source",
          ingestion_status: "degraded",
          last_success_at: fetchedAt,
          last_error_at: fetchedAt,
          last_error_message:
            "NASA EONET ingestion completed with partial provider coverage. Existing stored records were retained.",
        };

      const { error: sourceStatusError } = await db
        .from("data_sources")
        .update(sourceStatusUpdate)
        .eq("id", activeSourceId)

      if (sourceStatusError) {
        throw new Error("Unable to update the EONET source state.");
      }

      const { error: completeRunError } = await db
        .from("ingestion_runs")
        .update({
          status: runStatus,
          completed_at: new Date().toISOString(),
          records_received: allEvents.length,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          metadata: providerMetadata,
        })
        .eq("id", activeingestionRunId);

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
