-- ===========================================================================
-- 0001_foundation.sql — Phase 1 foundation schema
-- Tables: profiles, projects, brands, settings, media, media_analysis,
--         audit_log. pgvector installed for Phase 2 embeddings.
-- Every table is RLS-protected and scoped to the owning user.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type media_kind as enum ('video', 'image', 'audio');
create type media_status as enum ('ingesting', 'ready', 'analyzed', 'failed');
create type ai_provider as enum ('ollama', 'openrouter', 'openai', 'anthropic', 'gemini');

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects — top-level workspace owned by a user (multi-tenant seam)
-- ---------------------------------------------------------------------------
create table projects (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on projects (owner_id);

-- ---------------------------------------------------------------------------
-- brands — a voice/identity within a project
-- ---------------------------------------------------------------------------
create table brands (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  voice       text,
  default_hashtags text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index brands_project_idx on brands (project_id);
create index brands_owner_idx on brands (owner_id);

-- ---------------------------------------------------------------------------
-- settings — per-user configuration (AI provider, models, preferences)
-- ---------------------------------------------------------------------------
create table settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  text_provider      ai_provider not null default 'ollama',
  vision_provider    ai_provider not null default 'ollama',
  embedding_provider ai_provider not null default 'ollama',
  preferred_model    text,
  temperature        numeric(3, 2) not null default 0.70 check (temperature between 0 and 2),
  watch_folders      text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- media — one row per ingested file
-- ---------------------------------------------------------------------------
create table media (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  project_id    uuid not null references projects (id) on delete cascade,
  kind          media_kind not null,
  status        media_status not null default 'ingesting',
  source_path   text not null,
  storage_path  text,
  thumbnail_path text,
  content_hash  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes >= 0),
  width         int,
  height        int,
  duration_sec  numeric,
  captured_at   timestamptz,
  folder_label  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Dedup: the same file content cannot be ingested twice per owner.
  unique (owner_id, content_hash)
);
create index media_owner_idx on media (owner_id);
create index media_project_idx on media (project_id);
create index media_status_idx on media (owner_id, status);
create index media_kind_idx on media (owner_id, kind);

-- ---------------------------------------------------------------------------
-- media_analysis — AI-derived intelligence (populated in Phase 2).
-- embedding column is pgvector; nomic-embed-text = 768 dims.
-- ---------------------------------------------------------------------------
create table media_analysis (
  id             uuid primary key default gen_random_uuid(),
  media_id       uuid not null references media (id) on delete cascade,
  owner_id       uuid not null references auth.users (id) on delete cascade,
  transcript     text,
  ocr_text       text,
  objects        jsonb not null default '[]',
  scenes         jsonb not null default '[]',
  category       text,
  tone           text,
  mood           text,
  keywords       text[] not null default '{}',
  quality_score  numeric,
  viral_score    numeric,
  embedding      vector(768),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (media_id)
);
create index media_analysis_owner_idx on media_analysis (owner_id);
-- IVFFlat index for cosine similarity search (used by semantic search in Phase 2).
create index media_analysis_embedding_idx on media_analysis
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------------
-- audit_log — security/audit trail
-- ---------------------------------------------------------------------------
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_actor_idx on audit_log (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','projects','brands','settings','media','media_analysis']
  loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New-user bootstrap: create profile + settings on signup.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  insert into settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table profiles       enable row level security;
alter table projects       enable row level security;
alter table brands         enable row level security;
alter table settings       enable row level security;
alter table media          enable row level security;
alter table media_analysis enable row level security;
alter table audit_log      enable row level security;

-- profiles: a user sees and edits only their own row.
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Generic owner-scoped policies (select/insert/update/delete).
create policy "projects_all_own" on projects for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "brands_all_own" on brands for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "settings_all_own" on settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "media_all_own" on media for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "media_analysis_all_own" on media_analysis for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- audit_log: users may read their own actions; writes come from the service role.
create policy "audit_select_own" on audit_log for select using (auth.uid() = actor_id);
