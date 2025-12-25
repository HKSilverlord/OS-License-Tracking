-- Full Supabase setup: schema + seed data (from data2024h1and2025.csv)
-- Run this once in the Supabase SQL editor. It is idempotent where practical.

-- Extensions
create extension if not exists "pgcrypto";

-- ENUMS (wrapped in DO blocks for compatibility where IF NOT EXISTS on TYPE is not supported)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('active', 'completed', 'pending', 'archived');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'period_half') then
    create type public.period_half as enum ('H1', 'H2');
  end if;
end $$;

-- TABLES
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

create table if not exists public.periods (
  label text primary key,
  year integer not null check (year >= 2000),
  half public.period_half not null,
  created_at timestamptz not null default now(),
  unique (year, half)
);

-- Timestamp helper
create or replace function public.trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  exchange_rate integer not null default 165,
  license_computers integer not null default 7,
  license_per_computer integer not null default 2517143,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Triggers
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_monthly_records_updated_at') then
    create trigger set_monthly_records_updated_at
    before update on public.monthly_records
    for each row execute function public.trigger_set_timestamp();
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_settings_updated_at') then
    create trigger set_settings_updated_at
    before update on public.settings
    for each row execute function public.trigger_set_timestamp();
  end if;
end $$;

-- Indexes
create index if not exists idx_monthly_records_period on public.monthly_records(period_label);
create index if not exists idx_monthly_records_year on public.monthly_records(year);

-- RLS enable
alter table public.projects enable row level security;
alter table public.periods enable row level security;
alter table public.monthly_records enable row level security;
alter table public.settings enable row level security;

-- RLS policies (authenticated role read/write; adjust to your needs)
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

-- Seed: periods
insert into public.periods (label, year, half)
values
  ('2024-H2', 2024, 'H2'),
  ('2025-H1', 2025, 'H1'),
  ('2025-H2', 2025, 'H2')
on conflict (label) do nothing;

-- Seed: settings
insert into public.settings (label, exchange_rate, license_computers, license_per_computer)
values ('default', 165, 7, 2517143)
on conflict (label) do update
set exchange_rate = excluded.exchange_rate,
    license_computers = excluded.license_computers,
    license_per_computer = excluded.license_per_computer,
    updated_at = now();

