-- FOFO platform initial schema
-- subscribers.id matches auth.users.id (Supabase Auth) so RLS can key off auth.uid().

create extension if not exists "pgcrypto";

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  phone text,
  face_vector float8[],
  -- Public URL of one enrollment photo, used as the SerpAPI Google Lens search seed.
  reference_image_url text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  plan text default 'monthly',
  created_at timestamptz default now()
);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references subscribers(id) on delete cascade,
  status text not null default 'pending',
  candidates_found int default 0,
  matches_found int default 0,
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists detections (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references subscribers(id) on delete cascade,
  scan_id uuid references scans(id) on delete cascade,
  image_url text,
  source_url text,
  platform text,
  distance_score float8,
  deepfake_score float8,
  risk_level text,
  alert_message text,
  alerted_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_scans_subscriber_id on scans(subscriber_id);
create index if not exists idx_detections_subscriber_id on detections(subscriber_id);
create index if not exists idx_detections_scan_id on detections(scan_id);
create index if not exists idx_detections_created_at on detections(created_at desc);
create index if not exists idx_subscribers_stripe_customer_id on subscribers(stripe_customer_id);

-- Row Level Security: the backend talks to Supabase with the service-role
-- (secret) key, which bypasses RLS entirely. These policies only matter if
-- the frontend ever queries these tables directly with the publishable key,
-- and scope every subscriber to their own rows.

alter table subscribers enable row level security;
alter table scans enable row level security;
alter table detections enable row level security;

create policy "subscribers_select_own" on subscribers
  for select using (auth.uid() = id);

create policy "subscribers_update_own" on subscribers
  for update using (auth.uid() = id);

create policy "scans_select_own" on scans
  for select using (auth.uid() = subscriber_id);

create policy "detections_select_own" on detections
  for select using (auth.uid() = subscriber_id);
