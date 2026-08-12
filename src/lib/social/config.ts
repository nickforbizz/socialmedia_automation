import type { SocialPlatform } from "@/lib/supabase/database.types";

/**
 * Per-platform OAuth2 endpoints. Client credentials are read from env on demand
 * (e.g. FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET) so the strict env schema
 * stays small. A platform is "configured" only when both id and secret exist.
 */
export interface PlatformOAuthConfig {
  platform: SocialPlatform;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  /** Platform userinfo endpoint used to derive account identity (seam). */
  userInfoUrl?: string;
}

const ENDPOINTS: Record<
  SocialPlatform,
  { authorizeUrl: string; tokenUrl: string; scopes: string[]; userInfoUrl?: string }
> = {
  facebook: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["public_profile", "pages_show_list", "pages_manage_posts", "pages_read_engagement"],
    userInfoUrl: "https://graph.facebook.com/v21.0/me",
  },
  instagram: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    // IG publishing runs through linked Pages, so Page scopes are required too.
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ],
    userInfoUrl: "https://graph.facebook.com/v21.0/me",
  },
  youtube: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.upload"],
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  },
  tiktok: {
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["video.publish", "user.info.basic"],
  },
  linkedin: {
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    // OIDC for identity (sub/name) + member-share for publishing.
    scopes: ["openid", "profile", "w_member_social"],
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
  },
  x: {
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    userInfoUrl: "https://api.twitter.com/2/users/me",
  },
};

export function getPlatformOAuthConfig(platform: SocialPlatform): PlatformOAuthConfig | null {
  const prefix = platform.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;

  const endpoints = ENDPOINTS[platform];
  return { platform, clientId, clientSecret, ...endpoints };
}
