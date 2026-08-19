import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { barbers as localBarbers, services as localServices } from '@/data/catalog';

import { AdminSidebar } from '@/features/admin/components/AdminSidebar';
import { AdminTopbar } from '@/features/admin/components/AdminTopbar';
import { NoticeBanner } from '@/features/admin/components/NoticeBanner';
import { demoAppointments, demoClients, joined } from '@/features/admin/helpers';
import { styles } from '@/features/admin/styles';
import { ClientSubscriptionModal } from '@/features/admin/components/ClientSubscriptionModal';
import { LoyaltyPointsModal } from '@/features/admin/components/LoyaltyPointsModal';
import { ViksClubPlanModal } from '@/features/admin/components/ViksClubPlanModal';
import { AgendaTab } from '@/features/admin/tabs/AgendaTab';
import { CatalogTab } from '@/features/admin/tabs/CatalogTab';
import { ClientsTab } from '@/features/admin/tabs/ClientsTab';
import { MarketingTab } from '@/features/admin/tabs/MarketingTab';
import { SettingsTab } from '@/features/admin/tabs/SettingsTab';
import { consumeBenefit, fetchClientSubscription, voidBenefitUsage } from '@/features/viks-club/services/viks-club-service';
import type {
  AdminAppointment,
  AdminTab,
  Block,
  CalendarMode,
  Client,
  Option,
  Promotion,
} from '@/features/admin/types';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { addIsoDays, brasiliaDateIso, brasiliaDateTimeToIso, brasiliaTodayIso } from '@/lib/brasilia-time';
import { supabase } from '@/lib/supabase';

const todayIso = brasiliaTodayIso;

function getWeekRangeIso(dateIso: string) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dayOfWeek = dt.getDay(); // 0 = Sunday
  const startOfWeek = new Date(dt);
  startOfWeek.setDate(dt.getDate() - dayOfWeek);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const formatIso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return {
    startIso: formatIso(startOfWeek),
    endIso: formatIso(endOfWeek),
  };
}

