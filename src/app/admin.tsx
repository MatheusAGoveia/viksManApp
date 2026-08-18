import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, layout } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { barbers as localBarbers, formatCurrency, services as localServices } from '@/data/catalog';
import { supabase } from '@/lib/supabase';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

type AdminTab = 'agenda' | 'clients' | 'catalog' | 'marketing' | 'settings';
type CalendarMode = 'day' | 'week';
type Option = { id: string; slug: string; name: string; duration?: number; price?: number; active?: boolean };
type Client = { id: string; name: string; phone: string; email?: string };
type AdminAppointment = { id: string; startsAt: string; status: string; clientId: string; clientName: string; serviceId: string; serviceName: string; barberId: string; barberName: string; duration: number; partySize: number; totalCents: number; paymentStatus: string };
type Block = { id: string; startsAt: string; endsAt: string; barberName: string; kind: string; reason: string };
type Promotion = { id: string; title: string; message: string; audience: string; sendAt: string; startsAt: string; endsAt: string; status: string; discountLabel: string };

const todayIso = () => new Date().toISOString().slice(0, 10);
const demoClients: Client[] = [
  { id: 'demo-1', name: 'Matheus Damião', phone: '(31) 99999-2104', email: 'matheus@demo.com' },
  { id: 'demo-2', name: 'Rafael Martins', phone: '(31) 98881-7432', email: 'rafael@demo.com' },
  { id: 'demo-3', name: 'Caio Andrade', phone: '(31) 97772-1055', email: 'caio@demo.com' },
];

function demoAppointments(): AdminAppointment[] {
  return [
    { id: 'apt-1', startsAt: `${todayIso()}T09:00:00-03:00`, status: 'confirmed', clientId: 'demo-2', clientName: 'Rafael Martins', serviceId: 'cut', serviceName: 'Corte', barberId: 'victor', barberName: 'Victor', duration: 45, partySize: 1, totalCents: 4000, paymentStatus: 'pending' },
    { id: 'apt-2', startsAt: `${todayIso()}T10:00:00-03:00`, status: 'checked_in', clientId: 'demo-3', clientName: 'Caio Andrade', serviceId: 'combo', serviceName: 'Corte + barba', barberId: 'bruno', barberName: 'Bruno', duration: 75, partySize: 2, totalCents: 15000, paymentStatus: 'partial' },
    { id: 'apt-3', startsAt: `${todayIso()}T14:30:00-03:00`, status: 'confirmed', clientId: 'demo-1', clientName: 'Matheus Damião', serviceId: 'beard', serviceName: 'Barba', barberId: 'victor', barberName: 'Victor', duration: 35, partySize: 1, totalCents: 3500, paymentStatus: 'paid' },
  ];
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '');
}

function joined(row: unknown) {
  if (Array.isArray(row)) return row[0] as Record<string, unknown> | undefined;
  return row as Record<string, unknown> | undefined;
}

