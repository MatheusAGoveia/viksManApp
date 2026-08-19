-- Migration: Viks Club Plans, Subscriptions, Benefit Snapshots/Usage and Loyalty Points System
-- Date: 2026-08-19

-- 0. Profiles columns for Viks Club & Loyalty Points
alter table public.profiles add column if not exists viks_club_status text not null default 'inactive';
alter table public.profiles add column if not exists viks_points_balance integer not null default 0 constraint profiles_viks_points_balance_check check (viks_points_balance >= 0);

-- 1. Viks Club Plans
create table if not exists public.viks_club_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null default 0 constraint viks_club_plans_price_check check (price >= 0),
  billing_period text not null default 'monthly' constraint viks_club_plans_billing_period_check check (billing_period in ('monthly', 'yearly')),
  allowed_days text[] not null default array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.viks_club_plans add column if not exists allowed_days text[] not null default array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

-- 2. Viks Club Plan Benefits
create table if not exists public.viks_club_plan_benefits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.viks_club_plans(id) on delete cascade,
  benefit_type text not null default 'service_credit' constraint viks_club_plan_benefits_type_check check (benefit_type in ('service_credit', 'service_discount', 'product_discount')),
  service_id text,
  quantity integer not null default 1 constraint viks_club_plan_benefits_quantity_check check (quantity >= 0),
  discount_percent numeric(5, 2) default 0 constraint viks_club_plan_benefits_discount_check check (discount_percent >= 0 and discount_percent <= 100),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Viks Club Subscriptions
create table if not exists public.viks_club_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.viks_club_plans(id),
  barber_id text,
  status text not null default 'active' constraint viks_club_subscriptions_status_check check (status in ('active', 'paused', 'canceled', 'expired')),
  starts_at timestamptz not null default now(),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  canceled_at timestamptz,
  paused_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partial Unique Index: Max 1 active subscription per client at database level
create unique index if not exists idx_unique_active_subscription_per_client
  on public.viks_club_subscriptions (client_id)
  where (status = 'active');

-- Indexes for subscriptions queries
create index if not exists idx_viks_club_subscriptions_client_status on public.viks_club_subscriptions(client_id, status);
create index if not exists idx_viks_club_subscriptions_plan_id on public.viks_club_subscriptions(plan_id);

-- 4. Viks Club Subscription Benefits (Snapshot per active period)
create table if not exists public.viks_club_subscription_benefits (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.viks_club_subscriptions(id) on delete cascade,
  plan_benefit_id uuid references public.viks_club_plan_benefits(id) on delete set null,
  benefit_type text not null default 'service_credit',
  service_id text,
  quantity_granted integer not null default 0 constraint viks_sub_benefits_granted_check check (quantity_granted >= 0),
  quantity_used integer not null default 0 constraint viks_sub_benefits_used_check check (quantity_used >= 0 and quantity_used <= quantity_granted),
  discount_percent numeric(5, 2) default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_viks_sub_benefits_sub_id on public.viks_club_subscription_benefits(subscription_id);

-- 5. Viks Club Benefit Usage (Audit history)
create table if not exists public.viks_club_benefit_usage (
  id uuid primary key default gen_random_uuid(),
  subscription_benefit_id uuid not null references public.viks_club_subscription_benefits(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  quantity integer not null default 1 constraint viks_benefit_usage_qty_check check (quantity > 0),
  used_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_viks_benefit_usage_client_id on public.viks_club_benefit_usage(client_id);
create index if not exists idx_viks_benefit_usage_appointment_id on public.viks_club_benefit_usage(appointment_id);

-- 6. Loyalty Transactions (Audit history for points)
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  type text not null constraint loyalty_tx_type_check check (type in ('earn', 'redeem', 'adjustment', 'expiration')),
  points integer not null constraint loyalty_tx_points_check check (points > 0),
  reason text not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_loyalty_tx_client_id on public.loyalty_transactions(client_id, created_at desc);

-- RLS Enablement
alter table public.viks_club_plans enable row level security;
alter table public.viks_club_plan_benefits enable row level security;
alter table public.viks_club_subscriptions enable row level security;
alter table public.viks_club_subscription_benefits enable row level security;
alter table public.viks_club_benefit_usage enable row level security;
alter table public.loyalty_transactions enable row level security;

-- RLS Policies

-- Plans: Everyone authenticated can view active plans. Staff/Admin manage.
create policy "Anyone can view active plans" on public.viks_club_plans
  for select using (auth.role() = 'authenticated');

create policy "Staff manage plans" on public.viks_club_plans
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('manager', 'admin')
    )
  );

-- Plan Benefits: Authenticated view. Staff manage.
create policy "Anyone can view active plan benefits" on public.viks_club_plan_benefits
  for select using (auth.role() = 'authenticated');

create policy "Staff manage plan benefits" on public.viks_club_plan_benefits
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('manager', 'admin')
    )
  );

