-- Tracks when an account was suspended so the admin Business Overview can
-- compute a real "churn this month" figure and an honest MRR trend
-- (MRR-as-of-last-month) instead of a fabricated number. Set/cleared by
-- PATCH /admin/subscribers/{id}/status - null means never suspended, or
-- reactivated since the last suspension.

alter table subscribers add column if not exists suspended_at timestamptz;
