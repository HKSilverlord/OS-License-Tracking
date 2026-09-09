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
drop policy if exists "user_roles: read own" on public.user_roles;
create policy "user_roles: read own"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- KHÔNG tạo policy "user_roles: admin full".
-- Policy đó tự truy vấn chính public.user_roles trong mệnh đề using/with check,
-- gây đệ quy vô hạn (xem db/migration_fix_rbac_recursion.sql, vốn sinh ra chỉ để
-- xoá nó). Vì vậy nó bị loại bỏ hẳn tại đây thay vì tạo rồi lại xoá.
--
-- Hệ quả: user_roles chỉ ghi được từ Supabase SQL Editor (service_role), không
-- ghi được từ client. Đây là chủ ý — việc cấp quyền admin phải làm thủ công.
-- Xem hướng dẫn ở db/SETUP_GUIDE.md.
drop policy if exists "user_roles: admin full" on public.user_roles;

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
drop policy if exists "projects: authenticated read" on public.projects;
create policy "projects: authenticated read"
  on public.projects for select
  to authenticated using (true);

drop policy if exists "projects: admin write" on public.projects;
create policy "projects: admin write"
  on public.projects for insert
  to authenticated with check (public.get_my_role() = 'admin');

drop policy if exists "projects: admin update" on public.projects;
create policy "projects: admin update"
  on public.projects for update
  to authenticated using (public.get_my_role() = 'admin');

drop policy if exists "projects: admin delete" on public.projects;
create policy "projects: admin delete"
  on public.projects for delete
  to authenticated using (public.get_my_role() = 'admin');

-- periods
drop policy if exists "periods: authenticated read" on public.periods;
create policy "periods: authenticated read"
  on public.periods for select
  to authenticated using (true);

drop policy if exists "periods: admin write" on public.periods;
create policy "periods: admin write"
  on public.periods for insert
  to authenticated with check (public.get_my_role() = 'admin');

drop policy if exists "periods: admin update" on public.periods;
create policy "periods: admin update"
  on public.periods for update
  to authenticated using (public.get_my_role() = 'admin');

drop policy if exists "periods: admin delete" on public.periods;
create policy "periods: admin delete"
  on public.periods for delete
  to authenticated using (public.get_my_role() = 'admin');

-- monthly_records
drop policy if exists "monthly_records: authenticated read" on public.monthly_records;
create policy "monthly_records: authenticated read"
  on public.monthly_records for select
  to authenticated using (true);

drop policy if exists "monthly_records: admin write" on public.monthly_records;
create policy "monthly_records: admin write"
  on public.monthly_records for insert
  to authenticated with check (public.get_my_role() = 'admin');

drop policy if exists "monthly_records: admin update" on public.monthly_records;
create policy "monthly_records: admin update"
  on public.monthly_records for update
  to authenticated using (public.get_my_role() = 'admin');

drop policy if exists "monthly_records: admin delete" on public.monthly_records;
create policy "monthly_records: admin delete"
  on public.monthly_records for delete
  to authenticated using (public.get_my_role() = 'admin');

-- settings
drop policy if exists "settings: authenticated read" on public.settings;
create policy "settings: authenticated read"
  on public.settings for select
  to authenticated using (true);

drop policy if exists "settings: admin write" on public.settings;
create policy "settings: admin write"
  on public.settings for insert
  to authenticated with check (public.get_my_role() = 'admin');

drop policy if exists "settings: admin update" on public.settings;
create policy "settings: admin update"
  on public.settings for update
  to authenticated using (public.get_my_role() = 'admin');

drop policy if exists "settings: admin delete" on public.settings;
create policy "settings: admin delete"
  on public.settings for delete
  to authenticated using (public.get_my_role() = 'admin');

-- -------------------------------------------------------
-- 5. Seed admin đầu tiên
-- -------------------------------------------------------
-- KHÔNG hardcode email vào file này (nó nằm trong git).
-- Thay 'admin@example.com' bằng email thật rồi chạy một lần cho mỗi admin.
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'admin@example.com'
on conflict (user_id) do update set role = excluded.role;

-- Sau khi chạy xong, verify bằng:
-- select * from public.user_roles;
-- select public.get_my_role(); -- chạy khi đã login
