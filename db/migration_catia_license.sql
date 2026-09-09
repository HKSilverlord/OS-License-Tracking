-- =============================================================
-- CATIA License Data — server-side persistence (defect A4)
--
-- run in Supabase SQL editor after migration_rbac.sql
-- (that migration creates public.get_my_role(), used by the
--  write policy below).
--
-- Idempotent: safe to run more than once.
-- =============================================================

-- -------------------------------------------------------
-- 1. Table (single 'default' row holds the whole document)
-- -------------------------------------------------------
create table if not exists public.catia_license_data (
  id               text primary key default 'default',
  -- Record<licenseId, (number|null)[52]>  — man-yen per month slot
  license_costs    jsonb not null default '{}'::jsonb,
  -- Record<licenseId, Record<year, number|null>>  — man-yen per year
  license_revenues jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now(),
  updated_by       uuid null references auth.users(id)
);

-- -------------------------------------------------------
-- 2. RLS: read for any authenticated user, write for admins
--    (same pattern as db/migration_rbac.sql)
-- -------------------------------------------------------
alter table public.catia_license_data enable row level security;

drop policy if exists "catia_read" on public.catia_license_data;
drop policy if exists "catia_admin_write" on public.catia_license_data;

create policy "catia_read"
  on public.catia_license_data for select
  to authenticated
  using (true);

-- `for all` covers insert / update / delete. SELECT is still open to every
-- authenticated user because permissive policies are OR-ed with "catia_read".
create policy "catia_admin_write"
  on public.catia_license_data for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- -------------------------------------------------------
-- 3. Seed the single document row
-- -------------------------------------------------------
insert into public.catia_license_data (id)
values ('default')
on conflict (id) do nothing;

-- Verify with:
--   select id, jsonb_object_keys(license_costs), updated_at
--   from public.catia_license_data;
