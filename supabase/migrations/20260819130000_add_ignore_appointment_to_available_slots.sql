-- Migration: Support p_ignore_appointment_id in get_available_slots RPC for safe rescheduling
-- Date: 2026-08-19

drop function if exists public.get_available_slots(text, text, date, text, integer);
drop function if exists private.get_available_slots(text, text, date, text, integer);

create or replace function private.get_available_slots(
  p_unit_slug text,
  p_service_slug text,
  p_day date,
  p_barber_slug text default 'first',
  p_party_size integer default 1,
  p_ignore_appointment_id uuid default null
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
      (coalesce(bs.duration_override_minutes, s.duration_minutes) * greatest(1, least(p_party_size, 6)))
        + u.default_buffer_minutes as occupied_minutes,
      b.sort_order
    from public.units u
    join public.barbers b on b.unit_id = u.id and b.active
    join public.barber_services bs on bs.barber_id = b.id
    join public.services s on s.id = bs.service_id and s.active
    join public.working_hours wh on wh.barber_id = b.id
      and wh.weekday = extract(dow from p_day)::smallint and wh.active
    cross join lateral generate_series(
      (p_day + wh.opens_at) at time zone u.timezone,
      ((p_day + wh.closes_at) at time zone u.timezone) - make_interval(
        mins => (coalesce(bs.duration_override_minutes, s.duration_minutes) * greatest(1, least(p_party_size, 6))) + u.default_buffer_minutes
      ),
      make_interval(mins => wh.slot_interval_minutes)
    ) as slot(starts_at)
    where u.slug = p_unit_slug
      and u.active
      and s.slug = p_service_slug
      and p_party_size between 1 and 6
      and (p_barber_slug in ('first', '') or b.slug = p_barber_slug)
      and slot.starts_at >= now() + make_interval(mins => u.min_booking_notice_minutes)
      and slot.starts_at < now() + make_interval(days => u.max_booking_days)
      and not exists (
        select 1 from public.schedule_blocks block
        where block.barber_id = b.id
          and tstzrange(block.starts_at, block.ends_at, '[)') &&
            tstzrange(slot.starts_at, slot.starts_at + make_interval(
              mins => (coalesce(bs.duration_override_minutes, s.duration_minutes) * p_party_size) + u.default_buffer_minutes
            ), '[)')
      )
      and not exists (
        select 1 from public.appointments a
        where a.barber_id = b.id
          and a.status in ('pending', 'confirmed', 'checked_in', 'in_service')
          and (p_ignore_appointment_id is null or a.id <> p_ignore_appointment_id)
          and tstzrange(a.starts_at, a.ends_at, '[)') &&
            tstzrange(slot.starts_at, slot.starts_at + make_interval(
              mins => (coalesce(bs.duration_override_minutes, s.duration_minutes) * p_party_size) + u.default_buffer_minutes
            ), '[)')
      )
  )
  select distinct on (c.starts_at) c.starts_at, c.barber_slug, c.barber_name
  from candidates c
  order by c.starts_at, c.sort_order, c.barber_name;
$$;

revoke execute on function private.get_available_slots(text, text, date, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function private.get_available_slots(text, text, date, text, integer, uuid)
  to anon, authenticated;

create or replace function public.get_available_slots(
  p_unit_slug text,
  p_service_slug text,
  p_day date,
  p_barber_slug text default 'first',
  p_party_size integer default 1,
  p_ignore_appointment_id uuid default null
)
returns table (starts_at timestamptz, barber_slug text, barber_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_available_slots(p_unit_slug, p_service_slug, p_day, p_barber_slug, p_party_size, p_ignore_appointment_id);
$$;

revoke execute on function public.get_available_slots(text, text, date, text, integer, uuid) from public;
grant execute on function public.get_available_slots(text, text, date, text, integer, uuid) to anon, authenticated;
