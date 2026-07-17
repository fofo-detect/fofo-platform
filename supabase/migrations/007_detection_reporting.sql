-- Tracks whether a subscriber has reported a detection to the platform it
-- was found on, via the dashboard's Report button.

alter table detections add column if not exists reported boolean not null default false;
alter table detections add column if not exists reported_at timestamptz;
