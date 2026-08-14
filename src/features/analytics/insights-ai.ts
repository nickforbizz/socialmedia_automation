import "server-only";

import { chat } from "@/lib/ai";
import type { InsightFacts } from "./insights";

/**
 * Phrase deterministic insight facts as a short natural-language summary using
 * the configured text model. Best-effort: if the model is unavailable, the
 * joined facts are returned unchanged so the dashboard always shows a summary.
 */
export async function phraseInsights(facts: InsightFacts): Promise<string> {
  const fallback = [facts.headline, ...facts.facts].join(" ");
  try {
    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are an analytics assistant for a social media creator. Summarize the given " +
            "facts in 2–3 short, plain sentences. No preamble, no lists, no markdown.",
        },
        { role: "user", content: [facts.headline, ...facts.facts].join("\n") },
      ],
      { temperature: 0.4 },
    );
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}
