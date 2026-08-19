-- Migration: Restrict unit modification to manager/admin roles only
-- Date: 2026-08-19

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('manager', 'admin')
  );
$$;

drop policy if exists "Staff insert units" on public.units;
drop policy if exists "Staff update units" on public.units;
drop policy if exists "Staff delete units" on public.units;

create policy "Manager insert units" on public.units
  for insert to authenticated
  with check ((select private.is_manager()));

create policy "Manager update units" on public.units
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy "Manager delete units" on public.units
  for delete to authenticated
  using ((select private.is_manager()));
