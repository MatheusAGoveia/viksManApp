-- Migration: Consolidate Viks Club & Loyalty System Schema, RLS & Atomic RPCs
-- Date: 2026-08-19

-- 1. Schema Extensions & Price Cents Conversion
ALTER TABLE public.viks_club_plans
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0 CONSTRAINT viks_club_plans_price_cents_check CHECK (price_cents >= 0);

-- Migrate existing float/numeric price to price_cents if applicable
UPDATE public.viks_club_plans
SET price_cents = round(price * 100)
WHERE price_cents = 0 AND price > 0;

-- Appointments club discount tracking
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS club_discount_cents integer NOT NULL DEFAULT 0 CONSTRAINT appointments_club_discount_cents_check CHECK (club_discount_cents >= 0);

-- Benefit Usage Void/Reversal Audit columns
ALTER TABLE public.viks_club_benefit_usage
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text;

-- 2. Partial Unique Index: Client can have at most ONE current (active or paused) subscription
DROP INDEX IF EXISTS public.idx_unique_active_subscription_per_client;
DROP INDEX IF EXISTS public.idx_unique_current_subscription_per_client;

CREATE UNIQUE INDEX idx_unique_current_subscription_per_client
  ON public.viks_club_subscriptions (client_id)
  WHERE (status IN ('active', 'paused'));

-- 3. RLS hardening: Revoke direct INSERT/UPDATE/DELETE from clients and staff
-- All mutations on subscriptions, benefits, usage, and loyalty transactions MUST go through SECURITY DEFINER RPCs!

DROP POLICY IF EXISTS "Manager/Admin manage subscriptions" ON public.viks_club_subscriptions;
DROP POLICY IF EXISTS "Staff manage subscription benefits" ON public.viks_club_subscription_benefits;
DROP POLICY IF EXISTS "Staff insert benefit usage" ON public.viks_club_benefit_usage;
DROP POLICY IF EXISTS "Manager/Admin manage loyalty transactions" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "Staff manage plans" ON public.viks_club_plans;
DROP POLICY IF EXISTS "Staff manage plan benefits" ON public.viks_club_plan_benefits;

-- Plans & Plan Benefits RLS (Select all auth, Manage manager/admin)
CREATE POLICY "Manager/Admin manage plans" ON public.viks_club_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Manager/Admin manage plan benefits" ON public.viks_club_plan_benefits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('manager', 'admin')
    )
  );

-- Subscriptions, Subscription Benefits, Benefit Usage, Loyalty Transactions RLS:
-- SELECT allowed for client (own) and staff (all). NO INSERT/UPDATE/DELETE policies for clients/staff directly!

-- 4. ATOMIC SECURITY DEFINER RPCs

-- Helper Function: Calculate appointment payment status based on totals and payments made
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
  WHERE appointment_id = p_appointment_id;

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

-- RPC 1: Activate Subscription (No auto-cancel, strict auth.uid() audit, cycle-based period)
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

  -- Check if client already has a current active or paused subscription
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

  -- Create initial benefit snapshots for this cycle
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

-- RPC 2: Renew Subscription (Cycle-based, preserves old snapshots, generates new benefit snapshots)
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

  -- Start new period from current_period_end if still valid or now if expired
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

  -- Create NEW benefit snapshots for the new period cycle (leaving old snapshots intact)
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

-- RPC 3: Pause / Reactivate / Cancel Subscription Status
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

  -- If trying to reactivate a subscription whose period has already expired, demand renewal instead
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

