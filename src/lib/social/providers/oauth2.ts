import {
  SocialNotConfiguredError,
  type ConnectResult,
  type PublishInput,
  type PublishResult,
  type SocialProvider,
  type TokenSet,
} from "@/lib/social/types";
import type { PlatformOAuthConfig } from "@/lib/social/config";

/**
 * Generic OAuth2 (authorization-code) provider. Handles the parts that are
 * standard across platforms — building the authorize URL, exchanging the code,
 * and refreshing tokens. The platform-specific parts (deriving account identity
 * shape and the publishing API) are seams: implement a concrete provider per
 * platform and register it. Until then these throw a clear, actionable error.
 */
export class GenericOAuth2Provider implements SocialProvider {
  readonly isMock = false;
  constructor(protected readonly config: PlatformOAuthConfig) {}

  get platform() {
    return this.config.platform;
  }

  getAuthorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL(this.config.authorizeUrl);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", this.config.scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  private async tokenRequest(body: Record<string, string>): Promise<TokenSet> {
    const res = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new SocialNotConfiguredError(this.platform, `Token endpoint failed (${res.status}): ${detail}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : undefined,
      scopes: json.scope ? json.scope.split(/[ ,]+/) : this.config.scopes,
    };
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }): Promise<ConnectResult> {
    const tokens = await this.tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const account = await this.fetchAccountIdentity(tokens.accessToken);
    return { ...tokens, ...account };
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    return this.tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
  }

  /** Best-effort identity via the platform userinfo endpoint (common id fields). */
  private async fetchAccountIdentity(accessToken: string): Promise<{
    externalAccountId: string;
    displayName?: string;
    username?: string;
  }> {
    if (!this.config.userInfoUrl) {
      throw new SocialNotConfiguredError(
        this.platform,
        "No userinfo endpoint configured; implement a concrete provider to map account identity.",
      );
    }
    const res = await fetch(this.config.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new SocialNotConfiguredError(this.platform, `userinfo failed (${res.status}).`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const id = (data.id ?? data.sub ?? data.data ?? "") as string;
    if (!id) {
      throw new SocialNotConfiguredError(this.platform, "Could not derive account id from userinfo.");
    }
    return {
      externalAccountId: String(id),
      displayName: (data.name ?? data.localizedFirstName) as string | undefined,
      username: (data.username ?? data.screen_name) as string | undefined,
    };
  }

  async publish(_params: {
    accessToken: string;
    externalAccountId: string;
    input: PublishInput;
  }): Promise<PublishResult> {
    // Publishing APIs differ per platform (endpoints, media upload sessions,
    // container/publish steps). Implement a concrete provider to enable it.
    throw new SocialNotConfiguredError(
      this.platform,
      "Publishing for this platform is not implemented yet (real-provider seam).",
    );
  }
}
