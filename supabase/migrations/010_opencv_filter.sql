-- Tracks how many candidate images the OpenCV Haar Cascade pre-filter
-- rejected (no face detected locally) before they ever reached a billed
-- AWS Rekognition CompareFaces call, for the admin Scan Operations page.

alter table scans add column if not exists opencv_filtered integer not null default 0;