-- RPC 4: Consume Benefit (Atomic with appointment monetary discount calculation)
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
  v_unit_cents INTEGER := 0;
  v_discount_cents INTEGER := 0;
  v_usage_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_auth_uid AND role IN ('reception', 'manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Apenas recepção, gerentes e administradores podem registrar consumo de benefícios.';
  END IF;

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

  -- Require active validity period
  IF now() < v_sub_benefit.period_start OR now() > v_sub_benefit.period_end OR v_sub.current_period_end < now() THEN
    RAISE EXCEPTION 'O benefício está fora do período de vigência da assinatura.';
  END IF;

  IF (v_sub_benefit.quantity_used + p_quantity) > v_sub_benefit.quantity_granted THEN
    RAISE EXCEPTION 'Saldo insuficiente para este benefício (Disponível: %).', (v_sub_benefit.quantity_granted - v_sub_benefit.quantity_used);
  END IF;

  -- Increment usage on benefit snapshot
  UPDATE public.viks_club_subscription_benefits
  SET quantity_used = quantity_used + p_quantity,
      updated_at = now()
  WHERE id = p_subscription_benefit_id;

  INSERT INTO public.viks_club_benefit_usage (
    subscription_benefit_id, client_id, appointment_id, quantity, used_at, created_by, notes
  ) VALUES (
    p_subscription_benefit_id, v_sub.client_id, p_appointment_id, p_quantity, now(), v_auth_uid, p_notes
  ) RETURNING id INTO v_usage_id;

  -- Apply financial discount on appointment if attached
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_app FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
    IF FOUND THEN
      v_unit_cents := v_app.unit_price_cents;
      v_discount_cents := v_unit_cents * p_quantity;

      UPDATE public.appointments
      SET club_discount_cents = club_discount_cents + v_discount_cents
      WHERE id = p_appointment_id;

      -- Recalculate appointment totals and payment status
      PERFORM public.calculate_appointment_totals(p_appointment_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'usage_id', v_usage_id,
    'remaining', (v_sub_benefit.quantity_granted - (v_sub_benefit.quantity_used + p_quantity)),
    'discount_cents_applied', v_discount_cents
  );
END;
$$;

-- RPC 5: Void / Reverse Benefit Usage (Audit-safe, restores benefit balance and appointment total)
CREATE OR REPLACE FUNCTION public.void_viks_club_benefit_usage(
  p_usage_id uuid,
  p_reason text DEFAULT 'Estorno de atendimento'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_usage RECORD;
  v_sub_benefit RECORD;
  v_app RECORD;
  v_discount_cents INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_auth_uid AND role IN ('reception', 'manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Apenas recepção, gerentes e administradores podem reverter uso de benefícios.';
  END IF;

  SELECT * INTO v_usage
  FROM public.viks_club_benefit_usage
  WHERE id = p_usage_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de uso não encontrado.';
  END IF;

  IF v_usage.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este consumo de benefício já foi estornado anteriormente.';
  END IF;

  SELECT * INTO v_sub_benefit
  FROM public.viks_club_subscription_benefits
  WHERE id = v_usage.subscription_benefit_id
  FOR UPDATE;

  -- Restore quantity on benefit snapshot
  UPDATE public.viks_club_subscription_benefits
  SET quantity_used = GREATEST(0, quantity_used - v_usage.quantity),
      updated_at = now()
  WHERE id = v_usage.subscription_benefit_id;

  -- Mark usage as voided
  UPDATE public.viks_club_benefit_usage
  SET voided_at = now(),
      voided_by = v_auth_uid,
      void_reason = p_reason
  WHERE id = p_usage_id;

  -- Reverse appointment monetary discount if attached
  IF v_usage.appointment_id IS NOT NULL THEN
    SELECT * INTO v_app FROM public.appointments WHERE id = v_usage.appointment_id FOR UPDATE;
    IF FOUND THEN
      v_discount_cents := v_app.unit_price_cents * v_usage.quantity;

      UPDATE public.appointments
      SET club_discount_cents = GREATEST(0, club_discount_cents - v_discount_cents)
      WHERE id = v_usage.appointment_id;

      PERFORM public.calculate_appointment_totals(v_usage.appointment_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'restored_quantity', v_usage.quantity,
    'new_used_quantity', GREATEST(0, v_sub_benefit.quantity_used - v_usage.quantity)
  );
END;
$$;

-- RPC 6: Manage Loyalty Points (Atomic, locks profile row, strict types, uses auth.uid())
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
