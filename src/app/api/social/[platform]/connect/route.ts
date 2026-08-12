import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { isSocialPlatform } from "@/lib/social/platforms";
import { getSocialProvider } from "@/lib/social/registry";
import { createState } from "@/lib/social/oauth-state";
import { getOrCreateDefaultProject } from "@/features/social/accounts";
import { logger } from "@/lib/logger";

export const STATE_COOKIE = "social_oauth_state";

/**
 * Starts the OAuth connect flow for a platform. Builds a signed `state`
 * (CSRF), stores it in an httpOnly cookie, and redirects to the provider's
 * authorize URL. For the mock provider this URL points straight back to the
 * callback so the whole flow is exercised locally.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const settings = new URL("/settings", request.url);

  if (!isSocialPlatform(platform)) {
    settings.searchParams.set("error", "unknown_platform");
    return NextResponse.redirect(settings);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const env = getServerEnv();
  if (!env.TOKEN_ENCRYPTION_KEY) {
    settings.searchParams.set("error", "no_encryption_key");
    return NextResponse.redirect(settings);
  }

  try {
    const projectId = await getOrCreateDefaultProject(supabase, user.id);
    const redirectUri = `${env.APP_URL}/auth/social/callback`;
    const state = createState(platform, projectId, env.TOKEN_ENCRYPTION_KEY);
    const authorizeUrl = getSocialProvider(platform).getAuthorizeUrl({ state, redirectUri });

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    logger.warn("social connect start failed", { platform, message: (err as Error).message });
    settings.searchParams.set("error", "connect_start_failed");
    return NextResponse.redirect(settings);
  }
}
