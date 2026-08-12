import { logger } from "@/lib/logger";

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
}

/**
 * Exponential backoff with full jitter. Wraps every outbound AI call so a
 * transient provider hiccup does not surface as a user-facing failure.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 300, maxDelayMs = 5000, label = "ai-call" } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't waste attempts on errors that cannot succeed on retry (e.g. 4xx).
      if (err && typeof err === "object" && (err as { retryable?: boolean }).retryable === false) {
        throw err;
      }
      if (attempt === retries) break;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delay = Math.floor(Math.random() * backoff);
      logger.warn("ai retry", { label, attempt: attempt + 1, delay });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
