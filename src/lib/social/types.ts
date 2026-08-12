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

export interface SocialProvider {
  readonly platform: SocialPlatform;
  readonly isMock: boolean;
  /** OAuth2 authorize URL to redirect the user to. */
  getAuthorizeUrl(params: { state: string; redirectUri: string }): string;
  /** Exchange the callback code for tokens + account identity. */
  exchangeCode(params: { code: string; redirectUri: string }): Promise<ConnectResult>;
  /** Refresh an expired access token. */
  refresh(refreshToken: string): Promise<TokenSet>;
  /** Publish a post to the account. */
  publish(params: {
    accessToken: string;
    externalAccountId: string;
    input: PublishInput;
  }): Promise<PublishResult>;
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
