-- Product catalog and server-side next-slot discovery.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text not null default 'cuidados',
  price_cents integer not null check (price_cents >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text,
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_touch_updated_at
  before update on public.products
  for each row execute procedure public.touch_updated_at();

insert into public.products (
  slug, name, description, category, price_cents, stock_quantity, featured, sort_order
) values
  ('shampoo-refrescante', 'Shampoo refrescante', 'Limpeza diária com sensação fresca, sem ressecar os fios.', 'cabelo', 4990, 12, true, 10),
  ('pomada-matte', 'Pomada efeito matte', 'Fixação média e acabamento natural para modelar sem brilho.', 'finalizacao', 4590, 10, true, 20),
  ('gel-fixador', 'Gel fixador', 'Fixação forte, secagem rápida e acabamento limpo.', 'finalizacao', 2990, 14, false, 30),
  ('balm-para-barba', 'Balm para barba', 'Hidrata, controla os fios e reduz o ressecamento da pele.', 'barba', 3990, 9, true, 40),
  ('creme-modelador', 'Creme modelador', 'Textura leve para definição e controle no uso diário.', 'cabelo', 4290, 8, false, 50)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  price_cents = excluded.price_cents,
  stock_quantity = excluded.stock_quantity,
  featured = excluded.featured,
  sort_order = excluded.sort_order,
  active = true;

alter table public.products enable row level security;

create policy "Active products are public"
  on public.products for select to anon, authenticated
  using (active or (select private.is_staff()));

create policy "Staff manage products"
  on public.products for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

create function private.get_next_available_slot(
  p_unit_slug text,
  p_service_slug text,
  p_barber_slug text default 'first',
  p_party_size integer default 1
)
returns table (starts_at timestamptz, barber_slug text, barber_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with config as (
    select
      (now() at time zone u.timezone)::date as first_day,
      least(u.max_booking_days, 60) as search_days
    from public.units u
    where u.slug = p_unit_slug and u.active
  ),
  days as (
    select generate_series(
      c.first_day,
      c.first_day + greatest(c.search_days - 1, 0),
      interval '1 day'
    )::date as day
    from config c
  )
  select slot.starts_at, slot.barber_slug, slot.barber_name
  from days d
  cross join lateral private.get_available_slots(
    p_unit_slug,
    p_service_slug,
    d.day,
    p_barber_slug,
    p_party_size
  ) slot
  order by slot.starts_at
  limit 1;
$$;

revoke execute on function private.get_next_available_slot(text, text, text, integer)
  from public;
grant execute on function private.get_next_available_slot(text, text, text, integer)
  to anon, authenticated;

create function public.get_next_available_slot(
  p_unit_slug text,
  p_service_slug text,
  p_barber_slug text default 'first',
  p_party_size integer default 1
)
returns table (starts_at timestamptz, barber_slug text, barber_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_next_available_slot(
    p_unit_slug,
    p_service_slug,
    p_barber_slug,
    p_party_size
  );
$$;

revoke execute on function public.get_next_available_slot(text, text, text, integer)
  from public;
grant execute on function public.get_next_available_slot(text, text, text, integer)
  to anon, authenticated;
