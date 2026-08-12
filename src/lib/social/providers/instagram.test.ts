import { describe, it, expect, vi, afterEach } from "vitest";
import { InstagramProvider } from "./instagram";
import type { PlatformOAuthConfig } from "@/lib/social/config";

const config: PlatformOAuthConfig = {
  platform: "instagram",
  authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
  clientId: "cid",
  clientSecret: "sec",
  scopes: ["instagram_basic", "instagram_content_publish"],
  userInfoUrl: "https://graph.facebook.com/v21.0/me",
};

afterEach(() => vi.restoreAllMocks());

function routeFetch(routes: Array<[RegExp, () => Response]>) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(typeof input === "object" && "url" in input ? input.url : input);
    const match = routes.find(([re]) => re.test(url));
    if (!match) throw new Error(`Unexpected fetch: ${url}`);
    return match[1]();
  });
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

describe("InstagramProvider", () => {
  const provider = new InstagramProvider(config);

  it("requires page selection and reuses Facebook OAuth", () => {
    expect(provider.requiresPageSelection).toBe(true);
  });

  it("lists only Pages that have a linked IG account, keyed by IG id", async () => {
    routeFetch([
      [
        /\/me\/accounts/,
        () =>
          json({
            data: [
              { id: "pg1", name: "Kilifi", access_token: "pt1", instagram_business_account: { id: "ig1", username: "kilifi" } },
              { id: "pg2", name: "No IG", access_token: "pt2" }, // no linked IG → excluded
            ],
          }),
      ],
    ]);
    const pages = await provider.listPages("USER");
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ id: "ig1", name: "@kilifi", accessToken: "pt1" });
  });

  it("rejects a text-only post (Instagram requires media)", async () => {
    await expect(
      provider.publish({ accessToken: "pt1", externalAccountId: "ig1", input: { caption: "hi", hashtags: [] } }),
    ).rejects.toMatchObject({ name: "SocialPublishError", retryable: false });
  });

  it("publishes an image via container + media_publish", async () => {
    const fetchMock = routeFetch([
      [/\/ig1\/media$/, () => json({ id: "container-1" })],
      [/\/ig1\/media_publish$/, () => json({ id: "media-1" })],
      [/\/media-1\?/, () => json({ permalink: "https://www.instagram.com/p/abc/" })],
    ]);
    const result = await provider.publish({
      accessToken: "pt1",
      externalAccountId: "ig1",
      input: { caption: "Pic", hashtags: ["#kilifi"], mediaUrl: "https://s/i.jpg", mediaKind: "image" },
    });
    expect(result.externalPostId).toBe("media-1");
    expect(result.externalUrl).toContain("instagram.com/p/abc");
    // container call carried image_url + caption
    const containerBody = (fetchMock.mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(containerBody.get("image_url")).toBe("https://s/i.jpg");
    expect(containerBody.get("caption")).toContain("Pic");
  });

  it("waits for a video container to finish before publishing", async () => {
    let statusChecks = 0;
    const fetchMock = routeFetch([
      [/\/ig1\/media$/, () => json({ id: "vid-container" })],
      [
        /\/vid-container\?/,
        () => {
          statusChecks++;
          return json({ status_code: statusChecks >= 2 ? "FINISHED" : "IN_PROGRESS" });
        },
      ],
      [/\/ig1\/media_publish$/, () => json({ id: "media-vid" })],
      [/\/media-vid\?/, () => json({ permalink: "https://www.instagram.com/reel/x/" })],
    ]);
    const result = await provider.publish({
      accessToken: "pt1",
      externalAccountId: "ig1",
      input: { caption: "Clip", hashtags: [], mediaUrl: "https://s/v.mp4", mediaKind: "video" },
    });
    expect(result.externalPostId).toBe("media-vid");
    expect(statusChecks).toBeGreaterThanOrEqual(2);
    const containerBody = (fetchMock.mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(containerBody.get("media_type")).toBe("REELS");
  });
});
