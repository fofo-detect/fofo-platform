-- Per-risk-level WhatsApp alert toggles, editable from the dashboard's Alert
-- Settings page. Default matches the previously hardcoded ALERTABLE_RISK_LEVELS
-- behavior in scan.py (HIGH/CRITICAL only) so applying this migration does not
-- silently change alerting for existing subscribers.

alter table subscribers add column if not exists alert_preferences jsonb
  default '{"LOW": false, "MEDIUM": false, "HIGH": true, "CRITICAL": true}'::jsonb;
