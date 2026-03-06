/**
 * Retry utility for transient Supabase / network failures.
 *
 * Retryable conditions:
 *   - HTTP 429  (rate-limited)
 *   - HTTP 503  (Supabase overloaded / cold-start)
 *   - Network errors ("Failed to fetch", "connection reset", "ECONNRESET")
 *
 * Never retried:
 *   - 4xx client errors (bad input, auth, not found)
 *   - PostgreSQL constraint violations (23xxx)
 *   - Any deliberate business-logic error
 *
 * Usage — Supabase { data, error } pattern:
 *   const { data, error } = await withSupabaseRetry(() =>
 *     supabase.rpc("create_appointment_safe", { ... })
 *   );
 *
 * Usage — plain async function (throws on error):
 *   const result = await withRetry(() => fetch("/api/..."));
 */

const RETRYABLE_STATUS = new Set([429, 503]);
const RETRYABLE_MSG_PATTERNS = [
  /failed to fetch/i,
  /network/i,
  /econnreset/i,
  /connection.*reset/i,
  /connection.*refused/i,
  /socket hang up/i,
  /timeout/i,
];

function isRetryable(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    // Supabase error object has a `status` field
    if (typeof e.status === "number" && RETRYABLE_STATUS.has(e.status)) return true;
    // HTTP Response object
    if (e instanceof Response && RETRYABLE_STATUS.has((e as Response).status)) return true;
    // PostgreSQL constraint codes (23xxx) — never retry
    if (typeof e.code === "string" && e.code.startsWith("23")) return false;
    // Match message patterns
    const msg = typeof e.message === "string" ? e.message : "";
    if (RETRYABLE_MSG_PATTERNS.some((p) => p.test(msg))) return true;
  }
  if (typeof err === "string") {
    return RETRYABLE_MSG_PATTERNS.some((p) => p.test(err));
  }
  return false;
}

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

/** Exponential backoff with full jitter: base * 2^attempt * random(0.5–1.5) */
function backoff(attempt: number, baseMs = 200): number {
  const exp = baseMs * Math.pow(2, attempt);
  return exp * (0.5 + Math.random());
}

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string; code?: string; status?: number; details?: string } | null;
}

/**
 * Wraps a Supabase query that returns `{ data, error }`.
 * Retries up to `maxAttempts` times on transient errors.
 */
export async function withSupabaseRetry<T>(
  fn: () => PromiseLike<SupabaseResult<T>>,
  maxAttempts = 3
): Promise<SupabaseResult<T>> {
  let lastResult: SupabaseResult<T> = { data: null, error: null };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastResult = await fn();
    if (!lastResult.error) return lastResult;
    if (!isRetryable(lastResult.error)) return lastResult;
    if (attempt < maxAttempts - 1) {
      await delay(backoff(attempt));
    }
  }

  return lastResult;
}

/**
 * Wraps any async function that throws on failure.
 * Retries up to `maxAttempts` times on transient errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) throw err;
      if (attempt < maxAttempts - 1) {
        await delay(backoff(attempt));
      }
    }
  }

  throw lastError;
}
