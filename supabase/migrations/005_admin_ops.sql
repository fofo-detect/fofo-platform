-- Admin dashboard support: account suspension, scan failure reasons, and a
-- lightweight self-tracked external API call log (none of SerpAPI/AWS/
-- Sightengine/Anthropic/YouTube expose a simple "calls this month" API, so
-- the backend logs its own calls here instead of fabricating numbers).

alter table subscribers add column if not exists account_status text not null default 'active';
-- 'active' | 'suspended'

alter table scans add column if not exists error_message text;

create table if not exists api_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  -- 'serpapi' | 'youtube' | 'rekognition' | 'sightengine' | 'anthropic'
  created_at timestamptz default now()
);

create index if not exists idx_api_usage_events_provider_created_at
  on api_usage_events(provider, created_at desc);

alter table api_usage_events enable row level security;
-- No select policy: this table is only ever read by the backend via the
-- service-role key (admin dashboard), never by a subscriber-facing client.
