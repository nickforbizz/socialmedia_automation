-- ===========================================================================
-- 0005_social_publishing.sql — Phase 3
-- Connected social accounts (encrypted tokens) + posts publishing lifecycle.
-- Tokens are encrypted at the application layer (AES-256-GCM) before storage;
-- only ciphertext lives here, and RLS keeps rows owner-scoped.
-- ===========================================================================

create type social_platform as enum (
  'facebook', 'instagram', 'youtube', 'tiktok', 'linkedin', 'x'
);
create type account_status as enum ('connected', 'expired', 'revoked', 'error');
create type post_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed');

-- ---------------------------------------------------------------------------
-- social_accounts — one row per connected platform account/page.
-- ---------------------------------------------------------------------------
create table social_accounts (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  project_id           uuid not null references projects (id) on delete cascade,
  platform             social_platform not null,
  external_account_id  text not null,
  display_name         text,
  username             text,
  avatar_url           text,
  -- Encrypted token material (never plaintext, never sent to the client).
  access_token_cipher  text,
  refresh_token_cipher text,
  token_expires_at     timestamptz,
  scopes               text[] not null default '{}',
  status               account_status not null default 'connected',
  is_mock              boolean not null default false,
  last_checked_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (owner_id, platform, external_account_id)
);
create index social_accounts_owner_idx on social_accounts (owner_id);
create index social_accounts_project_idx on social_accounts (project_id);
create index social_accounts_platform_idx on social_accounts (owner_id, platform);

-- ---------------------------------------------------------------------------
-- posts — content targeting one platform/account, with a publish lifecycle.
-- Drafts, scheduled items and published items are all rows here, distinguished
-- by status + scheduled_for (normalized; avoids parallel draft/schedule tables).
-- ---------------------------------------------------------------------------
create table posts (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users (id) on delete cascade,
  project_id        uuid not null references projects (id) on delete cascade,
  social_account_id uuid references social_accounts (id) on delete set null,
  media_id          uuid references media (id) on delete set null,
  platform          social_platform not null,
  caption           text not null default '',
  hashtags          text[] not null default '{}',
  link              text,
  status            post_status not null default 'draft',
  scheduled_for     timestamptz,
  published_at      timestamptz,
  external_post_id  text,
  external_url      text,
  error             text,
  retry_count       int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A scheduled post must have a time; a published post must have a timestamp.
  constraint scheduled_requires_time
    check (status <> 'scheduled' or scheduled_for is not null)
);
create index posts_owner_idx on posts (owner_id);
create index posts_project_idx on posts (project_id);
create index posts_status_idx on posts (owner_id, status);
create index posts_account_idx on posts (social_account_id);
-- Fast lookup for the scheduler: due scheduled posts.
create index posts_due_idx on posts (status, scheduled_for)
  where status = 'scheduled';

-- updated_at triggers (function from 0001)
create trigger trg_social_accounts_updated before update on social_accounts
  for each row execute function set_updated_at();
create trigger trg_posts_updated before update on posts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table social_accounts enable row level security;
alter table posts           enable row level security;

create policy "social_accounts_all_own" on social_accounts for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "posts_all_own" on posts for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
