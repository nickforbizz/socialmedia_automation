import "server-only";

import { getProvider } from "@/lib/ai/registry";
import type { AIProviderName } from "@/lib/supabase/database.types";
import type { ChatMessage } from "@/lib/ai/types";

/**
 * High-level AI facade. UI/services call these; providers stay hidden.
 * Phase 6 grows this into the full orchestration layer (RAG, tools, memory).
 */

export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; provider?: AIProviderName; model?: string } = {},
): Promise<string> {
  const provider = getProvider("text", opts.provider);
  const result = await provider.generateText({
    messages,
    temperature: opts.temperature,
    model: opts.model,
  });
  return result.text;
}

export async function embed(
  input: string[],
  opts: { provider?: AIProviderName; model?: string } = {},
): Promise<number[][]> {
  const provider = getProvider("embedding", opts.provider);
  return provider.generateEmbeddings({ input, model: opts.model });
}

export { getProvider } from "@/lib/ai/registry";
export * from "@/lib/ai/types";
