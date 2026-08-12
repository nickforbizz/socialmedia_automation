import { describe, it, expect, vi, afterEach } from "vitest";
import {
  LinkedInProvider,
  escapeLinkedInText,
  buildCommentary,
  buildPostBody,
  authorUrn,
  postUrnToUrl,
} from "./linkedin";
import { SocialPublishError } from "@/lib/social/types";
import type { PlatformOAuthConfig } from "@/lib/social/config";

const config: PlatformOAuthConfig = {
  platform: "linkedin",
  authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  clientId: "cid",
  clientSecret: "sec",
  scopes: ["openid", "w_member_social"],
  userInfoUrl: "https://api.linkedin.com/v2/userinfo",
};

afterEach(() => vi.restoreAllMocks());

/** Route fetch calls by URL. Each route returns a Response (or throws if unmatched). */
function routeFetch(routes: Array<[RegExp, () => Response]>) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const match = routes.find(([re]) => re.test(url));
    if (!match) throw new Error(`Unexpected fetch: ${url}`);
    return match[1]();
  });
}

const okPost = () =>
  new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:9" } });

describe("LinkedIn helpers", () => {
  it("escapes reserved characters but preserves hashtags", () => {
    expect(escapeLinkedInText("Great trip (really)!")).toBe("Great trip \\(really\\)!");
    expect(escapeLinkedInText("a_b*c~")).toBe("a\\_b\\*c\\~");
    expect(escapeLinkedInText("#kilifi stays #kilifi")).toBe("#kilifi stays #kilifi");
  });

  it("builds commentary with caption, hashtags and link", () => {
    const c = buildCommentary("Sunset in Kilifi (drone)", ["#kilifi", "#drone"], "https://x.co/v");
    expect(c).toContain("Sunset in Kilifi \\(drone\\)");
    expect(c).toContain("#kilifi #drone");
    expect(c).toContain("https://x.co/v");
  });

  it("formats author and post URNs", () => {
    expect(authorUrn("abc123")).toBe("urn:li:person:abc123");
    expect(postUrnToUrl("urn:li:share:99")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:99/",
    );
  });

  it("attaches media content only when a URN is provided", () => {
    expect(buildPostBody("urn:li:person:a", "hi")).not.toHaveProperty("content");
    const withMedia = buildPostBody("urn:li:person:a", "hi", "urn:li:image:5");
    expect(withMedia.content).toEqual({ media: { id: "urn:li:image:5" } });
  });
});

describe("LinkedInProvider.publish — text", () => {
  const provider = new LinkedInProvider(config);
  const args = { accessToken: "tok", externalAccountId: "member-1", input: { caption: "Hello", hashtags: ["#hi"] } };

  it("creates a text post and returns the URN + url", async () => {
    const fetchMock = routeFetch([[/\/rest\/posts$/, okPost]]);
    const result = await provider.publish(args);
    expect(result.externalPostId).toBe("urn:li:share:9");
    expect(result.externalUrl).toContain("urn:li:share:9");
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.author).toBe("urn:li:person:member-1");
    expect(body.content).toBeUndefined();
  });

  it("throws non-retryable on 4xx and retryable on 5xx", async () => {
    routeFetch([[/\/rest\/posts$/, () => new Response("bad", { status: 401 })]]);
    await expect(provider.publish(args)).rejects.toMatchObject({ retryable: false });
    routeFetch([[/\/rest\/posts$/, () => new Response("oops", { status: 503 })]]);
    await expect(provider.publish(args)).rejects.toMatchObject({ retryable: true });
  });

  it("fails when no post id header is returned", async () => {
    routeFetch([[/\/rest\/posts$/, () => new Response(null, { status: 201 })]]);
    await expect(provider.publish(args)).rejects.toBeInstanceOf(SocialPublishError);
  });
});

describe("LinkedInProvider.publish — image", () => {
  const provider = new LinkedInProvider(config);

  it("uploads the image and attaches its URN to the post", async () => {
    const fetchMock = routeFetch([
      [/^https:\/\/storage\/signed/, () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })],
      [
        /\/rest\/images\?action=initializeUpload/,
        () =>
          new Response(
            JSON.stringify({ value: { uploadUrl: "https://upload/img", image: "urn:li:image:1" } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ],
      [/^https:\/\/upload\/img/, () => new Response(null, { status: 201 })],
      [/\/rest\/posts$/, okPost],
    ]);

    const result = await provider.publish({
      accessToken: "tok",
      externalAccountId: "m1",
      input: { caption: "Pic", hashtags: [], mediaUrl: "https://storage/signed/img.jpg", mediaKind: "image" },
    });

    expect(result.externalPostId).toBe("urn:li:share:9");
    const postCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/rest/posts"))!;
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body.content).toEqual({ media: { id: "urn:li:image:1" } });
  });
});

describe("LinkedInProvider.publish — video", () => {
  const provider = new LinkedInProvider(config);

  it("uploads parts, finalizes with ETags, and attaches the video URN", async () => {
    const fetchMock = routeFetch([
      [/^https:\/\/storage\/signed/, () => new Response(new Uint8Array(10), { status: 200 })],
      [
        /\/rest\/videos\?action=initializeUpload/,
        () =>
          new Response(
            JSON.stringify({
              value: {
                video: "urn:li:video:7",
                uploadToken: "utok",
                uploadInstructions: [{ uploadUrl: "https://upload/v0", firstByte: 0, lastByte: 9 }],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ],
      [/^https:\/\/upload\/v0/, () => new Response(null, { status: 200, headers: { etag: "et0" } })],
      [/\/rest\/videos\?action=finalizeUpload/, () => new Response(null, { status: 200 })],
      [/\/rest\/posts$/, okPost],
    ]);

    const result = await provider.publish({
      accessToken: "tok",
      externalAccountId: "m1",
      input: { caption: "Clip", hashtags: [], mediaUrl: "https://storage/signed/v.mp4", mediaKind: "video" },
    });

    expect(result.externalPostId).toBe("urn:li:share:9");
    const finalizeCall = fetchMock.mock.calls.find(([u]) => String(u).includes("finalizeUpload"))!;
    const finalizeBody = JSON.parse((finalizeCall[1] as RequestInit).body as string);
    expect(finalizeBody.finalizeUploadRequest.uploadedPartIds).toEqual(["et0"]);
    const postCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/rest/posts"))!;
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body.content).toEqual({ media: { id: "urn:li:video:7" } });
  });
});
