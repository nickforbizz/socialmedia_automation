"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateAndStoreIntelligence } from "@/features/media/intelligence";
import { logger } from "@/lib/logger";

export interface RegenerateState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.string().uuid();

/**
 * Regenerate AI intelligence for a media item on demand. Runs as the signed-in
 * user (RLS enforced), so a user can only regenerate their own media.
 */
export async function regenerateIntelligenceAction(
  _prev: RegenerateState,
  formData: FormData,
): Promise<RegenerateState> {
  const parsed = idSchema.safeParse(formData.get("mediaId"));
  if (!parsed.success) return { error: "Invalid media id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    await generateAndStoreIntelligence(supabase, parsed.data);
    revalidatePath(`/media/${parsed.data}`);
    return { ok: true };
  } catch (err) {
    logger.warn("regenerate intelligence failed", { message: (err as Error).message });
    return { error: (err as Error).message };
  }
}
