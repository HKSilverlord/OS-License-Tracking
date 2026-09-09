-- =============================================================================
-- OS License Tracking - base database schema
-- =============================================================================
-- Target: Supabase / PostgreSQL 15+ (gen_random_uuid() is built in).
-- Run this FIRST in the Supabase SQL Editor. See db/SETUP_GUIDE.md.
--
-- This script is IDEMPOTENT: it can be re-run on an existing database without
-- destroying data. Tables use `create table if not exists`, columns are added
-- with `add column if not exists`, and every policy is dropped before it is
-- re-created.
--
-- Data model
--   periods            one row per half-year, e.g. '2025-H1'
--   projects           the project catalogue
--   period_projects    junction; holds the AUTHORITATIVE per-period prices
--   monthly_records    planned / actual hours per (project, period, year, month)
--   settings           single-row app configuration (label = 'default')
--   user_roles         admin | user, read through public.get_my_role()
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Roles helper (must exist before any policy can reference it)
-- -----------------------------------------------------------------------------
-- db/migration_rbac.sql creates the same objects. They are repeated here so a
-- brand-new database can be provisioned from this single file.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null check (role in ('admin', 'user'))
);

alter table public.user_roles enable row level security;

-- Every user may read their own role. There is deliberately NO "admin full"
-- policy: it caused infinite recursion (db/migration_fix_rbac_recursion.sql).
-- Manage roles from the SQL editor or with the service-role key.
drop policy if exists "user_roles: read own" on public.user_roles;
create policy "user_roles: read own"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- security definer => bypasses RLS, so it never recurses into user_roles policies.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
as $$
  select role from public.user_roles where user_id = auth.uid();
$$;


-- -----------------------------------------------------------------------------
-- 1. periods
-- -----------------------------------------------------------------------------
create table if not exists public.periods (
  label      text primary key,                 -- 'YYYY-H1' | 'YYYY-H2'
  year       integer not null,
  half       text    not null check (half in ('H1', 'H2')),
  created_at timestamptz not null default now()
);

create index if not exists periods_year_idx on public.periods (year);


-- -----------------------------------------------------------------------------
-- 2. projects
-- -----------------------------------------------------------------------------
-- `code` is NOT globally unique: db/import_2025_data.sql deliberately creates a
-- separate project row per period reusing the same code, and looks projects up
-- by (code, period). The uniqueness that actually holds is (code, period).
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  name           text not null,
  type           text default '',
  software       text default '',
  status         text not null default 'active'
                 check (status in ('active', 'completed', 'pending', 'archived')),
  unit_price     numeric default 0,      -- @deprecated, kept for legacy rows
  plan_price     numeric default 0,      -- global fallback; period_projects wins
  actual_price   numeric default 0,      -- global fallback; period_projects wins
  notes          text default '',        -- 補足
  exclusion_mark text default '',        -- 除外記号
  display_order  integer,                -- lower sorts first; null is read as 0
  period         text,                   -- convenience label, e.g. '2025-H1'
  created_at     timestamptz not null default now()
);

-- Added defensively so this file stays runnable against older installs.
alter table public.projects add column if not exists notes          text default '';
alter table public.projects add column if not exists exclusion_mark text default '';
alter table public.projects add column if not exists display_order  integer;
alter table public.projects add column if not exists plan_price     numeric default 0;
alter table public.projects add column if not exists actual_price   numeric default 0;
alter table public.projects add column if not exists period         text;

create unique index if not exists projects_code_period_key on public.projects (code, period);
create index if not exists projects_display_order_idx on public.projects (display_order);
create index if not exists projects_period_idx        on public.projects (period);


-- -----------------------------------------------------------------------------
-- 3. period_projects  (junction - AUTHORITATIVE per-period prices)
-- -----------------------------------------------------------------------------
-- plan_price / actual_price are NULLABLE on purpose: the app resolves them with
-- `pp.plan_price ?? project.plan_price`, so NULL means "inherit the project's
-- global price" and is meaningfully different from 0.
create table if not exists public.period_projects (
  period_label text not null references public.periods(label)
                 on update cascade on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  plan_price   numeric,
  actual_price numeric,
  created_at   timestamptz not null default now(),
  primary key (period_label, project_id)
);

create index if not exists period_projects_project_id_idx   on public.period_projects (project_id);
create index if not exists period_projects_period_label_idx on public.period_projects (period_label);


-- -----------------------------------------------------------------------------
-- 4. monthly_records
-- -----------------------------------------------------------------------------
-- The unique key MUST match services/RecordService.ts:
--   .upsert(payload, { onConflict: 'project_id,period_label,year,month' })
-- period_label is intentionally NOT a foreign key: upsertRecord derives the
-- label from (year, month) and may write it before the period row exists.
create table if not exists public.monthly_records (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  period_label  text not null,
  year          integer not null,
  month         integer not null check (month between 1 and 12),
  planned_hours numeric not null default 0,
  actual_hours  numeric not null default 0,
  created_at    timestamptz not null default now(),
  constraint monthly_records_project_period_year_month_key
    unique (project_id, period_label, year, month)
);

create index if not exists monthly_records_year_idx         on public.monthly_records (year);
create index if not exists monthly_records_project_id_idx   on public.monthly_records (project_id);
create index if not exists monthly_records_period_label_idx on public.monthly_records (period_label);


