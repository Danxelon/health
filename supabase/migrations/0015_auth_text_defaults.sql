-- =============================================================================
-- Jibon Rokkha — 0015_auth_text_defaults.sql
-- Backfills every GoTrue text column on SQL-inserted auth.users rows.
--
-- Symptom in Auth logs (POST /token → 500):
--   "Error finding user: sql: Scan error on column index N, name
--    '<confirmation token|email change|...>': converting NULL to string
--    is unsupported"
-- Cause: manual INSERTs leave GoTrue text columns NULL; GoTrue scans them as
-- non-nullable strings, so each fixed column just reveals the next NULL one.
-- This covers the whole known set in one idempotent block. Safe to re-run.
-- =============================================================================

do $$
declare
  c text;
begin
  foreach c in array array['confirmation_token','recovery_token','email_change_token_current','email_change_token_new','email_change','phone_change','phone_change_token','reauthentication_token'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = c) then
      execute format('update auth.users set %I = %L where %I is null', c, '', c);
    end if;
  end loop;
end $$;
