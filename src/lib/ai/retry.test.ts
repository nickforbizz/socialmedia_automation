import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry";
import { RateLimiter } from "./ratelimit";

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, { retries: 3, baseDelayMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("recovered");
    await expect(withRetry(fn, { retries: 3, baseDelayMs: 1 })).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always"));
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow("always");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry errors marked non-retryable", async () => {
    const err = Object.assign(new Error("404 model not found"), { retryable: false });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retries: 3, baseDelayMs: 1 })).rejects.toThrow("404");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("RateLimiter", () => {
  it("allows up to capacity immediately", async () => {
    const rl = new RateLimiter(3, 1);
    const start = Date.now();
    await rl.acquire();
    await rl.acquire();
    await rl.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });
});
