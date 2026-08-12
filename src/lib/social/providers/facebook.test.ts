import { describe, it, expect, vi, afterEach } from "vitest";
import { FacebookProvider } from "./facebook";
import { SocialPublishError } from "@/lib/social/types";
import type { PlatformOAuthConfig } from "@/lib/social/config";

const config: PlatformOAuthConfig = {
  platform: "facebook",
  authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
  clientId: "cid",
  clientSecret: "sec",
  scopes: ["pages_show_list", "pages_manage_posts"],
  userInfoUrl: "https://graph.facebook.com/v21.0/me",
};

afterEach(() => vi.restoreAllMocks());

function routeFetch(routes: Array<[RegExp, () => Response]>) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = String(typeof input === "object" && "url" in input ? input.url : input);
    const match = routes.find(([re]) => re.test(url));
    if (!match) throw new Error(`Unexpected fetch: ${url} ${JSON.stringify(init)}`);
    return match[1]();
  });
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

describe("FacebookProvider", () => {
  const provider = new FacebookProvider(config);

  it("requires page selection", () => {
    expect(provider.requiresPageSelection).toBe(true);
    expect(provider.isMock).toBe(false);
  });

  it("exchangeCode returns a long-lived user token and identity", async () => {
    routeFetch([
      [/oauth\/access_token\?.*grant_type=fb_exchange_token/, () => json({ access_token: "LONG", expires_in: 5184000 })],
      [/oauth\/access_token/, () => json({ access_token: "SHORT" })],
      [/\/me\?/, () => json({ id: "user-1", name: "Nick" })],
    ]);
    const result = await provider.exchangeCode({ code: "c", redirectUri: "http://localhost/cb" });
    expect(result.accessToken).toBe("LONG");
    expect(result.externalAccountId).toBe("user-1");
    expect(result.displayName).toBe("Nick");
    expect(new Date(result.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("listPages maps the user's pages with their tokens", async () => {
    routeFetch([
      [
        /\/me\/accounts/,
        () =>
          json({
            data: [
              { id: "p1", name: "Kilifi Travel", category: "Travel", access_token: "pt1" },
              { id: "p2", name: "Mombasa Eats", category: "Food", access_token: "pt2" },
            ],
          }),
      ],
    ]);
    const pages = await provider.listPages("USER");
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ id: "p1", name: "Kilifi Travel", accessToken: "pt1" });
  });

  it("publishes text to the page feed", async () => {
    const fetchMock = routeFetch([[/\/p1\/feed/, () => json({ id: "p1_123" })]]);
    const result = await provider.publish({
      accessToken: "pt1",
      externalAccountId: "p1",
      input: { caption: "Hello", hashtags: ["#hi"] },
    });
    expect(result.externalPostId).toBe("p1_123");
    expect(result.externalUrl).toContain("p1_123");
    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(body.get("message")).toContain("Hello");
    expect(body.get("access_token")).toBe("pt1");
  });

  it("publishes an image via /photos with url", async () => {
    const fetchMock = routeFetch([[/\/p1\/photos/, () => json({ id: "img", post_id: "p1_999" })]]);
    const result = await provider.publish({
      accessToken: "pt1",
      externalAccountId: "p1",
      input: { caption: "Pic", hashtags: [], mediaUrl: "https://s/img.jpg", mediaKind: "image" },
    });
    expect(result.externalPostId).toBe("p1_999");
    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(body.get("url")).toBe("https://s/img.jpg");
  });

  it("throws a non-retryable error on 4xx", async () => {
    routeFetch([[/\/p1\/feed/, () => json({ error: "bad" }, 400)]]);
    await expect(
      provider.publish({ accessToken: "pt1", externalAccountId: "p1", input: { caption: "x", hashtags: [] } }),
    ).rejects.toMatchObject({ name: "SocialPublishError", retryable: false });
  });
});

describe("FacebookProvider publish id fallback", () => {
  it("fails when no id is returned", async () => {
    const provider = new FacebookProvider(config);
    vi.spyOn(global, "fetch").mockResolvedValue(json({}));
    await expect(
      provider.publish({ accessToken: "t", externalAccountId: "p1", input: { caption: "x", hashtags: [] } }),
    ).rejects.toBeInstanceOf(SocialPublishError);
    vi.restoreAllMocks();
  });
});
