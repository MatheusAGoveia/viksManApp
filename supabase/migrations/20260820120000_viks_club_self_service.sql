-- Viks Club self-service hardening.
-- Makes the customer journey configurable by the store and keeps subscription,
-- booking and benefit consumption in the same database transaction.

alter table public.viks_club_plans
  add column if not exists self_service_enabled boolean not null default false,
  add column if not exists allow_self_pause boolean not null default true,
  add column if not exists allow_self_cancel boolean not null default true,
  add column if not exists refund_on_cancel boolean not null default true,
  add column if not exists featured boolean not null default false;

alter table public.viks_club_benefit_usage
  add column if not exists discount_cents_applied integer not null default 0
    check (discount_cents_applied >= 0);

-- Plans are part of the storefront. Anonymous visitors may compare active plans;
-- staff can still inspect inactive plans through the management policy.
drop policy if exists "Anyone can view active plans" on public.viks_club_plans;
drop policy if exists "Anyone can view active plan benefits" on public.viks_club_plan_benefits;
drop policy if exists "Public view available plans" on public.viks_club_plans;
drop policy if exists "Public view available plan benefits" on public.viks_club_plan_benefits;

create policy "Public view available plans" on public.viks_club_plans
  for select to anon, authenticated
  using (
    active
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('manager', 'admin')
    )
  );

create policy "Public view available plan benefits" on public.viks_club_plan_benefits
  for select to anon, authenticated
  using (
    active
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('manager', 'admin')
    )
  );

grant select on public.viks_club_plans, public.viks_club_plan_benefits to anon, authenticated;