-- Subscriptions: Client reads own. Staff/Admin read/manage.
create policy "Clients view own subscription" on public.viks_club_subscriptions
  for select using (client_id = auth.uid());

create policy "Staff view all subscriptions" on public.viks_club_subscriptions
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('barber', 'reception', 'manager', 'admin')
    )
  );

create policy "Manager/Admin manage subscriptions" on public.viks_club_subscriptions
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('manager', 'admin')
    )
  );

-- Subscription Benefits: Client reads own. Staff reads/manages.
create policy "Clients view own subscription benefits" on public.viks_club_subscription_benefits
  for select using (
    exists (
      select 1 from public.viks_club_subscriptions s
      where s.id = viks_club_subscription_benefits.subscription_id
      and s.client_id = auth.uid()
    )
  );

create policy "Staff view subscription benefits" on public.viks_club_subscription_benefits
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('barber', 'reception', 'manager', 'admin')
    )
  );

create policy "Staff manage subscription benefits" on public.viks_club_subscription_benefits
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('reception', 'manager', 'admin')
    )
  );

-- Benefit Usage: Client views own. Staff views/manages.
create policy "Clients view own benefit usage" on public.viks_club_benefit_usage
  for select using (client_id = auth.uid());

create policy "Staff view benefit usage" on public.viks_club_benefit_usage
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('barber', 'reception', 'manager', 'admin')
    )
  );

create policy "Staff insert benefit usage" on public.viks_club_benefit_usage
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('reception', 'manager', 'admin')
    )
  );

-- Loyalty Transactions: Client views own. Staff/Admin view/manage.
create policy "Clients view own loyalty transactions" on public.loyalty_transactions
  for select using (client_id = auth.uid());

create policy "Staff view loyalty transactions" on public.loyalty_transactions
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('barber', 'reception', 'manager', 'admin')
    )
  );

create policy "Manager/Admin manage loyalty transactions" on public.loyalty_transactions
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('manager', 'admin')
    )
  );

-- RPC Functions for Atomic Transactions & Race Condition Safety

-- RPC 1: Activate Subscription
create or replace function public.activate_viks_club_subscription(
  p_client_id uuid,
  p_plan_id uuid,
  p_months integer default 1,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_plan record;
  v_sub_id uuid;
  v_period_start timestamptz := now();
  v_period_end timestamptz := now() + (p_months || ' month')::interval;
  v_b record;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('manager', 'admin')
  ) then
    raise exception 'Apenas gerentes e administradores podem ativar assinaturas.';
  end if;

  select * into v_plan from public.viks_club_plans where id = p_plan_id and active = true;
  if not found then
    raise exception 'Plano não encontrado ou inativo.';
  end if;

  update public.viks_club_subscriptions
  set status = 'canceled', canceled_at = now(), updated_at = now()
  where client_id = p_client_id and status = 'active';

  insert into public.viks_club_subscriptions (
    client_id, plan_id, status, starts_at, current_period_start, current_period_end, created_by
  ) values (
    p_client_id, p_plan_id, 'active', v_period_start, v_period_start, v_period_end, coalesce(p_created_by, auth.uid())
  ) returning id into v_sub_id;

  for v_b in (select * from public.viks_club_plan_benefits where plan_id = p_plan_id and active = true) loop
    insert into public.viks_club_subscription_benefits (
      subscription_id, plan_benefit_id, benefit_type, service_id, quantity_granted, quantity_used, discount_percent, period_start, period_end
    ) values (
      v_sub_id, v_b.id, v_b.benefit_type, v_b.service_id, v_b.quantity, 0, v_b.discount_percent, v_period_start, v_period_end
    );
  end loop;

  update public.profiles
  set viks_club_status = 'active'
  where id = p_client_id;

  return jsonb_build_object('success', true, 'subscription_id', v_sub_id);
end;
$$;

-- RPC 2: Renew Subscription
create or replace function public.renew_viks_club_subscription(
  p_subscription_id uuid,
  p_months integer default 1,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sub record;
  v_period_start timestamptz := now();
  v_period_end timestamptz := now() + (p_months || ' month')::interval;
  v_b record;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('manager', 'admin')
  ) then
    raise exception 'Apenas gerentes e administradores podem renovar assinaturas.';
  end if;

  select * into v_sub from public.viks_club_subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'Assinatura não encontrada.';
  end if;

  update public.viks_club_subscriptions
  set status = 'active',
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      paused_at = null,
      updated_at = now()
  where id = p_subscription_id;

  for v_b in (select * from public.viks_club_plan_benefits where plan_id = v_sub.plan_id and active = true) loop
    insert into public.viks_club_subscription_benefits (
      subscription_id, plan_benefit_id, benefit_type, service_id, quantity_granted, quantity_used, discount_percent, period_start, period_end
    ) values (
      p_subscription_id, v_b.id, v_b.benefit_type, v_b.service_id, v_b.quantity, 0, v_b.discount_percent, v_period_start, v_period_end
    );
  end loop;

  update public.profiles set viks_club_status = 'active' where id = v_sub.client_id;

  return jsonb_build_object('success', true);
