"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { disconnectAccount } from "@/features/social/accounts";
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
