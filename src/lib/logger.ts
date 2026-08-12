/**
 * Minimal structured logger. Emits JSON lines so a real aggregator
 * (Datadog, Logtail, etc.) can ingest them unchanged in production.
 * Swap the transport here without touching call sites — that is the
 * single monitoring hook seam for Phase 1.
 */
type Level = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function emit(level: Level, message: string, fields?: LogFields): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};
