import { brasiliaDateTimeToIso } from '@/lib/brasilia-time';
import { supabase } from '@/lib/supabase';
import type {
  BenefitType,
  BillingPeriod,
  DayOfWeek,
  LoyaltyTransaction,
  LoyaltyTransactionType,
  SubscriptionStatus,
  ViksClubPlan,
  ViksClubSubscription,
} from '../types';

// Check if Supabase client is active
export function isSupabaseActive(): boolean {
  return Boolean(supabase);
}

// Mock Data ONLY for offline / unconfigured Supabase environment
let demoPlans: ViksClubPlan[] = [
  {
    id: 'plan-essential',
    name: 'Viks Club Essencial',
    description: 'Assinatura mensal para manutenção do corte.',
    price: 89.9,
    priceCents: 8990,
    billingPeriod: 'monthly',
    active: true,
    benefits: [
      {
        id: 'b-ess-1',
        planId: 'plan-essential',
        benefitType: 'service_credit',
        serviceId: 'cut',
        quantity: 2,
        discountPercent: 0,
        description: '2 Cortes por mês',
        active: true,
      },
    ],
  },
  {
    id: 'plan-premium',
    name: 'Viks Club Premium',
    description: 'Assinatura completa com corte, barba e benefícios.',
    price: 149.9,
    priceCents: 14990,
    billingPeriod: 'monthly',
    allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday'],
    active: true,
    benefits: [
      {
        id: 'b-prem-1',
        planId: 'plan-premium',
        benefitType: 'service_credit',
        serviceId: 'cut',
        quantity: 2,
        discountPercent: 0,
        description: '2 Cortes por mês',
        active: true,
      },
      {
        id: 'b-prem-2',
        planId: 'plan-premium',
        benefitType: 'service_credit',
        serviceId: 'beard',
        quantity: 1,
        discountPercent: 0,
        description: '1 Barba por mês',
        active: true,
      },
    ],
  },
];

let demoSubscriptions: Record<string, ViksClubSubscription> = {};
let demoTransactions: Record<string, LoyaltyTransaction[]> = {};

export async function fetchViksClubPlans(): Promise<ViksClubPlan[]> {
  if (!isSupabaseActive() || !supabase) {
    return demoPlans;
  }

  const { data: plansData, error: plansError } = await supabase
    .from('viks_club_plans')
    .select('*')
    .order('created_at', { ascending: true });

  if (plansError || !plansData) {
    console.error('Database error fetching plans:', plansError?.message);
    return [];
  }

  const { data: benefitsData } = await supabase
    .from('viks_club_plan_benefits')
    .select('*');

  return plansData.map((p) => {
    const rawBenefits = (benefitsData ?? []).filter((b) => b.plan_id === p.id);
    const pCents = Number(p.price_cents ?? roundPriceToCents(p.price));
    return {
      id: String(p.id),
      name: String(p.name),
      description: p.description ? String(p.description) : null,
      price: pCents / 100,
      priceCents: pCents,
      billingPeriod: (p.billing_period as BillingPeriod) ?? 'monthly',
      allowedDays: (p.allowed_days as DayOfWeek[]) ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      active: Boolean(p.active),
      benefits: rawBenefits.map((b) => ({
        id: String(b.id),
        planId: String(b.plan_id),
        benefitType: (b.benefit_type as BenefitType) ?? 'service_credit',
        serviceId: b.service_id ? String(b.service_id) : null,
        quantity: Number(b.quantity ?? 1),
        discountPercent: Number(b.discount_percent ?? 0),
        description: b.description ? String(b.description) : null,
        active: Boolean(b.active),
      })),
    };
  });
}

