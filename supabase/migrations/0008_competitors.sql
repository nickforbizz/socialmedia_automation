-- ===========================================================================
-- 0008_competitors.sql — Phase 5
-- Public competitor accounts the user monitors, and observed public posts.
-- Purpose is strategic inspiration + content-gap analysis, never copying.
-- ===========================================================================

create type competitor_media_type as enum ('video', 'image', 'carousel', 'text');

create table competitors (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  project_id     uuid not null references projects (id) on delete cascade,
  platform       social_platform not null,
  handle         text not null,
  display_name   text,
  notes          text,
  is_mock        boolean not null default false,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (owner_id, platform, handle)
);
create index competitors_owner_idx on competitors (owner_id);
create index competitors_project_idx on competitors (project_id);

create table competitor_posts (
  id               uuid primary key default gen_random_uuid(),
  competitor_id    uuid not null references competitors (id) on delete cascade,
  owner_id         uuid not null references auth.users (id) on delete cascade,
  external_post_id text not null,
  posted_at        timestamptz not null,
  caption          text,
  hashtags         text[] not null default '{}',
  topics           text[] not null default '{}',
  media_type       competitor_media_type not null default 'image',
  video_length_sec numeric,
  likes            bigint not null default 0,
  comments         bigint not null default 0,
  shares           bigint not null default 0,
  permalink        text,
  created_at       timestamptz not null default now(),
  unique (competitor_id, external_post_id)
);
create index competitor_posts_competitor_idx on competitor_posts (competitor_id, posted_at desc);
create index competitor_posts_owner_idx on competitor_posts (owner_id);

create trigger trg_competitors_updated before update on competitors
  for each row execute function set_updated_at();

alter table competitors      enable row level security;
alter table competitor_posts enable row level security;

create policy "competitors_all_own" on competitors for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "competitor_posts_all_own" on competitor_posts for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
