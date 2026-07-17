-- Optional profession field, captured at signup, used to make the
-- name-based deepfake text searches more targeted (e.g. "[name] actor
-- deepfake" instead of just "[name] deepfake").

alter table subscribers add column if not exists profession text;
