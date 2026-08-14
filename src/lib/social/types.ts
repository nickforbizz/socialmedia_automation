import type { SocialPlatform } from "@/lib/supabase/database.types";

/**
 * Provider-agnostic social publishing contracts. Application code depends only
 * on `SocialProvider`; concrete platforms (or the mock) are resolved by the
 * registry. Adding a real platform means implementing this interface.
 */

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** ISO timestamp when the access token expires, if known. */
  expiresAt?: string;
  scopes?: string[];
}

export interface AccountInfo {
  externalAccountId: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}

export type ConnectResult = TokenSet & AccountInfo;

/** A selectable publishing target returned by multi-page platforms (FB/IG). */
export interface PageOption {
  id: string;
  name: string;
  category?: string;
  /** Page-scoped access token (kept server-side, encrypted before storage). */
  accessToken: string;
  expiresAt?: string;
}

export interface PublishInput {
  caption: string;
  hashtags: string[];
  link?: string;
  /** Public URL of the media to attach (from Supabase Storage), if any. */
  mediaUrl?: string;
  mediaKind?: "video" | "image" | "audio";
}

export interface PublishResult {
  externalPostId: string;
  externalUrl?: string;
}

export interface PostMetrics {
  impressions: number;
  reach: number;
  views: number;
  watchTimeSec: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

export interface AccountMetrics {
  followers: number;
  following: number;
  postsCount: number;
}

/** A public post observed on a competitor's account (for inspiration/analysis). */
export interface CompetitorObservedPost {
  externalPostId: string;
  postedAt: string;
  caption: string;
  hashtags: string[];
  topics: string[];
  mediaType: "video" | "image" | "carousel" | "text";
  videoLengthSec?: number;
  likes: number;
  comments: number;
  shares: number;
  permalink?: string;
}

export interface SocialProvider {
  readonly platform: SocialPlatform;
  readonly isMock: boolean;
  /**
   * When true, one OAuth yields multiple publishing targets (e.g. Facebook
   * Pages) and the connect flow must let the user pick. Such providers also
   * implement `listPages`, and `exchangeCode` returns the *user* token used to
   * enumerate pages rather than a final account.
   */
  readonly requiresPageSelection?: boolean;
  /** OAuth2 authorize URL to redirect the user to. */
  getAuthorizeUrl(params: { state: string; redirectUri: string }): string;
  /** Exchange the callback code for tokens + account identity. */
  exchangeCode(params: { code: string; redirectUri: string }): Promise<ConnectResult>;
  /** Refresh an expired access token. */
  refresh(refreshToken: string): Promise<TokenSet>;
  /** List selectable pages/targets for the connecting user (FB/IG). */
  listPages?(userAccessToken: string): Promise<PageOption[]>;
  /** Publish a post to the account. */
  publish(params: {
    accessToken: string;
    externalAccountId: string;
    input: PublishInput;
  }): Promise<PublishResult>;
  /**
   * Fetch current metrics for a published post (platform insights API).
   * Optional: providers that don't implement it are simply skipped by the
   * collector. Real platforms are a seam; the mock provider synthesizes data.
   */
  fetchPostMetrics?(ctx: {
    accessToken: string;
    externalPostId: string;
    publishedAt?: string | null;
    mediaKind?: "video" | "image" | "audio" | null;
  }): Promise<PostMetrics | null>;
  /** Fetch current account/follower metrics. Optional (see fetchPostMetrics). */
  fetchAccountMetrics?(ctx: {
    accessToken: string;
    externalAccountId: string;
  }): Promise<AccountMetrics | null>;
  /**
   * Fetch recent public posts for a competitor handle (for inspiration and
   * gap analysis). Optional: real platforms are a seam (IG Business Discovery,
   * YouTube Data API, etc.); the mock synthesizes realistic data.
   */
  fetchCompetitorPosts?(ctx: {
    handle: string;
    accessToken?: string;
    limit?: number;
  }): Promise<CompetitorObservedPost[]>;
}

export class SocialNotConfiguredError extends Error {
  constructor(platform: string, detail?: string) {
    super(
      `Social platform "${platform}" is not configured. ${detail ?? ""}`.trim() +
        ` Add ${platform.toUpperCase()}_CLIENT_ID/${platform.toUpperCase()}_CLIENT_SECRET, ` +
        `or enable the mock provider (SOCIAL_ALLOW_MOCK=true) for local testing.`,
    );
    this.name = "SocialNotConfiguredError";
  }
}

export class SocialPublishError extends Error {
  constructor(
    public readonly platform: string,
    message: string,
    public readonly retryable = true,
  ) {
    super(message);
    this.name = "SocialPublishError";
  }
}
