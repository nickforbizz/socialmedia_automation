import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/ai/registry";
import { logger } from "@/lib/logger";
import type { MediaListItem } from "@/features/media/queries";

export interface SemanticHit extends MediaListItem {
  similarity: number;
}

/**
 * Natural-language search over the user's media. Embeds the query with the same
 * model used for indexing, runs the pgvector RPC (RLS-scoped), then hydrates the
 * matching media rows. Returns [] for an empty query.
 */
export async function semanticSearch(query: string, limit = 12): Promise<SemanticHit[]> {
  const q = query.trim();
  if (!q) return [];

  const [embedding] = await getProvider("embedding").generateEmbeddings({ input: [q] });
  if (!embedding) return [];

  const supabase = await createClient();
  const { data: matches, error } = await supabase.rpc("match_media_analysis", {
    query_embedding: `[${embedding.join(",")}]`,
    match_count: limit,
  });
  if (error) {
    logger.warn("semantic search rpc failed", { message: error.message });
    throw new Error("Search failed. Try again.");
  }
  if (!matches || matches.length === 0) return [];

  const ids = matches.map((m) => m.media_id);
  const simById = new Map(matches.map((m) => [m.media_id, m.similarity]));

  const { data: rows, error: rowsErr } = await supabase
    .from("media")
    .select(
      "id, kind, status, file_name, thumbnail_path, folder_label, duration_sec, size_bytes, created_at",
    )
    .in("id", ids);
  if (rowsErr) throw new Error(`Failed to load results: ${rowsErr.message}`);

  return (rows ?? [])
    .map((r) => ({ ...r, similarity: simById.get(r.id) ?? 0 }))
    .sort((a, b) => b.similarity - a.similarity);
}
