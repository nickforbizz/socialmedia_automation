import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";

/**
 * Worker bootstrap.
 *
 * The worker is a standalone process — unlike the Next.js runtime, nothing loads
 * `.env.local` for it automatically. We load env files here FIRST, then
 * dynamically import the worker, because `@/lib/env` validates configuration at
 * import time (a static import would run that validation before env is loaded).
 *
 * Precedence mirrors Next.js: `.env.local` wins over `.env` (override: false
 * keeps already-set process.env and the first file loaded).
 */
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnv({ path: file, override: false });
}

// Immediate feedback so a slow queue connection doesn't look like a hang.
console.log(
  JSON.stringify({
    ts: new Date().toISOString(),
    level: "info",
    message: "worker: env loaded, booting",
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    watchFolders: process.env.MEDIA_WATCH_FOLDERS ?? "",
  }),
);

await import("./run").then(({ runWorker }) => runWorker()).catch((err) => {
  // Logger import is deferred with the worker so it also sees loaded env.
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      message: "worker: fatal",
      detail: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
