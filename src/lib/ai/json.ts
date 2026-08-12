/**
 * Best-effort extraction of a JSON object from an LLM response. Local models
 * sometimes wrap JSON in ```json fences or add a stray sentence; this pulls out
 * the first balanced {...} block and parses it. Returns null on failure so
 * callers can decide how to handle a malformed generation.
 */
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const slice = candidate.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}
