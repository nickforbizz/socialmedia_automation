import "server-only";

import { chat } from "@/lib/ai";
import type { Opportunity } from "./opportunities";

/** Deterministic, original idea per opportunity — the fallback and the seed. */
export function fallbackIdeas(opportunities: Opportunity[], place = "your area"): string[] {
  return opportunities.slice(0, 5).map((o) => {
    if (o.type === "untapped_footage") {
      return `“Hidden ${o.topic} in ${place}” — cut from your own unpublished ${o.topic} footage for a local, original angle.`;
    }
    if (o.type === "content_gap") {
      return `${o.topic} is working for competitors but you haven't shot it — plan a ${o.topic} capture with a angle only you can offer.`;
    }
    return `Keep a steady ${o.topic} cadence with fresh footage to stay ahead.`;
  });
}

/**
 * Turn opportunities into concrete, original post ideas grounded in the
 * creator's own footage — explicitly NOT copying competitors. Best-effort: if
 * the model is unavailable, returns the deterministic fallback ideas.
 */
export async function suggestContentIdeas(
  opportunities: Opportunity[],
  userMediaThemes: string[],
  place = "your area",
): Promise<string[]> {
  const fallback = fallbackIdeas(opportunities, place);
  if (opportunities.length === 0) return fallback;

  try {
    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are a content strategist for a travel/lifestyle creator. Propose 3–5 specific, " +
            "ORIGINAL post ideas that use the creator's OWN footage and a distinctive local angle. " +
            "Never suggest copying a competitor. One idea per line, no numbering, no preamble.",
        },
        {
          role: "user",
          content:
            `Opportunity topics (competitors do well here): ${opportunities.map((o) => o.topic).join(", ")}\n` +
            `Footage the creator already has: ${userMediaThemes.join(", ") || "unknown"}\n` +
            `Primary location: ${place}`,
        },
      ],
      { temperature: 0.7 },
    );
    const ideas = text
      .split("\n")
      .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
    return ideas.length > 0 ? ideas.slice(0, 6) : fallback;
  } catch {
    return fallback;
  }
}
