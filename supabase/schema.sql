-- LDR Photobooth MVP schema — PRD §17/§18.2
-- Run in Supabase SQL editor. 4 tables only. No captures/templates tables.

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9]{6,8}$'),
  host_session_id uuid not null,
  status text not null default 'waiting'
    check (status in ('waiting','capturing','completed','expired')),
  created_at timestamptz default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  session_id uuid not null,
  display_name varchar(30) not null,
  role text not null check (role in ('host','guest')),
  joined_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique (room_id, session_id)
);

create table capture_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','countdown','completed')),
  total_shots integer not null default 4,
  current_shot integer not null default 0,
  target_times bigint[] null,
  started_at timestamptz,
  completed_at timestamptz
);

create table analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  room_id uuid null,
  event text not null,
  meta jsonb not null default '{}'
);

-- Server clock for §9 offset correction. No data leaked.
create or replace function server_time_ms()
returns bigint language sql stable as
  $$ select (extract(epoch from now()) * 1000)::bigint $$;
grant execute on function server_time_ms() to anon;

-- RLS: lock everything from anon. room-api (service_role) bypasses RLS.
alter table rooms enable row level security;
alter table participants enable row level security;
alter table capture_sessions enable row level security;
alter table analytics_events enable row level security;

-- No anon policies on rooms / participants / capture_sessions = anon denied.
-- Single exception: analytics insert-only whitelist (§30).
create policy "analytics insert only"
on analytics_events for insert to anon
with check (event in ('room_created','room_joined','camera_ready',
  'session_started','capture_completed','session_completed',
  'result_generated','result_downloaded','result_shared','session_failed'));

-- Storage: create via Dashboard or CLI, both PRIVATE, no public policies:
--   photobooth-temp  (per-shot JPEG, TTL 24h via cleanup)
--   photobooth-final (optional user-requested share, TTL 7d via cleanup)
-- Access only via signed URLs minted by room-api after session_id check.

-- Cleanup trigger: pg_cron + pg_net hourly → Edge Function `cleanup`.
-- Set app.cleanup_url / app.cleanup_key via vault/secrets first.
-- select cron.schedule(
--   'photobooth-cleanup-hourly',
--   '0 * * * *',
--   $$ select net.http_post(
--     url := current_setting('app.cleanup_url'),
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.cleanup_key'),
--       'Content-Type', 'application/json'),
--     body := '{}'::jsonb
--   ) $$);
