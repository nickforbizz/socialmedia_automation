"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, signupSchema } from "@/lib/validation/auth";
import { logger } from "@/lib/logger";

export interface AuthActionState {
  error?: string;
  /** Non-error info to surface (e.g. "check your email to confirm"). */
  notice?: string;
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    logger.warn("sign-in failed", { code: error.code, message: error.message });
    // Surface the actual reason instead of masking every failure.
    if (error.code === "email_not_confirmed") {
      return {
        error:
          "Your email hasn't been confirmed yet. Check your inbox for the confirmation link, " +
          "or disable “Confirm email” in Supabase Auth settings for instant local access.",
      };
    }
    return { error: "Invalid email or password." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) {
    logger.warn("sign-up failed", { code: error.code, message: error.message });
    return { error: error.message };
  }

  // When "Confirm email" is ON, signUp returns no session. Redirecting to
  // /dashboard would bounce back to /login via middleware, which looks broken.
  // Instead, tell the user what to do. When confirmation is OFF, a session is
  // present and we go straight in.
  if (!data.session) {
    return {
      notice:
        "Account created. Check your email for a confirmation link before signing in. " +
        "(For local-first use, you can turn off “Confirm email” in Supabase Auth settings.)",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
