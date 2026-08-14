/**
 * Deterministic intent classifier for the assistant. Routing the query to the
 * right data retrieval is done with rules (not the LLM) so it's fast, testable,
 * and reliable with local models — the LLM only phrases the grounded answer.
 */
export type AssistantIntent =
  | "unpublished"
  | "gaps"
  | "best_times"
  | "analytics"
  | "search"
  | "general";

export function classifyIntent(query: string): AssistantIntent {
  const s = query.toLowerCase();

  if (/never (been )?(published|posted)|unpublished|haven'?t (been )?(posted|published)|not (yet )?(posted|published)/.test(s)) {
    return "unpublished";
  }
  if (/best time|when should i post|posting time|post (this|next|tomorrow|today)|what.*post tomorrow/.test(s)) {
    return "best_times";
  }
  if (/how (am i|are we|is it) (doing|performing)|analytic|engagement|reach|performance|\bstats\b|impressions/.test(s)) {
    return "analytics";
  }
  if (/\bgaps?\b|opportunit|content idea|what should i (post|create|make)|ideas for/.test(s)) {
    return "gaps";
  }
  if (/show me|find|search|which (videos?|clips?|footage)|videos? (of|with|about)|footage|photos? (of|with)/.test(s)) {
    return "search";
  }
  return "general";
}
