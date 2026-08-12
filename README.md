# AI Social Platform — Phase 1 (Foundation)

AI-first social media management platform. Local-first, architected to grow into a multi-tenant SaaS without a rewrite. This repository currently contains **Phase 1: Foundation**.

## What's in Phase 1

- **Project setup** — Next.js 15 (App Router), TypeScript (strict), Tailwind + shadcn-style UI, ESLint/Prettier, Vitest, Docker, GitHub Actions CI.
- **Authentication** — Supabase Auth (email/password), middleware session refresh, protected app routes.
- **Database** — Normalized Postgres schema with RLS on every table, `pgvector` installed for Phase 2. Migrations in `supabase/migrations`.
- **AI provider abstraction** — `AIProvider` interface + capability router. Ollama wired; OpenRouter/OpenAI/Anthropic/Gemini are config-only seams.
- **Local media ingestion** — Background worker scans watch folders, dedupes by content hash, uploads to Storage, persists metadata.
- **Dashboard shell** — Sidebar nav, dark mode, media stats, media grid, empty/loading states.

## Prerequisites

- Node 22+
- A Supabase project (or local Supabase stack)
- [Ollama](https://ollama.com) running locally with models pulled:
  ```bash
  ollama pull hermes3
  ollama pull llama3.2-vision
  ollama pull nomic-embed-text
  ```

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase + DATABASE_URL + watch folders
```

Apply migrations to your Supabase project (via the Supabase SQL editor, the CLI, or the Supabase MCP):

```
supabase/migrations/0001_foundation.sql
supabase/migrations/0002_storage.sql
```

Regenerate DB types after schema changes:

```bash
npm run db:types
```

## Run

```bash
npm run dev      # web app on http://localhost:3000
npm run worker   # background ingestion worker (needs DATABASE_URL)
```

Sign up once, then set `MEDIA_WATCH_FOLDERS` to your local video/image folders. The worker scans on start and every 60s.

## Verify

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Architecture notes

- **Provider abstraction** (`src/lib/ai`) is the core differentiator: capability → provider routing from config. `registry.ts` is the only file that references concrete providers.
- **RLS-first**: every table is owner-scoped; the browser/server clients use the anon key and act as the user. The service-role client (`admin.ts`) is used **only** by the worker and is `server-only`.
- **Queue** (`src/lib/queue`): pg-boss on Postgres — no extra infra beyond Supabase.
- **Feature-based structure**: domain logic lives under `src/features/*`, not in route files.

## Phase 2 seams (left open intentionally)

These are defined as interfaces/jobs, not stubbed with fake logic:

- Rich media probing (dimensions, duration, thumbnails) via ffprobe/sharp — `src/features/media/probe.ts`.
- Media analysis (scenes, STT, OCR, object detection, embeddings) as a downstream queue handler.
- Cloud AI providers — implement `AIProvider` in `src/lib/ai/providers/*` and register in `registry.ts`.
- Semantic search over the `media_analysis.embedding` pgvector column.

## Directory layout

```
src/
  app/
    (auth)/            login, signup, auth server actions
    (app)/             authenticated shell: dashboard, media
  components/
    ui/                shadcn-style primitives
    layout/            sidebar, theme toggle
  features/
    media/             ingest, probe, queries (domain logic)
  lib/
    ai/                provider abstraction, registry, providers
    supabase/          browser/server/admin clients, db types
    queue/             pg-boss
    env.ts, logger.ts, utils.ts, validation/
  workers/             background worker entry + folder scanner
supabase/migrations/   SQL migrations (RLS, storage)
```
