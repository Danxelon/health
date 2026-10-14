-- =============================================================================
-- Jibon Rokkha — 0014_auth_token_defaults.sql
-- Repairs GoTrue logins for auth.users rows inserted via SQL.
--
-- Symptom in Auth logs:
--   "Database error finding user: sql: Scan error on column index 2,
--    name confirmation token: converting NULL to string is unsupported"
-- Cause: manual INSERTs (seeds, admin, doctors, real accounts) leave GoTrue
-- token columns NULL; GoTrue scans them as non-nullable strings and every
-- email lookup for those rows fails. Backfill once, idempotently.
-- Safe to re-run.
-- =============================================================================

update auth.users set confirmation_token = '' where confirmation_token is null;
update auth.users set recovery_token = '' where recovery_token is null;
update auth.users set email_change_token_current = '' where email_change_token_current is null;
update auth.users set email_change_token_new = '' where email_change_token_new is null;
update auth.users set phone_change_token = '' where phone_change_token is null;
