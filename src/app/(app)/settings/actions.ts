"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { disconnectAccount, connectPendingPage } from "@/features/social/accounts";
import { getSocialProvider } from "@/lib/social/registry";
import { isSocialPlatform } from "@/lib/social/platforms";
import { logger } from "@/lib/logger";

const idSchema = z.string().uuid();

/** Disconnect (delete) a connected social account. RLS scopes to the owner. */
export async function disconnectAccountAction(formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("accountId"));
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await disconnectAccount(supabase, parsed.data);
    revalidatePath("/settings");
  } catch (err) {
    logger.warn("disconnect failed", { message: (err as Error).message });
  }
}

/**
 * Connect one Page the user chose from the pending set. Redirects back to the
 * page picker so they can connect more (the picker shows a done state once the
 * pending set is empty).
 */
export async function selectPageAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  if (!isSocialPlatform(platform) || !pageId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const isMock = getSocialProvider(platform).isMock;
    await connectPendingPage(supabase, { ownerId: user.id, platform, pageId, isMock });
    revalidatePath("/settings/pages");
    revalidatePath("/settings");
  } catch (err) {
    logger.warn("select page failed", { message: (err as Error).message });
  }
  redirect(`/settings/pages?platform=${platform}`);
}
