import { GenericOAuth2Provider } from "./oauth2";
import { SocialPublishError, type PublishInput, type PublishResult } from "@/lib/social/types";

/**
 * LinkedIn provider — real end-to-end member share.
 *
 * Identity + token exchange are inherited from GenericOAuth2Provider (LinkedIn
 * is standard OAuth2 + OIDC userinfo, which yields the member `sub`). Publishing
 * uses the versioned Posts API to create a text share (links auto-unfurl in the
 * commentary). Image/video upload is a multi-step registerUpload flow and is
 * left as a documented seam; text + link shares work today.
 */
const LINKEDIN_VERSION = "202405";
const POSTS_URL = "https://api.linkedin.com/rest/posts";

/**
 * LinkedIn "commentary" uses a Little Text format where a set of characters are
 * reserved and must be backslash-escaped or the request is rejected. We escape
 * the reserved set but deliberately leave `#` so hashtags render as entities.
 */
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

export class LinkedInProvider extends GenericOAuth2Provider {
  override async publish({
    accessToken,
    externalAccountId,
    input,
  }: {
    accessToken: string;
    externalAccountId: string;
    input: PublishInput;
  }): Promise<PublishResult> {
    const body = {
      author: authorUrn(externalAccountId),
      commentary: buildCommentary(input.caption, input.hashtags, input.link),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    const res = await fetch(POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": LINKEDIN_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      // 5xx / 429 are worth retrying; 4xx (bad token, permissions) are not.
      const retryable = res.status >= 500 || res.status === 429;
      throw new SocialPublishError("linkedin", `LinkedIn publish failed (${res.status}): ${detail}`, retryable);
    }

    // The created post URN is returned in a response header.
    const urn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
    if (!urn) {
      throw new SocialPublishError("linkedin", "LinkedIn did not return a post id.", false);
    }
    return { externalPostId: urn, externalUrl: postUrnToUrl(urn) };
  }
}
