"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { answerQuestion } from "@/features/assistant/assistant";
import { logger } from "@/lib/logger";

export interface AssistantState {
  error?: string;
}

const schema = z.object({
  message: z.string().trim().min(1, "Ask a question.").max(2000),
  conversationId: z.string().uuid().optional().or(z.literal("")),
});

export async function askAssistantAction(
  _prev: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const parsed = schema.safeParse({
    message: formData.get("message") ?? "",
    conversationId: formData.get("conversationId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    await answerQuestion(supabase, user.id, {
      conversationId: parsed.data.conversationId || undefined,
      message: parsed.data.message,
    });
    revalidatePath("/assistant");
    return {};
  } catch (err) {
    logger.warn("assistant failed", { message: (err as Error).message });
    return { error: (err as Error).message };
  }
}
