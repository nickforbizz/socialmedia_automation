/**
 * In-memory token-bucket limiter. Guards against hammering a provider from a
 * single process. For multi-instance deployments (Phase 3+) swap the store for
 * Redis/Postgres behind this same interface — call sites do not change.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.lastRefill = now;
  }

  /** Resolves once a token is available. */
  async acquire(): Promise<void> {
    this.refill();
    while (this.tokens < 1) {
      const waitMs = Math.ceil((1 - this.tokens) / this.refillPerSec) * 1000;
      await new Promise((r) => setTimeout(r, Math.max(10, waitMs)));
      this.refill();
    }
    this.tokens -= 1;
  }
}
