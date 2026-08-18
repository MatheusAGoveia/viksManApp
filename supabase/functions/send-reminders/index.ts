import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

function getSecretKey() {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) return JSON.parse(keys).default as string;
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

type NotificationJob = {
  id: string;
  channel: 'push' | 'whatsapp';
  template: 'confirmation' | 'reminder_24h' | 'reminder_2h' | 'changed' | 'cancelled';
  attempts: number;
  appointment: {
    starts_at: string;
    client_id: string;
    service: { name: string } | null;
    barber: { name: string } | null;
    client: { full_name: string | null; phone: string | null; whatsapp_consent: boolean } | null;
  } | null;
};

type Promotion = {
  id: string;
  title: string;
  message: string;
  discount_label: string | null;
  audience: 'all' | 'inactive_30d' | 'inactive_60d' | 'birthday_month';
};

type PromotionDelivery = {
  id: string;
  promotion_id: string;
  phone: string;
  attempts: number;
  promotion: Pick<Promotion, 'title' | 'message' | 'discount_label'> | null;
  client: { full_name: string | null } | null;
};

function messageFor(job: NotificationJob) {
  const appointment = job.appointment;
  const name = appointment?.client?.full_name?.split(' ')[0] || 'cliente';
  const service = appointment?.service?.name ?? 'atendimento';
  const barber = appointment?.barber?.name ?? 'equipe Viks';
  const date = appointment
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(appointment.starts_at))
    : '';
  const copy = {
    confirmation: `Tudo certo, ${name}. Seu ${service} com ${barber} está confirmado para ${date}.`,
    reminder_24h: `Lembrete Viks: amanhã tem ${service} com ${barber}, às ${date}.`,
    reminder_2h: `Seu horário na Viks é em 2 horas. Te esperamos para o ${service}.`,
    changed: `Seu horário na Viks foi alterado. Novo horário: ${date}, com ${barber}.`,
    cancelled: `Seu horário na Viks foi cancelado. Quando quiser, faça um novo agendamento pelo app.`,
  } as const;
  return copy[job.template];
}

async function sendPush(token: string, body: string) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title: 'Viks Man', body, sound: 'default', data: { route: '/appointments' } }),
  });
  if (!response.ok) throw new Error(`EXPO_PUSH_${response.status}`);
}

async function sendWhatsApp(phone: string, body: string) {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) throw new Error('WHATSAPP_NOT_CONFIGURED');
  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } }),
  });
  if (!response.ok) throw new Error(`WHATSAPP_${response.status}`);
}

async function sendPromotionWhatsApp(phone: string, promotion: Pick<Promotion, 'title' | 'message' | 'discount_label'>, firstName: string) {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const templateName = Deno.env.get('WHATSAPP_PROMOTION_TEMPLATE');
  if (!phoneNumberId || !accessToken || !templateName) throw new Error('WHATSAPP_PROMOTION_TEMPLATE_NOT_CONFIGURED');
  const text = `${promotion.title}${promotion.discount_label ? ` · ${promotion.discount_label}` : ''}\n${promotion.message}`;
  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: firstName }, { type: 'text', text }] }],
      },
    }),
  });
  if (!response.ok) throw new Error(`WHATSAPP_PROMOTION_${response.status}_${await response.text()}`);
}

