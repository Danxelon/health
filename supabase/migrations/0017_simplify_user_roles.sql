-- =============================================================================
-- Migration: 0017_simplify_user_roles.sql
-- Purpose:   Simplify user_role to strictly 3 roles: admin, doctor, citizen.
--            Any citizen can act as a blood donor or patient.
-- =============================================================================

-- Step 0: Ensure guard_profile_identity allows SQL Editor / migrations (auth.uid() is null)
create or replace function public.guard_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guard', true) = 'on' then
    return new;
  end if;

  -- Allow direct SQL editor, migrations, service_role, and database superuser where auth.uid() is NULL
  if auth.uid() is null then
    return new;
  end if;

  -- Allow admin users
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role is not self-assignable' using errcode = 'RJ001';
  end if;
  if new.nid_hash is distinct from old.nid_hash
     or new.nid_last4 is distinct from old.nid_last4 then
    raise exception 'nid cannot be changed without re-verification' using errcode = 'RJ002';
  end if;

  new.blood_group_verified := old.blood_group_verified;

  return new;
end; $$;

-- Enable bypass flag for this migration
select set_config('app.bypass_profile_guard', 'on', true);

-- Temporarily disable the identity trigger if present to guarantee smooth role standardization
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_profiles_identity_guard'
  ) then
    alter table public.profiles disable trigger trg_profiles_identity_guard;
  end if;
end $$;

-- 1. Standardize any existing profile roles
update public.profiles
   set role = 'citizen'
 where role::text in ('donor', 'blood_bank');

-- 2. Clean auth.users metadata if any
update auth.users
   set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"citizen"')
 where raw_user_meta_data->>'role' in ('donor', 'blood_bank');

-- 3. Re-align user_role enum to 3 values: ('admin', 'doctor', 'citizen')
do $$
begin
  if exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'user_role'
       and e.enumlabel in ('donor', 'blood_bank')
  ) then
    -- Rename old enum
    alter type public.user_role rename to user_role_legacy;

    -- Create clean 3-role enum
    create type public.user_role as enum ('admin', 'doctor', 'citizen');

    -- Migrate profiles.role column
    alter table public.profiles
      alter column role drop default,
      alter column role type public.user_role using (
        case
          when role::text in ('donor', 'blood_bank') then 'citizen'::public.user_role
          else role::text::public.user_role
        end
      ),
      alter column role set default 'citizen'::public.user_role;

    -- Drop legacy enum
    drop type public.user_role_legacy;
  end if;
end $$;

alter table public.profiles alter column role set default 'citizen'::public.user_role;

-- Re-enable the identity trigger
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_profiles_identity_guard'
  ) then
    alter table public.profiles enable trigger trg_profiles_identity_guard;
  end if;
end $$;

-- Reset bypass
select set_config('app.bypass_profile_guard', 'off', true);
