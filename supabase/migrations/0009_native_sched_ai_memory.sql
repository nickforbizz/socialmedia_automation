-- ===========================================================================
-- 0009_native_sched_ai_memory.sql — Phase 6
-- (1) Native platform scheduling flag on posts (platform holds the schedule).
-- (2) AI assistant conversation memory.
-- ===========================================================================

-- (1) When true, the post was handed to the platform's own scheduler (e.g.
-- Facebook scheduled_publish_time) — our worker must NOT publish it.
alter table posts add column native_scheduled boolean not null default false;

-- (2) Assistant conversations + messages.
create type ai_message_role as enum ('user', 'assistant', 'system');

create table ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_owner_idx on ai_conversations (owner_id, updated_at desc);

create table ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,
  owner_id        uuid not null references auth.users (id) on delete cascade,
  role            ai_message_role not null,
  content         text not null,
  created_at      timestamptz not null default now()
);
create index ai_messages_conversation_idx on ai_messages (conversation_id, created_at);

create trigger trg_ai_conversations_updated before update on ai_conversations
  for each row execute function set_updated_at();

alter table ai_conversations enable row level security;
alter table ai_messages      enable row level security;

create policy "ai_conversations_all_own" on ai_conversations for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "ai_messages_all_own" on ai_messages for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
