import "server-only";

import { getServerEnv } from "@/lib/env";
import type { SocialPlatform } from "@/lib/supabase/database.types";
import { getPlatformOAuthConfig } from "@/lib/social/config";
import { GenericOAuth2Provider } from "@/lib/social/providers/oauth2";
import { LinkedInProvider } from "@/lib/social/providers/linkedin";
import { MockSocialProvider } from "@/lib/social/providers/mock";
import { SocialNotConfiguredError, type SocialProvider } from "@/lib/social/types";

/**
 * Resolve the provider for a platform:
 *   1. If real OAuth client credentials are configured → GenericOAuth2Provider.
 *   2. Else if SOCIAL_ALLOW_MOCK is on → MockSocialProvider (local testing).
 *   3. Else → throw a clear "not configured" error.
 * This is the only place that decides real-vs-mock, mirroring the AI registry.
 */
export function getSocialProvider(platform: SocialPlatform): SocialProvider {
  const config = getPlatformOAuthConfig(platform);
  if (config) {
    // Concrete providers implement platform-specific publishing; the generic
    // provider handles OAuth but leaves publish() as a seam.
    if (platform === "linkedin") return new LinkedInProvider(config);
    return new GenericOAuth2Provider(config);
  }

  const env = getServerEnv();
  if (env.SOCIAL_ALLOW_MOCK) return new MockSocialProvider(platform);

  throw new SocialNotConfiguredError(platform);
}

export function isPlatformConfigured(platform: SocialPlatform): boolean {
  if (getPlatformOAuthConfig(platform)) return true;
  return getServerEnv().SOCIAL_ALLOW_MOCK;
}
