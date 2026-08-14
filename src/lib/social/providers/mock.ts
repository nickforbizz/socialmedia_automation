import { randomUUID } from "node:crypto";
import type { SocialPlatform } from "@/lib/supabase/database.types";
import type {
  AccountMetrics,
  CompetitorObservedPost,
  ConnectResult,
  PageOption,
  PostMetrics,
  PublishResult,
  SocialProvider,
  TokenSet,
} from "@/lib/social/types";
import { syntheticAccountMetrics, syntheticPostMetrics } from "@/lib/social/mock-metrics";
import { syntheticCompetitorPosts } from "@/lib/social/mock-competitors";

function ageHoursSince(iso?: string | null): number {
  if (!iso) return 1;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

/**
 * Mock provider — lets the entire connect → schedule → publish flow run locally
 * with no real app credentials. "Connecting" issues fake tokens and a synthetic
 * account; "publishing" returns a fake post id/URL. Gated by SOCIAL_ALLOW_MOCK.
 */
export class MockSocialProvider implements SocialProvider {
  readonly isMock = true;
  constructor(readonly platform: SocialPlatform) {}

  /** Facebook/Instagram present multiple pages to choose from. */
  get requiresPageSelection(): boolean {
    return this.platform === "facebook" || this.platform === "instagram";
  }

  async listPages(): Promise<PageOption[]> {
    const names = ["Kilifi Travel", "Mombasa Eats", "Watamu Dives"];
    return names.map((name, i) => ({
      id: `mock_page_${this.platform}_${i}`,
      name,
      category: "Travel & Tourism",
      accessToken: `mock-page-token-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    }));
  }

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

  async fetchPostMetrics(ctx: {
    externalPostId: string;
    publishedAt?: string | null;
    mediaKind?: "video" | "image" | "audio" | null;
  }): Promise<PostMetrics> {
    return syntheticPostMetrics(ctx.externalPostId, ageHoursSince(ctx.publishedAt), ctx.mediaKind);
  }

  async fetchAccountMetrics(ctx: { externalAccountId: string }): Promise<AccountMetrics> {
    return syntheticAccountMetrics(ctx.externalAccountId, 24);
  }

  async fetchCompetitorPosts(ctx: { handle: string; limit?: number }): Promise<CompetitorObservedPost[]> {
    return syntheticCompetitorPosts(ctx.handle, ctx.limit ?? 24);
  }
}

