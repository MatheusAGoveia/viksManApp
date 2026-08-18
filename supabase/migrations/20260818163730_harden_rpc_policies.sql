create index barbers_unit_idx on public.barbers (unit_id);

-- Keep privileged implementations outside the exposed API schema and expose
-- small SECURITY INVOKER wrappers with explicit grants.
alter function public.get_available_slots(text, text, date, text) set schema private;
alter function public.create_appointment(text, text, text, timestamptz, text, text) set schema private;
alter function public.cancel_appointment(uuid, text) set schema private;

revoke execute on function private.get_available_slots(text, text, date, text) from public, anon, authenticated;
revoke execute on function private.create_appointment(text, text, text, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function private.cancel_appointment(uuid, text) from public, anon, authenticated;
grant execute on function private.get_available_slots(text, text, date, text) to anon, authenticated;
grant execute on function private.create_appointment(text, text, text, timestamptz, text, text) to authenticated;
grant execute on function private.cancel_appointment(uuid, text) to authenticated;

create function public.get_available_slots(
  p_unit_slug text,
  p_service_slug text,
  p_day date,
  p_barber_slug text default 'first'
)
returns table (starts_at timestamptz, barber_slug text, barber_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_available_slots(p_unit_slug, p_service_slug, p_day, p_barber_slug);
$$;

create function public.create_appointment(
  p_unit_slug text,
  p_service_slug text,
  p_barber_slug text,
  p_starts_at timestamptz,
  p_notes text default null,
  p_booked_via text default 'app'
)
returns public.appointments
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_appointment(p_unit_slug, p_service_slug, p_barber_slug, p_starts_at, p_notes, p_booked_via);
$$;

create function public.cancel_appointment(p_appointment_id uuid, p_reason text default null)
returns public.appointments
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.cancel_appointment(p_appointment_id, p_reason);
$$;

revoke execute on function public.get_available_slots(text, text, date, text) from public;
revoke execute on function public.create_appointment(text, text, text, timestamptz, text, text) from public, anon;
revoke execute on function public.cancel_appointment(uuid, text) from public, anon;
grant execute on function public.get_available_slots(text, text, date, text) to anon, authenticated;
grant execute on function public.create_appointment(text, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;

-- Avoid duplicate permissive SELECT policies while retaining staff CRUD.
drop policy "Staff manage profiles" on public.profiles;
drop policy "Users update own profile" on public.profiles;
create policy "Users or staff update profiles" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()))
  with check ((select private.is_staff()) or (id = (select auth.uid()) and role = 'client'));

drop policy "Staff manage appointments" on public.appointments;
create policy "Staff insert appointments" on public.appointments for insert to authenticated
  with check ((select private.is_staff()));
create policy "Staff update appointments" on public.appointments for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete appointments" on public.appointments for delete to authenticated
  using ((select private.is_staff()));

drop policy "Users update own style" on public.client_style_profiles;
create policy "Users insert own style" on public.client_style_profiles for insert to authenticated
  with check (client_id = (select auth.uid()) or (select private.is_staff()));
create policy "Users update own style" on public.client_style_profiles for update to authenticated
  using (client_id = (select auth.uid()) or (select private.is_staff()))
  with check (client_id = (select auth.uid()) or (select private.is_staff()));

drop policy "Staff manage units" on public.units;
create policy "Staff insert units" on public.units for insert to authenticated with check ((select private.is_staff()));
create policy "Staff update units" on public.units for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete units" on public.units for delete to authenticated using ((select private.is_staff()));

drop policy "Staff manage services" on public.services;
create policy "Staff insert services" on public.services for insert to authenticated with check ((select private.is_staff()));
create policy "Staff update services" on public.services for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete services" on public.services for delete to authenticated using ((select private.is_staff()));

drop policy "Staff manage barbers" on public.barbers;
create policy "Staff insert barbers" on public.barbers for insert to authenticated with check ((select private.is_staff()));
create policy "Staff update barbers" on public.barbers for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete barbers" on public.barbers for delete to authenticated using ((select private.is_staff()));

drop policy "Staff manage barber services" on public.barber_services;
create policy "Staff insert barber services" on public.barber_services for insert to authenticated with check ((select private.is_staff()));
create policy "Staff update barber services" on public.barber_services for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete barber services" on public.barber_services for delete to authenticated using ((select private.is_staff()));

drop policy "Staff manage working hours" on public.working_hours;
create policy "Staff insert working hours" on public.working_hours for insert to authenticated with check ((select private.is_staff()));
create policy "Staff update working hours" on public.working_hours for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete working hours" on public.working_hours for delete to authenticated using ((select private.is_staff()));