function roundPriceToCents(price: any): number {
  const num = Number(price ?? 0);
  return Math.round(num * 100);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(id?: string | null): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export async function saveViksClubPlan(input: {
  id?: string;
  name: string;
  description?: string;
  priceCents: number;
  billingPeriod: BillingPeriod;
  allowedDays?: DayOfWeek[];
  active?: boolean;
  benefits: {
    id?: string;
    benefitType: BenefitType;
    serviceId?: string;
    quantity: number;
    discountPercent?: number;
    description?: string;
  }[];
}): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseActive() || !supabase) {
    return saveDemoPlan(input);
  }

  try {
    let planId = input.id;
    const priceVal = input.priceCents / 100;

    if (planId && isUuid(planId)) {
      const { error } = await supabase
        .from('viks_club_plans')
        .update({
          name: input.name,
          description: input.description,
          price: priceVal,
          price_cents: input.priceCents,
          billing_period: input.billingPeriod,
          allowed_days: input.allowedDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          active: input.active !== undefined ? input.active : true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) return { success: false, error: error.message };
    } else {
      const { data, error } = await supabase
        .from('viks_club_plans')
        .insert({
          name: input.name,
          description: input.description,
          price: priceVal,
          price_cents: input.priceCents,
          billing_period: input.billingPeriod,
          allowed_days: input.allowedDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          active: input.active !== undefined ? input.active : true,
        })
        .select()
        .single();

      if (error || !data) return { success: false, error: error?.message || 'Erro ao criar plano.' };
      planId = String(data.id);
    }

    // Replace benefits
    await supabase.from('viks_club_plan_benefits').delete().eq('plan_id', planId);
    if (input.benefits.length > 0) {
      const benefitsInsert = input.benefits.map((b) => ({
        plan_id: planId,
        benefit_type: b.benefitType,
        service_id: b.serviceId || null,
        quantity: b.quantity,
        discount_percent: b.discountPercent || 0,
        description: b.description || null,
        active: true,
      }));
      const { error: bErr } = await supabase.from('viks_club_plan_benefits').insert(benefitsInsert);
      if (bErr) return { success: false, error: bErr.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar plano.' };
  }
}

function saveDemoPlan(input: {
  id?: string;
  name: string;
  description?: string;
  priceCents: number;
  billingPeriod: BillingPeriod;
  allowedDays?: DayOfWeek[];
  active?: boolean;
  benefits: {
    id?: string;
    benefitType: BenefitType;
    serviceId?: string;
    quantity: number;
    discountPercent?: number;
    description?: string;
  }[];
}) {
  const planId = input.id || `plan-${Date.now()}`;
  const priceVal = input.priceCents / 100;
  const newPlan: ViksClubPlan = {
    id: planId,
    name: input.name,
    description: input.description || null,
    price: priceVal,
    priceCents: input.priceCents,
    billingPeriod: input.billingPeriod,
    allowedDays: input.allowedDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    active: input.active !== undefined ? input.active : true,
    benefits: input.benefits.map((b, idx) => ({
      id: b.id || `b-${planId}-${idx}`,
      planId,
      benefitType: b.benefitType,
      serviceId: b.serviceId || null,
      quantity: b.quantity,
      discountPercent: b.discountPercent || 0,
      description: b.description || null,
      active: true,
    })),
  };
  demoPlans = demoPlans.filter((p) => p.id !== planId).concat(newPlan);
  return { success: true };
}

export async function fetchClientSubscription(clientId: string): Promise<ViksClubSubscription | null> {
  if (!isSupabaseActive() || !supabase || !clientId) {
    return demoSubscriptions[clientId] || null;
  }

  const { data: subData, error: subError } = await supabase
    .from('viks_club_subscriptions')
    .select('*, viks_club_plans(name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError) {
    console.error('Database error fetching client subscription:', subError.message);
    return null;
  }
  if (!subData) return null;

  const { data: benefitsData } = await supabase
    .from('viks_club_subscription_benefits')
    .select('*')
    .eq('subscription_id', subData.id);

  const planName = (subData.viks_club_plans as unknown as Record<string, unknown> | null)?.name;
  const nowIso = new Date().toISOString();
  let status = (subData.status as SubscriptionStatus) ?? 'active';

  // Explicitly check expiry date: if currentPeriodEnd < now, treat as expired
  if (status === 'active' && subData.current_period_end < nowIso) {
    status = 'expired';
  }

  const currentPeriodStart = String(subData.current_period_start);
  const currentPeriodEnd = String(subData.current_period_end);

  // Filter benefits to ONLY return active benefits for the current subscription period
  const activePeriodBenefits = (benefitsData ?? []).filter((b) => {
    const pStart = String(b.period_start);
    const pEnd = String(b.period_end);
    return pStart <= currentPeriodEnd && pEnd >= currentPeriodStart && pEnd >= nowIso;
  });

  return {
    id: String(subData.id),
    clientId: String(subData.client_id),
    planId: String(subData.plan_id),
    barberId: subData.barber_id ? String(subData.barber_id) : null,
    planName: planName ? String(planName) : undefined,
    status,
    startsAt: String(subData.starts_at),
    currentPeriodStart,
    currentPeriodEnd,
    canceledAt: subData.canceled_at ? String(subData.canceled_at) : null,
    pausedAt: subData.paused_at ? String(subData.paused_at) : null,
    createdBy: subData.created_by ? String(subData.created_by) : null,
    benefits: activePeriodBenefits.map((b) => ({
      id: String(b.id),
      subscriptionId: String(b.subscription_id),
      planBenefitId: b.plan_benefit_id ? String(b.plan_benefit_id) : null,
      benefitType: (b.benefit_type as BenefitType) ?? 'service_credit',
      serviceId: b.service_id ? String(b.service_id) : null,
      quantityGranted: Number(b.quantity_granted ?? 0),
      quantityUsed: Number(b.quantity_used ?? 0),
      discountPercent: Number(b.discount_percent ?? 0),
      periodStart: String(b.period_start),
      periodEnd: String(b.period_end),
    })),
  };
}

export async function activateSubscription(
  clientId: string,
  planId: string,
  cycles = 1,
  barberId?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseActive() || !supabase) {
    return fallbackDemoActivate(clientId, planId, cycles, barberId);
  }

  try {
    const { data, error } = await supabase.rpc('activate_viks_club_subscription', {
      p_client_id: clientId,
      p_plan_id: planId,
      p_cycles: cycles,
      p_barber_id: barberId || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: Boolean((data as Record<string, unknown> | null)?.success) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao ativar assinatura.' };
  }
}

function fallbackDemoActivate(clientId: string, planId: string, cycles: number, barberId?: string) {
  const plan = demoPlans.find((p) => p.id === planId);
  if (!plan) return { success: false, error: 'Plano não encontrado.' };
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + cycles);

  const subId = `sub-${Date.now()}`;
  const sub: ViksClubSubscription = {
    id: subId,
    clientId,
    planId,
    barberId: barberId || 'victor',
    planName: plan.name,
    status: 'active',
    startsAt: now.toISOString(),
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: endDate.toISOString(),
    benefits: (plan.benefits || []).map((b) => ({
      id: `sb-${subId}-${b.id}`,
      subscriptionId: subId,
      planBenefitId: b.id,
      benefitType: b.benefitType,
      serviceId: b.serviceId || null,
      quantityGranted: b.quantity * cycles,
      quantityUsed: 0,
      discountPercent: b.discountPercent || 0,
      periodStart: now.toISOString(),
      periodEnd: endDate.toISOString(),
    })),
  };
  demoSubscriptions[clientId] = sub;
  return { success: true };
}

export async function renewSubscription(
  subscriptionId: string,
  clientId: string,
  cycles = 1,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseActive() || !supabase) {
    return fallbackDemoRenew(subscriptionId, clientId, cycles);
  }

  try {
    const { data, error } = await supabase.rpc('renew_viks_club_subscription', {
      p_subscription_id: subscriptionId,
      p_cycles: cycles,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: Boolean((data as Record<string, unknown> | null)?.success) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao renovar assinatura.' };
  }
}

function fallbackDemoRenew(subscriptionId: string, clientId: string, cycles: number) {
  const sub = demoSubscriptions[clientId];
  if (!sub || sub.id !== subscriptionId) return { success: false, error: 'Assinatura não encontrada.' };
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + cycles);
  sub.status = 'active';
  sub.currentPeriodStart = now.toISOString();
  sub.currentPeriodEnd = endDate.toISOString();
  if (sub.benefits) {
    sub.benefits.forEach((b) => {
      b.quantityUsed = 0;
      b.periodStart = now.toISOString();
      b.periodEnd = endDate.toISOString();
    });
  }
  return { success: true };
}

export async function updateSubscriptionStatus(
  subscriptionId: string,
  clientId: string,
  newStatus: SubscriptionStatus,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseActive() || !supabase) {
    return fallbackDemoStatus(subscriptionId, clientId, newStatus);
  }

  try {
    const { data, error } = await supabase.rpc('update_viks_club_subscription_status', {
      p_subscription_id: subscriptionId,
      p_new_status: newStatus,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: Boolean((data as Record<string, unknown> | null)?.success) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao alterar status da assinatura.' };
  }
}

function fallbackDemoStatus(subscriptionId: string, clientId: string, newStatus: SubscriptionStatus) {
  const sub = demoSubscriptions[clientId];
  if (sub && sub.id === subscriptionId) {
    sub.status = newStatus;
    if (newStatus === 'paused') sub.pausedAt = new Date().toISOString();
    if (newStatus === 'canceled') sub.canceledAt = new Date().toISOString();
  }
  return { success: true };
}

export async function consumeBenefit(
  subscriptionBenefitId: string,
  clientId: string,
  appointmentId?: string,
  quantity = 1,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseActive() || !supabase) {
    return fallbackDemoConsume(subscriptionBenefitId, clientId, quantity);
  }

  try {
    const { data, error } = await supabase.rpc('consume_viks_club_benefit', {
      p_subscription_benefit_id: subscriptionBenefitId,
      p_appointment_id: appointmentId || null,
      p_quantity: quantity,
      p_notes: notes || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: Boolean((data as Record<string, unknown> | null)?.success) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao registrar consumo de benefício.' };
  }
}

function fallbackDemoConsume(subscriptionBenefitId: string, clientId: string, quantity: number) {
  const sub = demoSubscriptions[clientId];
  if (!sub || sub.status !== 'active' || !sub.benefits) {
    return { success: false, error: 'Assinatura inativa ou sem benefícios.' };
  }
  const b = sub.benefits.find((item) => item.id === subscriptionBenefitId);
  if (!b) return { success: false, error: 'Benefício não encontrado.' };
  if (b.quantityUsed + quantity > b.quantityGranted) {
    return { success: false, error: `Saldo insuficiente (Disponível: ${b.quantityGranted - b.quantityUsed}).` };
  }
  b.quantityUsed += quantity;
  return { success: true };
}

export async function voidBenefitUsage(
  usageId: string,
  reason = 'Estorno de atendimento',
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseActive() || !supabase) {
    return { success: true };
  }

  try {
    const { data, error } = await supabase.rpc('void_viks_club_benefit_usage', {
      p_usage_id: usageId,
      p_reason: reason,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: Boolean((data as Record<string, unknown> | null)?.success) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao estornar uso do benefício.' };
  }
}

export async function fetchLoyaltyTransactions(clientId: string): Promise<LoyaltyTransaction[]> {
  if (!isSupabaseActive() || !supabase || !clientId) {
    return demoTransactions[clientId] || [
      {
        id: 'tx-1',
        clientId,
        type: 'earn',
        points: 100,
        reason: 'Atendimento presencial',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'tx-2',
        clientId,
        type: 'adjustment_credit',
        points: 50,
        reason: 'Bônus de Boas-Vindas Viks',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  }

  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('Database error fetching loyalty transactions:', error?.message);
    return [];
  }

  return data.map((t) => ({
    id: String(t.id),
    clientId: String(t.client_id),
    type: (t.type as LoyaltyTransactionType) ?? 'earn',
    points: Number(t.points ?? 0),
    reason: String(t.reason ?? ''),
    appointmentId: t.appointment_id ? String(t.appointment_id) : null,
    createdBy: t.created_by ? String(t.created_by) : null,
    createdAt: String(t.created_at),
  }));
}

export async function manageLoyaltyPoints(
  clientId: string,
  type: LoyaltyTransactionType,
  points: number,
  reason: string,
  appointmentId?: string,
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  if (!isSupabaseActive() || !supabase) {
    return fallbackDemoManageLoyalty(clientId, type, points, reason, appointmentId);
  }

  try {
    const { data, error } = await supabase.rpc('manage_loyalty_points', {
      p_client_id: clientId,
      p_type: type,
      p_points: points,
      p_reason: reason,
      p_appointment_id: appointmentId || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    const res = data as Record<string, unknown> | null;
    return { success: Boolean(res?.success), newBalance: Number(res?.new_balance ?? 0) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao processar pontos de fidelidade.' };
  }
}

function fallbackDemoManageLoyalty(
  clientId: string,
  type: LoyaltyTransactionType,
  points: number,
  reason: string,
  appointmentId?: string,
) {
  const list = demoTransactions[clientId] || [];
  const newTx: LoyaltyTransaction = {
    id: `tx-${Date.now()}`,
    clientId,
    type,
    points,
    reason,
    appointmentId: appointmentId || null,
    createdAt: new Date().toISOString(),
  };
  demoTransactions[clientId] = [newTx, ...list];
  let balance = list.reduce((acc, t) => acc + (t.type === 'earn' || t.type === 'adjustment_credit' || t.type === 'adjustment' ? t.points : -t.points), 0);
  balance += type === 'earn' || type === 'adjustment_credit' || type === 'adjustment' ? points : -points;
  return { success: true, newBalance: Math.max(0, balance) };
}

export async function rescheduleAppointment(
  appointmentId: string,
  date: string,
  time: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseActive() || !supabase) {
    return { success: true };
  }
  try {
    const startsAt = brasiliaDateTimeToIso(date, time);
    const { data, error } = await supabase.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId,
      p_starts_at: startsAt,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const res = data as Record<string, unknown> | null;
    return { success: Boolean(res?.success) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao reagendar atendimento.' };
  }
}
