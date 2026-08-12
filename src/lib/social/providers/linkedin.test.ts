import { describe, it, expect, vi, afterEach } from "vitest";
import {
  LinkedInProvider,
  escapeLinkedInText,
  buildCommentary,
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

describe("LinkedIn commentary helpers", () => {
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
});

describe("LinkedInProvider.publish", () => {
  const provider = new LinkedInProvider(config);
  const args = {
    accessToken: "tok",
    externalAccountId: "member-1",
    input: { caption: "Hello", hashtags: ["#hi"] },
  };

  it("posts to the Posts API and returns the created URN + url", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { "x-restli-id": "urn:li:share:123" },
      }),
    );

    const result = await provider.publish(args);
    expect(result.externalPostId).toBe("urn:li:share:123");
    expect(result.externalUrl).toContain("urn:li:share:123");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.linkedin.com/rest/posts");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["LinkedIn-Version"]).toBeDefined();
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.author).toBe("urn:li:person:member-1");
    expect(sentBody.lifecycleState).toBe("PUBLISHED");
  });

  it("throws a non-retryable error on 4xx", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("bad token", { status: 401 }),
    );
    await expect(provider.publish(args)).rejects.toMatchObject({
      name: "SocialPublishError",
      retryable: false,
    });
  });

  it("marks 5xx as retryable", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("oops", { status: 503 }));
    await expect(provider.publish(args)).rejects.toMatchObject({ retryable: true });
  });

  it("fails when no post id header is returned", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
    await expect(provider.publish(args)).rejects.toBeInstanceOf(SocialPublishError);
  });
});