export default function AdminScreen() {
  const { width } = useResponsiveLayout();
  const auth = useAuth();
  const wide = width >= 900;
  const [tab, setTab] = useState<AdminTab>('agenda');
  const [mode, setMode] = useState<CalendarMode>('day');
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [appointments, setAppointments] = useState<AdminAppointment[]>(() => demoAppointments());
  const [clients] = useState<Client[]>(demoClients);
  const [serviceOptions, setServiceOptions] = useState<Option[]>(
    localServices.map((item) => ({
      id: item.id,
      slug: item.id,
      name: item.name,
      duration: item.duration,
      price: item.price,
      active: true,
    })),
  );
  const [barberOptions, setBarberOptions] = useState<Option[]>(
    localBarbers
      .filter((item) => item.id !== 'first')
      .map((item) => ({ id: item.id, slug: item.id, name: item.name, active: true })),
  );
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [notice, setNotice] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [clientId, setClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [serviceId, setServiceId] = useState(localServices[0].id);
  const [barberId, setBarberId] = useState('victor');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const activeKeyRef = useRef('');

  const handleSetServiceId = useCallback((id: string) => {
    setServiceId(id);
    setTime('');
  }, []);

  const handleSetBarberId = useCallback((id: string) => {
    setBarberId(id);
    setTime('');
  }, []);

  const handleSetDate = useCallback((val: string) => {
    setDate(val);
    setTime('');
  }, []);
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
  const [plansModalVisible, setPlansModalVisible] = useState(false);
  const [subModalClient, setSubModalClient] = useState<Client | null>(null);
  const [loyaltyModalClient, setLoyaltyModalClient] = useState<Client | null>(null);

  const handleSelectClient = useCallback((client: Client) => {
    setClientId(client.id);
    setSelectedClient(client);
  }, []);

  const handleClearClient = useCallback(() => {
    setClientId('');
    setSelectedClient(null);
  }, []);

  const loadRemote = useCallback(async () => {
    if (!supabase || !auth.isStaff) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const range = mode === 'week' ? getWeekRangeIso(anchorDate) : { startIso: anchorDate, endIso: addIsoDays(anchorDate, 1) };
    const queryStartIso = brasiliaDateTimeToIso(range.startIso, '00:00');
    const queryEndIso = brasiliaDateTimeToIso(addIsoDays(range.startIso, 60), '00:00');

    const [
      rawAppointmentResult,
      serviceResult,
      barberResult,
      blockResult,
      promotionResult,
      unitResult,
    ] = await Promise.all([
      supabase
        .from('appointments')
        .select(
          'id, starts_at, status, client_id, service_id, barber_id, party_size, unit_price_cents, club_discount_cents, gratuity_cents, payment_status, client:profiles(full_name, prefers_silent_service), service:services(name,duration_minutes), barber:barbers(name)',
        )
        .gte('starts_at', queryStartIso)
        .lt('starts_at', queryEndIso)
        .order('starts_at'),
      supabase.from('services').select('id, slug, name, duration_minutes, price_cents, active').order('sort_order'),
      supabase.from('barbers').select('id, slug, name, active').order('sort_order'),
      supabase
        .from('schedule_blocks')
        .select('id, starts_at, ends_at, kind, reason, barber:barbers(name)')
        .gte('ends_at', new Date().toISOString())
        .order('starts_at')
        .limit(30),
      supabase
        .from('promotions')
        .select('id, title, message, audience, send_at, starts_at, ends_at, status, discount_label')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('units')
        .select('cancellation_hours, default_buffer_minutes, min_booking_notice_minutes, max_booking_days, pix_key')
        .eq('slug', 'betim')
        .single(),
    ]);

    let appointmentResult: any = rawAppointmentResult;
    if (appointmentResult.error && (appointmentResult.error.message.includes('prefers_silent_service') || appointmentResult.error.message.includes('schema cache'))) {
      appointmentResult = await supabase
        .from('appointments')
        .select(
          'id, starts_at, status, client_id, service_id, barber_id, party_size, unit_price_cents, club_discount_cents, gratuity_cents, payment_status, client:profiles(full_name), service:services(name,duration_minutes), barber:barbers(name)',
        )
        .gte('starts_at', queryStartIso)
        .lt('starts_at', queryEndIso)
        .order('starts_at');
    }

    if (!appointmentResult.error) {
      setAppointments(
        ((appointmentResult.data ?? []) as Record<string, unknown>[]).map((item) => {
          const row = item as Record<string, unknown>;
          const client = joined(row.client);
          const service = joined(row.service);
          const barber = joined(row.barber);
          const partySize = Number(row.party_size ?? 1);
          const clubDiscCents = Number(row.club_discount_cents ?? 0);
          const totalCents = Math.max(
            0,
            Number(row.unit_price_cents ?? 0) * partySize - clubDiscCents + Number(row.gratuity_cents ?? 0)
          );
          return {
            id: String(row.id),
            startsAt: String(row.starts_at),
            status: String(row.status),
            clientId: String(row.client_id),
            clientName: String(client?.full_name ?? 'Cliente'),
            serviceId: String(row.service_id),
            serviceName: String(service?.name ?? 'Serviço'),
            barberId: String(row.barber_id),
            barberName: String(barber?.name ?? 'Profissional'),
            duration: Number(service?.duration_minutes ?? 45),
            partySize,
            totalCents,
            clubDiscountCents: clubDiscCents,
            paymentStatus: String(row.payment_status ?? 'pending'),
            prefersSilentService: Boolean(client?.prefers_silent_service),
          };
        }),
      );
    }
    if (!serviceResult.error) {
      setServiceOptions(
        (serviceResult.data ?? []).map((item) => ({
          id: item.id,
          slug: item.slug,
          name: item.name,
          duration: item.duration_minutes,
          price: item.price_cents / 100,
          active: item.active,
        })),
      );
    }
    if (!barberResult.error) {
      setBarberOptions(
        (barberResult.data ?? []).map((item) => ({
          id: item.id,
          slug: item.slug,
          name: item.name,
          active: item.active,
        })),
      );
    }
    if (!blockResult.error) {
      setBlocks(
        (blockResult.data ?? []).map((item) => ({
          id: item.id,
          startsAt: item.starts_at,
          endsAt: item.ends_at,
          kind: item.kind,
          reason: item.reason || 'Horário bloqueado',
          barberName: String(joined(item.barber)?.name ?? 'Profissional'),
        })),
      );
    }
    if (!promotionResult.error) {
      setPromotions(
        (promotionResult.data ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          message: item.message,
          audience: item.audience,
          sendAt: item.send_at,
          startsAt: item.starts_at,
          endsAt: item.ends_at,
          status: item.status,
          discountLabel: item.discount_label ?? '',
        })),
      );
    }
    if (!unitResult.error) {
      setRuleCancellation(String(unitResult.data.cancellation_hours));
      setRuleBuffer(String(unitResult.data.default_buffer_minutes));
      setRuleNotice(String(unitResult.data.min_booking_notice_minutes));
      setRuleWindow(String(unitResult.data.max_booking_days));
      setPixKey(unitResult.data.pix_key ?? '');
    }
    setLoading(false);
  }, [anchorDate, auth.isStaff, mode]);

  useEffect(() => {
    queueMicrotask(loadRemote);
  }, [loadRemote]);

  const visibleAppointments = useMemo(() => {
    if (selectedClient) {
      return appointments.filter((item) => item.clientId === selectedClient.id);
    }
    if (mode === 'day') {
      return appointments.filter((item) => brasiliaDateIso(item.startsAt) === anchorDate);
    }
    const range = getWeekRangeIso(anchorDate);
    return appointments.filter((item) => {
      const dIso = brasiliaDateIso(item.startsAt);
      return dIso >= range.startIso && dIso < range.endIso;
    });
  }, [anchorDate, appointments, mode, selectedClient]);

  const occupancy = Math.min(
    100,
    Math.round((visibleAppointments.length / (mode === 'day' ? 16 : 80)) * 100),
  );

  function moveDate(direction: number) {
    setAnchorDate(addIsoDays(anchorDate, direction * (mode === 'week' ? 7 : 1)));
  }

  const fetchAvailableSlots = useCallback(async () => {
    const service = serviceOptions.find((item) => item.id === serviceId);
    const barber = barberOptions.find((item) => item.id === barberId);

    if (!serviceId || !barberId || !date || !service || !barber) {
      setAvailableTimeSlots([]);
      setSlotsLoading(false);
      setSlotsError('');
      return;
    }

    const requestKey = `${serviceId}:${barberId}:${date}:${editingId ?? ''}`;
    activeKeyRef.current = requestKey;

    setSlotsLoading(true);
    setSlotsError('');

    if (supabase) {
      const rpcParams: Record<string, unknown> = {
        p_unit_slug: 'betim',
        p_service_slug: service.slug,
        p_day: date,
        p_barber_slug: barber.slug,
        p_party_size: 1,
      };
      if (editingId) {
        rpcParams.p_ignore_appointment_id = editingId;
      }

      let availability = await supabase.rpc('get_available_slots', rpcParams as any);
      if (availability.error && editingId && rpcParams.p_ignore_appointment_id) {
        delete rpcParams.p_ignore_appointment_id;
        availability = await supabase.rpc('get_available_slots', rpcParams as any);
      }

      if (activeKeyRef.current !== requestKey) return;

      if (availability.error) {
        console.error('[Available Slots RPC Error]', availability.error);
        setSlotsLoading(false);
        setSlotsError('Não foi possível consultar os horários disponíveis.');
        setAvailableTimeSlots([]);
        return;
      }

      const rawSlots = availability.data ?? [];
      const formatted: string[] = rawSlots.map((slot: Record<string, unknown>) => {
        const d = new Date(String(slot.starts_at));
        return new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(d);
      });

      setAvailableTimeSlots(formatted);
      setSlotsLoading(false);
    } else {
      const demoSlots = [
        '09:00', '09:45', '10:30', '11:15', '13:00', '13:45', '14:30', '15:15', '16:00', '16:45', '17:30',
      ];
      setAvailableTimeSlots(demoSlots);
      setSlotsLoading(false);
    }
  }, [serviceId, barberId, date, serviceOptions, barberOptions, editingId]);

  useEffect(() => {
    if (showEditor) {
      const timer = setTimeout(() => {
        fetchAvailableSlots();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [serviceId, barberId, date, showEditor, fetchAvailableSlots]);

  async function openCreate(selectedClientId?: string) {
    setEditingId(undefined);
    setServiceId(serviceOptions[0]?.id ?? '');
    setBarberId(barberOptions[0]?.id ?? '');
    setDate(anchorDate);
    setTime('');
    setShowEditor(true);
    setNotice('');
    if (selectedClientId) {
      setClientId(selectedClientId);
      const existing = clients.find((c) => c.id === selectedClientId);
      if (existing) {
        setSelectedClient(existing);
      } else if (supabase) {
        const { data } = await supabase.from('profiles').select('id, full_name, phone').eq('id', selectedClientId).maybeSingle();
        if (data) setSelectedClient({ id: data.id, name: data.full_name || 'Cliente', phone: data.phone || 'Sem telefone' });
      }
    } else {
      setClientId('');
      setSelectedClient(null);
    }
  }

  async function openReschedule(item: AdminAppointment) {
    setEditingId(item.id);
    setClientId(item.clientId);
    setSelectedClient({ id: item.clientId, name: item.clientName, phone: 'Cliente cadastrado' });
    if (supabase) {
      supabase.from('profiles').select('id, full_name, phone').eq('id', item.clientId).maybeSingle().then(({ data }) => {
        if (data) setSelectedClient({ id: data.id, name: data.full_name || item.clientName, phone: data.phone || 'Sem telefone' });
      });
    }
    setServiceId(item.serviceId);
    setBarberId(item.barberId);
    setDate(brasiliaDateIso(item.startsAt));
    const formattedTime = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(item.startsAt));
    setTime(formattedTime);
    setShowEditor(true);
    setNotice('');
  }

  async function saveAppointment() {
    const service = serviceOptions.find((item) => item.id === serviceId);
    const barber = barberOptions.find((item) => item.id === barberId);
    if (!service || !barber || !clientId) return setNotice('Selecione cliente, serviço e profissional.');
    setSaving(true);
    setNotice('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setSaving(false);
      setNotice('Informe data e horário válidos.');
      return;
    }
    const startsAt = brasiliaDateTimeToIso(date, time);
    const startsAtMs = new Date(startsAt).getTime();

    // Check effective duration including duration_override_minutes from barber_services
    let durationMinutes = service.duration ?? 45;
    if (supabase) {
      const { data: bsData } = await supabase
        .from('barber_services')
        .select('duration_override_minutes')
        .eq('barber_id', barberId)
        .eq('service_id', serviceId)
        .maybeSingle();
      if (bsData?.duration_override_minutes) {
        durationMinutes = bsData.duration_override_minutes;
      }
    }
    const endsAt = new Date(startsAtMs + (durationMinutes + Number(ruleBuffer || 0)) * 60000).toISOString();

    if (supabase) {
      const original = editingId ? appointments.find((item) => item.id === editingId) : undefined;
      const unchangedSlot = Boolean(
        original &&
          new Date(original.startsAt).getTime() === startsAtMs &&
          original.barberId === barberId &&
          original.serviceId === serviceId,
      );

      if (!unchangedSlot) {
        const rpcParams: Record<string, unknown> = {
          p_unit_slug: 'betim',
          p_service_slug: service.slug,
          p_day: date,
          p_barber_slug: barber.slug,
          p_party_size: 1,
        };
        if (editingId) {
          rpcParams.p_ignore_appointment_id = editingId;
        }

        let availability = await supabase.rpc('get_available_slots', rpcParams as any);
        if (availability.error && editingId && rpcParams.p_ignore_appointment_id) {
          delete rpcParams.p_ignore_appointment_id;
          availability = await supabase.rpc('get_available_slots', rpcParams as any);
        }

        if (availability.error) {
          console.error('[Availability RPC Error]', availability.error);
          setSaving(false);
          setNotice('Não foi possível validar a disponibilidade do horário.');
          return;
        }

        const isAvailable = (availability.data ?? []).some(
          (slot: Record<string, unknown>) => new Date(String(slot.starts_at)).getTime() === startsAtMs,
        );

        if (!isAvailable) {
          setSaving(false);
          setNotice('Este horário não está disponível pelas regras atuais da barbearia.');
          return;
        }
      }

      const unit = await supabase.from('units').select('id').eq('slug', 'betim').single();
      if (unit.error || !unit.data) {
        setSaving(false);
        setNotice('A unidade Betim não está disponível.');
        return;
      }

      const result = editingId
        ? await supabase
            .from('appointments')
            .update({ starts_at: startsAt, ends_at: endsAt, barber_id: barberId, service_id: serviceId, client_id: clientId })
            .eq('id', editingId)
        : await supabase.from('appointments').insert({
            client_id: clientId,
            unit_id: unit.data.id,
            barber_id: barberId,
            service_id: serviceId,
            starts_at: startsAt,
            ends_at: endsAt,
            status: 'confirmed',
            booked_via: 'reception',
            party_size: 1,
            unit_price_cents: Math.round((service.price ?? 0) * 100),
          });

      if (result.error) {
        setSaving(false);
        setNotice(
          result.error.message.includes('appointments_no_barber_overlap')
            ? 'Este profissional já tem atendimento neste horário.'
            : result.error.message,
        );
        return;
      }
      await loadRemote();
    } else {
      const client = selectedClient ?? clients.find((item) => item.id === clientId);
      const barberOpt = barberOptions.find((item) => item.id === barberId);
      const value: AdminAppointment = {
        id: editingId ?? `demo-${Date.now()}`,
        startsAt,
        status: 'confirmed',
        clientId,
        clientName: client?.name ?? 'Cliente',
        serviceId,
        serviceName: service.name,
        barberId,
        barberName: barberOpt?.name ?? 'Profissional',
        duration: durationMinutes,
        partySize: 1,
        totalCents: Math.round((service.price ?? 0) * 100),
        paymentStatus: 'pending',
        prefersSilentService: false,
      };
      setAppointments((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? value : item))
          : [...current, value].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
    }

    setSaving(false);
    setShowEditor(false);
    setNotice(editingId ? 'Horário reagendado.' : 'Atendimento criado pela recepção.');
  }

  async function changeStatus(item: AdminAppointment, status: 'cancelled' | 'completed' | 'no_show') {
    if (supabase) {
      const payload =
        status === 'cancelled'
          ? { status, cancelled_at: new Date().toISOString(), cancellation_reason: 'Cancelado pela recepção' }
          : { status };
      const { error } = await supabase.from('appointments').update(payload).eq('id', item.id);
      if (error) return setNotice(error.message);
      await loadRemote();
    } else {
      setAppointments((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, status } : entry)),
      );
    }
    setNotice(
      status === 'cancelled' ? 'Atendimento cancelado; a notificação entrou na fila.' : 'Status atualizado.',
    );
  }

  async function createBlock() {
    const barber = barberOptions.find((item) => item.id === barberId);
    if (!barber) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(blockStart) || !/^\d{2}:\d{2}$/.test(blockEnd))
      return setNotice('Informe data e horários válidos para o bloqueio.');
    const startsAt = brasiliaDateTimeToIso(date, blockStart);
    const endsAt = brasiliaDateTimeToIso(date, blockEnd);
    if (endsAt <= startsAt) return setNotice('O fim do bloqueio precisa ser depois do início.');
    if (supabase) {
      const { error } = await supabase.from('schedule_blocks').insert({
        barber_id: barberId,
        starts_at: startsAt,
        ends_at: endsAt,
        kind: 'block',
        reason: blockReason,
        created_by: auth.user?.id,
      });
      if (error) return setNotice(error.message);
      await loadRemote();
    } else {
      setBlocks((current) => [
        ...current,
        { id: `block-${Date.now()}`, startsAt, endsAt, barberName: barber.name, kind: 'block', reason: blockReason },
      ]);
    }
    setNotice('Horário bloqueado na disponibilidade.');
  }

  async function markPaid(item: AdminAppointment) {
    if (!supabase) {
      setAppointments((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, paymentStatus: 'paid' } : entry)),
      );
      setNotice('Pagamento marcado como pago.');
      return;
    }
    const existing = await supabase
      .from('appointment_payments')
      .select('amount_cents')
      .eq('appointment_id', item.id)
      .eq('status', 'paid');
    if (existing.error) return setNotice(existing.error.message);
    const alreadyPaid = (existing.data ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
    const remaining = Math.max(0, item.totalCents - alreadyPaid);
    if (!remaining) return setNotice('Este atendimento já está quitado.');
    const { error } = await supabase.from('appointment_payments').insert({
      appointment_id: item.id,
      payer_name: item.clientName,
      amount_cents: remaining,
      method: 'pix',
      status: 'paid',
      paid_at: new Date().toISOString(),
      created_by: auth.user?.id,
    });
    if (error) return setNotice(error.message);
    await loadRemote();
    setNotice('Pagamento PIX registrado e atendimento quitado.');
  }

  async function createService() {
    const duration = Number(serviceDuration);
    const price = Number(servicePrice);
    if (!serviceName.trim() || !serviceSlug.trim() || duration < 5 || price < 0)
      return setNotice('Revise nome, identificador, duração e preço do serviço.');
    if (!supabase) {
      setServiceOptions((current) => [
        ...current,
        { id: `service-${Date.now()}`, slug: serviceSlug, name: serviceName, duration, price, active: true },
      ]);
      setNotice('Serviço criado na demonstração.');
      return;
    }
    const { data, error } = await supabase
      .from('services')
      .insert({
        name: serviceName.trim(),
        slug: serviceSlug.trim().toLowerCase(),
        description: 'Serviço Viks Man',
        duration_minutes: duration,
        price_cents: Math.round(price * 100),
      })
      .select('id')
      .single();
    if (error || !data) return setNotice(error?.message ?? 'Não foi possível criar o serviço.');
    const activeBarbers = barberOptions.filter((item) => item.active !== false);
    if (activeBarbers.length)
      await supabase
        .from('barber_services')
        .insert(activeBarbers.map((barber) => ({ barber_id: barber.id, service_id: data.id })));
    setServiceName('');
    setServiceSlug('');
    await loadRemote();
    setNotice('Serviço criado e liberado para os profissionais ativos.');
  }

  async function createBarber() {
    if (!barberName.trim() || !barberSlug.trim())
      return setNotice('Informe nome e identificador do profissional.');
    if (!supabase) {
      setBarberOptions((current) => [
        ...current,
        { id: `barber-${Date.now()}`, slug: barberSlug, name: barberName, active: true },
      ]);
      setNotice('Profissional criado na demonstração.');
      return;
    }
    const unit = await supabase.from('units').select('id').eq('slug', 'betim').single();
    if (unit.error) return setNotice(unit.error.message);
    const { data, error } = await supabase
      .from('barbers')
      .insert({
        unit_id: unit.data.id,
        name: barberName.trim(),
        slug: barberSlug.trim().toLowerCase(),
        bio: 'Profissional Viks Man',
      })
      .select('id')
      .single();
    if (error || !data) return setNotice(error?.message ?? 'Não foi possível criar o profissional.');
    const activeServices = serviceOptions.filter((item) => item.active !== false);
    if (activeServices.length)
      await supabase
        .from('barber_services')
        .insert(activeServices.map((service) => ({ barber_id: data.id, service_id: service.id })));
    await supabase.from('working_hours').insert(
      [1, 2, 3, 4, 5, 6].map((weekday) => ({
        barber_id: data.id,
        weekday,
        opens_at: '09:00',
        closes_at: '19:00',
        slot_interval_minutes: 15,
      })),
    );
    setBarberName('');
    setBarberSlug('');
    await loadRemote();
    setNotice('Profissional criado com jornada inicial de segunda a sábado, 9h–19h.');
  }

  async function toggleCatalog(kind: 'services' | 'barbers', item: Option) {
    if (!supabase) {
      const setter = kind === 'services' ? setServiceOptions : setBarberOptions;
      setter((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, active: item.active === false } : entry)),
      );
      return;
    }
    const { error } = await supabase.from(kind).update({ active: item.active === false }).eq('id', item.id);
    if (error) return setNotice(error.message);
    await loadRemote();
  }

  async function createPromotion() {
    if (!promoTitle.trim() || promoMessage.trim().length < 10 || !auth.user)
      return setNotice('Informe título e uma mensagem com pelo menos 10 caracteres.');
    const [sendDate, sendTime] = promoSendAt.trim().split(/\s+/);
    const [endDate, endTime] = promoEndsAt.trim().split(/\s+/);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(sendDate ?? '') ||
      !/^\d{2}:\d{2}$/.test(sendTime ?? '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate ?? '') ||
      !/^\d{2}:\d{2}$/.test(endTime ?? '')
    )
      return setNotice('Use o formato AAAA-MM-DD HH:MM.');
    const sendAt = new Date(brasiliaDateTimeToIso(sendDate ?? '', sendTime ?? ''));
    const endsAt = new Date(brasiliaDateTimeToIso(endDate ?? '', endTime ?? ''));
    if (Number.isNaN(sendAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= new Date())
      return setNotice('Use data e hora válidas e um término futuro.');
    if (!supabase) {
      setNotice('Campanha simulada. Conecte o WhatsApp para envio real.');
      return;
    }
    const { error } = await supabase.from('promotions').insert({
      title: promoTitle.trim(),
      message: promoMessage.trim(),
      discount_label: promoDiscount.trim() || null,
      audience: promoAudience,
      starts_at: new Date().toISOString(),
      ends_at: endsAt.toISOString(),
      send_at: sendAt.toISOString(),
      status: 'scheduled',
      created_by: auth.user.id,
    });
    if (error) return setNotice(error.message);
    setPromoTitle('');
    setPromoMessage('');
    setPromoDiscount('');
    await loadRemote();
    setNotice('Campanha agendada. Só receberão clientes com consentimento de marketing e WhatsApp.');
  }

  async function cancelPromotion(id: string) {
    if (!supabase) {
      setPromotions((current) =>
        current.map((item) => (item.id === id ? { ...item, status: 'cancelled' } : item)),
      );
      return;
    }
    const { error } = await supabase
      .from('promotions')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .in('status', ['draft', 'scheduled']);
    if (error) return setNotice(error.message);
    await loadRemote();
    setNotice('Campanha cancelada.');
  }

  async function saveRules() {
    if (!auth.isManager) return setNotice('Apenas gerência/administração pode alterar as configurações da unidade.');
    if (!supabase) return setNotice('Regras salvas na demonstração.');
    const { error } = await supabase
      .from('units')
      .update({
        cancellation_hours: Number(ruleCancellation),
        default_buffer_minutes: Number(ruleBuffer),
        min_booking_notice_minutes: Number(ruleNotice),
        max_booking_days: Number(ruleWindow),
        pix_key: pixKey.trim() || null,
      })
      .eq('slug', 'betim');
    if (error) return setNotice(error.message);
    await loadRemote();
    setNotice('Regras comerciais e chave PIX atualizadas.');
  }

  const handleConsumeBenefit = useCallback(async (item: AdminAppointment) => {
    setLoading(true);
    try {
      const sub = await fetchClientSubscription(item.clientId);
      if (!sub || sub.status !== 'active' || !sub.benefits) {
        setNotice('Cliente não possui assinatura ativa com benefícios.');
        setLoading(false);
        return;
      }
      const matchingBenefit = sub.benefits.find(
        (b) => b.benefitType === 'service_credit' && b.serviceId === item.serviceId && b.quantityUsed < b.quantityGranted
      );
      if (!matchingBenefit) {
        setNotice('Nenhum crédito de benefício disponível para este serviço nesta assinatura.');
        setLoading(false);
        return;
      }
      const res = await consumeBenefit(matchingBenefit.id, item.clientId, item.id, 1);
      if (res.success) {
        setNotice('Benefício Viks Club aplicado com sucesso no atendimento!');
        await loadRemote();
      } else {
        setNotice(res.error || 'Erro ao aplicar benefício.');
        setLoading(false);
      }
    } catch {
      setNotice('Falha ao aplicar benefício.');
      setLoading(false);
    }
  }, [loadRemote]);

  const handleVoidBenefit = useCallback(async (item: AdminAppointment) => {
    setLoading(true);
    try {
      if (!supabase) {
        setNotice('Modo offline — estorno não executado.');
        setLoading(false);
        return;
      }
      const { data: usageData } = await supabase
        .from('viks_club_benefit_usage')
        .select('id')
        .eq('appointment_id', item.id)
        .is('voided_at', null)
        .limit(1)
        .maybeSingle();

      if (!usageData) {
        setNotice('Nenhum uso ativo encontrado para estorno neste atendimento.');
        setLoading(false);
        return;
      }

      const res = await voidBenefitUsage(usageData.id, 'Estorno manual na agenda');
      if (res.success) {
        setNotice('Uso do benefício Viks Club estornado com sucesso!');
        await loadRemote();
      } else {
        setNotice(res.error || 'Erro ao estornar benefício.');
        setLoading(false);
      }
    } catch {
      setNotice('Falha ao estornar benefício.');
      setLoading(false);
    }
  }, [loadRemote]);

  if (auth.configured && !auth.loading && !auth.isStaff) {
    return (
      <SafeAreaView style={styles.denied}>
        <Ionicons name="lock-closed-outline" color={colors.blue} size={36} />
        <Text style={styles.deniedTitle}>Acesso da equipe.</Text>
        <Text style={styles.deniedText}>Entre com uma conta de recepção, gerência ou administração.</Text>
        <Pressable onPress={() => router.replace('/profile')} style={styles.deniedButton}>
          <Text style={styles.deniedButtonText}>VOLTAR AO PERFIL</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.shell}>
        <AdminTopbar configured={auth.configured} onClose={() => router.back()} />
        <View style={[styles.workspace, wide && styles.workspaceWide]}>
          <AdminSidebar activeTab={tab} onSelectTab={setTab} wide={wide} />
          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            <NoticeBanner notice={notice} onClear={() => setNotice('')} />
            {loading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}

            {tab === 'agenda' ? (
              <AgendaTab
                mode={mode}
                anchorDate={anchorDate}
                visibleAppointments={visibleAppointments}
                occupancy={occupancy}
                showEditor={showEditor}
                editingId={editingId}
                clients={clients}
                selectedClient={selectedClient}
                serviceOptions={serviceOptions}
                barberOptions={barberOptions}
                clientId={clientId}
                serviceId={serviceId}
                barberId={barberId}
                date={date}
                time={time}
                saving={saving}
                availableTimeSlots={availableTimeSlots}
                slotsLoading={slotsLoading}
                slotsError={slotsError}
                setMode={setMode}
                moveDate={moveDate}
                openCreate={openCreate}
                onSelectClient={handleSelectClient}
                onClearClient={handleClearClient}
                setServiceId={handleSetServiceId}
                setBarberId={handleSetBarberId}
                setDate={handleSetDate}
                setTime={setTime}
                onRetrySlots={fetchAvailableSlots}
                setShowEditor={setShowEditor}
                saveAppointment={saveAppointment}
                markPaid={markPaid}
                openReschedule={openReschedule}
                changeStatus={changeStatus}
                onConsumeBenefit={handleConsumeBenefit}
                onVoidBenefit={handleVoidBenefit}
                wide={wide}
              />
            ) : null}

            {tab === 'clients' ? (
              <>
                {auth.isManager ? (
                  <View style={{ marginBottom: 16 }}>
                    <Pressable
                      onPress={() => setPlansModalVisible(true)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: colors.blue,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 6,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Ionicons name="sparkles" size={16} color={colors.white} />
                      <Text style={{ color: colors.white, fontFamily: 'monospace', fontSize: 11, fontWeight: '800' }}>
                        GERENCIAR PLANOS DO VIKS CLUB
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <ClientsTab
                  onSelectClient={(selectedClientId) => {
                    setTab('agenda');
                    openCreate(selectedClientId);
                  }}
                  onManageSubscription={auth.isManager ? (client) => setSubModalClient(client) : undefined}
                  onManageLoyalty={auth.isManager ? (client) => setLoyaltyModalClient(client) : undefined}
                />
              </>
            ) : null}

            {tab === 'catalog' ? (
              <CatalogTab
                serviceName={serviceName}
                setServiceName={setServiceName}
                serviceSlug={serviceSlug}
                setServiceSlug={setServiceSlug}
                serviceDuration={serviceDuration}
                setServiceDuration={setServiceDuration}
                servicePrice={servicePrice}
                setServicePrice={setServicePrice}
                createService={createService}
                barberName={barberName}
                setBarberName={setBarberName}
                barberSlug={barberSlug}
                setBarberSlug={setBarberSlug}
                createBarber={createBarber}
                serviceOptions={serviceOptions}
                barberOptions={barberOptions}
                toggleCatalog={toggleCatalog}
                onManageViksClubPlans={auth.isManager ? () => setPlansModalVisible(true) : undefined}
                wide={wide}
              />
            ) : null}

            {tab === 'marketing' ? (
              <MarketingTab
                promoTitle={promoTitle}
                setPromoTitle={setPromoTitle}
                promoDiscount={promoDiscount}
                setPromoDiscount={setPromoDiscount}
                promoMessage={promoMessage}
                setPromoMessage={setPromoMessage}
                promoAudience={promoAudience}
                setPromoAudience={setPromoAudience}
                promoSendAt={promoSendAt}
                setPromoSendAt={setPromoSendAt}
                promoEndsAt={promoEndsAt}
                setPromoEndsAt={setPromoEndsAt}
                saving={saving}
                createPromotion={createPromotion}
                promotions={promotions}
                cancelPromotion={cancelPromotion}
                wide={wide}
              />
            ) : null}

            {tab === 'settings' ? (
              <SettingsTab
                barberOptions={barberOptions}
                barberId={barberId}
                setBarberId={setBarberId}
                date={date}
                setDate={setDate}
                blockStart={blockStart}
                setBlockStart={setBlockStart}
                blockEnd={blockEnd}
                setBlockEnd={setBlockEnd}
                blockReason={blockReason}
                setBlockReason={setBlockReason}
                createBlock={createBlock}
                ruleCancellation={ruleCancellation}
                setRuleCancellation={setRuleCancellation}
                ruleBuffer={ruleBuffer}
                setRuleBuffer={setRuleBuffer}
                ruleNotice={ruleNotice}
                setRuleNotice={setRuleNotice}
                ruleWindow={ruleWindow}
                setRuleWindow={setRuleWindow}
                pixKey={pixKey}
                setPixKey={setPixKey}
                saveRules={saveRules}
                blocks={blocks}
                canEditStoreSettings={auth.isManager}
                wide={wide}
              />
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>

      {auth.isManager ? (
        <ViksClubPlanModal visible={plansModalVisible} onClose={() => setPlansModalVisible(false)} />
      ) : null}

      {subModalClient ? (
        <ClientSubscriptionModal
          visible={Boolean(subModalClient)}
          clientId={subModalClient.id}
          clientName={subModalClient.name}
          onClose={() => setSubModalClient(null)}
        />
      ) : null}

      {loyaltyModalClient ? (
        <LoyaltyPointsModal
          visible={Boolean(loyaltyModalClient)}
          clientId={loyaltyModalClient.id}
          clientName={loyaltyModalClient.name}
          onClose={() => setLoyaltyModalClient(null)}
        />
      ) : null}
    </View>
  );
}
