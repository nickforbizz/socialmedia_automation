// @vitest-environment node
// registry uses getServerEnv(), which refuses to run when `window` exists.
import { describe, it, expect, vi, afterEach } from "vitest";
import { getSocialProvider, isPlatformConfigured } from "./registry";

// getServerEnv requires the service-role key; provide it for every case.
function baseEnv() {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
}

afterEach(() => vi.unstubAllEnvs());

describe("getSocialProvider", () => {
  it("returns the mock provider when no creds and mock is allowed", () => {
    baseEnv();
    vi.stubEnv("SOCIAL_ALLOW_MOCK", "true");
    vi.stubEnv("LINKEDIN_CLIENT_ID", "");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    const provider = getSocialProvider("linkedin");
    expect(provider.isMock).toBe(true);
  });

  it("returns the real LinkedInProvider when credentials are present", () => {
    baseEnv();
    vi.stubEnv("LINKEDIN_CLIENT_ID", "id");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "sec");
    const provider = getSocialProvider("linkedin");
    expect(provider.isMock).toBe(false);
    expect(provider.constructor.name).toBe("LinkedInProvider");
  });

  it("throws when a platform is unconfigured and mock is disabled", () => {
    baseEnv();
    vi.stubEnv("SOCIAL_ALLOW_MOCK", "false");
    vi.stubEnv("FACEBOOK_CLIENT_ID", "");
    vi.stubEnv("FACEBOOK_CLIENT_SECRET", "");
    expect(() => getSocialProvider("facebook")).toThrow();
    expect(isPlatformConfigured("facebook")).toBe(false);
  });
});
