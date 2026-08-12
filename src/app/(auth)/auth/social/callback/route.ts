import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { isSocialPlatform } from "@/lib/social/platforms";
import { getSocialProvider } from "@/lib/social/registry";
import { verifyState } from "@/lib/social/oauth-state";
import { upsertConnectedAccount, savePendingPages } from "@/features/social/accounts";
import { STATE_COOKIE } from "@/app/api/social/[platform]/connect/route";
import { logger } from "@/lib/logger";

/**
 * OAuth callback: verifies the signed state against the cookie (CSRF), exchanges
 * the code for tokens + account identity, and stores the account with encrypted
 * tokens. Redirects back to Settings with a status.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const settings = new URL("/settings", request.url);

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value;
  const env = getServerEnv();

  const fail = (reason: string) => {
    settings.searchParams.set("error", reason);
    cookieStore.delete(STATE_COOKIE);
    return NextResponse.redirect(settings);
  };

  if (!code || !stateParam || !cookieState || stateParam !== cookieState) return fail("oauth_state");
  if (!env.TOKEN_ENCRYPTION_KEY) return fail("no_encryption_key");

  const state = verifyState(stateParam, env.TOKEN_ENCRYPTION_KEY);
  if (!state || !isSocialPlatform(state.platform)) return fail("oauth_state");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const provider = getSocialProvider(state.platform);
    const redirectUri = `${env.APP_URL}/auth/social/callback`;
    const result = await provider.exchangeCode({ code, redirectUri });
    cookieStore.delete(STATE_COOKIE);

    // Multi-page platforms (Facebook/Instagram): stash the pages and let the
    // user choose which to connect, rather than assuming one account.
    if (provider.requiresPageSelection && provider.listPages) {
      const pages = await provider.listPages(result.accessToken);
      if (pages.length === 0) return fail("no_pages");
      await savePendingPages(supabase, {
        ownerId: user.id,
        projectId: state.projectId,
        platform: state.platform,
        pages,
      });
      const select = new URL("/settings/pages", request.url);
      select.searchParams.set("platform", state.platform);
      return NextResponse.redirect(select);
    }

    await upsertConnectedAccount(supabase, {
      ownerId: user.id,
      projectId: state.projectId,
      platform: state.platform,
      isMock: provider.isMock,
      result,
    });
    settings.searchParams.set("connected", state.platform);
    return NextResponse.redirect(settings);
  } catch (err) {
    logger.warn("social connect failed", { platform: state.platform, message: (err as Error).message });
    return fail("connect_failed");
  }
}
