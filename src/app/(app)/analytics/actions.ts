"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { collectMetrics } from "@/features/analytics/collect";
import { logger } from "@/lib/logger";

export interface RefreshState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Collect a fresh metrics snapshot for the signed-in user's published posts and
 * accounts on demand (RLS scopes the collection to the user). Useful for an
 * immediate view without waiting for the worker's periodic collection.
 */
export async function refreshMetricsAction(
  _prev: RefreshState,
  _formData: FormData,
): Promise<RefreshState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    const result = await collectMetrics(supabase);
    revalidatePath("/analytics");
    return {
      ok: true,
      message: `Captured ${result.postSnapshots} post and ${result.accountSnapshots} account snapshots.`,
    };
  } catch (err) {
    logger.warn("refresh metrics failed", { message: (err as Error).message });
    return { error: (err as Error).message };
  }
}
