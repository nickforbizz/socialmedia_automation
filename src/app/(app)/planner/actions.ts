"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateWeeklyPlan } from "@/features/planner/generate";
import { logger } from "@/lib/logger";

export interface PlanState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export async function generatePlanAction(_prev: PlanState, _formData: FormData): Promise<PlanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    const result = await generateWeeklyPlan(supabase, user.id);
    revalidatePath("/planner");
    revalidatePath("/calendar");
    return { ok: true, message: result.message };
  } catch (err) {
    logger.warn("generate plan failed", { message: (err as Error).message });
    return { error: (err as Error).message };
  }
}
