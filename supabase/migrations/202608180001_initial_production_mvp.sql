create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "btree_gist" with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.units (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text not null,
  city text not null,
  state char(2) not null,
  timezone text not null default 'America/Sao_Paulo',
  phone text,
  cancellation_hours integer not null default 4 check (cancellation_hours >= 0),
  min_booking_notice_minutes integer not null default 60 check (min_booking_notice_minutes >= 0),
  max_booking_days integer not null default 60 check (max_booking_days between 1 and 365),
  default_buffer_minutes integer not null default 5 check (default_buffer_minutes between 0 and 60),
  allow_walk_ins boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  birth_date date,
  role text not null default 'client' check (role in ('client', 'barber', 'reception', 'manager', 'admin')),
  preferred_barber_id uuid,
  marketing_consent boolean not null default false,
  whatsapp_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer not null check (price_cents >= 0),
  category text not null default 'barbearia',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  profile_id uuid unique references public.profiles(id) on delete set null,
  slug text not null unique,
  name text not null,
  bio text,
  specialties text[] not null default '{}',
  color text not null default '#135DFF',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_preferred_barber_fk
  foreign key (preferred_barber_id) references public.barbers(id) on delete set null;

create table public.barber_services (
  barber_id uuid not null references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  price_override_cents integer check (price_override_cents is null or price_override_cents >= 0),
  duration_override_minutes integer check (duration_override_minutes is null or duration_override_minutes between 5 and 480),
  primary key (barber_id, service_id)
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes between 5 and 120),
  active boolean not null default true,
  check (closes_at > opens_at),
  unique (barber_id, weekday)
);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'block' check (kind in ('block', 'break', 'day_off', 'vacation', 'maintenance')),
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show')),
  booked_via text not null default 'app' check (booked_via in ('app', 'web', 'reception', 'walk_in')),
  notes text,
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.appointments add constraint appointments_no_barber_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'checked_in', 'in_service'));

create index appointments_client_starts_idx on public.appointments (client_id, starts_at desc);
create index appointments_barber_starts_idx on public.appointments (barber_id, starts_at);
create index appointments_unit_starts_idx on public.appointments (unit_id, starts_at);
create index appointments_service_idx on public.appointments (service_id);
create index schedule_blocks_barber_starts_idx on public.schedule_blocks (barber_id, starts_at);
create index schedule_blocks_created_by_idx on public.schedule_blocks (created_by) where created_by is not null;
create index profiles_preferred_barber_idx on public.profiles (preferred_barber_id) where preferred_barber_id is not null;
create index barber_services_service_idx on public.barber_services (service_id);

