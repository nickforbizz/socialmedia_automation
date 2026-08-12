import { GenericOAuth2Provider } from "./oauth2";
import { SocialPublishError, type PublishInput, type PublishResult } from "@/lib/social/types";

/**
 * LinkedIn provider — real end-to-end member share, including media.
 *
 * Identity + token exchange come from GenericOAuth2Provider (OAuth2 + OIDC).
 * Publishing uses the versioned Posts API. Media follows LinkedIn's upload flow:
 *   - Images: initializeUpload → PUT bytes → attach urn:li:image to the post.
 *   - Videos: initializeUpload → PUT each part (collect ETags) → finalizeUpload
 *     → attach urn:li:video to the post.
 * Audio is not supported by LinkedIn, so audio media falls back to a text share.
 */
const LINKEDIN_VERSION = "202405";
const API = "https://api.linkedin.com/rest";

const RESERVED = /[\\|{}@[\]()<>*_~]/g;

export function escapeLinkedInText(text: string): string {
  return text.replace(RESERVED, "\\$&");
}

export function buildCommentary(caption: string, hashtags: string[], link?: string): string {
  const parts = [escapeLinkedInText(caption).trim()];
  if (hashtags.length > 0) parts.push(hashtags.join(" "));
  if (link) parts.push(link);
  return parts.filter(Boolean).join("\n\n");
}

export function authorUrn(personId: string): string {
  return `urn:li:person:${personId}`;
}

export function postUrnToUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

/** Pure builder for the Posts API body, with optional attached media URN. */
export function buildPostBody(author: string, commentary: string, mediaUrn?: string) {
  return {
    author,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    ...(mediaUrn ? { content: { media: { id: mediaUrn } } } : {}),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

export class LinkedInProvider extends GenericOAuth2Provider {
  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_VERSION,
    };
  }

  private fail(status: number, detail: string): never {
    throw new SocialPublishError(
      "linkedin",
      `LinkedIn publish failed (${status}): ${detail}`,
      status >= 500 || status === 429,
    );
  }

  /** Download the media bytes (from the signed Storage URL) for upload. */
  private async fetchMediaBytes(url: string): Promise<Uint8Array> {
    const res = await fetch(url);
    if (!res.ok) this.fail(res.status, "could not fetch media for upload");
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Images API: initialize, PUT the bytes, return the image URN. */
  private async uploadImage(
    accessToken: string,
    owner: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const initRes = await fetch(`${API}/images?action=initializeUpload`, {
      method: "POST",
      headers: this.headers(accessToken),
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    });
    if (!initRes.ok) this.fail(initRes.status, await initRes.text().catch(() => "init image failed"));
    const { value } = (await initRes.json()) as { value: { uploadUrl: string; image: string } };

    const put = await fetch(value.uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      // Node's fetch accepts a Uint8Array body; DOM lib types don't model it.
      body: bytes as unknown as BodyInit,
    });
    if (!put.ok) this.fail(put.status, "image byte upload failed");
    return value.image;
  }

  /** Videos API: initialize, PUT each part collecting ETags, finalize, return URN. */
  private async uploadVideo(
    accessToken: string,
    owner: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const initRes = await fetch(`${API}/videos?action=initializeUpload`, {
      method: "POST",
      headers: this.headers(accessToken),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner,
          fileSizeBytes: bytes.byteLength,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
    });
    if (!initRes.ok) this.fail(initRes.status, await initRes.text().catch(() => "init video failed"));
    const { value } = (await initRes.json()) as {
      value: {
        video: string;
        uploadToken: string;
        uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[];
      };
    };

    const uploadedPartIds: string[] = [];
    for (const part of value.uploadInstructions) {
      const chunk = bytes.subarray(part.firstByte, part.lastByte + 1);
      const put = await fetch(part.uploadUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: chunk as unknown as BodyInit,
      });
      if (!put.ok) this.fail(put.status, "video part upload failed");
      const etag = put.headers.get("etag");
      if (!etag) this.fail(put.status, "missing ETag on video part upload");
      uploadedPartIds.push(etag);
    }

    const finalizeRes = await fetch(`${API}/videos?action=finalizeUpload`, {
      method: "POST",
      headers: this.headers(accessToken),
      body: JSON.stringify({
        finalizeUploadRequest: {
          video: value.video,
          uploadToken: value.uploadToken,
          uploadedPartIds,
        },
      }),
    });
    if (!finalizeRes.ok) this.fail(finalizeRes.status, "video finalize failed");
    return value.video;
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
    const author = authorUrn(externalAccountId);

    // Upload media first (if any supported), then reference its URN in the post.
    let mediaUrn: string | undefined;
    if (input.mediaUrl && (input.mediaKind === "image" || input.mediaKind === "video")) {
      const bytes = await this.fetchMediaBytes(input.mediaUrl);
      mediaUrn =
        input.mediaKind === "image"
          ? await this.uploadImage(accessToken, author, bytes)
          : await this.uploadVideo(accessToken, author, bytes);
    }

    const body = buildPostBody(
      author,
      buildCommentary(input.caption, input.hashtags, input.link),
      mediaUrn,
    );

    const res = await fetch(`${API}/posts`, {
      method: "POST",
      headers: this.headers(accessToken),
      body: JSON.stringify(body),
    });
    if (!res.ok) this.fail(res.status, await res.text().catch(() => res.statusText));

    const urn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
    if (!urn) throw new SocialPublishError("linkedin", "LinkedIn did not return a post id.", false);
    return { externalPostId: urn, externalUrl: postUrnToUrl(urn) };
  }
}