create or replace function private.create_viks_club_benefit_cycles(
  p_subscription_id uuid,
  p_plan_id uuid,
  p_period_start timestamptz,
  p_cycles integer,
  p_billing_period text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b record;
  v_cycle integer;
  v_cycle_start timestamptz;
  v_cycle_end timestamptz;
begin
  for v_cycle in 0..greatest(1, p_cycles) - 1 loop
    if p_billing_period = 'yearly' then
      v_cycle_start := p_period_start + (v_cycle || ' year')::interval;
      v_cycle_end := p_period_start + ((v_cycle + 1) || ' year')::interval;
    else
      v_cycle_start := p_period_start + (v_cycle || ' month')::interval;
      v_cycle_end := p_period_start + ((v_cycle + 1) || ' month')::interval;
    end if;

    for v_b in (
      select * from public.viks_club_plan_benefits
      where plan_id = p_plan_id and active = true
    ) loop
      insert into public.viks_club_subscription_benefits (
        subscription_id,
        plan_benefit_id,
        benefit_type,
        service_id,
        quantity_granted,
        quantity_used,
        discount_percent,
        period_start,
        period_end
      ) values (
        p_subscription_id,
        v_b.id,
        v_b.benefit_type,
        v_b.service_id,
        v_b.quantity,
        0,
        v_b.discount_percent,
        v_cycle_start,
        v_cycle_end
      );
    end loop;
  end loop;
end;
$$;

create or replace function public.activate_viks_club_subscription(
  p_client_id uuid,
  p_plan_id uuid,
  p_cycles integer default 1,
  p_barber_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_plan record;
  v_sub_id uuid;
  v_period_start timestamptz := now();
  v_period_end timestamptz;
  v_cycles integer := greatest(1, least(coalesce(p_cycles, 1), 24));
begin
  perform set_config('app.in_rpc_subscription', 'true', true);

  if not exists (
    select 1 from public.profiles
    where id = v_auth_uid and role in ('manager', 'admin')
  ) then
    raise exception 'Apenas gerentes e administradores podem ativar assinaturas para outro cliente.';
  end if;

  select * into v_plan
  from public.viks_club_plans
  where id = p_plan_id and active = true;
  if not found then raise exception 'Plano não encontrado ou inativo.'; end if;

  update public.viks_club_subscriptions
  set status = 'expired', updated_at = now()
  where client_id = p_client_id and status in ('active', 'paused') and current_period_end <= now();

  if exists (
    select 1 from public.viks_club_subscriptions
    where client_id = p_client_id and status in ('active', 'paused')
  ) then
    raise exception 'Cliente já possui uma assinatura vigente.';
  end if;

  if v_plan.billing_period = 'yearly' then
    v_period_end := v_period_start + (v_cycles || ' year')::interval;
  else
    v_period_end := v_period_start + (v_cycles || ' month')::interval;
  end if;

  insert into public.viks_club_subscriptions (
    client_id, plan_id, barber_id, status, starts_at,
    current_period_start, current_period_end, created_by
  ) values (
    p_client_id, p_plan_id, nullif(p_barber_id, 'first'), 'active', v_period_start,
    v_period_start, v_period_end, v_auth_uid
  ) returning id into v_sub_id;

  perform private.create_viks_club_benefit_cycles(
    v_sub_id, p_plan_id, v_period_start, v_cycles, v_plan.billing_period
  );

  update public.profiles set viks_club_status = 'active' where id = p_client_id;

  return jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'status', 'active'
  );
end;
$$;

create or replace function public.self_subscribe_viks_club(
  p_plan_id uuid,
  p_barber_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_plan record;
  v_sub_id uuid;
  v_period_start timestamptz := now();
  v_period_end timestamptz;
begin
  if v_auth_uid is null then raise exception 'Entre na sua conta para assinar o Viks Club.'; end if;
  perform set_config('app.in_rpc_subscription', 'true', true);

  select * into v_plan
  from public.viks_club_plans
  where id = p_plan_id and active = true and self_service_enabled = true;
  if not found then raise exception 'Este plano não está disponível para contratação pelo app.'; end if;

  if p_barber_id is not null and p_barber_id <> 'first' and not exists (
    select 1 from public.barbers where slug = p_barber_id and active = true
  ) then
    raise exception 'Profissional selecionado não está disponível.';
  end if;

  update public.viks_club_subscriptions
  set status = 'expired', updated_at = now()
  where client_id = v_auth_uid and status in ('active', 'paused') and current_period_end <= now();

  if exists (
    select 1 from public.viks_club_subscriptions
    where client_id = v_auth_uid and status in ('active', 'paused')
  ) then
    raise exception 'Você já possui uma assinatura vigente.';
  end if;

  if v_plan.billing_period = 'yearly' then
    v_period_end := v_period_start + interval '1 year';
  else
    v_period_end := v_period_start + interval '1 month';
  end if;

  insert into public.viks_club_subscriptions (
    client_id, plan_id, barber_id, status, starts_at,
    current_period_start, current_period_end, created_by
  ) values (
    v_auth_uid, p_plan_id, nullif(p_barber_id, 'first'), 'active', v_period_start,
    v_period_start, v_period_end, v_auth_uid
  ) returning id into v_sub_id;

  perform private.create_viks_club_benefit_cycles(
    v_sub_id, p_plan_id, v_period_start, 1, v_plan.billing_period
  );

  update public.profiles set viks_club_status = 'active' where id = v_auth_uid;

  return jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'status', 'active'
  );
end;
$$;

create or replace function public.renew_viks_club_subscription(
  p_subscription_id uuid,
  p_cycles integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_sub record;
  v_plan record;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_cycles integer := greatest(1, least(coalesce(p_cycles, 1), 24));
  v_is_manager boolean;
begin
  perform set_config('app.in_rpc_subscription', 'true', true);
  select exists (
    select 1 from public.profiles
    where id = v_auth_uid and role in ('manager', 'admin')
  ) into v_is_manager;

  select * into v_sub
  from public.viks_club_subscriptions
  where id = p_subscription_id
  for update;
  if not found then raise exception 'Assinatura não encontrada.'; end if;

  select * into v_plan from public.viks_club_plans where id = v_sub.plan_id and active = true;
  if not found then raise exception 'O plano desta assinatura não está mais disponível.'; end if;

  if not v_is_manager and (v_sub.client_id <> v_auth_uid or not v_plan.self_service_enabled) then
    raise exception 'Você não tem permissão para renovar esta assinatura.';
  end if;

  v_period_start := greatest(now(), v_sub.current_period_end);
  if v_plan.billing_period = 'yearly' then
    v_period_end := v_period_start + (v_cycles || ' year')::interval;
  else
    v_period_end := v_period_start + (v_cycles || ' month')::interval;
  end if;

  update public.viks_club_subscriptions
  set status = 'active', current_period_start = v_period_start,
      current_period_end = v_period_end, paused_at = null, canceled_at = null,
      updated_at = now()
  where id = p_subscription_id;

  perform private.create_viks_club_benefit_cycles(
    p_subscription_id, v_sub.plan_id, v_period_start, v_cycles, v_plan.billing_period
  );

  update public.profiles set viks_club_status = 'active' where id = v_sub.client_id;
  return jsonb_build_object('success', true, 'status', 'active');
end;
$$;

create or replace function public.update_viks_club_subscription_status(
  p_subscription_id uuid,
  p_new_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_sub record;
  v_plan record;
  v_is_manager boolean;
begin
  perform set_config('app.in_rpc_subscription', 'true', true);
  if p_new_status not in ('active', 'paused', 'canceled') then raise exception 'Status inválido.'; end if;

  select * into v_sub
  from public.viks_club_subscriptions
  where id = p_subscription_id
  for update;
  if not found then raise exception 'Assinatura não encontrada.'; end if;

  select * into v_plan from public.viks_club_plans where id = v_sub.plan_id;
  select exists (
    select 1 from public.profiles
    where id = v_auth_uid and role in ('manager', 'admin')
  ) into v_is_manager;

  if not v_is_manager then
    if v_sub.client_id <> v_auth_uid then raise exception 'Sem permissão para alterar esta assinatura.'; end if;
    if p_new_status = 'paused' and not v_plan.allow_self_pause then
      raise exception 'A pausa deste plano deve ser solicitada à loja.';
    end if;
    if p_new_status = 'canceled' and not v_plan.allow_self_cancel then
      raise exception 'O cancelamento deste plano deve ser solicitado à loja.';
    end if;
    if p_new_status = 'active' and v_sub.status <> 'paused' then
      raise exception 'Apenas assinaturas pausadas podem ser reativadas.';
    end if;
  end if;

  if p_new_status = 'active' and v_sub.current_period_end <= now() then
    raise exception 'O período da assinatura expirou. Renove o plano para continuar.';
  end if;

  update public.viks_club_subscriptions
  set status = p_new_status,
      paused_at = case when p_new_status = 'paused' then now() when p_new_status = 'active' then null else paused_at end,
      canceled_at = case when p_new_status = 'canceled' then now() else canceled_at end,
      updated_at = now()
  where id = p_subscription_id;

  update public.profiles set viks_club_status = p_new_status where id = v_sub.client_id;
  return jsonb_build_object('success', true, 'status', p_new_status);
end;
$$;

create or replace function public.create_viks_club_appointment(
  p_subscription_benefit_id uuid,
  p_unit_slug text,
  p_service_slug text,
  p_barber_slug text,
  p_starts_at timestamptz,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_benefit record;
  v_sub record;
  v_plan record;
  v_unit record;
  v_appointment public.appointments;
  v_discount integer := 0;
  v_day text;
  v_usage_id uuid;
begin
  if v_auth_uid is null then raise exception 'Entre na sua conta para agendar.'; end if;

  select * into v_benefit
  from public.viks_club_subscription_benefits
  where id = p_subscription_benefit_id
  for update;
  if not found then raise exception 'Benefício não encontrado.'; end if;

  select * into v_sub from public.viks_club_subscriptions where id = v_benefit.subscription_id for update;
  select * into v_plan from public.viks_club_plans where id = v_sub.plan_id;
  select * into v_unit from public.units where slug = p_unit_slug and active = true;

  if v_sub.client_id <> v_auth_uid then raise exception 'Este benefício pertence a outro cliente.'; end if;
  if v_sub.status <> 'active' or v_sub.current_period_end <= now() then
    raise exception 'Sua assinatura não está ativa.';
  end if;
  if now() < v_benefit.period_start or now() >= v_benefit.period_end then
    raise exception 'Este benefício está fora do ciclo atual.';
  end if;
  if v_benefit.quantity_used >= v_benefit.quantity_granted then
    raise exception 'Você já utilizou todos os créditos deste benefício no ciclo atual.';
  end if;
  if v_benefit.benefit_type not in ('service_credit', 'service_discount') then
    raise exception 'Este benefício não pode ser usado em serviços.';
  end if;
  if v_benefit.service_id is distinct from p_service_slug then
    raise exception 'O serviço escolhido não corresponde ao benefício.';
  end if;
  if v_sub.barber_id is not null and v_sub.barber_id <> p_barber_slug then
    raise exception 'Este plano está vinculado a outro profissional.';
  end if;
  if v_unit.id is null then raise exception 'Unidade não encontrada.'; end if;

  v_day := (array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[
    extract(dow from (p_starts_at at time zone v_unit.timezone))::integer + 1
  ];
  if not (v_day = any(v_plan.allowed_days)) then
    raise exception 'O plano não permite agendamentos neste dia da semana.';
  end if;

  v_appointment := private.create_appointment(
    p_unit_slug, p_service_slug, p_barber_slug, p_starts_at,
    p_notes, 'viks_club', 1, 0
  );

  if v_benefit.benefit_type = 'service_credit' then
    v_discount := v_appointment.unit_price_cents;
  else
    v_discount := round(v_appointment.unit_price_cents * coalesce(v_benefit.discount_percent, 0) / 100.0);
  end if;
  v_discount := least(v_appointment.unit_price_cents, greatest(0, v_discount));

  update public.viks_club_subscription_benefits
  set quantity_used = quantity_used + 1, updated_at = now()
  where id = v_benefit.id;

  insert into public.viks_club_benefit_usage (
    subscription_benefit_id, client_id, appointment_id, quantity,
    used_at, created_by, notes, discount_cents_applied
  ) values (
    v_benefit.id, v_auth_uid, v_appointment.id, 1,
    now(), v_auth_uid, 'Agendamento autoatendido pelo Viks Club', v_discount
  ) returning id into v_usage_id;

  update public.appointments
  set club_discount_cents = v_discount
  where id = v_appointment.id;
  perform public.calculate_appointment_totals(v_appointment.id);

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment.id,
    'usage_id', v_usage_id,
    'discount_cents_applied', v_discount,
    'remaining', v_benefit.quantity_granted - v_benefit.quantity_used - 1
  );
end;
$$;

create or replace function public.consume_viks_club_benefit(
  p_subscription_benefit_id uuid,
  p_appointment_id uuid default null,
  p_quantity integer default 1,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_benefit record;
  v_sub record;
  v_app record;
  v_service_slug text;
  v_discount integer := 0;
  v_usage_id uuid;
begin
  if not exists (
    select 1 from public.profiles where id = v_auth_uid and role in ('reception', 'manager', 'admin')
  ) then raise exception 'Apenas a equipe pode registrar consumo manual.'; end if;
  if p_quantity <= 0 then raise exception 'Quantidade inválida.'; end if;

  select * into v_benefit from public.viks_club_subscription_benefits
  where id = p_subscription_benefit_id for update;
  if not found then raise exception 'Benefício não encontrado.'; end if;
  select * into v_sub from public.viks_club_subscriptions where id = v_benefit.subscription_id;

  if v_sub.status <> 'active' or v_sub.current_period_end <= now() then
    raise exception 'A assinatura do cliente não está ativa.';
  end if;
  if now() < v_benefit.period_start or now() >= v_benefit.period_end then
    raise exception 'Benefício fora do ciclo atual.';
  end if;
  if v_benefit.quantity_used + p_quantity > v_benefit.quantity_granted then
    raise exception 'Saldo insuficiente para este benefício.';
  end if;

  if p_appointment_id is not null then
    select a.*, s.slug into v_app
    from public.appointments a join public.services s on s.id = a.service_id
    where a.id = p_appointment_id for update of a;
    if not found then raise exception 'Atendimento não encontrado.'; end if;
    v_service_slug := v_app.slug;
    if v_app.client_id <> v_sub.client_id then raise exception 'Atendimento pertence a outro cliente.'; end if;
    if v_app.status in ('cancelled', 'no_show') then raise exception 'Atendimento cancelado ou no-show.'; end if;
    if v_benefit.service_id is distinct from v_service_slug then
      raise exception 'Serviço não corresponde ao benefício.';
    end if;
    if exists (
      select 1 from public.viks_club_benefit_usage
      where appointment_id = p_appointment_id and voided_at is null
    ) then raise exception 'Este atendimento já possui um benefício aplicado.'; end if;

    if v_benefit.benefit_type = 'service_credit' then
      v_discount := least(v_app.unit_price_cents * p_quantity, v_app.unit_price_cents * v_app.party_size);
    elsif v_benefit.benefit_type = 'service_discount' then
      v_discount := round(v_app.unit_price_cents * coalesce(v_benefit.discount_percent, 0) / 100.0);
    else
      raise exception 'Benefício de produto não pode ser aplicado a atendimento.';
    end if;
  elsif v_benefit.benefit_type <> 'product_discount' then
    raise exception 'Benefícios de serviço exigem um atendimento.';
  end if;

  update public.viks_club_subscription_benefits
  set quantity_used = quantity_used + p_quantity, updated_at = now()
  where id = v_benefit.id;

  insert into public.viks_club_benefit_usage (
    subscription_benefit_id, client_id, appointment_id, quantity,
    used_at, created_by, notes, discount_cents_applied
  ) values (
    v_benefit.id, v_sub.client_id, p_appointment_id, p_quantity,
    now(), v_auth_uid, p_notes, v_discount
  ) returning id into v_usage_id;

  if p_appointment_id is not null then
    update public.appointments
    set club_discount_cents = least(
      unit_price_cents * party_size,
      club_discount_cents + v_discount
    )
    where id = p_appointment_id;
    perform public.calculate_appointment_totals(p_appointment_id);
  end if;

  return jsonb_build_object(
    'success', true, 'usage_id', v_usage_id,
    'remaining', v_benefit.quantity_granted - v_benefit.quantity_used - p_quantity,
    'discount_cents_applied', v_discount
  );
end;
$$;

create or replace function public.void_viks_club_benefit_usage(
  p_usage_id uuid,
  p_reason text default 'Estorno de atendimento'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_usage record;
  v_benefit record;
begin
  if not exists (
    select 1 from public.profiles where id = v_auth_uid and role in ('reception', 'manager', 'admin')
  ) then raise exception 'Apenas a equipe pode estornar benefícios.'; end if;

  select * into v_usage from public.viks_club_benefit_usage where id = p_usage_id for update;
  if not found then raise exception 'Registro de uso não encontrado.'; end if;
  if v_usage.voided_at is not null then raise exception 'Este uso já foi estornado.'; end if;

  select * into v_benefit from public.viks_club_subscription_benefits
  where id = v_usage.subscription_benefit_id for update;

  update public.viks_club_subscription_benefits
  set quantity_used = greatest(0, quantity_used - v_usage.quantity), updated_at = now()
  where id = v_usage.subscription_benefit_id;
  update public.viks_club_benefit_usage
  set voided_at = now(), voided_by = v_auth_uid, void_reason = nullif(trim(p_reason), '')
  where id = p_usage_id;

  if v_usage.appointment_id is not null then
    update public.appointments
    set club_discount_cents = greatest(0, club_discount_cents - v_usage.discount_cents_applied)
    where id = v_usage.appointment_id;
    perform public.calculate_appointment_totals(v_usage.appointment_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'restored_quantity', v_usage.quantity,
    'new_used_quantity', greatest(0, v_benefit.quantity_used - v_usage.quantity)
  );
end;
$$;

create or replace function private.refund_canceled_viks_club_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage record;
  v_refund integer := 0;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for v_usage in (
      select u.*, p.refund_on_cancel
      from public.viks_club_benefit_usage u
      join public.viks_club_subscription_benefits sb on sb.id = u.subscription_benefit_id
      join public.viks_club_subscriptions s on s.id = sb.subscription_id
      join public.viks_club_plans p on p.id = s.plan_id
      where u.appointment_id = new.id and u.voided_at is null
      for update of u
    ) loop
      if v_usage.refund_on_cancel then
        update public.viks_club_subscription_benefits
        set quantity_used = greatest(0, quantity_used - v_usage.quantity), updated_at = now()
        where id = v_usage.subscription_benefit_id;
        update public.viks_club_benefit_usage
        set voided_at = now(), void_reason = 'Estorno automático por cancelamento'
        where id = v_usage.id;
        v_refund := v_refund + v_usage.discount_cents_applied;
      end if;
    end loop;

    if v_refund > 0 then
      update public.appointments
      set club_discount_cents = greatest(0, club_discount_cents - v_refund)
      where id = new.id;
      perform public.calculate_appointment_totals(new.id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists appointments_refund_club_benefit on public.appointments;
create trigger appointments_refund_club_benefit
  after update of status on public.appointments
  for each row execute function private.refund_canceled_viks_club_usage();

revoke execute on function private.create_viks_club_benefit_cycles(uuid, uuid, timestamptz, integer, text)
  from public, anon, authenticated;
revoke execute on function private.refund_canceled_viks_club_usage()
  from public, anon, authenticated;
revoke execute on function public.self_subscribe_viks_club(uuid, text) from public, anon;
revoke execute on function public.create_viks_club_appointment(uuid, text, text, text, timestamptz, text)
  from public, anon;

grant execute on function public.self_subscribe_viks_club(uuid, text) to authenticated;
grant execute on function public.create_viks_club_appointment(uuid, text, text, text, timestamptz, text)
  to authenticated;
grant execute on function public.activate_viks_club_subscription(uuid, uuid, integer, text) to authenticated;
grant execute on function public.renew_viks_club_subscription(uuid, integer) to authenticated;
grant execute on function public.update_viks_club_subscription_status(uuid, text) to authenticated;
grant execute on function public.consume_viks_club_benefit(uuid, uuid, integer, text) to authenticated;
grant execute on function public.void_viks_club_benefit_usage(uuid, text) to authenticated;
