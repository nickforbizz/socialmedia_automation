import { createClient } from "@/lib/supabase/server";
import type { Database, MediaKind, MediaStatus } from "@/lib/supabase/database.types";

type MediaRow = Database["public"]["Tables"]["media"]["Row"];
type AnalysisRow = Database["public"]["Tables"]["media_analysis"]["Row"];
type IntelligenceRow = Database["public"]["Tables"]["media_intelligence"]["Row"];

export interface MediaDetail {
  media: MediaRow;
  analysis: AnalysisRow | null;
  intelligence: IntelligenceRow | null;
}

export interface MediaListItem {
  id: string;
  kind: MediaKind;
  status: MediaStatus;
  file_name: string;
  thumbnail_path: string | null;
  folder_label: string | null;
  duration_sec: number | null;
  size_bytes: number | null;
  created_at: string;
}

export interface MediaStats {
  total: number;
  ready: number;
  analyzed: number;
  ingesting: number;
  failed: number;
}

/** Recent media for the signed-in user. RLS scopes rows automatically. */
export async function listRecentMedia(limit = 24): Promise<MediaListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .select(
      "id, kind, status, file_name, thumbnail_path, folder_label, duration_sec, size_bytes, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load media: ${error.message}`);
  return data ?? [];
}

/** Status counts for dashboard widgets. Uses head+count to avoid transferring rows. */
export async function getMediaStats(): Promise<MediaStats> {
  const supabase = await createClient();
  const statuses: MediaStatus[] = ["ready", "analyzed", "ingesting", "failed"];

  const [totalRes, ...byStatus] = await Promise.all([
    supabase.from("media").select("id", { count: "exact", head: true }),
    ...statuses.map((s) =>
      supabase.from("media").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  ]);

  const [ready, analyzed, ingesting, failed] = byStatus.map((r) => r.count ?? 0);
  return {
    total: totalRes.count ?? 0,
    ready: ready ?? 0,
    analyzed: analyzed ?? 0,
    ingesting: ingesting ?? 0,
    failed: failed ?? 0,
  };
}

/** Full detail for one media item: base row + analysis + generated intelligence. */
export async function getMediaDetail(id: string): Promise<MediaDetail | null> {
  const supabase = await createClient();
  const { data: media, error } = await supabase.from("media").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load media: ${error.message}`);
  if (!media) return null;

  const [{ data: analysis }, { data: intelligence }] = await Promise.all([
    supabase.from("media_analysis").select("*").eq("media_id", id).maybeSingle(),
    supabase.from("media_intelligence").select("*").eq("media_id", id).maybeSingle(),
  ]);

  return { media, analysis: analysis ?? null, intelligence: intelligence ?? null };
}
