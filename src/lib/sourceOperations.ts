import { isSupabaseConfigured, supabase } from './supabase';

export type SourceOperationsRunStatus =
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'unknown';

export interface SourceOperationsFailureSummary {
  category: string | null;
  partition: string | null;
  status: string | null;
  attempts: number | null;
  outcome: string | null;
}

export interface SourceOperationsRun {
  sourceCode: string;
  displayName: string;
  startedAt: string;
  completedAt: string | null;
  status: SourceOperationsRunStatus;
  durationMs: number | null;
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  finalProviderOutcome: string | null;
  retryCount: number;
  retryableFailureCount: number;
  successfulResponseCount: number;
  failureSummaryCount: number;
  retainedStoredRecords: boolean;
  failureSummaries: SourceOperationsFailureSummary[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNonNegativeNumber(value: unknown): number {
  const parsed = asNumber(value);

  return parsed !== null && parsed >= 0 ? parsed : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNullableNumber(value: unknown): number | null {
  const parsed = asNumber(value);

  return parsed !== null && parsed >= 0 ? parsed : null;
}

function parseFailureSummaries(value: unknown): SourceOperationsFailureSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((summary) => ({
      category: asString(summary.category),
      partition: asString(summary.partition),
      status: asString(summary.status),
      attempts: asNullableNumber(summary.attempts),
      outcome: asString(summary.outcome),
    }));
}

function parseRun(value: unknown): SourceOperationsRun | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceCode = asString(value.source_code);
  const displayName = asString(value.display_name);
  const startedAt = asString(value.started_at);

  if (!sourceCode || !displayName || !startedAt) {
    return null;
  }

  const rawStatus = asString(value.status);
  const status: SourceOperationsRunStatus =
    rawStatus === 'running' ||
    rawStatus === 'succeeded' ||
    rawStatus === 'partial' ||
    rawStatus === 'failed'
      ? rawStatus
      : 'unknown';

  return {
    sourceCode,
    displayName,
    startedAt,
    completedAt: asString(value.completed_at),
    status,
    durationMs: asNullableNumber(value.duration_ms),
    recordsReceived: asNonNegativeNumber(value.records_received),
    recordsCreated: asNonNegativeNumber(value.records_created),
    recordsUpdated: asNonNegativeNumber(value.records_updated),
    finalProviderOutcome: asString(value.final_provider_outcome),
    retryCount: asNonNegativeNumber(value.retry_count),
    retryableFailureCount: asNonNegativeNumber(value.retryable_failure_count),
    successfulResponseCount: asNonNegativeNumber(value.successful_response_count),
    failureSummaryCount: asNonNegativeNumber(value.failure_summary_count),
    retainedStoredRecords: asBoolean(value.retained_stored_records),
    failureSummaries: parseFailureSummaries(value.failure_summaries),
  };
}

export async function getSourceOperationsRecentRuns(
  limit = 20,
): Promise<SourceOperationsRun[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Source Operations is unavailable because Supabase is not configured.');
  }

  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 50));

  const { data, error } = await supabase.rpc(
    'get_source_operations_recent_runs',
    { p_limit: boundedLimit },
  );

  if (error) {
    throw new Error('Unable to load the authenticated Source Operations read model.');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map(parseRun)
    .filter((run): run is SourceOperationsRun => run !== null);
}
