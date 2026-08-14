"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDefaultProject } from "@/features/social/accounts";
import { syncCompetitor } from "@/features/competitors/collect";
import { getSocialProvider } from "@/lib/social/registry";
import { isSocialPlatform } from "@/lib/social/platforms";
import { logger } from "@/lib/logger";

export interface AddCompetitorState {
  ok?: boolean;
  error?: string;
}

const addSchema = z.object({
  platform: z.string().refine(isSocialPlatform, "Choose a platform."),
  handle: z.string().trim().min(1, "Enter a handle or username.").max(120),
  displayName: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function addCompetitorAction(
  _prev: AddCompetitorState,
  formData: FormData,
): Promise<AddCompetitorState> {
  const parsed = addSchema.safeParse({
    platform: formData.get("platform"),
    handle: formData.get("handle"),
    displayName: formData.get("displayName") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data;
  if (!isSocialPlatform(input.platform)) return { error: "Unknown platform." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    const projectId = await getOrCreateDefaultProject(supabase, user.id);
    const isMock = getSocialProvider(input.platform).isMock;
    const handle = input.handle.replace(/^@/, "");

    const { data, error } = await supabase
      .from("competitors")
      .upsert(
        {
          owner_id: user.id,
          project_id: projectId,
          platform: input.platform,
          handle,
          display_name: input.displayName || handle,
          notes: null,
          last_synced_at: null,
          is_mock: isMock,
        },
        { onConflict: "owner_id,platform,handle" },
      )
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not add competitor." };

    // Sync immediately so intelligence appears right away (best-effort).
    try {
      await syncCompetitor(supabase, data.id);
    } catch (err) {
      logger.warn("initial competitor sync failed", { message: (err as Error).message });
    }

    revalidatePath("/competitors");
    return { ok: true };
  } catch (err) {
    logger.warn("add competitor failed", { message: (err as Error).message });
    return { error: (err as Error).message };
  }
}

const idSchema = z.string().uuid();

export async function syncCompetitorAction(formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("competitorId"));
  if (!parsed.success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await syncCompetitor(supabase, parsed.data);
  } catch (err) {
    logger.warn("competitor sync failed", { message: (err as Error).message });
  }
  revalidatePath("/competitors");
}

export async function removeCompetitorAction(formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("competitorId"));
  if (!parsed.success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("competitors").delete().eq("id", parsed.data);
  revalidatePath("/competitors");
}
