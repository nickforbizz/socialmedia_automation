import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv, parseWatchFolders } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getBoss, QUEUES } from "@/lib/queue/boss";
import { isSupportedMedia } from "@/features/media/probe";
import type { IngestJob } from "@/features/media/ingest";

/**
 * Resolve the local owner + a project to attach ingested media to.
 *
 * Local-first single-operator assumption: the earliest-created profile is the
 * owner. Multi-tenant SaaS (Phase 3+) will instead map each watch folder to a
 * specific user/project — this function is the seam for that change.
 */
async function resolveOwnerAndProject(): Promise<{ ownerId: string; projectId: string } | null> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!profile) {
    logger.warn("scanner: no user exists yet; sign up first");
    return null;
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (project) return { ownerId: profile.id, projectId: project.id };

  const { data: created, error } = await supabase
    .from("projects")
    .insert({ owner_id: profile.id, name: "My Project" })
    .select("id")
    .single();
  if (error || !created) {
    logger.error("scanner: failed to create default project", { message: error?.message });
    return null;
  }
  return { ownerId: profile.id, projectId: created.id };
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    logger.warn("scanner: cannot read folder", { dir, message: (err as Error).message });
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && isSupportedMedia(full)) yield full;
  }
}

/**
 * Scan every watch folder and enqueue an ingest job per supported file.
 * Dedup happens downstream in ingestFile (content-hash unique constraint),
 * so re-scanning is safe and idempotent.
 */
export async function scanOnce(): Promise<number> {
  const env = getServerEnv();
  const folders = parseWatchFolders(env.MEDIA_WATCH_FOLDERS);
  if (folders.length === 0) {
    logger.info("scanner: no watch folders configured (MEDIA_WATCH_FOLDERS)");
    return 0;
  }
  logger.info("scanner: watching folders", { folders: folders.map((f) => f.path) });

  const target = await resolveOwnerAndProject();
  if (!target) return 0;

  const boss = await getBoss();
  let queued = 0;

  for (const folder of folders) {
    for await (const filePath of walk(folder.path)) {
      const job: IngestJob = {
        ownerId: target.ownerId,
        projectId: target.projectId,
        filePath,
        folderLabel: folder.label,
      };
      // Use content path as singleton key to coalesce duplicate enqueues.
      await boss.send(QUEUES.ingest, job, { singletonKey: `${target.ownerId}:${filePath}` });
      queued++;
    }
  }

  logger.info("scanner: enqueued files", { queued });
  return queued;
}
