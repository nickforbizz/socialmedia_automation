-- ===========================================================================
-- 0007_pending_connections.sql — Phase 3 addendum
-- Multi-page platforms (Facebook Pages, Instagram Business) return several
-- targets from one OAuth. We stash the candidate options (with per-page tokens
-- encrypted at the app layer) between the callback and the user's page choice.
-- One pending row per (owner, platform); it's deleted once a page is selected.
-- ===========================================================================

create table pending_connections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  platform   social_platform not null,
  -- [{ id, name, category, token_cipher, expires_at }] — token_cipher is
  -- AES-256-GCM ciphertext, never plaintext.
  options    jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (owner_id, platform)
);
create index pending_connections_owner_idx on pending_connections (owner_id);

alter table pending_connections enable row level security;

create policy "pending_connections_all_own" on pending_connections for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
