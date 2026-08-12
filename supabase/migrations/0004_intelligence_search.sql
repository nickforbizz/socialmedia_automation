-- ===========================================================================
-- 0004_intelligence_search.sql — Phase 2
-- AI media intelligence (regenerable generated content), user-overridable
-- prompt templates, and a pgvector similarity RPC for semantic search.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- media_intelligence — generated, regenerable content for a media item.
-- One current row per media (regeneration upserts). Factual analysis stays in
-- media_analysis; this table is the "creative" output layer.
-- ---------------------------------------------------------------------------
create table media_intelligence (
  id                     uuid primary key default gen_random_uuid(),
  media_id               uuid not null references media (id) on delete cascade,
  owner_id               uuid not null references auth.users (id) on delete cascade,
  titles                 text[] not null default '{}',
  hooks                  text[] not null default '{}',
  captions               text[] not null default '{}',
  descriptions           text[] not null default '{}',
  hashtags               text[] not null default '{}',
  ctas                   text[] not null default '{}',
  thumbnail_ideas        text[] not null default '{}',
  best_cover_frame_sec   numeric,
  target_audience        text,
  recommended_platforms  text[] not null default '{}',
  engagement_prediction  jsonb not null default '{}',
  provider               text,
  model                  text,
  generated_at           timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (media_id)
);
create index media_intelligence_owner_idx on media_intelligence (owner_id);

-- ---------------------------------------------------------------------------
-- prompt_templates — user-overridable prompts. owner_id null = system default.
-- The app ships code defaults and reads overrides from here when present.
-- ---------------------------------------------------------------------------
create table prompt_templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users (id) on delete cascade,
  key         text not null,
  version     int  not null default 1,
  template    text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, key)
);
create index prompt_templates_key_idx on prompt_templates (key);

-- updated_at triggers (function defined in 0001)
create trigger trg_media_intelligence_updated before update on media_intelligence
  for each row execute function set_updated_at();
create trigger trg_prompt_templates_updated before update on prompt_templates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Semantic search RPC. SECURITY INVOKER so RLS applies; the explicit
-- owner filter keeps results scoped even if called directly. Returns media ids
-- ranked by cosine similarity to the query embedding.
-- ---------------------------------------------------------------------------
create or replace function match_media_analysis(
  query_embedding vector(768),
  match_count int default 12
)
returns table (media_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select ma.media_id, 1 - (ma.embedding <=> query_embedding) as similarity
  from media_analysis ma
  where ma.embedding is not null
    and ma.owner_id = auth.uid()
  order by ma.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table media_intelligence enable row level security;
alter table prompt_templates   enable row level security;

create policy "media_intelligence_all_own" on media_intelligence for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- prompt_templates: read own + system defaults; write only own rows.
create policy "prompt_templates_select" on prompt_templates for select
  using (owner_id is null or owner_id = auth.uid());
create policy "prompt_templates_insert_own" on prompt_templates for insert
  with check (owner_id = auth.uid());
create policy "prompt_templates_update_own" on prompt_templates for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "prompt_templates_delete_own" on prompt_templates for delete
  using (owner_id = auth.uid());
