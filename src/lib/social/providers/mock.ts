import { randomUUID } from "node:crypto";
import type { SocialPlatform } from "@/lib/supabase/database.types";
import type { ConnectResult, PublishResult, SocialProvider, TokenSet } from "@/lib/social/types";

/**
 * Mock provider — lets the entire connect → schedule → publish flow run locally
 * with no real app credentials. "Connecting" issues fake tokens and a synthetic
 * account; "publishing" returns a fake post id/URL. Gated by SOCIAL_ALLOW_MOCK.
 */
export class MockSocialProvider implements SocialProvider {
  readonly isMock = true;
  constructor(readonly platform: SocialPlatform) {}

  getAuthorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    // Route straight back to the callback with a mock code, so the normal
    // callback handler processes it like any other provider.
    const url = new URL(redirectUri);
    url.searchParams.set("code", `mock_${this.platform}_${randomUUID()}`);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(): Promise<ConnectResult> {
    const id = randomUUID().slice(0, 8);
    return {
      accessToken: `mock-access-${randomUUID()}`,
      refreshToken: `mock-refresh-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      scopes: ["mock"],
      externalAccountId: `mock_${this.platform}_${id}`,
      displayName: `Mock ${this.platform} account`,
      username: `mock_${this.platform}_${id}`,
    };
  }

  async refresh(): Promise<TokenSet> {
    return {
      accessToken: `mock-access-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    };
  }

  async publish(): Promise<PublishResult> {
    const id = randomUUID();
    return { externalPostId: `mock_post_${id}`, externalUrl: `https://example.com/mock/${id}` };
  }
}
