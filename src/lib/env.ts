import { z } from "zod";

/**
 * Centralized, validated environment configuration.
 *
 * Split into `client` (NEXT_PUBLIC_*, safe to ship to the browser) and `server`
 * (secrets, never bundled client-side). Server access from a client bundle
 * throws at build/runtime, preventing accidental secret leakage.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const providerEnum = z.enum(["ollama", "openrouter", "openai", "anthropic", "gemini"]);

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url().optional(),

  AI_TEXT_PROVIDER: providerEnum.default("ollama"),
  AI_VISION_PROVIDER: providerEnum.default("ollama"),
  AI_EMBEDDING_PROVIDER: providerEnum.default("ollama"),
  AI_TRANSCRIPTION_PROVIDER: providerEnum.default("ollama"),

  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_TEXT_MODEL: z.string().default("hermes3"),
  OLLAMA_VISION_MODEL: z.string().default("llama3.2-vision"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  MEDIA_WATCH_FOLDERS: z.string().default(""),
  MEDIA_STORAGE_BUCKET: z.string().default("media"),

  // Base URL used to build OAuth redirect URIs.
  APP_URL: z.string().url().default("http://localhost:3000"),
  // 32-byte base64 key for encrypting OAuth tokens at rest. Required only for
  // social features; optional so Phase 1/2 boot without it.
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  // Allow the mock social provider (local dev end-to-end without real apps).
  SOCIAL_ALLOW_MOCK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Real platform OAuth client credentials are read on demand per platform via
  // getPlatformOAuthConfig() (e.g. FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET),
  // so they don't bloat this schema. See src/lib/social/config.ts.
});

function parse<T extends z.ZodTypeAny>(schema: T, source: Record<string, unknown>): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const clientEnv = parse(clientSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Server-only env. Importing this from a client component throws, because the
 * referenced variables are undefined in the browser bundle.
 */
export function getServerEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in the browser.");
  }
  return parse(serverSchema, process.env);
}

export type MediaWatchFolder = { label: string; path: string };

export function parseWatchFolders(raw: string): MediaWatchFolder[] {
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((path) => ({ path, label: path.split(/[\\/]/).filter(Boolean).pop() ?? path }));
}
