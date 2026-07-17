-- Tracks which search source found each detection (google_lens, bing,
-- yandex, youtube, or the name-based text-search pipeline), distinct from
-- `platform` which records which website/app the image was found on.

alter table detections add column if not exists source text;