async function createPromotionDeliveries(admin: SupabaseClient, promotion: Promotion) {
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, phone, birth_date')
    .eq('role', 'client')
    .eq('marketing_consent', true)
    .eq('whatsapp_consent', true)
    .not('phone', 'is', null);
  if (profileError) throw profileError;
  let recipients = profiles ?? [];

  if (promotion.audience === 'birthday_month') {
    const month = new Date().getMonth() + 1;
    recipients = recipients.filter((profile) => profile.birth_date && Number(String(profile.birth_date).slice(5, 7)) === month);
  } else if (promotion.audience === 'inactive_30d' || promotion.audience === 'inactive_60d') {
    const days = promotion.audience === 'inactive_30d' ? 30 : 60;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { data: recent, error: recentError } = await admin.from('appointments').select('client_id').gte('starts_at', cutoff).in('status', ['confirmed', 'checked_in', 'in_service', 'completed']);
    if (recentError) throw recentError;
    const activeIds = new Set((recent ?? []).map((appointment) => appointment.client_id));
    recipients = recipients.filter((profile) => !activeIds.has(profile.id));
  }

  if (recipients.length) {
    const { error } = await admin.from('promotion_deliveries').upsert(
      recipients.map((profile) => ({ promotion_id: promotion.id, client_id: profile.id, phone: profile.phone, status: 'pending' })),
      { onConflict: 'promotion_id,client_id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  if (recipients.length === 0) await admin.from('promotions').update({ status: 'sent' }).eq('id', promotion.id);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = getSecretKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'SERVER_NOT_CONFIGURED' }, { status: 500, headers: corsHeaders });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: authorized, error: authorizationError } = await admin.rpc('verify_worker_secret', { p_secret: request.headers.get('x-cron-secret') });
  if (authorizationError || authorized !== true) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: corsHeaders });
  }

  const { data: duePromotions, error: promotionClaimError } = await admin.rpc('activate_due_promotions', { p_limit: 20 });
  if (promotionClaimError) return Response.json({ error: promotionClaimError.message }, { status: 500, headers: corsHeaders });
  for (const promotion of (duePromotions ?? []) as Promotion[]) {
    try {
      await createPromotionDeliveries(admin, promotion);
    } catch (promotionError) {
      await admin.from('promotions').update({ status: 'scheduled' }).eq('id', promotion.id);
      console.error('promotion audience error', promotion.id, promotionError);
    }
  }

  const { data: claimed, error: claimError } = await admin.rpc('claim_notification_jobs', { p_limit: 100 });
  if (claimError) return Response.json({ error: claimError.message }, { status: 500, headers: corsHeaders });
  const claimedIds = (claimed ?? []).map((item: { id: string }) => item.id);
  let data: unknown[] = [];
  if (claimedIds.length) {
    const result = await admin
      .from('notification_jobs')
      .select('id, channel, template, attempts, appointment:appointments(starts_at, client_id, service:services(name), barber:barbers(name), client:profiles(full_name, phone, whatsapp_consent))')
      .in('id', claimedIds);
    if (result.error) {
      await admin.from('notification_jobs').update({ status: 'pending', last_error: result.error.message }).in('id', claimedIds);
      return Response.json({ error: result.error.message }, { status: 500, headers: corsHeaders });
    }
    data = result.data ?? [];
  }

  let sent = 0;
  for (const rawJob of data) {
    const job = rawJob as unknown as NotificationJob;
    try {
      const body = messageFor(job);
      if (job.channel === 'push') {
        const { data: tokens } = await admin.from('push_tokens').select('expo_push_token').eq('user_id', job.appointment?.client_id).eq('active', true);
        await Promise.all((tokens ?? []).map((item) => sendPush(String(item.expo_push_token), body)));
      } else if (job.appointment?.client?.phone && job.appointment.client.whatsapp_consent) {
        await sendWhatsApp(job.appointment.client.phone, body);
      }
      await admin.from('notification_jobs').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', job.id);
      sent += 1;
    } catch (jobError) {
      await admin.from('notification_jobs').update({ status: job.attempts >= 3 ? 'failed' : 'pending', last_error: String(jobError) }).eq('id', job.id);
    }
  }

  const { data: claimedPromotions, error: deliveryClaimError } = await admin.rpc('claim_promotion_deliveries', { p_limit: 100 });
  if (deliveryClaimError) return Response.json({ error: deliveryClaimError.message }, { status: 500, headers: corsHeaders });
  const deliveryIds = (claimedPromotions ?? []).map((item: { id: string }) => item.id);
  let promotionSent = 0;
  if (deliveryIds.length) {
    const { data: deliveries, error: deliveryError } = await admin.from('promotion_deliveries').select('id, promotion_id, phone, attempts, promotion:promotions(title,message,discount_label), client:profiles(full_name)').in('id', deliveryIds);
    if (deliveryError) {
      await admin.from('promotion_deliveries').update({ status: 'pending', last_error: deliveryError.message }).in('id', deliveryIds);
      return Response.json({ error: deliveryError.message }, { status: 500, headers: corsHeaders });
    }
    for (const rawDelivery of deliveries ?? []) {
      const delivery = rawDelivery as unknown as PromotionDelivery;
      try {
        if (!delivery.promotion) throw new Error('PROMOTION_NOT_FOUND');
        const firstName = delivery.client?.full_name?.split(' ')[0] || 'cliente';
        await sendPromotionWhatsApp(delivery.phone, delivery.promotion, firstName);
        await admin.from('promotion_deliveries').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', delivery.id);
        promotionSent += 1;
      } catch (deliverySendError) {
        await admin.from('promotion_deliveries').update({ status: delivery.attempts >= 3 ? 'failed' : 'pending', last_error: String(deliverySendError) }).eq('id', delivery.id);
      }
    }
  }

  const { data: sendingPromotions } = await admin.from('promotions').select('id').eq('status', 'sending');
  for (const promotion of sendingPromotions ?? []) {
    const { count } = await admin.from('promotion_deliveries').select('id', { count: 'exact', head: true }).eq('promotion_id', promotion.id).in('status', ['pending', 'processing']);
    if (count === 0) await admin.from('promotions').update({ status: 'sent' }).eq('id', promotion.id);
  }

  return Response.json({ appointmentsProcessed: data.length, appointmentMessagesSent: sent, promotionsActivated: duePromotions?.length ?? 0, promotionMessagesSent: promotionSent }, { headers: corsHeaders });
});
