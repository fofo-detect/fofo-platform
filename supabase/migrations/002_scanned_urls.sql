-- Cross-scan URL dedup: once a candidate URL has been checked for a
-- subscriber, it is never re-downloaded or re-compared in a later scan,
-- regardless of whether it turned out to be a match. This is what lets each
-- day's scan only spend API calls on URLs never seen before, building
-- cumulative internet coverage over time instead of re-paying for the same
-- Rekognition/Sightengine/Claude calls on every run.

create table if not exists scanned_urls (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references subscribers(id) on delete cascade,
  url text not null,
  first_checked_at timestamptz default now(),
  unique (subscriber_id, url)
);

create index if not exists idx_scanned_urls_subscriber_id on scanned_urls(subscriber_id);

alter table scanned_urls enable row level security;

create policy "scanned_urls_select_own" on scanned_urls
  for select using (auth.uid() = subscriber_id);
