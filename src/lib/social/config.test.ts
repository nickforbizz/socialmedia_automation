import { describe, it, expect, afterEach, vi } from "vitest";
import { getPlatformOAuthConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("getPlatformOAuthConfig", () => {
  it("returns null when credentials are absent", () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    expect(getPlatformOAuthConfig("linkedin")).toBeNull();
  });

  it("returns null when only one of id/secret is present", () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "abc");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    expect(getPlatformOAuthConfig("linkedin")).toBeNull();
  });

  it("builds a full config when both are present", () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "client-123");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "secret-xyz");
    const cfg = getPlatformOAuthConfig("linkedin");
    expect(cfg).not.toBeNull();
    expect(cfg?.clientId).toBe("client-123");
    expect(cfg?.clientSecret).toBe("secret-xyz");
    expect(cfg?.authorizeUrl).toContain("linkedin.com");
    expect(cfg?.scopes).toContain("w_member_social");
    expect(cfg?.userInfoUrl).toContain("userinfo");
  });
});
