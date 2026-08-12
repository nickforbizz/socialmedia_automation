import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Handles the link Supabase emails for signup confirmation / password recovery.
 * The link points here with `token_hash` and `type`. We verify the OTP, which
 * sets the session cookie, then redirect into the app.
 *
 * Without this route, the confirmation email had nowhere to land — that was a
 * real gap in the original auth flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    logger.warn("email confirmation failed", { code: error.code, message: error.message });
  }

  return NextResponse.redirect(
    new URL("/login?error=confirmation_failed", request.url),
  );
}
