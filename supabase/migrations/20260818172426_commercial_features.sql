-- Commercial MVP: group appointments, manual PIX/payment splits, tips and
-- scheduled WhatsApp promotions. Privileged implementations stay private.

alter table public.units add column pix_key text;
update public.units set pix_key = 'matheusaagd2@gmail.com' where slug = 'betim';

alter table public.appointments
  add column party_size integer not null default 1 check (party_size between 1 and 6),
  add column unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  add column gratuity_cents integer not null default 0 check (gratuity_cents >= 0),
  add column payment_status text not null default 'pending'
    check (payment_status in ('pending', 'partial', 'paid', 'refunded'));

create table public.appointment_payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  payer_name text not null check (char_length(trim(payer_name)) between 1 and 120),
  amount_cents integer not null check (amount_cents > 0),
  method text not null default 'pix' check (method in ('pix', 'cash', 'card', 'other')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded')),
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointment_payments_appointment_idx
  on public.appointment_payments (appointment_id, created_at desc);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 80),
  message text not null check (char_length(trim(message)) between 10 and 900),
  discount_label text,
  audience text not null default 'all'
    check (audience in ('all', 'inactive_30d', 'inactive_60d', 'birthday_month')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  send_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.promotion_deliveries (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (promotion_id, client_id)
);

create index promotions_due_idx on public.promotions (send_at)
  where status = 'scheduled';
create index promotion_deliveries_pending_idx on public.promotion_deliveries (created_at)
  where status = 'pending';
create index promotion_deliveries_promotion_idx on public.promotion_deliveries (promotion_id, status);

create trigger appointment_payments_touch_updated_at
  before update on public.appointment_payments
  for each row execute procedure public.touch_updated_at();
create trigger promotions_touch_updated_at
  before update on public.promotions
  for each row execute procedure public.touch_updated_at();

create or replace function private.sync_appointment_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid := coalesce(new.appointment_id, old.appointment_id);
  v_total integer;
  v_paid integer;
begin
  select (unit_price_cents * party_size) + gratuity_cents
    into v_total from public.appointments where id = v_appointment_id;
  select coalesce(sum(amount_cents), 0) into v_paid
    from public.appointment_payments
    where appointment_id = v_appointment_id and status = 'paid';
  update public.appointments
    set payment_status = case
      when v_paid <= 0 then 'pending'
      when v_paid < v_total then 'partial'
      else 'paid'
    end
    where id = v_appointment_id and payment_status <> 'refunded';
  return null;
end;
$$;

create trigger appointment_payments_sync_status
  after insert or update or delete on public.appointment_payments
  for each row execute procedure private.sync_appointment_payment_status();

-- Replace the availability RPC so a group reserves enough consecutive time on
-- one chair. The buffer is applied once, after the final person.
drop function public.get_available_slots(text, text, date, text);
drop function private.get_available_slots(text, text, date, text);

create function private.get_available_slots(
  p_unit_slug text,
  p_service_slug text,
  p_day date,
  p_barber_slug text default 'first',
  p_party_size integer default 1
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

revoke execute on function private.get_available_slots(text, text, date, text, integer)
  from public, anon, authenticated;
grant execute on function private.get_available_slots(text, text, date, text, integer)
  to anon, authenticated;

create function public.get_available_slots(
  p_unit_slug text,
  p_service_slug text,
  p_day date,
  p_barber_slug text default 'first',
  p_party_size integer default 1
)
returns table (starts_at timestamptz, barber_slug text, barber_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_available_slots(p_unit_slug, p_service_slug, p_day, p_barber_slug, p_party_size);
$$;

revoke execute on function public.get_available_slots(text, text, date, text, integer) from public;
grant execute on function public.get_available_slots(text, text, date, text, integer) to anon, authenticated;

-- Replace appointment creation with price snapshots, group duration and tip.
drop function public.create_appointment(text, text, text, timestamptz, text, text);
drop function private.create_appointment(text, text, text, timestamptz, text, text);

create function private.create_appointment(
  p_unit_slug text,
  p_service_slug text,
  p_barber_slug text,
  p_starts_at timestamptz,
  p_notes text default null,
  p_booked_via text default 'app',
  p_party_size integer default 1,
  p_gratuity_cents integer default 0
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
  v_unit_price integer;
  v_end timestamptz;
  v_result public.appointments;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_party_size not between 1 and 6 then raise exception 'INVALID_PARTY_SIZE'; end if;
  if p_gratuity_cents < 0 or p_gratuity_cents > 100000 then raise exception 'INVALID_GRATUITY'; end if;

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

  select b.id,
         coalesce(bs.duration_override_minutes, v_service.duration_minutes),
         coalesce(bs.price_override_cents, v_service.price_cents)
    into v_barber_id, v_duration, v_unit_price
  from public.barbers b
  join public.barber_services bs on bs.barber_id = b.id and bs.service_id = v_service.id
  join public.working_hours wh on wh.barber_id = b.id
    and wh.weekday = extract(dow from (p_starts_at at time zone v_unit.timezone))::smallint
    and wh.active
  where b.unit_id = v_unit.id and b.active
    and (p_barber_slug = 'first' or b.slug = p_barber_slug)
    and (p_starts_at at time zone v_unit.timezone)::time >= wh.opens_at
    and ((p_starts_at at time zone v_unit.timezone)::time + make_interval(
      mins => (coalesce(bs.duration_override_minutes, v_service.duration_minutes) * p_party_size) + v_unit.default_buffer_minutes
    )) <= wh.closes_at
    and not exists (
      select 1 from public.schedule_blocks block
      where block.barber_id = b.id
        and tstzrange(block.starts_at, block.ends_at, '[)') && tstzrange(
          p_starts_at,
          p_starts_at + make_interval(mins => (coalesce(bs.duration_override_minutes, v_service.duration_minutes) * p_party_size) + v_unit.default_buffer_minutes),
          '[)'
        )
    )
    and not exists (
      select 1 from public.appointments a
      where a.barber_id = b.id
        and a.status in ('pending', 'confirmed', 'checked_in', 'in_service')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(
          p_starts_at,
          p_starts_at + make_interval(mins => (coalesce(bs.duration_override_minutes, v_service.duration_minutes) * p_party_size) + v_unit.default_buffer_minutes),
          '[)'
        )
    )
  order by b.sort_order, b.name
  limit 1;

  if v_barber_id is null then raise exception 'SLOT_UNAVAILABLE'; end if;
  v_end := p_starts_at + make_interval(mins => (v_duration * p_party_size) + v_unit.default_buffer_minutes);

  insert into public.appointments (
    client_id, unit_id, barber_id, service_id, starts_at, ends_at, notes,
    booked_via, party_size, unit_price_cents, gratuity_cents
  ) values (
    (select auth.uid()), v_unit.id, v_barber_id, v_service.id, p_starts_at, v_end,
    nullif(trim(p_notes), ''), p_booked_via, p_party_size, v_unit_price, p_gratuity_cents
  ) returning * into v_result;
  return v_result;
exception
  when exclusion_violation then raise exception 'SLOT_UNAVAILABLE';
end;
$$;

revoke execute on function private.create_appointment(text, text, text, timestamptz, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function private.create_appointment(text, text, text, timestamptz, text, text, integer, integer)
  to authenticated;

create function public.create_appointment(
  p_unit_slug text,
  p_service_slug text,
  p_barber_slug text,
  p_starts_at timestamptz,
  p_notes text default null,
  p_booked_via text default 'app',
  p_party_size integer default 1,
  p_gratuity_cents integer default 0
)
returns public.appointments
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_appointment(
    p_unit_slug, p_service_slug, p_barber_slug, p_starts_at, p_notes,
    p_booked_via, p_party_size, p_gratuity_cents
  );
$$;

revoke execute on function public.create_appointment(text, text, text, timestamptz, text, text, integer, integer)
  from public, anon;
grant execute on function public.create_appointment(text, text, text, timestamptz, text, text, integer, integer)
  to authenticated;

-- Queue confirmations, changes, cancellations and reminders on push and
-- WhatsApp. Delivery still respects each client's WhatsApp consent.
create or replace function public.enqueue_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notification_jobs (appointment_id, channel, template, scheduled_for)
    values
      (new.id, 'push', 'confirmation', now()),
      (new.id, 'whatsapp', 'confirmation', now()),
      (new.id, 'push', 'reminder_24h', new.starts_at - interval '24 hours'),
      (new.id, 'whatsapp', 'reminder_24h', new.starts_at - interval '24 hours'),
      (new.id, 'push', 'reminder_2h', new.starts_at - interval '2 hours'),
      (new.id, 'whatsapp', 'reminder_2h', new.starts_at - interval '2 hours')
    on conflict do nothing;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.notification_jobs set status = 'cancelled'
      where appointment_id = new.id and status = 'pending';
    insert into public.notification_jobs (appointment_id, channel, template, scheduled_for)
      values (new.id, 'push', 'cancelled', now()), (new.id, 'whatsapp', 'cancelled', now())
      on conflict do nothing;
  elsif new.starts_at is distinct from old.starts_at or new.barber_id is distinct from old.barber_id then
    update public.notification_jobs set status = 'cancelled'
      where appointment_id = new.id and status = 'pending';
    insert into public.notification_jobs (appointment_id, channel, template, scheduled_for)
      values
        (new.id, 'push', 'changed', now()),
        (new.id, 'whatsapp', 'changed', now()),
        (new.id, 'push', 'reminder_24h', new.starts_at - interval '24 hours'),
        (new.id, 'whatsapp', 'reminder_24h', new.starts_at - interval '24 hours'),
        (new.id, 'push', 'reminder_2h', new.starts_at - interval '2 hours'),
        (new.id, 'whatsapp', 'reminder_2h', new.starts_at - interval '2 hours')
      on conflict (appointment_id, channel, template)
      do update set scheduled_for = excluded.scheduled_for, status = 'pending', attempts = 0, last_error = null;
  end if;
  return new;
end;
$$;

-- Atomic service-role claims prevent duplicate campaign workers.
create function private.activate_due_promotions(p_limit integer default 20)
returns setof public.promotions
language sql
security definer
set search_path = ''
as $$
  update public.promotions
  set status = 'sending', updated_at = now()
  where id in (
    select id from public.promotions
    where status = 'scheduled' and send_at <= now()
    order by send_at
    limit greatest(1, least(p_limit, 20))
    for update skip locked
  )
  returning *;
$$;

create function private.claim_promotion_deliveries(p_limit integer default 100)
returns setof public.promotion_deliveries
language sql
security definer
set search_path = ''
as $$
  update public.promotion_deliveries
  set status = 'processing', attempts = attempts + 1
  where id in (
    select id from public.promotion_deliveries
    where status = 'pending' and attempts < 3
    order by created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning *;
$$;

revoke execute on function private.activate_due_promotions(integer) from public, anon, authenticated;
revoke execute on function private.claim_promotion_deliveries(integer) from public, anon, authenticated;
grant execute on function private.activate_due_promotions(integer) to service_role;
grant execute on function private.claim_promotion_deliveries(integer) to service_role;

create function public.activate_due_promotions(p_limit integer default 20)
returns setof public.promotions
language sql
security invoker
set search_path = ''
as $$ select * from private.activate_due_promotions(p_limit); $$;

create function public.claim_promotion_deliveries(p_limit integer default 100)
returns setof public.promotion_deliveries
language sql
security invoker
set search_path = ''
as $$ select * from private.claim_promotion_deliveries(p_limit); $$;

revoke execute on function public.activate_due_promotions(integer) from public, anon, authenticated;
revoke execute on function public.claim_promotion_deliveries(integer) from public, anon, authenticated;
grant execute on function public.activate_due_promotions(integer) to service_role;
grant execute on function public.claim_promotion_deliveries(integer) to service_role;

alter table public.appointment_payments enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_deliveries enable row level security;

create policy "Clients or staff read appointment payments" on public.appointment_payments
  for select to authenticated using (
    (select private.is_staff()) or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.client_id = (select auth.uid())
    )
  );
create policy "Staff insert appointment payments" on public.appointment_payments
  for insert to authenticated with check ((select private.is_staff()));
create policy "Staff update appointment payments" on public.appointment_payments
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete appointment payments" on public.appointment_payments
  for delete to authenticated using ((select private.is_staff()));

create policy "Public read live promotions" on public.promotions
  for select to anon, authenticated using (
    (status = 'sent' and starts_at <= now() and ends_at > now()) or (select private.is_staff())
  );
create policy "Staff insert promotions" on public.promotions
  for insert to authenticated with check ((select private.is_staff()) and created_by = (select auth.uid()));
create policy "Staff update promotions" on public.promotions
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete promotions" on public.promotions
  for delete to authenticated using ((select private.is_staff()));

create policy "Staff read promotion deliveries" on public.promotion_deliveries
  for select to authenticated using ((select private.is_staff()));
create policy "Staff insert promotion deliveries" on public.promotion_deliveries
  for insert to authenticated with check ((select private.is_staff()));
create policy "Staff update promotion deliveries" on public.promotion_deliveries
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete promotion deliveries" on public.promotion_deliveries
  for delete to authenticated using ((select private.is_staff()));

grant select on public.promotions to anon;
grant select on public.appointment_payments, public.promotions, public.promotion_deliveries to authenticated;
grant insert, update, delete on public.appointment_payments, public.promotions, public.promotion_deliveries to authenticated;

revoke execute on function private.sync_appointment_payment_status() from public, anon, authenticated;