-- -----------------------------------------------------------------------------
-- 5. settings  (single row, label = 'default')
-- -----------------------------------------------------------------------------
-- Column names must match services/DashboardService.ts getSettings/saveSettings.
create table if not exists public.settings (
  label                text primary key default 'default',
  exchange_rate        numeric not null default 165,
  license_computers    integer not null default 7,
  license_per_computer numeric not null default 2517143,
  unit_price           numeric not null default 2300,
  updated_at           timestamptz not null default now()
);

insert into public.settings (label, exchange_rate, license_computers, license_per_computer, unit_price)
values ('default', 165, 7, 2517143, 2300)
on conflict (label) do nothing;


-- =============================================================================
-- 6. Row Level Security
-- =============================================================================
-- Pattern (identical to db/migration_rbac.sql):
--   SELECT                   -> any authenticated user
--   INSERT / UPDATE / DELETE -> public.get_my_role() = 'admin'
-- Anonymous users get nothing.

alter table public.periods         enable row level security;
alter table public.projects        enable row level security;
alter table public.period_projects enable row level security;
alter table public.monthly_records enable row level security;
alter table public.settings        enable row level security;

-- periods ---------------------------------------------------------------------
drop policy if exists "periods: authenticated read" on public.periods;
drop policy if exists "periods: admin write"        on public.periods;
drop policy if exists "periods: admin update"       on public.periods;
drop policy if exists "periods: admin delete"       on public.periods;

create policy "periods: authenticated read"
  on public.periods for select to authenticated using (true);
create policy "periods: admin write"
  on public.periods for insert to authenticated with check (public.get_my_role() = 'admin');
create policy "periods: admin update"
  on public.periods for update to authenticated using (public.get_my_role() = 'admin');
create policy "periods: admin delete"
  on public.periods for delete to authenticated using (public.get_my_role() = 'admin');

-- projects --------------------------------------------------------------------
drop policy if exists "projects: authenticated read" on public.projects;
drop policy if exists "projects: admin write"        on public.projects;
drop policy if exists "projects: admin update"       on public.projects;
drop policy if exists "projects: admin delete"       on public.projects;

create policy "projects: authenticated read"
  on public.projects for select to authenticated using (true);
create policy "projects: admin write"
  on public.projects for insert to authenticated with check (public.get_my_role() = 'admin');
create policy "projects: admin update"
  on public.projects for update to authenticated using (public.get_my_role() = 'admin');
create policy "projects: admin delete"
  on public.projects for delete to authenticated using (public.get_my_role() = 'admin');

-- period_projects -------------------------------------------------------------
drop policy if exists "period_projects: authenticated read" on public.period_projects;
drop policy if exists "period_projects: admin write"        on public.period_projects;
drop policy if exists "period_projects: admin update"       on public.period_projects;
drop policy if exists "period_projects: admin delete"       on public.period_projects;

create policy "period_projects: authenticated read"
  on public.period_projects for select to authenticated using (true);
create policy "period_projects: admin write"
  on public.period_projects for insert to authenticated with check (public.get_my_role() = 'admin');
create policy "period_projects: admin update"
  on public.period_projects for update to authenticated using (public.get_my_role() = 'admin');
create policy "period_projects: admin delete"
  on public.period_projects for delete to authenticated using (public.get_my_role() = 'admin');

-- monthly_records -------------------------------------------------------------
drop policy if exists "monthly_records: authenticated read" on public.monthly_records;
drop policy if exists "monthly_records: admin write"        on public.monthly_records;
drop policy if exists "monthly_records: admin update"       on public.monthly_records;
drop policy if exists "monthly_records: admin delete"       on public.monthly_records;

create policy "monthly_records: authenticated read"
  on public.monthly_records for select to authenticated using (true);
create policy "monthly_records: admin write"
  on public.monthly_records for insert to authenticated with check (public.get_my_role() = 'admin');
create policy "monthly_records: admin update"
  on public.monthly_records for update to authenticated using (public.get_my_role() = 'admin');
create policy "monthly_records: admin delete"
  on public.monthly_records for delete to authenticated using (public.get_my_role() = 'admin');

-- settings --------------------------------------------------------------------
drop policy if exists "settings: authenticated read" on public.settings;
drop policy if exists "settings: admin write"        on public.settings;
drop policy if exists "settings: admin update"       on public.settings;
drop policy if exists "settings: admin delete"       on public.settings;

create policy "settings: authenticated read"
  on public.settings for select to authenticated using (true);
create policy "settings: admin write"
  on public.settings for insert to authenticated with check (public.get_my_role() = 'admin');
create policy "settings: admin update"
  on public.settings for update to authenticated using (public.get_my_role() = 'admin');
create policy "settings: admin delete"
  on public.settings for delete to authenticated using (public.get_my_role() = 'admin');


-- =============================================================================
-- 7. Seed the first administrator
-- =============================================================================
-- Create the user in Authentication > Users first, then run the statement below
-- with that user's own email address. Without at least one admin row the whole
-- application is read-only.
--
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'you@example.com'
--   on conflict (user_id) do update set role = excluded.role;
--
-- Verify:
--   select * from public.user_roles;
--   select public.get_my_role();   -- run while logged in as that user
-- =============================================================================
