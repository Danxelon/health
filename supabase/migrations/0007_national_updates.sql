-- =============================================================================
-- Jibon Rokkha — 0007_national_updates.sql
-- National updates feed (DGHS/IEDCR announcements). Adds a public-read table
-- for campaign / alert / notice posts, wires updated_at maintenance through
-- the shared touch_updated_at() trigger, backfills the Bengali excerpt column
-- on articles, and re-issues article_feed so clients get excerpt_bn alongside
-- the existing fields.
--
-- ORDER MATTERS: the updated_at trigger is attached before article_feed is
-- recreated, and articles.excerpt_bn exists before the view selects it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM
-- -----------------------------------------------------------------------------
create type national_update_kind as enum ('campaign', 'alert', 'notice');

-- -----------------------------------------------------------------------------
-- NATIONAL UPDATES
-- Public-read by design: clients select * from national_updates directly
-- (the RLS policy is what grants row-level access; no update RPC exists).
-- Inserts and edits are admin-only via public.is_admin().
-- -----------------------------------------------------------------------------
create table national_updates (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  title_bn       text,
  body           text,
  body_bn        text,
  kind           national_update_kind not null default 'notice',
  source         text, -- e.g. 'DGHS', 'IEDCR'
  effective_from timestamptz not null default now(),
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table national_updates enable row level security;

create policy national_updates_select_public on national_updates
  for select to anon, authenticated using (true);
create policy national_updates_insert_admin on national_updates
  for insert to authenticated with check (public.is_admin());
create policy national_updates_update_admin on national_updates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- updated_at maintenance, mirroring 0003_triggers.sql for other tables
-- -----------------------------------------------------------------------------
create trigger trg_national_updates_touch before update on national_updates
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- ARTICLES
-- -----------------------------------------------------------------------------
alter table articles add column if not exists excerpt_bn text;

-- Re-issue the curated feed with the new column. security_invoker = false keeps
-- the view owner's rights, exactly as in 0002_rls.sql.
create or replace view public.article_feed
with (security_invoker = false) as
select
  a.id, a.slug, a.title, a.title_bn, a.excerpt, a.excerpt_bn, a.cover_image_path,
  a.tags, a.published_at, a.view_count, a.flagged_review,
  a.author_id,
  coalesce(pr.full_name_bn, pr.full_name) as author_name,
  pr.avatar_url as author_avatar,
  doc.degrees as author_degrees,
  sp.name_en as specialty_en, sp.name_bn as specialty_bn, sp.slug as specialty_slug,
  (select count(*) from article_reactions ar where ar.article_id = a.id) as reaction_count
from articles a
join doctors doc on doc.user_id = a.author_id
join profiles pr on pr.id = a.author_id
left join specialties sp on sp.id = doc.specialty_id
where a.status = 'published'
  and doc.verification = 'verified';

grant select on public.article_feed to anon, authenticated;

-- Clients do a raw select * from national_updates, so the table privilege is
-- granted explicitly alongside the RLS policy above.
grant select on public.national_updates to anon, authenticated;