import { describe, it, expect } from "vitest";
import { MockSocialProvider } from "./mock";

describe("MockSocialProvider", () => {
  const provider = new MockSocialProvider("linkedin");

  it("is flagged as mock", () => {
    expect(provider.isMock).toBe(true);
    expect(provider.platform).toBe("linkedin");
  });

  it("authorize URL points back to the callback with code + state", () => {
    const redirectUri = "http://localhost:3000/auth/social/callback";
    const url = new URL(provider.getAuthorizeUrl({ state: "st-123", redirectUri }));
    expect(url.origin + url.pathname).toBe(redirectUri);
    expect(url.searchParams.get("state")).toBe("st-123");
    expect(url.searchParams.get("code")).toMatch(/^mock_linkedin_/);
  });

  it("exchangeCode returns tokens and a synthetic account", async () => {
    const result = await provider.exchangeCode();
    expect(result.accessToken).toMatch(/^mock-access-/);
    expect(result.refreshToken).toMatch(/^mock-refresh-/);
    expect(result.externalAccountId).toMatch(/^mock_linkedin_/);
    expect(new Date(result.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("publish returns a fake post id and url", async () => {
    const r = await provider.publish();
    expect(r.externalPostId).toMatch(/^mock_post_/);
    expect(r.externalUrl).toContain("example.com/mock/");
  });

  it("does not require page selection for linkedin", () => {
    expect(provider.requiresPageSelection).toBe(false);
  });
});

describe("MockSocialProvider — facebook pages", () => {
  const fb = new MockSocialProvider("facebook");

  it("requires page selection and lists fake pages with tokens", async () => {
    expect(fb.requiresPageSelection).toBe(true);
    const pages = await fb.listPages();
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0]!.id).toMatch(/^mock_page_facebook_/);
    expect(pages[0]!.accessToken).toMatch(/^mock-page-token-/);
  });
});