-- Seed: projects and monthly records (from data2024h1and2025.csv)
with proj as (
  insert into public.projects (code, name, type, software, status, unit_price)
  values
    ('PRJ-001','ISJ (A)','Mechanical Design','CATIA','active',2300),
    ('PRJ-002','ISJ (B)','Mechanical Design','CATIA','active',2300),
    ('PRJ-003','ISJ (C)','Mechanical Design','ICAD','active',2300),
    ('PRJ-004','GLW (LM)','Mechanical Design','CATIA','active',2300),
    ('PRJ-005','GLW (FALTEC)','Mechanical Design','CATIA','active',2300),
    ('PRJ-006','GLW (?)','Mechanical Design','CATIA','active',2300),
    ('PRJ-007','NX/CATIA mixed','Mechanical Design','CATIA','active',2300),
    ('PRJ-008','GNN(5P45)','Mechanical Design','CATIA','active',2300),
    ('PRJ-009','GNN(H60E)','Mechanical Design','CATIA','active',2300),
    ('PRJ-010','GNN(L53M)','Mechanical Design','CATIA','active',2300),
    ('PRJ-011','GNN(33FY)','Mechanical Design','CATIA','active',2300),
    ('PRJ-012','Project 12 (CATIA)','Mechanical Design','CATIA','active',2300),
    ('PRJ-013','VUTEQ','Mechanical Design','CATIA','active',2300),
    ('PRJ-014','GNN(W13G) A','Mechanical Design','CATIA','active',2300),
    ('PRJ-015','GNN(W13G) B','Mechanical Design','CATIA','active',2300),
    ('PRJ-016','ICAD Project','Mechanical Design','ICAD','active',2300)
  on conflict (code) do update
    set name = excluded.name,
        type = excluded.type,
        software = excluded.software,
        unit_price = excluded.unit_price,
        status = 'active'
  returning id, code
)
insert into public.monthly_records (project_id, period_label, year, month, planned_hours, actual_hours)
select p.id, v.period_label, v.year, v.month, v.planned_hours, v.actual_hours
from (
  values
  -- PRJ-001 ISJ (A)
  ('PRJ-001','2024-H2',2024,8,0,0),('PRJ-001','2024-H2',2024,9,50,0),('PRJ-001','2024-H2',2024,10,50,0),('PRJ-001','2024-H2',2024,11,100,0),('PRJ-001','2024-H2',2024,12,100,0),
  ('PRJ-001','2025-H1',2025,1,130,80),('PRJ-001','2025-H1',2025,2,160,152),('PRJ-001','2025-H1',2025,3,160,160),('PRJ-001','2025-H1',2025,4,160,152),('PRJ-001','2025-H1',2025,5,105,161),('PRJ-001','2025-H1',2025,6,160,171),
  ('PRJ-001','2025-H2',2025,7,160,160),('PRJ-001','2025-H2',2025,8,120,154),('PRJ-001','2025-H2',2025,9,160,160),('PRJ-001','2025-H2',2025,10,160,182),('PRJ-001','2025-H2',2025,11,160,80),('PRJ-001','2025-H2',2025,12,135,0),

  -- PRJ-002 ISJ (B)
  ('PRJ-002','2024-H2',2024,8,0,0),('PRJ-002','2024-H2',2024,9,50,0),('PRJ-002','2024-H2',2024,10,50,0),('PRJ-002','2024-H2',2024,11,100,0),('PRJ-002','2024-H2',2024,12,100,0),
  ('PRJ-002','2025-H1',2025,1,120,32),('PRJ-002','2025-H1',2025,2,150,56),('PRJ-002','2025-H1',2025,3,150,0),('PRJ-002','2025-H1',2025,4,150,0),('PRJ-002','2025-H1',2025,5,100,0),('PRJ-002','2025-H1',2025,6,150,0),
  ('PRJ-002','2025-H2',2025,7,200,0),('PRJ-002','2025-H2',2025,8,180,0),('PRJ-002','2025-H2',2025,9,200,0),('PRJ-002','2025-H2',2025,10,200,0),('PRJ-002','2025-H2',2025,11,200,0),('PRJ-002','2025-H2',2025,12,180,0),

  -- PRJ-003 ISJ (C)
  ('PRJ-003','2024-H2',2024,8,0,0),('PRJ-003','2024-H2',2024,9,50,0),('PRJ-003','2024-H2',2024,10,50,0),('PRJ-003','2024-H2',2024,11,100,0),('PRJ-003','2024-H2',2024,12,100,0),
  ('PRJ-003','2025-H1',2025,1,100,8),('PRJ-003','2025-H1',2025,2,100,0),('PRJ-003','2025-H1',2025,3,100,8),('PRJ-003','2025-H1',2025,4,100,0),('PRJ-003','2025-H1',2025,5,80,0),('PRJ-003','2025-H1',2025,6,100,0),

  -- PRJ-004 GLW (LM)
  ('PRJ-004','2024-H2',2024,8,0,3),('PRJ-004','2024-H2',2024,9,150,74),('PRJ-004','2024-H2',2024,10,150,109),('PRJ-004','2024-H2',2024,11,0,150),('PRJ-004','2024-H2',2024,12,0,446),
  ('PRJ-004','2025-H1',2025,1,0,0),('PRJ-004','2025-H1',2025,2,50,0),('PRJ-004','2025-H1',2025,3,50,0),('PRJ-004','2025-H1',2025,4,50,0),('PRJ-004','2025-H1',2025,5,50,0),('PRJ-004','2025-H1',2025,6,50,0),
  ('PRJ-004','2025-H2',2025,7,50,0),('PRJ-004','2025-H2',2025,8,30,0),('PRJ-004','2025-H2',2025,9,50,0),('PRJ-004','2025-H2',2025,10,50,0),('PRJ-004','2025-H2',2025,11,50,0),('PRJ-004','2025-H2',2025,12,30,0),

  -- PRJ-005 GLW (FALTEC)
  ('PRJ-005','2025-H1',2025,1,100,0),('PRJ-005','2025-H1',2025,2,100,0),('PRJ-005','2025-H1',2025,3,140,0),('PRJ-005','2025-H1',2025,4,140,0),('PRJ-005','2025-H1',2025,5,120,0),('PRJ-005','2025-H1',2025,6,140,0),
  ('PRJ-005','2025-H2',2025,7,140,0),('PRJ-005','2025-H2',2025,8,120,0),('PRJ-005','2025-H2',2025,9,140,0),('PRJ-005','2025-H2',2025,10,140,0),('PRJ-005','2025-H2',2025,11,140,0),('PRJ-005','2025-H2',2025,12,120,0),

  -- PRJ-006 GLW (?)
  ('PRJ-006','2025-H1',2025,1,100,0),('PRJ-006','2025-H1',2025,2,100,0),('PRJ-006','2025-H1',2025,3,100,0),('PRJ-006','2025-H1',2025,4,100,0),('PRJ-006','2025-H1',2025,5,80,0),('PRJ-006','2025-H1',2025,6,100,0),
  ('PRJ-006','2025-H2',2025,7,100,0),('PRJ-006','2025-H2',2025,8,80,0),('PRJ-006','2025-H2',2025,9,100,0),('PRJ-006','2025-H2',2025,10,100,0),('PRJ-006','2025-H2',2025,11,100,0),('PRJ-006','2025-H2',2025,12,80,0),

  -- PRJ-007 NX/CATIA mixed
  ('PRJ-007','2025-H1',2025,1,0,0),('PRJ-007','2025-H1',2025,2,0,0),('PRJ-007','2025-H1',2025,3,0,0),('PRJ-007','2025-H1',2025,4,100,0),('PRJ-007','2025-H1',2025,5,80,3),('PRJ-007','2025-H1',2025,6,100,0),
  ('PRJ-007','2025-H2',2025,7,100,0),('PRJ-007','2025-H2',2025,8,80,0),('PRJ-007','2025-H2',2025,9,100,0),('PRJ-007','2025-H2',2025,10,100,0),('PRJ-007','2025-H2',2025,11,100,0),('PRJ-007','2025-H2',2025,12,80,0),

  -- PRJ-008 GNN(5P45)
  ('PRJ-008','2025-H1',2025,1,100,74),('PRJ-008','2025-H1',2025,2,100,72),('PRJ-008','2025-H1',2025,3,100,208),('PRJ-008','2025-H1',2025,4,100,10),('PRJ-008','2025-H1',2025,5,80,0),('PRJ-008','2025-H1',2025,6,100,0),
  ('PRJ-008','2025-H2',2025,7,100,0),('PRJ-008','2025-H2',2025,8,80,0),('PRJ-008','2025-H2',2025,9,100,8),('PRJ-008','2025-H2',2025,10,100,15),('PRJ-008','2025-H2',2025,11,100,0),('PRJ-008','2025-H2',2025,12,80,0),

  -- PRJ-009 GNN(H60E)
  ('PRJ-009','2025-H1',2025,1,0,0),('PRJ-009','2025-H1',2025,2,0,0),('PRJ-009','2025-H1',2025,3,0,85),('PRJ-009','2025-H1',2025,4,0,0),('PRJ-009','2025-H1',2025,5,0,0),('PRJ-009','2025-H1',2025,6,0,0),

  -- PRJ-010 GNN(L53M)
  ('PRJ-010','2025-H1',2025,1,0,0),('PRJ-010','2025-H1',2025,2,0,0),('PRJ-010','2025-H1',2025,3,0,0),('PRJ-010','2025-H1',2025,4,0,0),('PRJ-010','2025-H1',2025,5,0,110),('PRJ-010','2025-H1',2025,6,0,0),
  ('PRJ-010','2025-H2',2025,7,0,0),('PRJ-010','2025-H2',2025,8,0,78),('PRJ-010','2025-H2',2025,9,0,0),('PRJ-010','2025-H2',2025,10,0,0),('PRJ-010','2025-H2',2025,11,0,0),('PRJ-010','2025-H2',2025,12,0,0),

  -- PRJ-011 GNN(33FY)
  ('PRJ-011','2025-H2',2025,7,0,0),('PRJ-011','2025-H2',2025,8,0,0),('PRJ-011','2025-H2',2025,9,0,0),('PRJ-011','2025-H2',2025,10,0,0),('PRJ-011','2025-H2',2025,11,0,43),('PRJ-011','2025-H2',2025,12,0,0),

  -- PRJ-012 Project 12
  ('PRJ-012','2025-H1',2025,1,0,0),('PRJ-012','2025-H1',2025,2,0,0),('PRJ-012','2025-H1',2025,3,150,0),('PRJ-012','2025-H1',2025,4,250,0),('PRJ-012','2025-H1',2025,5,150,0),('PRJ-012','2025-H1',2025,6,0,0),
  ('PRJ-012','2025-H2',2025,7,0,0),('PRJ-012','2025-H2',2025,8,0,0),('PRJ-012','2025-H2',2025,9,150,0),('PRJ-012','2025-H2',2025,10,250,0),('PRJ-012','2025-H2',2025,11,150,0),('PRJ-012','2025-H2',2025,12,0,0),

  -- PRJ-013 VUTEQ
  ('PRJ-013','2025-H2',2025,7,50,0),('PRJ-013','2025-H2',2025,8,30,0),('PRJ-013','2025-H2',2025,9,50,0),('PRJ-013','2025-H2',2025,10,50,0),('PRJ-013','2025-H2',2025,11,50,0),('PRJ-013','2025-H2',2025,12,30,0),

  -- PRJ-014 GNN(W13G) A
  ('PRJ-014','2025-H2',2025,7,0,0),('PRJ-014','2025-H2',2025,8,0,0),('PRJ-014','2025-H2',2025,9,30,79),('PRJ-014','2025-H2',2025,10,40,140),('PRJ-014','2025-H2',2025,11,40,0),('PRJ-014','2025-H2',2025,12,20,0),

  -- PRJ-015 GNN(W13G) B
  ('PRJ-015','2025-H2',2025,7,0,0),('PRJ-015','2025-H2',2025,8,0,0),('PRJ-015','2025-H2',2025,9,0,0),('PRJ-015','2025-H2',2025,10,0,0),('PRJ-015','2025-H2',2025,11,0,40),('PRJ-015','2025-H2',2025,12,0,0),

  -- PRJ-016 ICAD Project
  ('PRJ-016','2025-H2',2025,7,100,0),('PRJ-016','2025-H2',2025,8,80,0),('PRJ-016','2025-H2',2025,9,100,0),('PRJ-016','2025-H2',2025,10,100,0),('PRJ-016','2025-H2',2025,11,100,0),('PRJ-016','2025-H2',2025,12,80,0)
) as v(project_code, period_label, year, month, planned_hours, actual_hours)
join proj p on p.code = v.project_code
on conflict (project_id, period_label, year, month)
  do update set planned_hours = excluded.planned_hours,
                actual_hours = excluded.actual_hours,
                updated_at = now();

select 'schema and seed complete';
