-- =============================================================
-- Business status report (事業状況報告) — written content per month
--
-- Run in the Supabase SQL editor after db/schema.sql (which creates
-- public.get_my_role(), used by the write policies below).
--
-- The report page works out every figure (hours, revenue, rates) from
-- the tracking tables. This table stores only what people write: the
-- highlight, customer status, focus projects, training, staffing and
-- actions. One row per report month; `content` is the ReportContent
-- document described in utils/reportModel.ts.
--
-- Idempotent: safe to run more than once.
-- =============================================================

-- -------------------------------------------------------
-- 1. Table
-- -------------------------------------------------------
create table if not exists public.business_reports (
  id          text primary key,                -- 'YYYY-MM', e.g. '2026-09'
  year        integer not null,
  month       integer not null,
  content     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references auth.users(id) on delete set null
);

-- Keep the key, year and month consistent. Added separately so that a
-- table created by an earlier run of this file gets them too.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'business_reports_id_format'
      and conrelid = 'public.business_reports'::regclass
  ) then
    alter table public.business_reports
      add constraint business_reports_id_format
      check (id ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'business_reports_id_matches'
      and conrelid = 'public.business_reports'::regclass
  ) then
    alter table public.business_reports
      add constraint business_reports_id_matches
      check (id = lpad(year::text, 4, '0') || '-' || lpad(month::text, 2, '0'));
  end if;
end
$$;

-- -------------------------------------------------------
-- 2. Stamp who saved it and when
--    The client sends updated_at, but the server's clock and
--    auth.uid() are the ones that count.
-- -------------------------------------------------------
create or replace function public.business_reports_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists business_reports_stamp on public.business_reports;
create trigger business_reports_stamp
  before insert or update on public.business_reports
  for each row execute function public.business_reports_stamp();

-- -------------------------------------------------------
-- 3. Row Level Security (same pattern as db/schema.sql):
--      SELECT                   -> any authenticated user
--      INSERT / UPDATE / DELETE -> public.get_my_role() = 'admin'
--    Anonymous users get nothing.
-- -------------------------------------------------------
alter table public.business_reports enable row level security;

drop policy if exists "business_reports: authenticated read" on public.business_reports;
drop policy if exists "business_reports: admin write"        on public.business_reports;
drop policy if exists "business_reports: admin update"       on public.business_reports;
drop policy if exists "business_reports: admin delete"       on public.business_reports;

create policy "business_reports: authenticated read"
  on public.business_reports for select to authenticated using (true);
create policy "business_reports: admin write"
  on public.business_reports for insert to authenticated with check (public.get_my_role() = 'admin');
create policy "business_reports: admin update"
  on public.business_reports for update to authenticated
  using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
create policy "business_reports: admin delete"
  on public.business_reports for delete to authenticated using (public.get_my_role() = 'admin');

-- Verify with:
--   select id, updated_at, updated_by from public.business_reports order by id desc;
