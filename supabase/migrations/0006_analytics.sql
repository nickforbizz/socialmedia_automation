-- ===========================================================================
-- 0006_analytics.sql — Phase 4
-- Time-series metrics for posts and accounts, plus a latest-per-post view.
-- Snapshots accumulate over time so we can chart trends and compute growth.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- post_metrics — one snapshot of a post's metrics at a point in time.
-- ---------------------------------------------------------------------------
create table post_metrics (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references posts (id) on delete cascade,
  owner_id       uuid not null references auth.users (id) on delete cascade,
  captured_at    timestamptz not null default now(),
  impressions    bigint not null default 0,
  reach          bigint not null default 0,
  views          bigint not null default 0,
  watch_time_sec bigint not null default 0,
  likes          bigint not null default 0,
  comments       bigint not null default 0,
  shares         bigint not null default 0,
  saves          bigint not null default 0,
  clicks         bigint not null default 0
);
create index post_metrics_post_idx on post_metrics (post_id, captured_at desc);
create index post_metrics_owner_time_idx on post_metrics (owner_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- account_metrics — follower/account snapshots over time.
-- ---------------------------------------------------------------------------
create table account_metrics (
  id                uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references social_accounts (id) on delete cascade,
  owner_id          uuid not null references auth.users (id) on delete cascade,
  captured_at       timestamptz not null default now(),
  followers         bigint not null default 0,
  following         bigint not null default 0,
  posts_count       bigint not null default 0
);
create index account_metrics_acct_idx on account_metrics (social_account_id, captured_at desc);
create index account_metrics_owner_time_idx on account_metrics (owner_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- Latest snapshot per post. security_invoker makes the view honor the querying
-- user's RLS on post_metrics (Postgres 15+ / Supabase).
-- ---------------------------------------------------------------------------
create view post_metrics_latest
with (security_invoker = on)
as
select distinct on (pm.post_id)
  pm.post_id,
  pm.owner_id,
  pm.captured_at,
  pm.impressions,
  pm.reach,
  pm.views,
  pm.watch_time_sec,
  pm.likes,
  pm.comments,
  pm.shares,
  pm.saves,
  pm.clicks
from post_metrics pm
order by pm.post_id, pm.captured_at desc;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table post_metrics    enable row level security;
alter table account_metrics enable row level security;

create policy "post_metrics_all_own" on post_metrics for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "account_metrics_all_own" on account_metrics for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
