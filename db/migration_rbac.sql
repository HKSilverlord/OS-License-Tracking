-- =============================================================
-- RBAC Migration: Admin vs User (view-only)
-- Chạy trong Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- -------------------------------------------------------
-- 1. Tạo bảng user_roles
-- -------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null check (role in ('admin', 'user'))
);

alter table public.user_roles enable row level security;

-- User tự xem role của mình được
create policy "user_roles: read own"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- Chỉ admin mới sửa bảng user_roles
create policy "user_roles: admin full"
  on public.user_roles for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role = 'admin'
    )
  );

-- -------------------------------------------------------
-- 2. Helper function — dùng trong RLS policies
-- -------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
as $$
  select role from public.user_roles where user_id = auth.uid();
$$;

-- -------------------------------------------------------
-- 3. Drop các policy cũ (all-for-authenticated)
-- -------------------------------------------------------

-- projects
drop policy if exists "Projects authenticated rw" on public.projects;
drop policy if exists "Enable all access for authenticated users on projects" on public.projects;

-- periods
drop policy if exists "Periods authenticated rw" on public.periods;
drop policy if exists "Enable all access for authenticated users on periods" on public.periods;

-- monthly_records
drop policy if exists "Records authenticated rw" on public.monthly_records;
drop policy if exists "Enable all access for authenticated users on monthly_records" on public.monthly_records;

-- settings
drop policy if exists "Settings authenticated rw" on public.settings;
drop policy if exists "Enable all access for authenticated users on settings" on public.settings;

-- -------------------------------------------------------
-- 4. Tạo policy mới: SELECT cho tất cả, write chỉ admin
-- -------------------------------------------------------

-- projects
create policy "projects: authenticated read"
  on public.projects for select
  to authenticated using (true);

create policy "projects: admin write"
  on public.projects for insert
  to authenticated with check (public.get_my_role() = 'admin');

create policy "projects: admin update"
  on public.projects for update
  to authenticated using (public.get_my_role() = 'admin');

create policy "projects: admin delete"
  on public.projects for delete
  to authenticated using (public.get_my_role() = 'admin');

-- periods
create policy "periods: authenticated read"
  on public.periods for select
  to authenticated using (true);

create policy "periods: admin write"
  on public.periods for insert
  to authenticated with check (public.get_my_role() = 'admin');

create policy "periods: admin update"
  on public.periods for update
  to authenticated using (public.get_my_role() = 'admin');

create policy "periods: admin delete"
  on public.periods for delete
  to authenticated using (public.get_my_role() = 'admin');

-- monthly_records
create policy "monthly_records: authenticated read"
  on public.monthly_records for select
  to authenticated using (true);

create policy "monthly_records: admin write"
  on public.monthly_records for insert
  to authenticated with check (public.get_my_role() = 'admin');

create policy "monthly_records: admin update"
  on public.monthly_records for update
  to authenticated using (public.get_my_role() = 'admin');

create policy "monthly_records: admin delete"
  on public.monthly_records for delete
  to authenticated using (public.get_my_role() = 'admin');

-- settings
create policy "settings: authenticated read"
  on public.settings for select
  to authenticated using (true);

create policy "settings: admin write"
  on public.settings for insert
  to authenticated with check (public.get_my_role() = 'admin');

create policy "settings: admin update"
  on public.settings for update
  to authenticated using (public.get_my_role() = 'admin');

create policy "settings: admin delete"
  on public.settings for delete
  to authenticated using (public.get_my_role() = 'admin');

-- -------------------------------------------------------
-- 5. Seed admin đầu tiên
-- -------------------------------------------------------
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email in (
  'admin@gmail.com',
  'linh.trandinh@esutech.vn',
  'linhtd@esutech.edu.vn',
  'mactuananh.work@gmail.com'
)
on conflict (user_id) do nothing;

-- Sau khi chạy xong, verify bằng:
-- select * from public.user_roles;
-- select public.get_my_role(); -- chạy khi đã login
