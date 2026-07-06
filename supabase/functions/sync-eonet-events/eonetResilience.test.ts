import {
  canStartProviderAttempt,
  classifyHttpStatus,
  classifyNetworkFailure,
  createProviderFailureSummary,
  finalProviderOutcome,
  isRetryableHttpStatus,
  parseRetryAfterMs,
  retryDelayForFailure,
  shouldRetryProviderFailure,
} from "./eonetResilience.ts";

function assert(condition: boolean, message = "Assertion failed"): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("retryable HTTP status allowlist includes 429, 500, 502, 503, and 504", () => {
  for (const status of [429, 500, 502, 503, 504]) {
    assertEquals(isRetryableHttpStatus(status), true, `${status} should be retryable`);
    assertEquals(classifyHttpStatus(status).retryable, true, `${status} classification should be retryable`);
  }
});

Deno.test("non-retryable client errors include 400, 403, and 404", () => {
  for (const status of [400, 403, 404]) {
    assertEquals(isRetryableHttpStatus(status), false, `${status} should not be retryable`);
    assertEquals(classifyHttpStatus(status).retryable, false, `${status} classification should not be retryable`);
  }
});

Deno.test("failed request attempts consume the shared 20-attempt allowance", () => {
  assertEquals(canStartProviderAttempt(19), true);
  assertEquals(canStartProviderAttempt(20), false);
});

Deno.test("attempt 21 is blocked", () => {
  assertEquals(canStartProviderAttempt(20, 20), false);
});

Deno.test("a partition cannot retry more than once", () => {
  assertEquals(
    shouldRetryProviderFailure({
      partitionRetryCount: 1,
      runRetryCount: 0,
      providerAttemptCount: 1,
      remainingBudgetMs: 20_000,
      retryDelayMs: 1_000,
    }),
    false,
  );
});

Deno.test("a run cannot exceed four total retries", () => {
  assertEquals(
    shouldRetryProviderFailure({
      partitionRetryCount: 0,
      runRetryCount: 4,
      providerAttemptCount: 4,
      remainingBudgetMs: 20_000,
      retryDelayMs: 1_000,
    }),
    false,
  );
});

Deno.test("retry is skipped if remaining budget cannot cover delay, timeout, and guard", () => {
  assertEquals(
    shouldRetryProviderFailure({
      partitionRetryCount: 0,
      runRetryCount: 0,
      providerAttemptCount: 1,
      remainingBudgetMs: 16_499,
      retryDelayMs: 1_000,
    }),
    false,
  );
});

Deno.test("Retry-After seconds parsing works", () => {
  assertEquals(parseRetryAfterMs("3", 0), 3_000);
});

Deno.test("Retry-After HTTP-date parsing works", () => {
  const nowMs = Date.parse("Mon, 06 Jul 2026 00:00:00 GMT");
  assertEquals(parseRetryAfterMs("Mon, 06 Jul 2026 00:00:05 GMT", nowMs), 5_000);
});

Deno.test("invalid and excessive Retry-After values are safely rejected or clamped", () => {
  assertEquals(parseRetryAfterMs("not a date", 0), null);
  assertEquals(parseRetryAfterMs("-1", 0), null);
  assertEquals(parseRetryAfterMs("999", 0), 10_000);
});

Deno.test("retry delay defaults are deterministic for rate limit, server, network, and timeout failures", () => {
  assertEquals(retryDelayForFailure(classifyHttpStatus(429), null, 0), 2_000);
  assertEquals(retryDelayForFailure(classifyHttpStatus(503), null, 0), 1_000);
  assertEquals(retryDelayForFailure(classifyNetworkFailure("network"), null, 0), 1_000);
  assertEquals(retryDelayForFailure(classifyNetworkFailure("timeout"), null, 0), 1_000);
});

Deno.test("final outcome becomes succeeded, partial, or failed from provider results", () => {
  assertEquals(
    finalProviderOutcome({
      successfulProviderResponseCount: 1,
      providerFailureSummaryCount: 0,
      providerWarningCount: 0,
    }),
    "succeeded",
  );
  assertEquals(
    finalProviderOutcome({
      successfulProviderResponseCount: 1,
      providerFailureSummaryCount: 1,
      providerWarningCount: 0,
    }),
    "partial",
  );
  assertEquals(
    finalProviderOutcome({
      successfulProviderResponseCount: 0,
      providerFailureSummaryCount: 1,
      providerWarningCount: 0,
    }),
    "failed",
  );
});

Deno.test("safe failure summaries contain only allowed fields and no raw diagnostics", () => {
  const summary = createProviderFailureSummary({
    category: "wildfires",
    partition: "closed_partition https://example.invalid/?token=secret",
    status: "http_503\nstack trace",
    attempts: 2.8,
    outcome: "retry_exhausted",
  });

  assertEquals(Object.keys(summary).sort().join(","), "attempts,category,outcome,partition,status");
  assertEquals(summary.category, "wildfires");
  assertEquals(summary.attempts, 2);
  assert(!summary.partition.includes("/"), "partition should not contain raw URL delimiters");
  assert(!summary.partition.includes("?"), "partition should not contain query delimiters");
  assert(!summary.status.includes("\n"), "status should not contain raw diagnostics");
});