end;
$$;

-- RPC 3: Pause / Cancel Subscription
create or replace function public.update_viks_club_subscription_status(
  p_subscription_id uuid,
  p_new_status text,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sub record;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('manager', 'admin')
  ) then
    raise exception 'Apenas gerentes e administradores podem alterar status de assinaturas.';
  end if;

  if p_new_status not in ('active', 'paused', 'canceled') then
    raise exception 'Status inválido.';
  end if;

  select * into v_sub from public.viks_club_subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'Assinatura não encontrada.';
  end if;

  update public.viks_club_subscriptions
  set status = p_new_status,
      paused_at = case when p_new_status = 'paused' then now() else paused_at end,
      canceled_at = case when p_new_status = 'canceled' then now() else canceled_at end,
      updated_at = now()
  where id = p_subscription_id;

  update public.profiles set viks_club_status = p_new_status where id = v_sub.client_id;

  return jsonb_build_object('success', true);
end;
$$;

-- RPC 4: Consume Benefit (With Row Locking to Prevent Race Conditions)
create or replace function public.consume_viks_club_benefit(
  p_subscription_benefit_id uuid,
  p_appointment_id uuid default null,
  p_quantity integer default 1,
  p_created_by uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sub_benefit record;
  v_sub record;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('reception', 'manager', 'admin')
  ) then
    raise exception 'Apenas recepção, gerentes e administradores podem registrar consumo de benefícios.';
  end if;

  select * into v_sub_benefit
  from public.viks_club_subscription_benefits
  where id = p_subscription_benefit_id
  for update;

  if not found then
    raise exception 'Benefício não encontrado.';
  end if;

  select * into v_sub from public.viks_club_subscriptions where id = v_sub_benefit.subscription_id;

  if v_sub.status != 'active' then
    raise exception 'A assinatura do cliente não está ativa.';
  end if;

  if now() < v_sub_benefit.period_start or now() > v_sub_benefit.period_end then
    raise exception 'O benefício está fora do período de vigência.';
  end if;

  if (v_sub_benefit.quantity_used + p_quantity) > v_sub_benefit.quantity_granted then
    raise exception 'Saldo insuficiente para este benefício (Disponível: %).', (v_sub_benefit.quantity_granted - v_sub_benefit.quantity_used);
  end if;

  update public.viks_club_subscription_benefits
  set quantity_used = quantity_used + p_quantity,
      updated_at = now()
  where id = p_subscription_benefit_id;

  insert into public.viks_club_benefit_usage (
    subscription_benefit_id, client_id, appointment_id, quantity, used_at, created_by, notes
  ) values (
    p_subscription_benefit_id, v_sub.client_id, p_appointment_id, p_quantity, now(), coalesce(p_created_by, auth.uid()), p_notes
  );

  return jsonb_build_object('success', true, 'remaining', (v_sub_benefit.quantity_granted - (v_sub_benefit.quantity_used + p_quantity)));
end;
$$;

-- RPC 5: Manage Loyalty Points (Earn, Redeem, Adjustment - Atomic with Profile Row Lock)
create or replace function public.manage_loyalty_points(
  p_client_id uuid,
  p_type text,
  p_points integer,
  p_reason text,
  p_appointment_id uuid default null,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_profile record;
  v_new_balance integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('manager', 'admin')
  ) then
    raise exception 'Apenas gerentes e administradores podem alterar pontos de fidelidade.';
  end if;

  if p_type not in ('earn', 'redeem', 'adjustment', 'expiration') then
    raise exception 'Tipo de transação de pontos inválido.';
  end if;

  if p_points <= 0 then
    raise exception 'A quantidade de pontos deve ser maior que zero.';
  end if;

  select * into v_profile from public.profiles where id = p_client_id for update;
  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  if p_type in ('redeem', 'expiration') then
    if v_profile.viks_points_balance < p_points then
      raise exception 'Saldo insuficiente de pontos (Saldo atual: %, Solicitado: %).', v_profile.viks_points_balance, p_points;
    end if;
    v_new_balance := v_profile.viks_points_balance - p_points;
  else
    v_new_balance := v_profile.viks_points_balance + p_points;
  end if;

  insert into public.loyalty_transactions (
    client_id, type, points, reason, appointment_id, created_by
  ) values (
    p_client_id, p_type, p_points, p_reason, p_appointment_id, coalesce(p_created_by, auth.uid())
  );

  update public.profiles
  set viks_points_balance = v_new_balance
  where id = p_client_id;

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;
