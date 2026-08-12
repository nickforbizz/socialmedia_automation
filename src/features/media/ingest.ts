import "server-only";

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { probeFile } from "./probe";

export interface IngestJob {
  ownerId: string;
  projectId: string;
  filePath: string;
  folderLabel: string | null;
}

export interface IngestResult {
  status: "ingested" | "duplicate";
  mediaId?: string;
}

/**
 * Ingest a single local file:
 *  1. probe (kind, size, hash, mime)
 *  2. skip if this owner already has the same content hash (dedup)
 *  3. upload original to Storage under <ownerId>/<mediaId>/<file>
 *  4. persist the media row (status = 'ready')
 *
 * Runs in the background worker with the service-role client. Richer analysis
 * (thumbnails, scenes, STT, OCR, embeddings) is a separate Phase 2 job.
 */
export async function ingestFile(job: IngestJob): Promise<IngestResult> {
  const env = getServerEnv();
  const supabase = createAdminClient();
  const probe = await probeFile(job.filePath);

  const { data: existing, error: dupErr } = await supabase
    .from("media")
    .select("id")
    .eq("owner_id", job.ownerId)
    .eq("content_hash", probe.contentHash)
    .maybeSingle();
  if (dupErr) throw new Error(`Dedup check failed: ${dupErr.message}`);
  if (existing) {
    logger.info("ingest skipped (duplicate)", { file: probe.fileName });
    return { status: "duplicate", mediaId: existing.id };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("media")
    .insert({
      owner_id: job.ownerId,
      project_id: job.projectId,
      kind: probe.kind,
      status: "ingesting",
      source_path: job.filePath,
      storage_path: null,
      thumbnail_path: null,
      content_hash: probe.contentHash,
      file_name: probe.fileName,
      mime_type: probe.mimeType,
      size_bytes: probe.sizeBytes,
      width: probe.width,
      height: probe.height,
      duration_sec: probe.durationSec,
      captured_at: probe.capturedAt,
      folder_label: job.folderLabel,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) throw new Error(`Insert failed: ${insertErr?.message}`);

  const mediaId = inserted.id;
  const storagePath = `${job.ownerId}/${mediaId}/${probe.fileName}`;

  try {
    const bytes = await readFile(job.filePath);
    const { error: uploadErr } = await supabase.storage
      .from(env.MEDIA_STORAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: probe.mimeType ?? "application/octet-stream",
        upsert: true,
      });
    if (uploadErr) throw new Error(uploadErr.message);

    await supabase
      .from("media")
      .update({ status: "ready", storage_path: storagePath })
      .eq("id", mediaId);

    await supabase.from("audit_log").insert({
      actor_id: job.ownerId,
      action: "media.ingested",
      entity: "media",
      entity_id: mediaId,
      metadata: { file: probe.fileName, kind: probe.kind, ext: extname(probe.fileName) },
    });

    logger.info("ingest complete", { mediaId, file: probe.fileName });
    return { status: "ingested", mediaId };
  } catch (err) {
    await supabase.from("media").update({ status: "failed" }).eq("id", mediaId);
    throw err instanceof Error ? err : new Error("Upload failed");
  }
}
