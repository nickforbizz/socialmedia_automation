import { logger } from "@/lib/logger";
import { getBoss, stopBoss, QUEUES } from "@/lib/queue/boss";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestFile, type IngestJob } from "@/features/media/ingest";
import { analyzeMedia } from "@/features/media/analysis";
import { generateAndStoreIntelligence } from "@/features/media/intelligence";
import { publishPost } from "@/features/social/publishing";
import { collectMetrics } from "@/features/analytics/collect";
import { dispatchDuePosts } from "./scheduler";
import { scanOnce } from "./scanner";

const SCAN_INTERVAL_MS = 60_000;
const SCHEDULE_INTERVAL_MS = 30_000;
const METRICS_INTERVAL_MS = 300_000;

interface MediaJob {
  mediaId: string;
}

interface PublishJob {
  postId: string;
}

/**
 * Worker pipeline: ingest → analyze (vision + embedding) → intelligence.
 * Each stage enqueues the next only on success, so a failure stops that item's
 * chain without blocking others. All stages use the service-role client.
 *
 * Env is loaded by the bootstrap (index.ts) BEFORE this module is imported,
 * because @/lib/env validates configuration at import time.
 */
export async function runWorker(): Promise<void> {
  logger.info("worker: connecting to Postgres queue (DATABASE_URL)…");
  const boss = await getBoss();
  logger.info("worker: queue connected");
  const admin = createAdminClient();

  // pg-boss v10 requires queues to exist before send()/work(); otherwise sends
  // are silently dropped. Create them (idempotent) with a bounded retry policy.
  for (const queue of Object.values(QUEUES)) {
    await boss.createQueue(queue, {
      name: queue,
      policy: "standard",
      retryLimit: 3,
      retryBackoff: true,
    });
  }
  logger.info("worker: queues ready", { queues: Object.values(QUEUES) });

  // 1) Ingest local files, then enqueue analysis.
  await boss.work<IngestJob>(QUEUES.ingest, { batchSize: 2 }, async ([job]) => {
    if (!job) return;
    try {
      const result = await ingestFile(job.data);
      logger.info("ingest job done", { id: job.id, ...result });
      if (result.status === "ingested" && result.mediaId) {
        await boss.send(QUEUES.analyze, { mediaId: result.mediaId }, { singletonKey: result.mediaId });
      }
    } catch (err) {
      logger.error("ingest job failed", { id: job.id, file: job.data.filePath, message: (err as Error).message });
      throw err; // let pg-boss apply retry/backoff
    }
  });

  // 2) Analyze media, then enqueue intelligence generation.
  await boss.work<MediaJob>(QUEUES.analyze, { batchSize: 1 }, async ([job]) => {
    if (!job) return;
    try {
      await analyzeMedia(admin, job.data.mediaId);
      await boss.send(
        QUEUES.intelligence,
        { mediaId: job.data.mediaId },
        { singletonKey: job.data.mediaId },
      );
      logger.info("analyze job done", { id: job.id, mediaId: job.data.mediaId });
    } catch (err) {
      logger.error("analyze job failed", { id: job.id, mediaId: job.data.mediaId, message: (err as Error).message });
      throw err;
    }
  });

  // 3) Generate captions / titles / hashtags etc.
  await boss.work<MediaJob>(QUEUES.intelligence, { batchSize: 1 }, async ([job]) => {
    if (!job) return;
    try {
      await generateAndStoreIntelligence(admin, job.data.mediaId);
      logger.info("intelligence job done", { id: job.id, mediaId: job.data.mediaId });
    } catch (err) {
      logger.error("intelligence job failed", { id: job.id, mediaId: job.data.mediaId, message: (err as Error).message });
      throw err;
    }
  });

  // 4) Publish due/queued posts to their platform.
  await boss.work<PublishJob>(QUEUES.publish, { batchSize: 1 }, async ([job]) => {
    if (!job) return;
    try {
      await publishPost(admin, job.data.postId);
      logger.info("publish job done", { id: job.id, postId: job.data.postId });
    } catch (err) {
      logger.error("publish job failed", { id: job.id, postId: job.data.postId, message: (err as Error).message });
      throw err;
    }
  });

  logger.info("worker: subscribed to ingest, analyze, intelligence, publish queues");

  // Self-heal: re-enqueue analysis for any media that isn't analyzed yet — e.g.
  // items that failed in a previous run before an AI model was available. The
  // singletonKey dedups against anything already queued.
  const { data: pending } = await admin
    .from("media")
    .select("id")
    .in("status", ["ready", "failed"])
    .limit(1000);
  for (const m of pending ?? []) {
    await boss.send(QUEUES.analyze, { mediaId: m.id }, { singletonKey: m.id });
  }
  logger.info("worker: reconciled pending analysis", { count: pending?.length ?? 0 });

  await scanOnce();
  const scanTimer = setInterval(() => {
    scanOnce().catch((err) => logger.error("scan failed", { message: (err as Error).message }));
  }, SCAN_INTERVAL_MS);

  // Poll for scheduled posts whose time has arrived and enqueue them.
  await dispatchDuePosts(admin, boss);
  const scheduleTimer = setInterval(() => {
    dispatchDuePosts(admin, boss).catch((err) =>
      logger.error("dispatch failed", { message: (err as Error).message }),
    );
  }, SCHEDULE_INTERVAL_MS);

  // Periodically collect analytics snapshots for published posts + accounts.
  const metricsTimer = setInterval(() => {
    collectMetrics(admin).catch((err) =>
      logger.error("metrics collect failed", { message: (err as Error).message }),
    );
  }, METRICS_INTERVAL_MS);

  const shutdown = async () => {
    clearInterval(scanTimer);
    clearInterval(scheduleTimer);
    clearInterval(metricsTimer);
    await stopBoss();
    logger.info("worker: stopped");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
