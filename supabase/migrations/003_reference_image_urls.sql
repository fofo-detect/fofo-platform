-- Enrollment now captures up to 8 face angles (live camera flow) instead of a
-- single upload, and the scan endpoint runs a separate Google Lens search per
-- enrolled photo. reference_image_url (singular) is kept as-is for backward
-- compatibility and as the Rekognition CompareFaces source image; this column
-- holds every enrolled photo's S3 URL for the multi-search scan step.

alter table subscribers add column if not exists reference_image_urls text[];
