-- Migration: Fix units RLS policies and revoke insert/delete
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

-- Drop any legacy or intermediate policies on public.units
drop policy if exists "Staff manage units" on public.units;
drop policy if exists "Staff insert units" on public.units;
drop policy if exists "Staff update units" on public.units;
drop policy if exists "Staff delete units" on public.units;
drop policy if exists "Manager insert units" on public.units;
drop policy if exists "Manager update units" on public.units;
drop policy if exists "Manager delete units" on public.units;

-- Create ONLY the update policy for manager/admin
create policy "Manager update units" on public.units
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

-- Revoke table-level INSERT and DELETE permissions on public.units from authenticated role
revoke insert, delete on public.units from authenticated;
