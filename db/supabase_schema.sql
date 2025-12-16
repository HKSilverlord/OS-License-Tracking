-- Supabase schema for OS Management System
-- Run this in the SQL editor. It avoids seeding any real project data so you don't expose private info.

-- UUID helper (available by default in Supabase, but keep idempotent)
create extension if not exists "pgcrypto";

-- ENUMS
create type if not exists public.project_status as enum ('active', 'completed', 'pending', 'archived');
create type if not exists public.period_half as enum ('H1', 'H2');

-- PROJECTS
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null,
  software text not null,
  status public.project_status not null default 'active',
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- PERIODS (list of labels like 2024-H2 that the UI can select)
create table if not exists public.periods (
  label text primary key,
  year integer not null check (year >= 2000),
  half public.period_half not null,
  created_at timestamptz not null default now(),
  unique (year, half)
);

-- Helper to keep updated_at in sync
create or replace function public.trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- MONTHLY RECORDS (hours per project per month/period)
create table if not exists public.monthly_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period_label text not null references public.periods(label) on delete cascade,
  year integer not null check (year >= 2000),
  month integer not null check (month between 1 and 12),
  planned_hours numeric(12,2) not null default 0,
  actual_hours numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, period_label, year, month)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_monthly_records_updated_at') then
    create trigger set_monthly_records_updated_at
    before update on public.monthly_records
    for each row execute function public.trigger_set_timestamp();
  end if;
end $$;

create index if not exists idx_monthly_records_period on public.monthly_records(period_label);
create index if not exists idx_monthly_records_year on public.monthly_records(year);

-- SETTINGS (exchange rate and license info)
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  exchange_rate integer not null default 165,
  license_computers integer not null default 7,
  license_per_computer integer not null default 2517143,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_settings_updated_at') then
    create trigger set_settings_updated_at
    before update on public.settings
    for each row execute function public.trigger_set_timestamp();
  end if;
end $$;

-- Seed only structural rows (no real project data)
insert into public.periods (label, year, half) values
  ('2024-H2', 2024, 'H2'),
  ('2025-H1', 2025, 'H1'),
  ('2025-H2', 2025, 'H2')
on conflict (label) do nothing;

insert into public.settings (label, exchange_rate, license_computers, license_per_computer)
values ('default', 165, 7, 2517143)
on conflict (label) do update
set exchange_rate = excluded.exchange_rate,
    license_computers = excluded.license_computers,
    license_per_computer = excluded.license_per_computer,
    updated_at = now();

-- RLS: allow only authenticated users. Adjust policies to match your auth needs.
alter table public.projects enable row level security;
alter table public.periods enable row level security;
alter table public.monthly_records enable row level security;
alter table public.settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Projects authenticated rw') then
    create policy "Projects authenticated rw"
    on public.projects for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Periods authenticated rw') then
    create policy "Periods authenticated rw"
    on public.periods for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Monthly records authenticated rw') then
    create policy "Monthly records authenticated rw"
    on public.monthly_records for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Settings authenticated rw') then
    create policy "Settings authenticated rw"
    on public.settings for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
  end if;
end $$;