export default function AdminScreen() {
  const { width } = useResponsiveLayout();
  const auth = useAuth();
  const wide = width >= 900;
  const [tab, setTab] = useState<AdminTab>('agenda');
  const [mode, setMode] = useState<CalendarMode>('day');
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [appointments, setAppointments] = useState<AdminAppointment[]>(() => demoAppointments());
  const [clients, setClients] = useState<Client[]>(demoClients);
  const [serviceOptions, setServiceOptions] = useState<Option[]>(localServices.map((item) => ({ id: item.id, slug: item.id, name: item.name, duration: item.duration, price: item.price, active: true })));
  const [barberOptions, setBarberOptions] = useState<Option[]>(localBarbers.filter((item) => item.id !== 'first').map((item) => ({ id: item.id, slug: item.id, name: item.name, active: true })));
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [clientId, setClientId] = useState(demoClients[0].id);
  const [serviceId, setServiceId] = useState(localServices[0].id);
  const [barberId, setBarberId] = useState('victor');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('09:00');
  const [blockReason, setBlockReason] = useState('Intervalo');
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockEnd, setBlockEnd] = useState('13:00');
  const [saving, setSaving] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoAudience, setPromoAudience] = useState('all');
  const [promoSendAt, setPromoSendAt] = useState(`${todayIso()} 10:00`);
  const [promoEndsAt, setPromoEndsAt] = useState(`${todayIso()} 23:59`);
  const [serviceName, setServiceName] = useState('');
  const [serviceSlug, setServiceSlug] = useState('');
  const [serviceDuration, setServiceDuration] = useState('45');
  const [servicePrice, setServicePrice] = useState('40');
  const [barberName, setBarberName] = useState('');
  const [barberSlug, setBarberSlug] = useState('');
  const [ruleCancellation, setRuleCancellation] = useState('4');
  const [ruleBuffer, setRuleBuffer] = useState('5');
  const [ruleNotice, setRuleNotice] = useState('60');
  const [ruleWindow, setRuleWindow] = useState('60');
  const [pixKey, setPixKey] = useState('matheusaagd2@gmail.com');

  const loadRemote = useCallback(async () => {
    if (!supabase || !auth.isStaff) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [appointmentResult, clientResult, serviceResult, barberResult, blockResult, promotionResult, unitResult] = await Promise.all([
      supabase.from('appointments').select('id, starts_at, status, client_id, service_id, barber_id, party_size, unit_price_cents, gratuity_cents, payment_status, client:profiles(full_name), service:services(name,duration_minutes), barber:barbers(name)').gte('starts_at', new Date(`${anchorDate}T00:00:00-03:00`).toISOString()).lt('starts_at', new Date(new Date(`${anchorDate}T00:00:00-03:00`).getTime() + 8 * 86400000).toISOString()).order('starts_at'),
      supabase.from('profiles').select('id, full_name, phone').eq('role', 'client').order('full_name').limit(100),
      supabase.from('services').select('id, slug, name, duration_minutes, price_cents, active').order('sort_order'),
      supabase.from('barbers').select('id, slug, name, active').order('sort_order'),
      supabase.from('schedule_blocks').select('id, starts_at, ends_at, kind, reason, barber:barbers(name)').gte('ends_at', new Date().toISOString()).order('starts_at').limit(30),
      supabase.from('promotions').select('id, title, message, audience, send_at, starts_at, ends_at, status, discount_label').order('created_at', { ascending: false }).limit(30),
      supabase.from('units').select('cancellation_hours, default_buffer_minutes, min_booking_notice_minutes, max_booking_days, pix_key').eq('slug', 'betim').single(),
    ]);
    if (!appointmentResult.error) setAppointments((appointmentResult.data ?? []).map((item) => {
      const row = item as Record<string, unknown>; const client = joined(row.client); const service = joined(row.service); const barber = joined(row.barber);
      const partySize = Number(row.party_size ?? 1); const totalCents = Number(row.unit_price_cents ?? 0) * partySize + Number(row.gratuity_cents ?? 0);
      return { id: String(row.id), startsAt: String(row.starts_at), status: String(row.status), clientId: String(row.client_id), clientName: String(client?.full_name ?? 'Cliente'), serviceId: String(row.service_id), serviceName: String(service?.name ?? 'Serviço'), barberId: String(row.barber_id), barberName: String(barber?.name ?? 'Profissional'), duration: Number(service?.duration_minutes ?? 45), partySize, totalCents, paymentStatus: String(row.payment_status ?? 'pending') };
    }));
    if (!clientResult.error) setClients((clientResult.data ?? []).map((item) => ({ id: item.id, name: item.full_name || 'Cliente sem nome', phone: item.phone || 'Sem telefone' })));
    if (!serviceResult.error) setServiceOptions((serviceResult.data ?? []).map((item) => ({ id: item.id, slug: item.slug, name: item.name, duration: item.duration_minutes, price: item.price_cents / 100, active: item.active })));
    if (!barberResult.error) setBarberOptions((barberResult.data ?? []).map((item) => ({ id: item.id, slug: item.slug, name: item.name, active: item.active })));
    if (!blockResult.error) setBlocks((blockResult.data ?? []).map((item) => ({ id: item.id, startsAt: item.starts_at, endsAt: item.ends_at, kind: item.kind, reason: item.reason || 'Horário bloqueado', barberName: String(joined(item.barber)?.name ?? 'Profissional') })));
    if (!promotionResult.error) setPromotions((promotionResult.data ?? []).map((item) => ({ id: item.id, title: item.title, message: item.message, audience: item.audience, sendAt: item.send_at, startsAt: item.starts_at, endsAt: item.ends_at, status: item.status, discountLabel: item.discount_label ?? '' })));
    if (!unitResult.error) { setRuleCancellation(String(unitResult.data.cancellation_hours)); setRuleBuffer(String(unitResult.data.default_buffer_minutes)); setRuleNotice(String(unitResult.data.min_booking_notice_minutes)); setRuleWindow(String(unitResult.data.max_booking_days)); setPixKey(unitResult.data.pix_key ?? ''); }
    setLoading(false);
  }, [anchorDate, auth.isStaff]);

  useEffect(() => { queueMicrotask(loadRemote); }, [loadRemote]);

  const visibleAppointments = useMemo(() => appointments.filter((item) => mode === 'week' || item.startsAt.slice(0, 10) === anchorDate), [anchorDate, appointments, mode]);
  const filteredClients = useMemo(() => clients.filter((client) => `${client.name} ${client.phone} ${client.email ?? ''}`.toLowerCase().includes(search.toLowerCase())), [clients, search]);
  const occupancy = Math.min(100, Math.round((visibleAppointments.length / (mode === 'day' ? 16 : 80)) * 100));

  function moveDate(direction: number) {
    const next = new Date(`${anchorDate}T12:00:00`); next.setDate(next.getDate() + direction * (mode === 'week' ? 7 : 1)); setAnchorDate(next.toISOString().slice(0, 10));
  }

  function openCreate(selectedClientId?: string) {
    setEditingId(undefined); setClientId(selectedClientId ?? clients[0]?.id ?? ''); setServiceId(serviceOptions[0]?.id ?? ''); setBarberId(barberOptions[0]?.id ?? ''); setDate(anchorDate); setTime('09:00'); setShowEditor(true); setNotice('');
  }

  function openReschedule(item: AdminAppointment) {
    setEditingId(item.id); setClientId(item.clientId); setServiceId(item.serviceId); setBarberId(item.barberId); setDate(item.startsAt.slice(0, 10)); setTime(formatTime(item.startsAt)); setShowEditor(true); setNotice('');
  }

  async function saveAppointment() {
    const service = serviceOptions.find((item) => item.id === serviceId); if (!service || !clientId || !barberId) return;
    setSaving(true); setNotice('');
    const startsAt = new Date(`${date}T${time}:00-03:00`).toISOString();
    const endsAt = new Date(new Date(startsAt).getTime() + (service.duration ?? 45) * 60000).toISOString();
    if (supabase) {
      const unit = await supabase.from('units').select('id').eq('slug', 'betim').single();
      if (unit.error || !unit.data) { setSaving(false); setNotice('A unidade Betim não está disponível.'); return; }
      const result = editingId
        ? await supabase.from('appointments').update({ starts_at: startsAt, ends_at: endsAt, barber_id: barberId, service_id: serviceId }).eq('id', editingId)
        : await supabase.from('appointments').insert({ client_id: clientId, unit_id: unit.data.id, barber_id: barberId, service_id: serviceId, starts_at: startsAt, ends_at: endsAt, status: 'confirmed', booked_via: 'reception', party_size: 1, unit_price_cents: Math.round((service.price ?? 0) * 100) });
      if (result.error) { setSaving(false); setNotice(result.error.message.includes('appointments_no_barber_overlap') ? 'Este profissional já tem atendimento neste horário.' : result.error.message); return; }
      await loadRemote();
    } else {
      const client = clients.find((item) => item.id === clientId); const barber = barberOptions.find((item) => item.id === barberId);
      const value: AdminAppointment = { id: editingId ?? `demo-${Date.now()}`, startsAt, status: 'confirmed', clientId, clientName: client?.name ?? 'Cliente', serviceId, serviceName: service.name, barberId, barberName: barber?.name ?? 'Profissional', duration: service.duration ?? 45, partySize: 1, totalCents: Math.round((service.price ?? 0) * 100), paymentStatus: 'pending' };
      setAppointments((current) => editingId ? current.map((item) => item.id === editingId ? value : item) : [...current, value].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }
    setSaving(false); setShowEditor(false); setNotice(editingId ? 'Horário reagendado.' : 'Atendimento criado pela recepção.');
  }

  async function changeStatus(item: AdminAppointment, status: 'cancelled' | 'completed' | 'no_show') {
    if (supabase) {
      const payload = status === 'cancelled' ? { status, cancelled_at: new Date().toISOString(), cancellation_reason: 'Cancelado pela recepção' } : { status };
      const { error } = await supabase.from('appointments').update(payload).eq('id', item.id); if (error) return setNotice(error.message); await loadRemote();
    } else setAppointments((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    setNotice(status === 'cancelled' ? 'Atendimento cancelado; a notificação entrou na fila.' : 'Status atualizado.');
  }

  async function createBlock() {
    const barber = barberOptions.find((item) => item.id === barberId); if (!barber) return;
    const startsAt = new Date(`${date}T${blockStart}:00-03:00`).toISOString(); const endsAt = new Date(`${date}T${blockEnd}:00-03:00`).toISOString();
    if (endsAt <= startsAt) return setNotice('O fim do bloqueio precisa ser depois do início.');
    if (supabase) { const { error } = await supabase.from('schedule_blocks').insert({ barber_id: barberId, starts_at: startsAt, ends_at: endsAt, kind: 'block', reason: blockReason, created_by: auth.user?.id }); if (error) return setNotice(error.message); await loadRemote(); }
    else setBlocks((current) => [...current, { id: `block-${Date.now()}`, startsAt, endsAt, barberName: barber.name, kind: 'block', reason: blockReason }]);
    setNotice('Horário bloqueado na disponibilidade.');
  }

  async function markPaid(item: AdminAppointment) {
    if (!supabase) { setAppointments((current) => current.map((entry) => entry.id === item.id ? { ...entry, paymentStatus: 'paid' } : entry)); setNotice('Pagamento marcado como pago.'); return; }
    const existing = await supabase.from('appointment_payments').select('amount_cents').eq('appointment_id', item.id).eq('status', 'paid');
    if (existing.error) return setNotice(existing.error.message);
    const alreadyPaid = (existing.data ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
    const remaining = Math.max(0, item.totalCents - alreadyPaid);
    if (!remaining) return setNotice('Este atendimento já está quitado.');
    const { error } = await supabase.from('appointment_payments').insert({ appointment_id: item.id, payer_name: item.clientName, amount_cents: remaining, method: 'pix', status: 'paid', paid_at: new Date().toISOString(), created_by: auth.user?.id });
    if (error) return setNotice(error.message);
    await loadRemote(); setNotice('Pagamento PIX registrado e atendimento quitado.');
  }

  async function createService() {
    const duration = Number(serviceDuration); const price = Number(servicePrice);
    if (!serviceName.trim() || !serviceSlug.trim() || duration < 5 || price < 0) return setNotice('Revise nome, identificador, duração e preço do serviço.');
    if (!supabase) { setServiceOptions((current) => [...current, { id: `service-${Date.now()}`, slug: serviceSlug, name: serviceName, duration, price, active: true }]); setNotice('Serviço criado na demonstração.'); return; }
    const { data, error } = await supabase.from('services').insert({ name: serviceName.trim(), slug: serviceSlug.trim().toLowerCase(), description: 'Serviço Viks Man', duration_minutes: duration, price_cents: Math.round(price * 100) }).select('id').single();
    if (error || !data) return setNotice(error?.message ?? 'Não foi possível criar o serviço.');
    const activeBarbers = barberOptions.filter((item) => item.active !== false);
    if (activeBarbers.length) await supabase.from('barber_services').insert(activeBarbers.map((barber) => ({ barber_id: barber.id, service_id: data.id })));
    setServiceName(''); setServiceSlug(''); await loadRemote(); setNotice('Serviço criado e liberado para os profissionais ativos.');
  }

  async function createBarber() {
    if (!barberName.trim() || !barberSlug.trim()) return setNotice('Informe nome e identificador do profissional.');
    if (!supabase) { setBarberOptions((current) => [...current, { id: `barber-${Date.now()}`, slug: barberSlug, name: barberName, active: true }]); setNotice('Profissional criado na demonstração.'); return; }
    const unit = await supabase.from('units').select('id').eq('slug', 'betim').single();
    if (unit.error) return setNotice(unit.error.message);
    const { data, error } = await supabase.from('barbers').insert({ unit_id: unit.data.id, name: barberName.trim(), slug: barberSlug.trim().toLowerCase(), bio: 'Profissional Viks Man' }).select('id').single();
    if (error || !data) return setNotice(error?.message ?? 'Não foi possível criar o profissional.');
    const activeServices = serviceOptions.filter((item) => item.active !== false);
    if (activeServices.length) await supabase.from('barber_services').insert(activeServices.map((service) => ({ barber_id: data.id, service_id: service.id })));
    await supabase.from('working_hours').insert([1, 2, 3, 4, 5, 6].map((weekday) => ({ barber_id: data.id, weekday, opens_at: '09:00', closes_at: '19:00', slot_interval_minutes: 15 })));
    setBarberName(''); setBarberSlug(''); await loadRemote(); setNotice('Profissional criado com jornada inicial de segunda a sábado, 9h–19h.');
  }

  async function toggleCatalog(kind: 'services' | 'barbers', item: Option) {
    if (!supabase) { const setter = kind === 'services' ? setServiceOptions : setBarberOptions; setter((current) => current.map((entry) => entry.id === item.id ? { ...entry, active: item.active === false } : entry)); return; }
    const { error } = await supabase.from(kind).update({ active: item.active === false }).eq('id', item.id);
    if (error) return setNotice(error.message); await loadRemote();
  }

  async function createPromotion() {
    if (!promoTitle.trim() || promoMessage.trim().length < 10 || !auth.user) return setNotice('Informe título e uma mensagem com pelo menos 10 caracteres.');
    const sendAt = new Date(`${promoSendAt.replace(' ', 'T')}:00-03:00`); const endsAt = new Date(`${promoEndsAt.replace(' ', 'T')}:00-03:00`);
    if (Number.isNaN(sendAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) return setNotice('Use data e hora válidas e um término futuro.');
    if (!supabase) { setNotice('Campanha simulada. Conecte o WhatsApp para envio real.'); return; }
    const { error } = await supabase.from('promotions').insert({ title: promoTitle.trim(), message: promoMessage.trim(), discount_label: promoDiscount.trim() || null, audience: promoAudience, starts_at: new Date().toISOString(), ends_at: endsAt.toISOString(), send_at: sendAt.toISOString(), status: 'scheduled', created_by: auth.user.id });
    if (error) return setNotice(error.message); setPromoTitle(''); setPromoMessage(''); setPromoDiscount(''); await loadRemote(); setNotice('Campanha agendada. Só receberão clientes com consentimento de marketing e WhatsApp.');
  }

  async function cancelPromotion(id: string) {
    if (!supabase) { setPromotions((current) => current.map((item) => item.id === id ? { ...item, status: 'cancelled' } : item)); return; }
    const { error } = await supabase.from('promotions').update({ status: 'cancelled' }).eq('id', id).in('status', ['draft', 'scheduled']);
    if (error) return setNotice(error.message); await loadRemote(); setNotice('Campanha cancelada.');
  }

  async function saveRules() {
    if (!supabase) return setNotice('Regras salvas na demonstração.');
    const { error } = await supabase.from('units').update({ cancellation_hours: Number(ruleCancellation), default_buffer_minutes: Number(ruleBuffer), min_booking_notice_minutes: Number(ruleNotice), max_booking_days: Number(ruleWindow), pix_key: pixKey.trim() || null }).eq('slug', 'betim');
    if (error) return setNotice(error.message); await loadRemote(); setNotice('Regras comerciais e chave PIX atualizadas.');
  }

  if (auth.configured && !auth.loading && !auth.isStaff) return <SafeAreaView style={styles.denied}><Ionicons name="lock-closed-outline" color={colors.blue} size={36} /><Text style={styles.deniedTitle}>Acesso da equipe.</Text><Text style={styles.deniedText}>Entre com uma conta de recepção, gerência ou administração.</Text><Pressable onPress={() => router.replace('/profile')} style={styles.deniedButton}><Text style={styles.deniedButtonText}>VOLTAR AO PERFIL</Text></Pressable></SafeAreaView>;

  return <View style={styles.screen}>
    <SafeAreaView edges={['top']} style={styles.shell}>
      <View style={styles.topbar}><View><Text style={styles.brand}>VIKS <Text style={styles.brandAccent}>/</Text> RECEPÇÃO</Text><Text style={styles.unit}>UNIDADE BETIM · {auth.configured ? 'CONECTADO' : 'DEMONSTRAÇÃO'}</Text></View><Pressable accessibilityLabel="Fechar painel" hitSlop={8} onPress={() => router.back()} style={styles.close}><Ionicons name="close" color={colors.white} size={21} /></Pressable></View>
      <View style={[styles.workspace, wide && styles.workspaceWide]}>
        <View style={[styles.sidebar, wide && styles.sidebarWide]}>
          {([['agenda', 'calendar-outline', 'Agenda'], ['clients', 'people-outline', 'Clientes'], ['catalog', 'cut-outline', 'Catálogo'], ['marketing', 'megaphone-outline', 'Promoções'], ['settings', 'options-outline', 'Operação']] as const).map(([value, icon, label]) => <Pressable key={value} onPress={() => setTab(value)} style={[styles.navItem, tab === value && styles.navItemActive]}><Ionicons name={icon} color={tab === value ? colors.white : '#77787D'} size={19} /><Text style={[styles.navText, tab === value && styles.navTextActive]}>{label}</Text></Pressable>)}
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text><Pressable accessibilityLabel="Fechar aviso" hitSlop={12} onPress={() => setNotice('')}><Ionicons name="close" color={colors.ink} size={16} /></Pressable></View> : null}
          {loading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}
          {tab === 'agenda' ? <>
            <View style={styles.pageHead}><View><Text style={styles.eyebrow}>AGENDA ADMINISTRATIVA</Text><Text style={styles.pageTitle}>{mode === 'day' ? 'Hoje na Viks.' : 'Visão da semana.'}</Text></View><Pressable onPress={() => openCreate()} style={styles.createButton}><Ionicons name="add" color={colors.white} size={18} /><Text style={styles.createText}>NOVO ATENDIMENTO</Text></Pressable></View>
            <View style={styles.toolbar}><View style={styles.segment}><Pressable onPress={() => setMode('day')} style={[styles.segmentItem, mode === 'day' && styles.segmentActive]}><Text style={[styles.segmentText, mode === 'day' && styles.segmentTextActive]}>DIA</Text></Pressable><Pressable onPress={() => setMode('week')} style={[styles.segmentItem, mode === 'week' && styles.segmentActive]}><Text style={[styles.segmentText, mode === 'week' && styles.segmentTextActive]}>SEMANA</Text></Pressable></View><View style={styles.dateNav}><Pressable accessibilityLabel="Dia anterior" hitSlop={12} onPress={() => moveDate(-1)}><Ionicons name="chevron-back" color={colors.ink} size={19} /></Pressable><Text style={styles.dateNavText}>{formatDay(`${anchorDate}T12:00:00`)}</Text><Pressable accessibilityLabel="Próximo dia" hitSlop={12} onPress={() => moveDate(1)}><Ionicons name="chevron-forward" color={colors.ink} size={19} /></Pressable></View></View>
            <View style={[styles.summaryGrid, wide && styles.summaryGridWide]}><Summary value={String(visibleAppointments.length).padStart(2, '0')} label="ATENDIMENTOS" /><Summary value={`${occupancy}%`} label="OCUPAÇÃO" /><Summary value={String(visibleAppointments.filter((item) => item.status === 'confirmed').length).padStart(2, '0')} label="CONFIRMADOS" /></View>
            {showEditor ? <AppointmentEditor clients={clients} services={serviceOptions} barbers={barberOptions} clientId={clientId} serviceId={serviceId} barberId={barberId} date={date} time={time} editing={Boolean(editingId)} saving={saving} setClientId={setClientId} setServiceId={setServiceId} setBarberId={setBarberId} setDate={setDate} setTime={setTime} onCancel={() => setShowEditor(false)} onSave={saveAppointment} /> : null}
            <View style={styles.scheduleList}>{visibleAppointments.length ? visibleAppointments.map((item) => <AppointmentRow key={item.id} item={item} onPaid={() => markPaid(item)} onReschedule={() => openReschedule(item)} onStatus={(status) => changeStatus(item, status)} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhum atendimento.</Text><Text style={styles.emptyText}>A agenda está livre para este período.</Text></View>}</View>
          </> : null}
          {tab === 'clients' ? <><View style={styles.pageHead}><View><Text style={styles.eyebrow}>BASE DE CLIENTES</Text><Text style={styles.pageTitle}>Encontre rápido.</Text></View><Text style={styles.total}>{clients.length} CADASTROS</Text></View><View style={styles.searchBox}><Ionicons name="search" color={colors.muted} size={19} /><TextInput value={search} onChangeText={setSearch} placeholder="Nome, telefone ou e-mail" placeholderTextColor="#92938E" style={styles.searchInput} /></View><View style={styles.clientList}>{filteredClients.map((client) => <View key={client.id} style={styles.clientRow}><View style={styles.clientAvatar}><Text style={styles.clientInitial}>{client.name[0]}</Text></View><View style={styles.clientCopy}><Text style={styles.clientName}>{client.name}</Text><Text style={styles.clientPhone}>{client.phone}</Text></View><Pressable onPress={() => { setTab('agenda'); openCreate(client.id); }} style={styles.clientAction}><Text style={styles.clientActionText}>AGENDAR</Text><Ionicons name="arrow-forward" color={colors.blue} size={16} /></Pressable></View>)}</View></> : null}
          {tab === 'catalog' ? <><View style={styles.pageHead}><View><Text style={styles.eyebrow}>CATÁLOGO E EQUIPE</Text><Text style={styles.pageTitle}>O que a Viks oferece.</Text></View></View><View style={[styles.operationGrid, wide && styles.operationGridWide]}><View style={styles.operationCard}><Text style={styles.cardTitle}>NOVO SERVIÇO</Text><LabeledInput label="NOME" value={serviceName} onChangeText={setServiceName} placeholder="Ex.: Corte infantil" /><LabeledInput label="IDENTIFICADOR" value={serviceSlug} onChangeText={setServiceSlug} placeholder="corte-infantil" /><View style={styles.inputPair}><LabeledInput label="DURAÇÃO (MIN)" value={serviceDuration} onChangeText={setServiceDuration} placeholder="45" /><LabeledInput label="PREÇO (R$)" value={servicePrice} onChangeText={setServicePrice} placeholder="40" /></View><Pressable onPress={createService} style={styles.operationButton}><Text style={styles.operationButtonText}>CRIAR SERVIÇO</Text></Pressable></View><View style={styles.operationCard}><Text style={styles.cardTitle}>NOVO PROFISSIONAL</Text><LabeledInput label="NOME" value={barberName} onChangeText={setBarberName} placeholder="Nome profissional" /><LabeledInput label="IDENTIFICADOR" value={barberSlug} onChangeText={setBarberSlug} placeholder="nome-sem-espacos" /><Text style={styles.cardHint}>A jornada inicial será segunda a sábado, das 9h às 19h, com todos os serviços ativos.</Text><Pressable onPress={createBarber} style={styles.operationButton}><Text style={styles.operationButtonText}>CRIAR PROFISSIONAL</Text></Pressable></View></View><Text style={styles.subheading}>SERVIÇOS</Text><View style={styles.catalogList}>{serviceOptions.map((item) => <View key={item.id} style={styles.catalogRow}><View style={styles.catalogCopy}><Text style={styles.catalogName}>{item.name}</Text><Text style={styles.catalogMeta}>{item.duration} min · {formatCurrency(item.price ?? 0)} · {item.slug}</Text></View><Pressable onPress={() => toggleCatalog('services', item)} style={[styles.statusButton, item.active === false && styles.statusButtonOff]}><Text style={[styles.statusButtonText, item.active === false && styles.statusButtonTextOff]}>{item.active === false ? 'REATIVAR' : 'ATIVO'}</Text></Pressable></View>)}</View><Text style={styles.subheading}>PROFISSIONAIS</Text><View style={styles.catalogList}>{barberOptions.map((item) => <View key={item.id} style={styles.catalogRow}><View style={styles.catalogCopy}><Text style={styles.catalogName}>{item.name}</Text><Text style={styles.catalogMeta}>{item.slug}</Text></View><Pressable onPress={() => toggleCatalog('barbers', item)} style={[styles.statusButton, item.active === false && styles.statusButtonOff]}><Text style={[styles.statusButtonText, item.active === false && styles.statusButtonTextOff]}>{item.active === false ? 'REATIVAR' : 'ATIVO'}</Text></Pressable></View>)}</View></> : null}
          {tab === 'marketing' ? <><View style={styles.pageHead}><View><Text style={styles.eyebrow}>AUTOMAÇÃO DE MARKETING</Text><Text style={styles.pageTitle}>Promoções no WhatsApp.</Text></View></View><View style={[styles.promoLayout, wide && styles.promoLayoutWide]}><View style={styles.promoForm}><Text style={styles.cardTitle}>NOVA CAMPANHA</Text><Text style={styles.cardHint}>Sem SMS. O disparo usa WhatsApp e respeita os consentimentos do cliente.</Text><LabeledInput label="TÍTULO" value={promoTitle} onChangeText={setPromoTitle} placeholder="Semana do corte" /><LabeledInput label="DESTAQUE" value={promoDiscount} onChangeText={setPromoDiscount} placeholder="Ex.: 10% OFF" /><Text style={styles.inputLabel}>MENSAGEM</Text><TextInput multiline value={promoMessage} onChangeText={setPromoMessage} placeholder="Conte a promoção e inclua como agendar." placeholderTextColor="#9A9B96" style={styles.messageInput} /><Text style={styles.inputLabel}>PÚBLICO</Text><OptionChips options={[{ id: 'all', slug: 'all', name: 'Todos autorizados' }, { id: 'inactive_30d', slug: 'inactive_30d', name: 'Inativos 30 dias' }, { id: 'inactive_60d', slug: 'inactive_60d', name: 'Inativos 60 dias' }, { id: 'birthday_month', slug: 'birthday_month', name: 'Aniversariantes' }]} selected={promoAudience} onSelect={setPromoAudience} /><View style={styles.inputPair}><LabeledInput label="ENVIAR EM" value={promoSendAt} onChangeText={setPromoSendAt} placeholder="AAAA-MM-DD HH:MM" /><LabeledInput label="VÁLIDA ATÉ" value={promoEndsAt} onChangeText={setPromoEndsAt} placeholder="AAAA-MM-DD HH:MM" /></View><Pressable disabled={saving} onPress={createPromotion} style={styles.editorSave}><Text style={styles.editorSaveText}>AGENDAR NO WHATSAPP</Text><Ionicons name="logo-whatsapp" color={colors.white} size={18} /></Pressable></View><View style={styles.promoHistory}><Text style={styles.cardTitle}>CAMPANHAS</Text>{promotions.length ? promotions.map((promo) => <View key={promo.id} style={styles.promoRow}><View style={styles.promoTop}><Text style={styles.promoTitle}>{promo.title}</Text><Text style={styles.promoStatus}>{promo.status.toUpperCase()}</Text></View><Text style={styles.promoMessage}>{promo.message}</Text><Text style={styles.catalogMeta}>{promo.audience} · {new Date(promo.sendAt).toLocaleString('pt-BR')}</Text>{['draft', 'scheduled'].includes(promo.status) ? <Pressable onPress={() => cancelPromotion(promo.id)} style={styles.cancelPromo}><Text style={styles.smallDanger}>CANCELAR CAMPANHA</Text></Pressable> : null}</View>) : <Text style={styles.emptyText}>Nenhuma campanha criada.</Text>}</View></View></> : null}
          {tab === 'settings' ? <><View style={styles.pageHead}><View><Text style={styles.eyebrow}>OPERAÇÃO DA LOJA</Text><Text style={styles.pageTitle}>Regras e bloqueios.</Text></View></View><View style={[styles.operationGrid, wide && styles.operationGridWide]}><View style={styles.operationCard}><Text style={styles.cardTitle}>BLOQUEAR HORÁRIO</Text><Text style={styles.cardHint}>Intervalo, folga, manutenção ou indisponibilidade.</Text><OptionChips options={barberOptions.filter((item) => item.active !== false)} selected={barberId} onSelect={setBarberId} /><LabeledInput label="DATA" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" /><View style={styles.inputPair}><LabeledInput label="INÍCIO" value={blockStart} onChangeText={setBlockStart} placeholder="12:00" /><LabeledInput label="FIM" value={blockEnd} onChangeText={setBlockEnd} placeholder="13:00" /></View><LabeledInput label="MOTIVO" value={blockReason} onChangeText={setBlockReason} placeholder="Intervalo" /><Pressable onPress={createBlock} style={styles.operationButton}><Text style={styles.operationButtonText}>SALVAR BLOQUEIO</Text></Pressable></View><View style={styles.operationCard}><Text style={styles.cardTitle}>REGRAS COMERCIAIS</Text><View style={styles.inputPair}><LabeledInput label="CANCELAMENTO (H)" value={ruleCancellation} onChangeText={setRuleCancellation} placeholder="4" /><LabeledInput label="INTERVALO (MIN)" value={ruleBuffer} onChangeText={setRuleBuffer} placeholder="5" /></View><View style={styles.inputPair}><LabeledInput label="ANTECEDÊNCIA (MIN)" value={ruleNotice} onChangeText={setRuleNotice} placeholder="60" /><LabeledInput label="AGENDA ABERTA (DIAS)" value={ruleWindow} onChangeText={setRuleWindow} placeholder="60" /></View><LabeledInput label="CHAVE PIX" value={pixKey} onChangeText={setPixKey} placeholder="Chave PIX da unidade" /><Rule label="Encaixes" value="Permitidos" /><Rule label="Primeiro disponível" value="Menor horário livre" /><Pressable onPress={saveRules} style={styles.operationButton}><Text style={styles.operationButtonText}>SALVAR REGRAS</Text></Pressable></View></View><Text style={styles.subheading}>PRÓXIMOS BLOQUEIOS</Text><View style={styles.blockList}>{blocks.length ? blocks.map((block) => <View key={block.id} style={styles.blockRow}><View style={styles.blockIcon}><Ionicons name="remove-circle-outline" color={colors.danger} size={19} /></View><View style={styles.blockCopy}><Text style={styles.blockTitle}>{block.reason}</Text><Text style={styles.blockMeta}>{block.barberName} · {formatDay(block.startsAt)} · {formatTime(block.startsAt)}–{formatTime(block.endsAt)}</Text></View></View>) : <Text style={styles.emptyText}>Nenhum bloqueio futuro.</Text>}</View></> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  </View>;
}

function Summary({ value, label }: { value: string; label: string }) { return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function Rule({ label, value }: { label: string; value: string }) { return <View style={styles.rule}><Text style={styles.ruleLabel}>{label}</Text><Text style={styles.ruleValue}>{value}</Text></View>; }
function LabeledInput({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) { return <View style={styles.labeledInput}><Text style={styles.inputLabel}>{label}</Text><TextInput {...props} placeholderTextColor="#9A9B96" style={styles.input} /></View>; }
function OptionChips({ options, selected, onSelect }: { options: Option[]; selected: string; onSelect: (id: string) => void }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{options.map((item) => <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[styles.chip, selected === item.id && styles.chipActive]}><Text style={[styles.chipText, selected === item.id && styles.chipTextActive]}>{item.name}</Text></Pressable>)}</ScrollView>; }

function AppointmentEditor(props: { clients: Client[]; services: Option[]; barbers: Option[]; clientId: string; serviceId: string; barberId: string; date: string; time: string; editing: boolean; saving: boolean; setClientId: (id: string) => void; setServiceId: (id: string) => void; setBarberId: (id: string) => void; setDate: (value: string) => void; setTime: (value: string) => void; onCancel: () => void; onSave: () => void }) {
  return <View style={styles.editor}><View style={styles.editorHead}><View><Text style={styles.cardTitle}>{props.editing ? 'REAGENDAR ATENDIMENTO' : 'NOVO ATENDIMENTO'}</Text><Text style={styles.cardHint}>A restrição do banco impede conflito de horários.</Text></View><Pressable accessibilityLabel="Fechar editor" hitSlop={12} onPress={props.onCancel}><Ionicons name="close" color={colors.ink} size={20} /></Pressable></View><Text style={styles.inputLabel}>CLIENTE</Text><OptionChips options={props.clients.map((item) => ({ id: item.id, slug: item.id, name: item.name }))} selected={props.clientId} onSelect={props.setClientId} /><Text style={styles.inputLabel}>SERVIÇO</Text><OptionChips options={props.services} selected={props.serviceId} onSelect={props.setServiceId} /><Text style={styles.inputLabel}>PROFISSIONAL</Text><OptionChips options={props.barbers} selected={props.barberId} onSelect={props.setBarberId} /><View style={styles.inputPair}><LabeledInput label="DATA" value={props.date} onChangeText={props.setDate} placeholder="AAAA-MM-DD" /><LabeledInput label="HORA" value={props.time} onChangeText={props.setTime} placeholder="09:00" /></View><Pressable disabled={props.saving} onPress={props.onSave} style={styles.editorSave}><Text style={styles.editorSaveText}>{props.saving ? 'SALVANDO…' : props.editing ? 'CONFIRMAR NOVO HORÁRIO' : 'CRIAR ATENDIMENTO'}</Text><Ionicons name="arrow-forward" color={colors.white} size={17} /></Pressable></View>;
}

function AppointmentRow({ item, onPaid, onReschedule, onStatus }: { item: AdminAppointment; onPaid: () => void; onReschedule: () => void; onStatus: (status: 'cancelled' | 'completed' | 'no_show') => void }) {
  const inactive = ['cancelled', 'completed', 'no_show'].includes(item.status);
  const statusLabel: Record<string, string> = { confirmed: 'CONFIRMADO', checked_in: 'CHEGOU', in_service: 'EM ATENDIMENTO', completed: 'CONCLUÍDO', cancelled: 'CANCELADO', no_show: 'NÃO COMPARECEU' };
  return <View style={[styles.appointment, inactive && styles.appointmentInactive]}><View style={styles.appointmentTime}><Text style={styles.appointmentTimeText}>{formatTime(item.startsAt)}</Text><Text style={styles.appointmentDay}>{formatDay(item.startsAt)}</Text></View><View style={styles.appointmentCopy}><View style={styles.appointmentTop}><Text style={styles.appointmentClient}>{item.clientName}</Text><Text style={styles.appointmentStatus}>{statusLabel[item.status] ?? item.status.toUpperCase()}</Text></View><Text style={styles.appointmentMeta}>{item.serviceName} · {item.duration * item.partySize} min · {item.barberName} · {item.partySize} {item.partySize === 1 ? 'pessoa' : 'pessoas'}</Text><Text style={styles.paymentMeta}>{formatCurrency(item.totalCents / 100)} · {item.paymentStatus === 'paid' ? 'PAGO' : item.paymentStatus === 'partial' ? 'PAGAMENTO PARCIAL' : 'PENDENTE'}</Text>{!inactive ? <View style={styles.appointmentActions}>{item.paymentStatus !== 'paid' ? <Pressable onPress={onPaid} style={styles.paidButton}><Ionicons name="logo-usd" color={colors.success} size={14} /><Text style={styles.paidText}>MARCAR PIX PAGO</Text></Pressable> : null}<Pressable onPress={onReschedule} style={styles.smallActionButton}><Text style={styles.smallAction}>REAGENDAR</Text></Pressable><Pressable onPress={() => onStatus('completed')} style={styles.smallActionButton}><Text style={styles.smallAction}>CONCLUIR</Text></Pressable><Pressable onPress={() => onStatus('no_show')} style={styles.smallActionButton}><Text style={styles.smallAction}>NO-SHOW</Text></Pressable><Pressable onPress={() => onStatus('cancelled')} style={styles.smallActionButton}><Text style={styles.smallDanger}>CANCELAR</Text></Pressable></View> : null}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, shell: { flex: 1 }, topbar: { minHeight: 74, paddingHorizontal: 20, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: colors.white, fontFamily: fonts.sans, fontSize: 16, fontWeight: '900', letterSpacing: -0.4 }, brandAccent: { color: colors.blue }, unit: { color: '#83848A', fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 1, marginTop: 5 }, close: { width: 38, height: 38, borderWidth: 1, borderColor: '#3D3E43', alignItems: 'center', justifyContent: 'center' }, workspace: { flex: 1 }, workspaceWide: { flexDirection: 'row' }, sidebar: { height: 72, backgroundColor: colors.ink, flexDirection: 'row', paddingHorizontal: 4 }, sidebarWide: { width: 142, height: '100%', flexDirection: 'column', paddingTop: 18 }, navItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 }, navItemActive: { backgroundColor: colors.blue }, navText: { color: '#77787D', fontFamily: fonts.sans, fontSize: 7, fontWeight: '900', letterSpacing: 0.35 }, navTextActive: { color: colors.white }, content: { flex: 1 }, contentInner: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 34, paddingBottom: 60 }, loader: { marginBottom: 20 }, notice: { minHeight: 48, paddingHorizontal: 15, backgroundColor: '#DDE6FF', borderLeftWidth: 4, borderLeftColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, noticeText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '700', flex: 1 },
  pageHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }, eyebrow: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginBottom: 10 }, pageTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 35, lineHeight: 37, fontWeight: '800', letterSpacing: -1.8 }, createButton: { minHeight: 48, paddingHorizontal: 15, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', gap: 9 }, createText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 }, total: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800' }, toolbar: { minHeight: 70, marginTop: 30, backgroundColor: colors.white, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, segment: { flexDirection: 'row', backgroundColor: colors.soft, padding: 3 }, segmentItem: { height: 44, minWidth: 70, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: colors.ink }, segmentText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900' }, segmentTextActive: { color: colors.white }, dateNav: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 13 }, dateNavText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, summaryGrid: { marginTop: 10, gap: 8 }, summaryGridWide: { flexDirection: 'row' }, summary: { flex: 1, minHeight: 96, padding: 17, backgroundColor: colors.white }, summaryValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 30, fontWeight: '800', letterSpacing: -1.3 }, summaryLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.8, marginTop: 8 },
  scheduleList: { marginTop: 24, borderTopWidth: 1, borderColor: colors.line }, appointment: { minHeight: 130, paddingVertical: 17, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 18 }, appointmentInactive: { opacity: 0.48 }, appointmentTime: { width: 80 }, appointmentTimeText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 25, fontWeight: '800', letterSpacing: -1 }, appointmentDay: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, textTransform: 'uppercase', marginTop: 5 }, appointmentCopy: { flex: 1 }, appointmentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, appointmentClient: { color: colors.ink, fontFamily: fonts.sans, fontSize: 16, fontWeight: '800' }, appointmentStatus: { color: colors.success, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, appointmentMeta: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, marginTop: 6 }, paymentMeta: { color: colors.success, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.5, marginTop: 6 }, appointmentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }, paidButton: { minHeight: 44, paddingHorizontal: 9, borderWidth: 1, borderColor: '#A8D5BA', flexDirection: 'row', alignItems: 'center', gap: 5 }, paidText: { color: colors.success, fontFamily: fonts.sans, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 }, smallActionButton: { minHeight: 44, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' }, smallAction: { color: colors.ink, fontFamily: fonts.sans, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, smallDanger: { color: colors.danger, fontFamily: fonts.sans, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, empty: { paddingVertical: 50, alignItems: 'center' }, emptyTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 24, fontWeight: '800' }, emptyText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, marginTop: 7 },
  editor: { marginTop: 20, padding: 20, backgroundColor: colors.white, borderTopWidth: 5, borderTopColor: colors.blue }, editorHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }, cardTitle: { color: colors.ink, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, cardHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 15, marginTop: 8 }, inputLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginBottom: 7, marginTop: 14 }, chips: { gap: 7, paddingRight: 10 }, chip: { height: 44, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, chipActive: { backgroundColor: colors.ink, borderColor: colors.ink }, chipText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800' }, chipTextActive: { color: colors.white }, inputPair: { flexDirection: 'row', gap: 9 }, labeledInput: { flex: 1 }, input: { height: 46, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink, fontFamily: fonts.sans, fontSize: 12 }, editorSave: { height: 50, marginTop: 20, paddingHorizontal: 16, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, editorSaveText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  searchBox: { height: 54, marginTop: 28, paddingHorizontal: 16, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 11 }, searchInput: { flex: 1, color: colors.ink, fontFamily: fonts.sans, fontSize: 13 }, clientList: { marginTop: 22, borderTopWidth: 1, borderColor: colors.line }, clientRow: { minHeight: 84, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 13 }, clientAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, clientInitial: { color: colors.white, fontFamily: fonts.sans, fontSize: 16, fontWeight: '900' }, clientCopy: { flex: 1 }, clientName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 14, fontWeight: '800' }, clientPhone: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, marginTop: 4 }, clientAction: { minHeight: 44, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 7 }, clientActionText: { color: colors.blue, fontFamily: fonts.sans, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  operationGrid: { marginTop: 28, gap: 10 }, operationGridWide: { flexDirection: 'row', alignItems: 'flex-start' }, operationCard: { flex: 1, padding: 20, backgroundColor: colors.white }, operationButton: { height: 48, marginTop: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, operationButtonText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, rule: { minHeight: 51, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, ruleLabel: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10 }, ruleValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 10, fontWeight: '800', textAlign: 'right' }, subheading: { color: colors.ink, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 38, marginBottom: 12 }, blockList: { borderTopWidth: 1, borderColor: colors.line }, blockRow: { minHeight: 76, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 }, blockIcon: { width: 40, height: 40, backgroundColor: '#FBE9E7', alignItems: 'center', justifyContent: 'center' }, blockCopy: { flex: 1 }, blockTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 12, fontWeight: '800' }, blockMeta: { color: colors.muted, fontFamily: fonts.sans, fontSize: 9, marginTop: 4 },
  catalogList: { backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line }, catalogRow: { minHeight: 78, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 }, catalogCopy: { flex: 1 }, catalogName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 14, fontWeight: '800' }, catalogMeta: { color: colors.muted, fontFamily: fonts.sans, fontSize: 9, lineHeight: 14, marginTop: 4 }, statusButton: { minWidth: 78, minHeight: 42, backgroundColor: '#E6F4EC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, statusButtonOff: { backgroundColor: '#EEEDE8' }, statusButtonText: { color: colors.success, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, statusButtonTextOff: { color: colors.muted },
  promoLayout: { marginTop: 28, gap: 12 }, promoLayoutWide: { flexDirection: 'row', alignItems: 'flex-start' }, promoForm: { flex: 1.1, padding: 20, backgroundColor: colors.white }, promoHistory: { flex: 0.9, padding: 20, backgroundColor: colors.white }, messageInput: { minHeight: 110, padding: 13, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' }, promoRow: { paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.line }, promoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, promoTitle: { flex: 1, color: colors.ink, fontFamily: fonts.sans, fontSize: 14, fontWeight: '800' }, promoStatus: { color: colors.blue, fontFamily: fonts.mono, fontSize: 6, fontWeight: '900', letterSpacing: 0.6 }, promoMessage: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 15, marginTop: 8 }, cancelPromo: { minHeight: 42, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 6 },
  denied: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 30 }, deniedTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 29, fontWeight: '800', marginTop: 18 }, deniedText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 330, marginTop: 8 }, deniedButton: { height: 48, marginTop: 22, paddingHorizontal: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, deniedButtonText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
});