create table public.client_style_profiles (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_cut text,
  preferred_beard text,
  clipper_guard text,
  fade_height text,
  finish text,
  allergies text,
  barber_notes text,
  updated_at timestamptz not null default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  channel text not null check (channel in ('push', 'whatsapp')),
  template text not null check (template in ('confirmation', 'reminder_24h', 'reminder_2h', 'changed', 'cancelled')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (appointment_id, channel, template)
);

create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event text not null,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index push_tokens_active_user_idx on public.push_tokens (user_id) where active;
create index notification_jobs_pending_schedule_idx on public.notification_jobs (scheduled_for) where status = 'pending';
create index appointment_events_appointment_idx on public.appointment_events (appointment_id, created_at desc);
create index appointment_events_actor_idx on public.appointment_events (actor_id) where actor_id is not null;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('barber', 'reception', 'manager', 'admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.claim_notification_jobs(p_limit integer default 100)
returns setof public.notification_jobs
language sql
security definer
set search_path = ''
as $$
  update public.notification_jobs
  set status = 'processing', attempts = attempts + 1
  where id in (
    select id
    from public.notification_jobs
    where status = 'pending' and scheduled_for <= now()
    order by scheduled_for
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning *;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute procedure public.touch_updated_at();
create trigger services_touch_updated_at before update on public.services
  for each row execute procedure public.touch_updated_at();
create trigger appointments_touch_updated_at before update on public.appointments
  for each row execute procedure public.touch_updated_at();

create or replace function public.audit_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.appointment_events (appointment_id, actor_id, event, previous_data, new_data)
  values (
    new.id,
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger appointments_audit
  after insert or update on public.appointments
  for each row execute procedure public.audit_appointment();

create or replace function public.enqueue_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template text;
begin
  if tg_op = 'INSERT' then
    insert into public.notification_jobs (appointment_id, channel, template, scheduled_for)
    values
      (new.id, 'push', 'confirmation', now()),
      (new.id, 'push', 'reminder_24h', new.starts_at - interval '24 hours'),
      (new.id, 'push', 'reminder_2h', new.starts_at - interval '2 hours')
    on conflict do nothing;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.notification_jobs set status = 'cancelled'
      where appointment_id = new.id and status = 'pending';
    insert into public.notification_jobs (appointment_id, channel, template, scheduled_for)
      values (new.id, 'push', 'cancelled', now()) on conflict do nothing;
  elsif new.starts_at is distinct from old.starts_at or new.barber_id is distinct from old.barber_id then
    update public.notification_jobs set status = 'cancelled'
      where appointment_id = new.id and status = 'pending';
    insert into public.notification_jobs (appointment_id, channel, template, scheduled_for)
      values
        (new.id, 'push', 'changed', now()),
        (new.id, 'push', 'reminder_24h', new.starts_at - interval '24 hours'),
        (new.id, 'push', 'reminder_2h', new.starts_at - interval '2 hours')
      on conflict (appointment_id, channel, template)
      do update set scheduled_for = excluded.scheduled_for, status = 'pending', attempts = 0, last_error = null;
  end if;
  return new;
end;
$$;

create trigger appointments_enqueue_notifications
  after insert or update on public.appointments
  for each row execute procedure public.enqueue_appointment_notifications();

create or replace function public.get_available_slots(
  p_unit_slug text,
  p_service_slug text,
  p_day date,
  p_barber_slug text default 'first'
)
returns table (starts_at timestamptz, barber_slug text, barber_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select
      slot.starts_at,
      b.id as barber_id,
      b.slug as barber_slug,
      b.name as barber_name,
      coalesce(bs.duration_override_minutes, s.duration_minutes) + u.default_buffer_minutes as occupied_minutes,
      b.sort_order
    from public.units u
    join public.barbers b on b.unit_id = u.id and b.active
    join public.barber_services bs on bs.barber_id = b.id
    join public.services s on s.id = bs.service_id and s.active
    join public.working_hours wh on wh.barber_id = b.id
      and wh.weekday = extract(dow from p_day)::smallint and wh.active
    cross join lateral generate_series(
      (p_day + wh.opens_at) at time zone u.timezone,
      ((p_day + wh.closes_at) at time zone u.timezone)
        - make_interval(mins => coalesce(bs.duration_override_minutes, s.duration_minutes) + u.default_buffer_minutes),
      make_interval(mins => wh.slot_interval_minutes)
    ) as slot(starts_at)
    where u.slug = p_unit_slug
      and u.active
      and s.slug = p_service_slug
      and (p_barber_slug in ('first', '') or b.slug = p_barber_slug)
      and slot.starts_at >= now() + make_interval(mins => u.min_booking_notice_minutes)
      and slot.starts_at < now() + make_interval(days => u.max_booking_days)
      and not exists (
        select 1 from public.schedule_blocks block
        where block.barber_id = b.id
          and tstzrange(block.starts_at, block.ends_at, '[)') &&
              tstzrange(slot.starts_at, slot.starts_at + make_interval(mins => coalesce(bs.duration_override_minutes, s.duration_minutes) + u.default_buffer_minutes), '[)')
      )
      and not exists (
        select 1 from public.appointments a
        where a.barber_id = b.id
          and a.status in ('pending', 'confirmed', 'checked_in', 'in_service')
          and tstzrange(a.starts_at, a.ends_at, '[)') &&
              tstzrange(slot.starts_at, slot.starts_at + make_interval(mins => coalesce(bs.duration_override_minutes, s.duration_minutes) + u.default_buffer_minutes), '[)')
      )
  )
  select distinct on (c.starts_at) c.starts_at, c.barber_slug, c.barber_name
  from candidates c
  order by c.starts_at, c.sort_order, c.barber_name;
$$;

create or replace function public.create_appointment(
  p_unit_slug text,
  p_service_slug text,
  p_barber_slug text,
  p_starts_at timestamptz,
  p_notes text default null,
  p_booked_via text default 'app'
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit public.units;
  v_service public.services;
  v_barber_id uuid;
  v_duration integer;
  v_end timestamptz;
  v_result public.appointments;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_unit from public.units where slug = p_unit_slug and active;
  if not found then raise exception 'UNIT_NOT_FOUND'; end if;
  select * into v_service from public.services where slug = p_service_slug and active;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;

  if p_starts_at < now() + make_interval(mins => v_unit.min_booking_notice_minutes) then
    raise exception 'MIN_BOOKING_NOTICE';
  end if;
  if p_starts_at >= now() + make_interval(days => v_unit.max_booking_days) then
    raise exception 'MAX_BOOKING_WINDOW';
  end if;

  select b.id, coalesce(bs.duration_override_minutes, v_service.duration_minutes)
    into v_barber_id, v_duration
  from public.barbers b
  join public.barber_services bs on bs.barber_id = b.id and bs.service_id = v_service.id
  join public.working_hours wh on wh.barber_id = b.id
    and wh.weekday = extract(dow from (p_starts_at at time zone v_unit.timezone))::smallint
    and wh.active
  where b.unit_id = v_unit.id and b.active
    and (p_barber_slug = 'first' or b.slug = p_barber_slug)
    and (p_starts_at at time zone v_unit.timezone)::time >= wh.opens_at
    and ((p_starts_at at time zone v_unit.timezone)::time +
         make_interval(mins => coalesce(bs.duration_override_minutes, v_service.duration_minutes) + v_unit.default_buffer_minutes)) <= wh.closes_at
    and not exists (
      select 1 from public.schedule_blocks block
      where block.barber_id = b.id
        and tstzrange(block.starts_at, block.ends_at, '[)') &&
            tstzrange(p_starts_at, p_starts_at + make_interval(mins => coalesce(bs.duration_override_minutes, v_service.duration_minutes) + v_unit.default_buffer_minutes), '[)')
    )
    and not exists (
      select 1 from public.appointments a
      where a.barber_id = b.id
        and a.status in ('pending', 'confirmed', 'checked_in', 'in_service')
        and tstzrange(a.starts_at, a.ends_at, '[)') &&
            tstzrange(p_starts_at, p_starts_at + make_interval(mins => coalesce(bs.duration_override_minutes, v_service.duration_minutes) + v_unit.default_buffer_minutes), '[)')
    )
  order by b.sort_order, b.name
  limit 1;

  if v_barber_id is null then raise exception 'SLOT_UNAVAILABLE'; end if;
  v_end := p_starts_at + make_interval(mins => v_duration + v_unit.default_buffer_minutes);

  insert into public.appointments (client_id, unit_id, barber_id, service_id, starts_at, ends_at, notes, booked_via)
  values ((select auth.uid()), v_unit.id, v_barber_id, v_service.id, p_starts_at, v_end, nullif(trim(p_notes), ''), p_booked_via)
  returning * into v_result;
  return v_result;
exception
  when exclusion_violation then raise exception 'SLOT_UNAVAILABLE';
end;
$$;

create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text default null)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments;
  v_cancellation_hours integer;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND'; end if;
  select cancellation_hours into v_cancellation_hours from public.units where id = v_appointment.unit_id;
  if v_appointment.client_id <> (select auth.uid()) and not private.is_staff() then raise exception 'FORBIDDEN'; end if;
  if not private.is_staff() and v_appointment.starts_at < now() + make_interval(hours => v_cancellation_hours) then
    raise exception 'CANCELLATION_WINDOW_CLOSED';
  end if;
  update public.appointments set status = 'cancelled', cancellation_reason = nullif(trim(p_reason), ''), cancelled_at = now()
  where id = p_appointment_id returning * into v_appointment;
  return v_appointment;
end;
$$;

alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.barber_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.client_style_profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.appointment_events enable row level security;

create policy "Public reads active units" on public.units for select to anon, authenticated using (active or (select private.is_staff()));
create policy "Public reads active services" on public.services for select to anon, authenticated using (active or (select private.is_staff()));
create policy "Public reads active barbers" on public.barbers for select to anon, authenticated using (active or (select private.is_staff()));
create policy "Public reads barber services" on public.barber_services for select to anon, authenticated using (true);
create policy "Public reads working hours" on public.working_hours for select to anon, authenticated using (active or (select private.is_staff()));

create policy "Users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_staff()));
create policy "Users update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = 'client');
create policy "Staff manage profiles" on public.profiles for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Clients read own appointments" on public.appointments for select to authenticated using (client_id = (select auth.uid()) or (select private.is_staff()));
create policy "Staff manage appointments" on public.appointments for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Users read own style" on public.client_style_profiles for select to authenticated using (client_id = (select auth.uid()) or (select private.is_staff()));
create policy "Users update own style" on public.client_style_profiles for all to authenticated using (client_id = (select auth.uid()) or (select private.is_staff())) with check (client_id = (select auth.uid()) or (select private.is_staff()));
create policy "Users manage own push tokens" on public.push_tokens for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Staff manage schedule blocks" on public.schedule_blocks for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff manage units" on public.units for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff manage services" on public.services for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff manage barbers" on public.barbers for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff manage barber services" on public.barber_services for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff manage working hours" on public.working_hours for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff read notification jobs" on public.notification_jobs for select to authenticated using ((select private.is_staff()));
create policy "Staff read appointment events" on public.appointment_events for select to authenticated using ((select private.is_staff()));

grant usage on schema public to anon, authenticated;
grant select on public.units, public.services, public.barbers, public.barber_services, public.working_hours to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.appointments to authenticated;
grant select, insert, update on public.client_style_profiles, public.push_tokens to authenticated;
grant select, insert, update, delete on public.schedule_blocks to authenticated;
grant select, insert, update, delete on public.units, public.services, public.barbers, public.barber_services, public.working_hours, public.appointments to authenticated;
grant select on public.notification_jobs, public.appointment_events to authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.audit_appointment() from public, anon, authenticated;
revoke execute on function public.enqueue_appointment_notifications() from public, anon, authenticated;
revoke execute on function public.get_available_slots(text, text, date, text) from public;
revoke execute on function public.create_appointment(text, text, text, timestamptz, text, text) from public, anon;
revoke execute on function public.cancel_appointment(uuid, text) from public, anon;
revoke execute on function public.claim_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.get_available_slots(text, text, date, text) to anon, authenticated;
grant execute on function public.create_appointment(text, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;
grant execute on function public.claim_notification_jobs(integer) to service_role;

insert into public.units (id, slug, name, address, city, state, phone)
values ('00000000-0000-0000-0000-000000000001', 'betim', 'Viks Man Betim', 'Rua do Rosário, 497 · Angola', 'Betim', 'MG', null);

insert into public.services (id, slug, name, description, duration_minutes, price_cents, sort_order) values
  ('10000000-0000-0000-0000-000000000001', 'cut', 'Corte', 'Tesoura ou máquina, com acabamento no detalhe.', 45, 4000, 1),
  ('10000000-0000-0000-0000-000000000002', 'beard', 'Barba', 'Desenho, toalha quente e finalização.', 35, 3500, 2),
  ('10000000-0000-0000-0000-000000000003', 'combo', 'Corte + barba', 'Visual completo em uma única visita.', 75, 7500, 3),
  ('10000000-0000-0000-0000-000000000004', 'eyebrow', 'Sobrancelha', 'Alinhamento natural para completar o visual.', 15, 1500, 4);

insert into public.barbers (id, unit_id, slug, name, specialties, sort_order, color) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'victor', 'Victor', array['Fade', 'Barba', 'Acabamento'], 1, '#135DFF'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'bruno', 'Bruno', array['Tesoura', 'Clássico', 'Infantil'], 2, '#101114');

insert into public.barber_services (barber_id, service_id)
select b.id, s.id from public.barbers b cross join public.services s;

insert into public.working_hours (barber_id, weekday, opens_at, closes_at)
select b.id, day.weekday,
  case when day.weekday = 6 then time '08:00' else time '09:00' end,
  case when day.weekday = 6 then time '18:00' else time '20:00' end
from public.barbers b
cross join (values (1), (2), (3), (4), (5), (6)) as day(weekday);

alter publication supabase_realtime add table public.appointments, public.schedule_blocks;
