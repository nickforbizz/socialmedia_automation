"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDefaultProject } from "@/features/social/accounts";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

export interface ComposeState {
  ok?: boolean;
  error?: string;
}

const composeSchema = z.object({
  socialAccountId: z.string().uuid("Choose an account to publish to."),
  caption: z.string().max(5000).default(""),
  hashtags: z.string().default(""),
  mediaId: z.string().uuid().optional().or(z.literal("")),
  scheduledFor: z.string().optional().or(z.literal("")),
  intent: z.enum(["draft", "schedule", "publish_now"]),
});

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

/**
 * Create a post as a draft, a scheduled item, or "publish now" (scheduled for
 * immediately — the worker's scheduler picks it up within ~30s, keeping the web
 * tier decoupled from the queue). Runs as the user; RLS enforces ownership.
 */
export async function composePostAction(
  _prev: ComposeState,
  formData: FormData,
): Promise<ComposeState> {
  const parsed = composeSchema.safeParse({
    socialAccountId: formData.get("socialAccountId"),
    caption: formData.get("caption") ?? "",
    hashtags: formData.get("hashtags") ?? "",
    mediaId: formData.get("mediaId") ?? "",
    scheduledFor: formData.get("scheduledFor") ?? "",
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Resolve the account (and its platform) — RLS ensures it's the user's.
  const { data: account, error: accErr } = await supabase
    .from("social_accounts")
    .select("id, platform")
    .eq("id", input.socialAccountId)
    .maybeSingle();
  if (accErr || !account) return { error: "Selected account not found." };

  let status: "draft" | "scheduled" = "draft";
  let scheduledFor: string | null = null;

  if (input.intent === "publish_now") {
    status = "scheduled";
    scheduledFor = new Date().toISOString();
  } else if (input.intent === "schedule") {
    if (!input.scheduledFor) return { error: "Pick a date and time to schedule." };
    const when = new Date(input.scheduledFor);
    if (Number.isNaN(when.getTime())) return { error: "Invalid schedule time." };
    status = "scheduled";
    scheduledFor = when.toISOString();
  }

  try {
    const projectId = await getOrCreateDefaultProject(supabase, user.id);
    const { error } = await supabase.from("posts").insert({
      owner_id: user.id,
      project_id: projectId,
      social_account_id: account.id,
      media_id: input.mediaId ? input.mediaId : null,
      platform: account.platform,
      caption: input.caption,
      hashtags: parseHashtags(input.hashtags),
      link: null,
      status,
      scheduled_for: scheduledFor,
      published_at: null,
      external_post_id: null,
      external_url: null,
      error: null,
    });
    if (error) return { error: error.message };

    revalidatePath("/calendar");
    return { ok: true };
  } catch (err) {
    logger.warn("compose failed", { message: (err as Error).message });
    return { error: (err as Error).message };
  }
}

const idSchema = z.string().uuid();

async function ownedPostUpdate(formData: FormData, patch: PostUpdate): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("postId"));
  if (!parsed.success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("posts").update(patch).eq("id", parsed.data);
  revalidatePath("/calendar");
}

/** Publish now: flip a draft/scheduled post to due-immediately. */
export async function publishNowAction(formData: FormData): Promise<void> {
  await ownedPostUpdate(formData, {
    status: "scheduled",
    scheduled_for: new Date().toISOString(),
  });
}

/** Cancel a scheduled post back to draft. */
export async function cancelScheduleAction(formData: FormData): Promise<void> {
  await ownedPostUpdate(formData, { status: "draft", scheduled_for: null });
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("postId"));
  if (!parsed.success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("posts").delete().eq("id", parsed.data);
  revalidatePath("/calendar");
}
