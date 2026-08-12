import { describe, it, expect } from "vitest";
import { GenericOAuth2Provider } from "./oauth2";
import { SocialNotConfiguredError } from "@/lib/social/types";
import type { PlatformOAuthConfig } from "@/lib/social/config";

const config: PlatformOAuthConfig = {
  platform: "linkedin",
  authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  clientId: "cid",
  clientSecret: "csecret",
  scopes: ["openid", "w_member_social"],
  userInfoUrl: "https://api.linkedin.com/v2/userinfo",
};

describe("GenericOAuth2Provider", () => {
  const provider = new GenericOAuth2Provider(config);

  it("builds a valid authorize URL with all required params", () => {
    const url = new URL(
      provider.getAuthorizeUrl({ state: "st", redirectUri: "http://localhost:3000/auth/social/callback" }),
    );
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("scope")).toBe("openid w_member_social");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/auth/social/callback",
    );
  });

  it("is not a mock provider", () => {
    expect(provider.isMock).toBe(false);
    expect(provider.platform).toBe("linkedin");
  });

  it("publish throws a not-configured seam error for the generic provider", async () => {
    await expect(
      provider.publish({
        accessToken: "t",
        externalAccountId: "a",
        input: { caption: "hi", hashtags: [] },
      }),
    ).rejects.toBeInstanceOf(SocialNotConfiguredError);
  });
});
