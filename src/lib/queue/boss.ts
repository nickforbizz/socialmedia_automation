import "server-only";

import PgBoss from "pg-boss";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Durable job queue backed by Postgres (pg-boss). Chosen over Redis/BullMQ
 * because Supabase already provides Postgres — one fewer moving part for the
 * local-first deployment. The queue interface is small enough to swap later.
 */
export const QUEUES = {
  ingest: "media.ingest",
  analyze: "media.analyze",
  intelligence: "media.intelligence",
} as const;

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run the background queue.");
  }
  // Supabase (and most hosted Postgres) require TLS. The pooler presents a
  // valid cert, but we don't ship the CA, so disable strict verification for
  // non-local connections. Local Postgres connects without SSL.
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(env.DATABASE_URL);
  boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  boss.on("error", (err) => logger.error("pg-boss error", { message: err.message }));
  await boss.start();
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
