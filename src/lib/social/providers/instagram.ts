import { FacebookProvider } from "./facebook";
import { SocialPublishError, type PageOption, type PublishInput, type PublishResult } from "@/lib/social/types";

/**
 * Instagram provider — publishes to an Instagram Business/Creator account that
 * is linked to a Facebook Page. Connection reuses Facebook's OAuth (inherited);
 * `listPages` returns only Pages that have a linked IG account, using the IG
 * account id as the target and the Page token to publish.
 *
 * Publishing is IG's two-step flow: create a media container, then publish it.
 * Instagram feed posts REQUIRE media (image or video/Reel); text-only is not
 * supported.
 */
const CONTAINER_POLLS = 10;
const CONTAINER_POLL_MS = 3000;

export class InstagramProvider extends FacebookProvider {
  /** Only Pages with a linked IG business account are selectable targets. */
  override async listPages(userAccessToken: string): Promise<PageOption[]> {
    const data = await this.graphGet<{
      data: {
        access_token: string;
        instagram_business_account?: { id: string; username?: string };
      }[];
    }>("/me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      access_token: userAccessToken,
      limit: "100",
    });

    return (data.data ?? [])
      .filter((p) => p.instagram_business_account?.id)
      .map((p) => ({
        id: p.instagram_business_account!.id,
        name: p.instagram_business_account!.username
          ? `@${p.instagram_business_account!.username}`
          : "Instagram account",
        category: "Instagram",
        accessToken: p.access_token, // page token is used for IG publishing
      }));
  }

  private async waitForContainer(creationId: string, token: string): Promise<void> {
    for (let i = 0; i < CONTAINER_POLLS; i++) {
      const status = await this.graphGet<{ status_code?: string }>(`/${creationId}`, {
        fields: "status_code",
        access_token: token,
      });
      if (status.status_code === "FINISHED") return;
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
        throw new SocialPublishError("instagram", `Media processing ${status.status_code}.`, false);
      }
      await new Promise((r) => setTimeout(r, CONTAINER_POLL_MS));
    }
    // Not ready yet — let the worker retry the whole publish later.
    throw new SocialPublishError("instagram", "Media still processing; will retry.", true);
  }

  override async publish({
    accessToken,
    externalAccountId,
    input,
  }: {
    accessToken: string;
    externalAccountId: string;
    input: PublishInput;
  }): Promise<PublishResult> {
    if (!input.mediaUrl || (input.mediaKind !== "image" && input.mediaKind !== "video")) {
      throw new SocialPublishError(
        "instagram",
        "Instagram requires an image or video to post.",
        false,
      );
    }

    const caption = [input.caption, input.hashtags.join(" ")].filter(Boolean).join("\n\n");

    // 1) Create the media container.
    const containerParams: Record<string, string> =
      input.mediaKind === "video"
        ? { media_type: "REELS", video_url: input.mediaUrl, caption, access_token: accessToken }
        : { image_url: input.mediaUrl, caption, access_token: accessToken };

    const container = await this.graphPost<{ id: string }>(
      `/${externalAccountId}/media`,
      containerParams,
      "instagram",
    );

    // 2) Video containers process asynchronously — wait until ready.
    if (input.mediaKind === "video") {
      await this.waitForContainer(container.id, accessToken);
    }

    // 3) Publish the container.
    const published = await this.graphPost<{ id: string }>(
      `/${externalAccountId}/media_publish`,
      { creation_id: container.id, access_token: accessToken },
      "instagram",
    );

    // Best-effort permalink.
    let url = "https://www.instagram.com/";
    try {
      const meta = await this.graphGet<{ permalink?: string }>(`/${published.id}`, {
        fields: "permalink",
        access_token: accessToken,
      });
      if (meta.permalink) url = meta.permalink;
    } catch {
      // ignore — permalink is optional
    }

    return { externalPostId: published.id, externalUrl: url };
  }
}
