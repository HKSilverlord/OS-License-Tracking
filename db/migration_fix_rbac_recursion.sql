-- Fix for infinite recursion bug when querying user_roles
drop policy if exists "user_roles: admin full" on public.user_roles;
