import { GenericOAuth2Provider } from "./oauth2";
import {
  SocialNotConfiguredError,
  SocialPublishError,
  type ConnectResult,
  type PageOption,
  type PublishInput,
  type PublishResult,
  type TokenSet,
} from "@/lib/social/types";

/**
 * Facebook provider — connects a *Page* (chosen by the user) and publishes to
 * its feed. One OAuth returns the user's token; `listPages` enumerates the
 * Pages they manage (each with its own page token), and the connect flow lets
 * the user pick which Page(s) to add. Publishing posts to `/{page-id}/feed`
 * (or /photos, /videos) with the page token.
 */
export const GRAPH = "https://graph.facebook.com/v21.0";

export class FacebookProvider extends GenericOAuth2Provider {
  readonly requiresPageSelection = true;

  protected async graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${GRAPH}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new SocialNotConfiguredError("facebook", `Graph GET ${path} failed (${res.status}): ${detail}`);
    }
    return (await res.json()) as T;
  }

  /** POST form-encoded params to the Graph API. `platform` scopes the error. */
  protected async graphPost<T>(
    path: string,
    params: Record<string, string>,
    platform = "facebook",
  ): Promise<T> {
    const res = await fetch(`${GRAPH}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new SocialPublishError(
        platform,
        `Graph POST ${path} failed (${res.status}): ${detail}`,
        res.status >= 500 || res.status === 429,
      );
    }
    return (await res.json()) as T;
  }

  /** Exchange code → short-lived token → long-lived user token → identity. */
  override async exchangeCode({
    code,
    redirectUri,
  }: {
    code: string;
    redirectUri: string;
  }): Promise<ConnectResult> {
    const short = await this.graphGet<{ access_token: string }>("/oauth/access_token", {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const long = await this.graphGet<{ access_token: string; expires_in?: number }>(
      "/oauth/access_token",
      {
        grant_type: "fb_exchange_token",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        fb_exchange_token: short.access_token,
      },
    );

    const me = await this.graphGet<{ id: string; name?: string }>("/me", {
      fields: "id,name",
      access_token: long.access_token,
    });

    return {
      accessToken: long.access_token,
      expiresAt: long.expires_in
        ? new Date(Date.now() + long.expires_in * 1000).toISOString()
        : undefined,
      externalAccountId: me.id,
      displayName: me.name,
    };
  }

  /** List the Pages the user manages, each with its page-scoped token. */
  async listPages(userAccessToken: string): Promise<PageOption[]> {
    const data = await this.graphGet<{
      data: { id: string; name: string; category?: string; access_token: string }[];
    }>("/me/accounts", {
      fields: "id,name,category,access_token",
      access_token: userAccessToken,
      limit: "100",
    });
    return (data.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      accessToken: p.access_token,
    }));
  }

  override async refresh(): Promise<TokenSet> {
    // Page tokens derived from a long-lived user token are effectively durable;
    // Facebook has no refresh-token grant. Reconnect if a token is revoked.
    throw new SocialNotConfiguredError(
      "facebook",
      "Facebook page tokens are not refreshable; reconnect the page if it expires.",
    );
  }

  /** Publish to the Page feed (text/link), or /photos, /videos for media. */
  override async publish({
    accessToken,
    externalAccountId,
    input,
  }: {
    accessToken: string;
    externalAccountId: string;
    input: PublishInput;
  }): Promise<PublishResult> {
    const message = [input.caption, input.hashtags.join(" ")].filter(Boolean).join("\n\n");

    let path = `/${externalAccountId}/feed`;
    const body: Record<string, string> = { access_token: accessToken, message };

    if (input.mediaUrl && input.mediaKind === "image") {
      path = `/${externalAccountId}/photos`;
      body.url = input.mediaUrl;
      body.caption = message;
      delete body.message;
    } else if (input.mediaUrl && input.mediaKind === "video") {
      path = `/${externalAccountId}/videos`;
      body.file_url = input.mediaUrl;
      body.description = message;
      delete body.message;
    } else if (input.link) {
      body.link = input.link;
    }

    const res = await fetch(`${GRAPH}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new SocialPublishError(
        "facebook",
        `Facebook publish failed (${res.status}): ${detail}`,
        res.status >= 500 || res.status === 429,
      );
    }
    const json = (await res.json()) as { id?: string; post_id?: string };
    const id = json.post_id ?? json.id;
    if (!id) throw new SocialPublishError("facebook", "Facebook did not return a post id.", false);
    return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}` };
  }
}
