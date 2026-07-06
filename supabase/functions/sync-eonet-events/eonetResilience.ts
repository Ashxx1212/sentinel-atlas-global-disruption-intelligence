export const EONET_RESILIENCE_LIMITS = {
  maxProviderAttempts: 20,
  maxRetriesPerPartition: 1,
  maxRetriesPerRun: 4,
  requestTimeoutMs: 15_000,
  retryBudgetGuardMs: 500,
  defaultRetryDelayMs: 1_000,
  rateLimitRetryDelayMs: 2_000,
  maxRetryAfterMs: 10_000,
} as const;

export type FinalProviderOutcome = "succeeded" | "partial" | "failed";

export type ProviderFailureSummary = {
  category: string;
  partition: string;
  status: string;
  attempts: number;
  outcome: string;
};

export type ProviderFailureClassification = {
  status: string;
  retryable: boolean;
};

const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

function safeSummaryText(value: string): string {
  return value.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 80);
}

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

export function classifyHttpStatus(status: number): ProviderFailureClassification {
  return {
    status: `http_${status}`,
    retryable: isRetryableHttpStatus(status),
  };
}

export function classifyNetworkFailure(kind: "network" | "timeout"): ProviderFailureClassification {
  return {
    status: kind === "timeout" ? "timeout" : "network_error",
    retryable: true,
  };
}

export function canStartProviderAttempt(
  providerAttemptCount: number,
  maxProviderAttempts = EONET_RESILIENCE_LIMITS.maxProviderAttempts,
): boolean {
  return providerAttemptCount < maxProviderAttempts;
}

export function parseRetryAfterMs(
  value: string | null,
  nowMs = Date.now(),
  maxRetryAfterMs = EONET_RESILIENCE_LIMITS.maxRetryAfterMs,
): number | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (/^-?\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return null;
    }

    return Math.min(seconds * 1_000, maxRetryAfterMs);
  }

  const retryAtMs = Date.parse(normalized);
  if (!Number.isFinite(retryAtMs)) {
    return null;
  }

  const delayMs = retryAtMs - nowMs;
  if (delayMs < 0) {
    return null;
  }

  return Math.min(delayMs, maxRetryAfterMs);
}

export function retryDelayForFailure(
  failure: ProviderFailureClassification,
  retryAfterHeader: string | null,
  nowMs = Date.now(),
): number | null {
  if (!failure.retryable) {
    return null;
  }

  if (failure.status === "http_429") {
    return parseRetryAfterMs(retryAfterHeader, nowMs) ?? EONET_RESILIENCE_LIMITS.rateLimitRetryDelayMs;
  }

  return EONET_RESILIENCE_LIMITS.defaultRetryDelayMs;
}

export function shouldRetryProviderFailure({
  partitionRetryCount,
  runRetryCount,
  providerAttemptCount,
  remainingBudgetMs,
  retryDelayMs,
  maxProviderAttempts = EONET_RESILIENCE_LIMITS.maxProviderAttempts,
  maxRetriesPerPartition = EONET_RESILIENCE_LIMITS.maxRetriesPerPartition,
  maxRetriesPerRun = EONET_RESILIENCE_LIMITS.maxRetriesPerRun,
  requestTimeoutMs = EONET_RESILIENCE_LIMITS.requestTimeoutMs,
  retryBudgetGuardMs = EONET_RESILIENCE_LIMITS.retryBudgetGuardMs,
}: {
  partitionRetryCount: number;
  runRetryCount: number;
  providerAttemptCount: number;
  remainingBudgetMs: number;
  retryDelayMs: number;
  maxProviderAttempts?: number;
  maxRetriesPerPartition?: number;
  maxRetriesPerRun?: number;
  requestTimeoutMs?: number;
  retryBudgetGuardMs?: number;
}): boolean {
  if (partitionRetryCount >= maxRetriesPerPartition) {
    return false;
  }

  if (runRetryCount >= maxRetriesPerRun) {
    return false;
  }

  if (!canStartProviderAttempt(providerAttemptCount, maxProviderAttempts)) {
    return false;
  }

  return remainingBudgetMs >= retryDelayMs + requestTimeoutMs + retryBudgetGuardMs;
}

export function finalProviderOutcome({
  successfulProviderResponseCount,
  providerFailureSummaryCount,
  providerWarningCount,
}: {
  successfulProviderResponseCount: number;
  providerFailureSummaryCount: number;
  providerWarningCount: number;
}): FinalProviderOutcome {
  if (successfulProviderResponseCount <= 0) {
    return "failed";
  }

  if (providerFailureSummaryCount > 0 || providerWarningCount > 0) {
    return "partial";
  }

  return "succeeded";
}

export function createProviderFailureSummary({
  category,
  partition,
  status,
  attempts,
  outcome,
}: ProviderFailureSummary): ProviderFailureSummary {
  return {
    category: safeSummaryText(category),
    partition: safeSummaryText(partition),
    status: safeSummaryText(status),
    attempts: Math.max(0, Math.trunc(attempts)),
    outcome: safeSummaryText(outcome),
  };
}
