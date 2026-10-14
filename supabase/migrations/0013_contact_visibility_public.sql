-- =============================================================================
-- Jibon Rokkha — 0013_contact_visibility_public.sql
-- Adds 'public' to the contact_visibility enum on databases first created
-- from 0001_schema (which only had on_unlock/private_admin).
--
-- Without this, the donors seed fails with:
--   SQLSTATE 22P02: invalid input value for enum contact_visibility: "public"
-- Safe to re-run.
-- =============================================================================

do $$ begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'contact_visibility' and e.enumlabel = 'public'
  ) then
    alter type public.contact_visibility add value 'public';
  end if;
end $$;
