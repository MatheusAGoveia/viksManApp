-- Migration: Hotfix Final Viks Club, Loyalty System, Profile Protection & Rescheduling
-- Date: 2026-08-19

-- 1. Migrate legacy loyalty_transactions types and fix constraint
UPDATE public.loyalty_transactions
SET type = 'adjustment_credit'
WHERE type = 'adjustment';

ALTER TABLE public.loyalty_transactions
  DROP CONSTRAINT IF EXISTS loyalty_tx_type_check;

ALTER TABLE public.loyalty_transactions
  ADD CONSTRAINT loyalty_tx_type_check
  CHECK (type IN ('earn', 'redeem', 'adjustment_credit', 'adjustment_debit', 'expiration'));

-- 2. Unified Appointment Financial Calculation Function & Trigger
CREATE OR REPLACE FUNCTION public.calculate_appointment_totals(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_app RECORD;
  v_gross_service_cents INTEGER;
  v_due_cents INTEGER;
  v_paid_cents INTEGER;
  v_status TEXT;
BEGIN
  SELECT * INTO v_app FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_gross_service_cents := v_app.unit_price_cents * COALESCE(v_app.party_size, 1);
  v_due_cents := GREATEST(0, v_gross_service_cents - COALESCE(v_app.club_discount_cents, 0) + COALESCE(v_app.gratuity_cents, 0));

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_paid_cents
  FROM public.appointment_payments
  WHERE appointment_id = p_appointment_id AND status = 'paid';

  IF v_paid_cents >= v_due_cents THEN
    v_status := 'paid';
  ELSIF v_paid_cents > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

  UPDATE public.appointments
  SET payment_status = v_status
  WHERE id = p_appointment_id;
END;
$$;

-- Trigger function for appointment_payments
CREATE OR REPLACE FUNCTION private.sync_appointment_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment_id uuid := COALESCE(NEW.appointment_id, OLD.appointment_id);
BEGIN
  PERFORM public.calculate_appointment_totals(v_appointment_id);
  RETURN NULL;
END;
$$;

-- Re-create appointment_payments sync trigger
DROP TRIGGER IF EXISTS appointment_payments_sync_status ON public.appointment_payments;
CREATE TRIGGER appointment_payments_sync_status
  AFTER INSERT OR UPDATE OR DELETE ON public.appointment_payments
  FOR EACH ROW EXECUTE PROCEDURE private.sync_appointment_payment_status();

-- 3. Database-Level Protection for Profiles Privileged Fields (viks_points_balance, viks_club_status, role)
CREATE OR REPLACE FUNCTION private.protect_profiles_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Protect viks_points_balance: can ONLY be updated when config local flag is set by manage_loyalty_points RPC
  IF (OLD.viks_points_balance IS DISTINCT FROM NEW.viks_points_balance) THEN
    IF current_setting('app.in_rpc_manage_loyalty', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'O saldo de pontos de fidelidade (viks_points_balance) só pode ser alterado via RPC oficial (manage_loyalty_points).';
    END IF;
  END IF;

  -- Protect viks_club_status: can ONLY be updated by subscription RPCs or manager/admin
  IF (OLD.viks_club_status IS DISTINCT FROM NEW.viks_club_status) THEN
    IF current_setting('app.in_rpc_subscription', true) IS DISTINCT FROM 'true' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')
      ) THEN
        RAISE EXCEPTION 'O status do Viks Club (viks_club_status) só pode ser alterado por gerentes ou administradores.';
      END IF;
    END IF;
  END IF;

  -- Protect role: can ONLY be updated by admins
  IF (OLD.role IS DISTINCT FROM NEW.role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar a role de um usuário.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_fields ON public.profiles;
CREATE TRIGGER trg_protect_profiles_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_profiles_privileged_fields();

-- 4. Harden consume_viks_club_benefit RPC with 9 strict validations & Duplicate Prevention
CREATE OR REPLACE FUNCTION public.consume_viks_club_benefit(
  p_subscription_benefit_id uuid,
  p_appointment_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 1,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_sub_benefit RECORD;
  v_sub RECORD;
  v_app RECORD;
  v_discount_cents INTEGER := 0;
  v_max_allowed_discount INTEGER := 0;
  v_usage_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_auth_uid AND role IN ('reception', 'manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Apenas recepção, gerentes e administradores podem registrar consumo de benefícios.';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade solicitada deve ser maior que zero.';
  END IF;

  -- Lock benefit snapshot
  SELECT * INTO v_sub_benefit
  FROM public.viks_club_subscription_benefits
  WHERE id = p_subscription_benefit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Benefício não encontrado.';
  END IF;

  SELECT * INTO v_sub FROM public.viks_club_subscriptions WHERE id = v_sub_benefit.subscription_id;

  IF v_sub.status != 'active' THEN
    RAISE EXCEPTION 'A assinatura do cliente não está ativa.';
  END IF;

  -- 1, 2, 3. Validate active period and remaining balance
  IF now() < v_sub_benefit.period_start OR now() > v_sub_benefit.period_end OR v_sub.current_period_end < now() THEN
    RAISE EXCEPTION 'O benefício está fora do período de vigência da assinatura.';
  END IF;

  IF (v_sub_benefit.quantity_used + p_quantity) > v_sub_benefit.quantity_granted THEN
    RAISE EXCEPTION 'Saldo insuficiente para este benefício (Disponível: %).', (v_sub_benefit.quantity_granted - v_sub_benefit.quantity_used);
  END IF;

  -- 4, 5, 6, 7, 8. Appointment validations if attached
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_app FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Atendimento não encontrado.';
    END IF;

    IF v_app.client_id <> v_sub.client_id THEN
      RAISE EXCEPTION 'Este atendimento pertence a outro cliente.';
    END IF;

    IF v_sub_benefit.service_id IS NOT NULL AND v_app.service_id <> v_sub_benefit.service_id THEN
      RAISE EXCEPTION 'O serviço do atendimento não corresponde ao benefício do plano.';
    END IF;

    IF v_app.status IN ('cancelled', 'no_show') THEN
      RAISE EXCEPTION 'Não é possível aplicar benefício a um atendimento cancelado ou no-show.';
    END IF;

    -- Prevent duplicate application on same appointment
    IF EXISTS (
      SELECT 1 FROM public.viks_club_benefit_usage
      WHERE appointment_id = p_appointment_id
        AND subscription_benefit_id = p_subscription_benefit_id
        AND voided_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Este benefício já foi aplicado a este atendimento.';
    END IF;

    -- Calculate discount (capped at gross service price)
    v_max_allowed_discount := v_app.unit_price_cents * COALESCE(v_app.party_size, 1);
    v_discount_cents := LEAST(v_app.unit_price_cents * p_quantity, v_max_allowed_discount);
  END IF;

  -- Update benefit quantity_used
  UPDATE public.viks_club_subscription_benefits
  SET quantity_used = quantity_used + p_quantity,
      updated_at = now()
  WHERE id = p_subscription_benefit_id;

  INSERT INTO public.viks_club_benefit_usage (
    subscription_benefit_id, client_id, appointment_id, quantity, used_at, created_by, notes
  ) VALUES (
    p_subscription_benefit_id, v_sub.client_id, p_appointment_id, p_quantity, now(), v_auth_uid, p_notes
  ) RETURNING id INTO v_usage_id;

  IF p_appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET club_discount_cents = club_discount_cents + v_discount_cents
    WHERE id = p_appointment_id;

    PERFORM public.calculate_appointment_totals(p_appointment_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'usage_id', v_usage_id,
    'remaining', (v_sub_benefit.quantity_granted - (v_sub_benefit.quantity_used + p_quantity)),
    'discount_cents_applied', v_discount_cents
  );
END;
$$;

-- 5. RPC: Atomic Rescheduling of Existing Appointment
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_app RECORD;
  v_duration_minutes INTEGER := 45;
  v_ends_at timestamptz;
BEGIN
  SELECT * INTO v_app FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;

  IF v_app.client_id <> v_auth_uid AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_auth_uid AND role IN ('barber', 'reception', 'manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para reagendar este atendimento.';
  END IF;

  SELECT duration_minutes INTO v_duration_minutes
  FROM public.services WHERE id = v_app.service_id;
  v_duration_minutes := COALESCE(v_duration_minutes, 45);

  v_ends_at := p_starts_at + make_interval(mins => v_duration_minutes * COALESCE(v_app.party_size, 1));

  -- Check conflict on barber schedule ignoring current appointment
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.barber_id = v_app.barber_id
      AND a.id <> p_appointment_id
      AND a.status IN ('pending', 'confirmed', 'checked_in', 'in_service')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Horário indisponível na agenda do profissional.';
  END IF;

  UPDATE public.appointments
  SET starts_at = p_starts_at,
      ends_at = v_ends_at,
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Update manage_loyalty_points and subscription RPCs to set session config for trigger bypass
CREATE OR REPLACE FUNCTION public.manage_loyalty_points(
  p_client_id uuid,
  p_type text,
  p_points integer,
  p_reason text,
  p_appointment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_profile RECORD;
  v_new_balance integer;
BEGIN
  PERFORM set_config('app.in_rpc_manage_loyalty', 'true', true);

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_auth_uid AND role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Apenas gerentes e administradores podem alterar pontos de fidelidade.';
  END IF;

  IF p_type NOT IN ('earn', 'redeem', 'adjustment_credit', 'adjustment_debit', 'expiration') THEN
    RAISE EXCEPTION 'Tipo de transação de pontos inválido.';
  END IF;

  IF p_points <= 0 THEN
    RAISE EXCEPTION 'A quantidade de pontos deve ser maior que zero.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  IF p_type IN ('redeem', 'adjustment_debit', 'expiration') THEN
    IF v_profile.viks_points_balance < p_points THEN
      RAISE EXCEPTION 'Saldo insuficiente de pontos (Saldo atual: %, Solicitado: %).', v_profile.viks_points_balance, p_points;
    END IF;
    v_new_balance := v_profile.viks_points_balance - p_points;
  ELSE
    v_new_balance := v_profile.viks_points_balance + p_points;
  END IF;

  INSERT INTO public.loyalty_transactions (
    client_id, type, points, reason, appointment_id, created_by
  ) VALUES (
    p_client_id, p_type, p_points, p_reason, p_appointment_id, v_auth_uid
  );

  UPDATE public.profiles
  SET viks_points_balance = v_new_balance
  WHERE id = p_client_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_viks_club_subscription(
  p_client_id uuid,
  p_plan_id uuid,
  p_cycles integer DEFAULT 1,
  p_barber_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_plan RECORD;
  v_sub_id uuid;
  v_period_start timestamptz := now();
  v_period_end timestamptz;
  v_b RECORD;
  v_cycles integer := GREATEST(1, COALESCE(p_cycles, 1));
BEGIN
  PERFORM set_config('app.in_rpc_subscription', 'true', true);

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_auth_uid AND role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Apenas gerentes e administradores podem ativar assinaturas.';
  END IF;

  SELECT * INTO v_plan FROM public.viks_club_plans WHERE id = p_plan_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado ou inativo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.viks_club_subscriptions
    WHERE client_id = p_client_id AND status IN ('active', 'paused')
  ) THEN
    RAISE EXCEPTION 'Cliente já possui uma assinatura vigente (ativa ou pausada). Cancele a assinatura atual antes de ativar um novo plano.';
  END IF;

  IF v_plan.billing_period = 'yearly' THEN
    v_period_end := v_period_start + (v_cycles || ' year')::interval;
  ELSE
    v_period_end := v_period_start + (v_cycles || ' month')::interval;
  END IF;

  INSERT INTO public.viks_club_subscriptions (
    client_id, plan_id, barber_id, status, starts_at, current_period_start, current_period_end, created_by
  ) VALUES (
    p_client_id, p_plan_id, p_barber_id, 'active', v_period_start, v_period_start, v_period_end, v_auth_uid
  ) RETURNING id INTO v_sub_id;

  FOR v_b IN (SELECT * FROM public.viks_club_plan_benefits WHERE plan_id = p_plan_id AND active = true) LOOP
    INSERT INTO public.viks_club_subscription_benefits (
      subscription_id, plan_benefit_id, benefit_type, service_id, quantity_granted, quantity_used, discount_percent, period_start, period_end
    ) VALUES (
      v_sub_id, v_b.id, v_b.benefit_type, v_b.service_id, v_b.quantity * v_cycles, 0, v_b.discount_percent, v_period_start, v_period_end
    );
  END LOOP;

  UPDATE public.profiles
  SET viks_club_status = 'active'
  WHERE id = p_client_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_viks_club_subscription(
  p_subscription_id uuid,
  p_cycles integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_sub RECORD;
  v_plan RECORD;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_b RECORD;
  v_cycles integer := GREATEST(1, COALESCE(p_cycles, 1));
BEGIN
  PERFORM set_config('app.in_rpc_subscription', 'true', true);

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_auth_uid AND role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Apenas gerentes e administradores podem renovar assinaturas.';
  END IF;

  SELECT * INTO v_sub FROM public.viks_club_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada.';
  END IF;

  SELECT * INTO v_plan FROM public.viks_club_plans WHERE id = v_sub.plan_id;

  v_period_start := GREATEST(now(), v_sub.current_period_end);
  IF v_plan.billing_period = 'yearly' THEN
    v_period_end := v_period_start + (v_cycles || ' year')::interval;
  ELSE
    v_period_end := v_period_start + (v_cycles || ' month')::interval;
  END IF;

  UPDATE public.viks_club_subscriptions
  SET status = 'active',
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      paused_at = NULL,
      updated_at = now()
  WHERE id = p_subscription_id;

  FOR v_b IN (SELECT * FROM public.viks_club_plan_benefits WHERE plan_id = v_sub.plan_id AND active = true) LOOP
    INSERT INTO public.viks_club_subscription_benefits (
      subscription_id, plan_benefit_id, benefit_type, service_id, quantity_granted, quantity_used, discount_percent, period_start, period_end
    ) VALUES (
      p_subscription_id, v_b.id, v_b.benefit_type, v_b.service_id, v_b.quantity * v_cycles, 0, v_b.discount_percent, v_period_start, v_period_end
    );
  END LOOP;

  UPDATE public.profiles SET viks_club_status = 'active' WHERE id = v_sub.client_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_viks_club_subscription_status(
  p_subscription_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_sub RECORD;
BEGIN
  PERFORM set_config('app.in_rpc_subscription', 'true', true);

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_auth_uid AND role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Apenas gerentes e administradores podem alterar status de assinaturas.';
  END IF;

  IF p_new_status NOT IN ('active', 'paused', 'canceled') THEN
    RAISE EXCEPTION 'Status inválido.';
  END IF;

  SELECT * INTO v_sub FROM public.viks_club_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada.';
  END IF;

  IF p_new_status = 'active' AND v_sub.current_period_end < now() THEN
    RAISE EXCEPTION 'O período desta assinatura expirou em %. É necessário renovar a assinatura.', to_char(v_sub.current_period_end, 'DD/MM/YYYY');
  END IF;

  UPDATE public.viks_club_subscriptions
  SET status = p_new_status,
      paused_at = CASE WHEN p_new_status = 'paused' THEN now() ELSE paused_at END,
      canceled_at = CASE WHEN p_new_status = 'canceled' THEN now() ELSE canceled_at END,
      updated_at = now()
  WHERE id = p_subscription_id;

  UPDATE public.profiles SET viks_club_status = p_new_status WHERE id = v_sub.client_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Enhance private.create_appointment to match service/barber by both slug and UUID id
CREATE OR REPLACE FUNCTION private.create_appointment(
  p_unit_slug text,
  p_service_slug text,
  p_barber_slug text,
  p_starts_at timestamptz,
  p_notes text DEFAULT NULL,
  p_booked_via text DEFAULT 'app',
  p_party_size integer DEFAULT 1,
  p_gratuity_cents integer DEFAULT 0
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit public.units;
  v_service public.services;
  v_barber_id uuid;
  v_duration integer;
  v_unit_price integer;
  v_end timestamptz;
  v_result public.appointments;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_party_size NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'INVALID_PARTY_SIZE'; END IF;
  IF p_gratuity_cents < 0 OR p_gratuity_cents > 100000 THEN RAISE EXCEPTION 'INVALID_GRATUITY'; END IF;

  SELECT * INTO v_unit FROM public.units WHERE slug = p_unit_slug AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNIT_NOT_FOUND'; END IF;

  SELECT * INTO v_service FROM public.services WHERE (slug = p_service_slug OR id::text = p_service_slug) AND active LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;

  IF p_starts_at < now() + make_interval(mins => v_unit.min_booking_notice_minutes) THEN
    RAISE EXCEPTION 'MIN_BOOKING_NOTICE';
  END IF;
  IF p_starts_at >= now() + make_interval(days => v_unit.max_booking_days) THEN
    RAISE EXCEPTION 'MAX_BOOKING_WINDOW';
  END IF;

  SELECT b.id,
         COALESCE(bs.duration_override_minutes, v_service.duration_minutes),
         COALESCE(bs.price_override_cents, v_service.price_cents)
    INTO v_barber_id, v_duration, v_unit_price
  FROM public.barbers b
  JOIN public.barber_services bs ON bs.barber_id = b.id AND bs.service_id = v_service.id
  JOIN public.working_hours wh ON wh.barber_id = b.id
    AND wh.weekday = EXTRACT(dow FROM (p_starts_at AT TIME ZONE v_unit.timezone))::smallint
    AND wh.active
  WHERE b.unit_id = v_unit.id AND b.active
    AND (p_barber_slug IN ('first', '') OR b.slug = p_barber_slug OR b.id::text = p_barber_slug)
    AND (p_starts_at AT TIME ZONE v_unit.timezone)::time >= wh.opens_at
    AND ((p_starts_at AT TIME ZONE v_unit.timezone)::time + make_interval(
      mins => (COALESCE(bs.duration_override_minutes, v_service.duration_minutes) * p_party_size) + v_unit.default_buffer_minutes
    )) <= wh.closes_at
    AND NOT EXISTS (
      SELECT 1 FROM public.schedule_blocks block
      WHERE block.barber_id = b.id
        AND tstzrange(block.starts_at, block.ends_at, '[)') && tstzrange(
          p_starts_at,
          p_starts_at + make_interval(mins => (COALESCE(bs.duration_override_minutes, v_service.duration_minutes) * p_party_size) + v_unit.default_buffer_minutes),
          '[)'
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.barber_id = b.id
        AND a.status IN ('pending', 'confirmed', 'checked_in', 'in_service')
        AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(
          p_starts_at,
          p_starts_at + make_interval(mins => (COALESCE(bs.duration_override_minutes, v_service.duration_minutes) * p_party_size) + v_unit.default_buffer_minutes),
          '[)'
        )
    )
  ORDER BY b.sort_order, b.name
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
  END IF;

  v_end := p_starts_at + make_interval(mins => (v_duration * p_party_size) + v_unit.default_buffer_minutes);

  INSERT INTO public.appointments (
    unit_id, service_id, barber_id, client_id, starts_at, ends_at, notes, booked_via, party_size, unit_price_cents, gratuity_cents
  ) VALUES (
    v_unit.id, v_service.id, v_barber_id, auth.uid(), p_starts_at, v_end, p_notes, p_booked_via, p_party_size, v_unit_price, p_gratuity_cents
  ) RETURNING * INTO v_result;

  PERFORM public.calculate_appointment_totals(v_result.id);

  RETURN v_result;
END;
$$;

