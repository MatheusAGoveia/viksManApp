import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-ui';
import { colors, fonts, layout } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useBookings } from '@/context/booking-context';
import { barbers, formatBookingDate, formatCurrency, makeDateOptions, services, timeSlots } from '@/data/catalog';
import { fetchClientSubscription } from '@/features/viks-club/services/viks-club-service';
import type { ViksClubSubscription } from '@/features/viks-club/types';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getNextAvailableSlot, type NextAvailableSlot } from '@/lib/availability';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const PIX_KEY = 'matheusaagd2@gmail.com';
const partyOptions = [1, 2, 3, 4, 5, 6];
const tipOptions = [0, 5, 10, 15];

function filterSlotsForDuration(slots: string[], totalDurationMinutes: number): string[] {
  if (slots.length === 0 || totalDurationMinutes <= 45) return slots;

  const toMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const CLOSING_MINUTES = 19 * 60;
  const slotMinutes = slots.map(toMinutes);

  return slots.filter((_, index) => {
    const startMins = slotMinutes[index];
    let currentEndMins = startMins + 45;

    for (let j = index + 1; j < slotMinutes.length; j++) {
      const nextStartMins = slotMinutes[j];
      if (nextStartMins <= currentEndMins) {
        currentEndMins = nextStartMins + 45;
      } else {
        break;
      }
    }

    const availableWindow = Math.min(currentEndMins, CLOSING_MINUTES) - startMins;
    return availableWindow >= totalDurationMinutes;
  });
}

export default function BookingScreen() {
  const params = useLocalSearchParams<{ service?: string; barber?: string }>();
  const { width } = useResponsiveLayout();
  const auth = useAuth();
  const { user } = auth;
  const { addBooking } = useBookings();
  const dates = useMemo(() => makeDateOptions(14), []);
  const isWide = width >= 760;
  const [date, setDate] = useState<string>();
  const [time, setTime] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const [availableTimes, setAvailableTimes] = useState(timeSlots);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [partySize, setPartySize] = useState(1);
  const [tipPercent, setTipPercent] = useState(0);
  const [pixCopied, setPixCopied] = useState(false);
  const activeBarbersList = useMemo(() => barbers.filter((b) => b.id !== 'first'), []);
  const maxSimultaneous = activeBarbersList.length;

  const [nextSlots, setNextSlots] = useState<Record<string, NextAvailableSlot | null>>({});
  const [silentService, setSilentService] = useState<boolean>(auth.profile?.prefersSilentService ?? false);
  const [groupMode, setGroupMode] = useState<'consecutive' | 'simultaneous'>('consecutive');
  const [sameServiceForGroup, setSameServiceForGroup] = useState<boolean>(true);
  const [activePersonIndex, setActivePersonIndex] = useState<number>(0);
  const [groupServicesMap, setGroupServicesMap] = useState<Record<number, string[]>>({ 0: ['cut'] });

  const incomingServiceParam = paramValue(params.service);
  const incomingBarber = paramValue(params.barber);

  useEffect(() => {
    if (auth.profile?.prefersSilentService !== undefined) {
      const isSilent = auth.profile.prefersSilentService;
      const timer = setTimeout(() => {
        setSilentService(isSilent);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [auth.profile?.prefersSilentService]);
  useEffect(() => {
    if (partySize > maxSimultaneous && groupMode === 'simultaneous') {
      const timer = setTimeout(() => {
        setGroupMode('consecutive');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [groupMode, maxSimultaneous, partySize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGroupServicesMap((prev) => {
        const next: Record<number, string[]> = {};
        const base = prev[0] && prev[0].length > 0 ? prev[0] : ['cut'];
        for (let i = 0; i < partySize; i++) {
          next[i] = prev[i] && prev[i].length > 0 ? prev[i] : base;
        }
        return next;
      });
      if (activePersonIndex >= partySize) {
        setActivePersonIndex(0);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activePersonIndex, partySize]);

  const initialServiceIds = useMemo(() => {
    if (!incomingServiceParam) return ['cut'];
    const list = incomingServiceParam.split(',').filter(Boolean);
    const valid = list.filter((id) => services.some((s) => s.id === id));
    return valid.length > 0 ? valid : ['cut'];
  }, [incomingServiceParam]);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(initialServiceIds);

  function toggleService(id: string) {
    setTime(undefined);
    setSelectedServiceIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((item) => item !== id);
        if (next.length === 0) next = [id];
      } else {
        next = [...prev, id];
      }
      router.setParams({ service: next.join(',') });
      return next;
    });
    Haptics.selectionAsync().catch(() => undefined);
  }

  function toggleServiceForPerson(serviceId: string) {
    setTime(undefined);
    if (partySize === 1 || sameServiceForGroup) {
      toggleService(serviceId);
      setGroupServicesMap((prev) => {
        let current = prev[0] || ['cut'];
        if (current.includes(serviceId)) {
          current = current.filter((id) => id !== serviceId);
          if (current.length === 0) current = [serviceId];
        } else {
          current = [...current, serviceId];
        }
        const nextMap: Record<number, string[]> = {};
        for (let i = 0; i < partySize; i++) {
          nextMap[i] = current;
        }
        return nextMap;
      });
    } else {
      setGroupServicesMap((prev) => {
        let current = prev[activePersonIndex] || ['cut'];
        if (current.includes(serviceId)) {
          current = current.filter((id) => id !== serviceId);
          if (current.length === 0) current = [serviceId];
        } else {
          current = [...current, serviceId];
        }
        return { ...prev, [activePersonIndex]: current };
      });
      Haptics.selectionAsync().catch(() => undefined);
    }
  }

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)),
    [selectedServiceIds],
  );

  const groupCalculations = useMemo(() => {
    if (partySize === 1 || sameServiceForGroup) {
      const sList = services.filter((s) => selectedServiceIds.includes(s.id));
      const name = sList.map((s) => s.name).join(' + ') || 'Serviço';
      const durPerPerson = sList.reduce((sum, s) => sum + s.duration, 0);
      const pricePerPerson = sList.reduce((sum, s) => sum + s.price, 0);
      return {
        name,
        totalDuration: groupMode === 'consecutive' ? durPerPerson * partySize : durPerPerson,
        totalPrice: pricePerPerson * partySize,
        primaryServiceId: selectedServiceIds[0] || 'cut',
      };
    }

    let sumDuration = 0;
    let maxDurationInGroup = 0;
    let sumPrice = 0;
    const namesList: string[] = [];

    for (let i = 0; i < partySize; i++) {
      const pIds = groupServicesMap[i] || ['cut'];
      const pServices = services.filter((s) => pIds.includes(s.id));
      const pDur = pServices.reduce((sum, s) => sum + s.duration, 0);
      const pPrice = pServices.reduce((sum, s) => sum + s.price, 0);
      const pNames = pServices.map((s) => s.name).join(' + ');

      sumDuration += pDur;
      maxDurationInGroup = Math.max(maxDurationInGroup, pDur);
      sumPrice += pPrice;
      namesList.push(`P${i + 1}: ${pNames}`);
    }

    const firstPersonIds = groupServicesMap[0] || ['cut'];

    return {
      name: namesList.join(' · '),
      totalDuration: groupMode === 'consecutive' ? sumDuration : maxDurationInGroup,
      totalPrice: sumPrice,
      primaryServiceId: firstPersonIds[0] || 'cut',
    };
  }, [groupMode, groupServicesMap, partySize, sameServiceForGroup, selectedServiceIds]);

  const primaryServiceId = groupCalculations.primaryServiceId;
  const combinedServiceName = groupCalculations.name;
  const combinedDuration = groupCalculations.totalDuration;
  const combinedPrice = groupCalculations.totalPrice;

  const barberId = barbers.some((item) => item.id === incomingBarber) ? incomingBarber : undefined;

  const [clientSub, setClientSub] = useState<ViksClubSubscription | null>(null);

  useEffect(() => {
    if (auth.profile?.id) {
      fetchClientSubscription(auth.profile.id).then(setClientSub).catch(() => undefined);
    }
  }, [auth.profile?.id]);

  const assignedBarberObj = barbers.find((b) => b.id === clientSub?.barberId);

  const selectedBarber = barbers.find((barber) => barber.id === barberId);
  const canConfirm = Boolean(selectedServiceIds.length > 0 && barberId && date && time && !submitting);
  const subtotal = combinedPrice;
  const gratuity = Math.round(subtotal * tipPercent) / 100;
  const total = subtotal + gratuity;

  useEffect(() => {
    async function loadSlots() {
      const totalNeededMinutes = combinedDuration;

      if (partySize > 1 && groupMode === 'simultaneous') {
        const targetServiceSlug = selectedServiceIds.length > 1 && combinedDuration >= 75 ? 'combo' : primaryServiceId;
        setSlotsLoading(true);
        const client = supabase;
        if (client && date) {
          const barberSlotsPromises = activeBarbersList.map(async (b) => {
            const { data } = await client.rpc('get_available_slots', {
              p_unit_slug: 'betim',
              p_service_slug: targetServiceSlug,
              p_day: date,
              p_barber_slug: b.id,
              p_party_size: 1,
            });
            const times: string[] = (data ?? []).map((slot: Record<string, unknown>) => new Intl.DateTimeFormat('pt-BR', {
              timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
            }).format(new Date(String(slot.starts_at))));
            return filterSlotsForDuration(Array.from(new Set(times)), combinedDuration);
          });
          const allBarberSlots = await Promise.all(barberSlotsPromises);
          const counts: Record<string, number> = {};
          for (const bSlots of allBarberSlots) {
            for (const t of bSlots) {
              counts[t] = (counts[t] || 0) + 1;
            }
          }
          const simultaneousTimes = Object.keys(counts).filter((t) => counts[t] >= partySize).sort();
          setAvailableTimes(simultaneousTimes);
        } else {
          const filteredOffline = filterSlotsForDuration(timeSlots, combinedDuration);
          setAvailableTimes(filteredOffline);
        }
        setSlotsLoading(false);
        return;
      }

      if (!supabase || !primaryServiceId || !barberId || !date) {
        setAvailableTimes(filterSlotsForDuration(timeSlots, totalNeededMinutes));
        return;
      }
      setSlotsLoading(true);
      const targetServiceSlug = selectedServiceIds.length > 1 && combinedDuration >= 75 ? 'combo' : primaryServiceId;
      const { data, error } = await supabase.rpc('get_available_slots', {
        p_unit_slug: 'betim',
        p_service_slug: targetServiceSlug,
        p_day: date,
        p_barber_slug: barberId,
        p_party_size: partySize,
      });
      if (!error) {
        const times: string[] = (data ?? []).map((slot: Record<string, unknown>) => new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).format(new Date(String(slot.starts_at))));
        const uniqueTimes = Array.from(new Set(times));
        setAvailableTimes(filterSlotsForDuration(uniqueTimes, totalNeededMinutes));
      } else {
        setAvailableTimes(filterSlotsForDuration(timeSlots, totalNeededMinutes));
      }
      setSlotsLoading(false);
    }
    loadSlots();
  }, [activeBarbersList, barberId, combinedDuration, date, groupMode, partySize, primaryServiceId, selectedServiceIds.length]);

  useEffect(() => {
    if (!primaryServiceId || !supabase) return;
    let active = true;
    const targetServiceSlug = selectedServiceIds.length > 1 && combinedDuration >= 75 ? 'combo' : primaryServiceId;
    Promise.all(barbers.map(async (barber) => [barber.id, await getNextAvailableSlot(targetServiceSlug, barber.id, partySize)] as const))
      .then((results) => {
        if (active) setNextSlots(Object.fromEntries(results));
      })
      .catch(() => {
        if (active) setNextSlots({});
      });
    return () => { active = false; };
  }, [combinedDuration, partySize, primaryServiceId, selectedServiceIds.length]);

  function select(setter: (value: string) => void, value: string) {
    setter(value);
    Haptics.selectionAsync().catch(() => undefined);
  }

  async function confirm() {
    if (selectedServiceIds.length === 0 || !barberId || !date || !time) return;
    if (isSupabaseConfigured && !user) {
      router.push({ pathname: '/login', params: { returnTo: '/book' } });
      return;
    }
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      await addBooking({ serviceId: primaryServiceId, barberId, date, time, partySize, gratuityCents: Math.round(gratuity * 100), unitPriceCents: Math.round(combinedPrice * 100), paymentStatus: 'pending', pixKey: PIX_KEY });
      if (user || !isSupabaseConfigured) {
        let barberUuid: string | null = barberId;
        if (supabase && barberId) {
          const { data: bData } = await supabase.from('barbers').select('id').eq('slug', barberId).maybeSingle();
          if (bData?.id) barberUuid = bData.id;
        }
        auth.updateProfile({ preferredBarberId: barberUuid, prefersSilentService: silentService }).catch(() => undefined);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setConfirmed(true);
    } catch (error) {
      const message = String(error);
      setSubmitError(message.includes('SLOT_UNAVAILABLE') ? 'Este horário acabou de ser ocupado. Escolha outro encaixe.' : 'Não foi possível confirmar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function finish(destination: '/' | '/appointments') {
    setConfirmed(false);
    setDate(undefined);
    setTime(undefined);
    setPartySize(1);
    setTipPercent(0);
    setPixCopied(false);
    router.replace(destination);
  }

  if (confirmed && selectedServices.length > 0 && selectedBarber && date && time) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.centeredContent}>
        <SafeAreaView style={styles.successWrap}>
          <View style={styles.successMark}><Ionicons name="checkmark" color={colors.white} size={42} /></View>
          <Text style={styles.successEyebrow}>HORÁRIO CONFIRMADO</Text>
          <Text style={styles.successTitle}>Cadeira{`\n`}reservada.</Text>
          <Text style={styles.successText}>{isSupabaseConfigured ? 'Seu horário foi sincronizado com a barbearia e com a sua conta.' : 'Seu horário já aparece na agenda deste dispositivo.'}</Text>
          <View style={styles.successCard}>
            <Text style={styles.summaryLabel}>SEU AGENDAMENTO</Text>
            <Text style={styles.summaryDate}>{formatBookingDate(date)}</Text>
            <Text style={styles.summaryTime}>{time}</Text>
            <View style={styles.summaryLine}><Text style={styles.summaryKey}>SERVIÇO</Text><Text style={styles.summaryValue}>{combinedServiceName}</Text></View>
            <View style={styles.summaryLine}><Text style={styles.summaryKey}>PROFISSIONAL</Text><Text style={styles.summaryValue}>{selectedBarber.name}</Text></View>
            <View style={styles.summaryLine}><Text style={styles.summaryKey}>GRUPO</Text><Text style={styles.summaryValue}>{partySize} {partySize === 1 ? 'pessoa' : 'pessoas'}</Text></View>
            {partySize > 1 ? <View style={styles.summaryLine}><Text style={styles.summaryKey}>MODO GRUPO</Text><Text style={styles.summaryValue}>{groupMode === 'consecutive' ? 'Consecutivo' : 'Simultâneo'}</Text></View> : null}
            {silentService ? <View style={styles.summaryLine}><Text style={styles.summaryKey}>ATENDIMENTO</Text><Text style={styles.summaryValue}>Silencioso 🔇</Text></View> : null}
            {gratuity > 0 ? <View style={styles.summaryLine}><Text style={styles.summaryKey}>GORJETA</Text><Text style={styles.summaryValue}>{formatCurrency(gratuity)}</Text></View> : null}
            <View style={styles.summaryLine}><Text style={styles.summaryKey}>TOTAL</Text><Text style={styles.summaryValue}>{formatCurrency(total)}</Text></View>
            {partySize > 1 ? <View style={styles.summaryLine}><Text style={styles.summaryKey}>DIVISÃO SUGERIDA</Text><Text style={styles.summaryValue}>{formatCurrency(total / partySize)} por pessoa</Text></View> : null}
          </View>
          <View style={styles.pixCard}>
            <View style={styles.pixIcon}><Ionicons name="qr-code-outline" color={colors.blue} size={22} /></View>
            <View style={styles.pixCopy}><Text style={styles.pixLabel}>PAGAMENTO VIA PIX</Text><Text selectable style={styles.pixKey}>{PIX_KEY}</Text><Text style={styles.pixHint}>O pagamento é confirmado manualmente pela recepção.</Text></View>
            <Pressable accessibilityLabel="Copiar chave PIX" onPress={async () => { await Clipboard.setStringAsync(PIX_KEY); setPixCopied(true); }} style={styles.copyButton}><Ionicons name={pixCopied ? 'checkmark' : 'copy-outline'} color={colors.ink} size={18} /><Text style={styles.copyText}>{pixCopied ? 'COPIADO' : 'COPIAR'}</Text></Pressable>
          </View>
          <Pressable onPress={() => finish('/appointments')} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>VER MEUS HORÁRIOS</Text><Ionicons name="arrow-forward" color={colors.white} size={18} />
          </Pressable>
          <Pressable onPress={() => finish('/')} style={styles.secondary}><Text style={styles.secondaryText}>VOLTAR AO INÍCIO</Text></Pressable>
        </SafeAreaView>
      </ScrollView>
    );
  }

  return (
    <>
    <ScrollView style={styles.screen} contentContainerStyle={styles.centeredContent} keyboardShouldPersistTaps="handled">
      <SafeAreaView edges={['top']} style={[styles.page, !isWide && canConfirm && styles.pageWithDock]}>
        <View style={styles.header}>
          <View style={styles.bookingTopbar}>
            <BrandLockup inverse />
            <Text style={styles.unitLabel}>UNIDADE BETIM</Text>
          </View>
          <Text style={styles.eyebrow}>AGENDAMENTO</Text>
          <Text style={[styles.title, isWide && styles.titleWide]}>Escolha.{`\n`}Confirme. <Text style={styles.titleAccent}>Pronto.</Text></Text>
          <Text style={styles.subtitle}>Disponibilidade real, inclusive para grupos de até seis pessoas.</Text>
        </View>

        <View style={styles.progress}>
          {[selectedServiceIds.length > 0, partySize > 0, Boolean(barberId), Boolean(date), Boolean(time)].map((done, index) => (
            <View key={index} style={[styles.progressBar, done && styles.progressDone]} />
          ))}
        </View>

        <View style={[styles.bookingLayout, isWide && styles.bookingLayoutWide]}>
        <View style={styles.choicesColumn}>
        <View style={[styles.section, isWide && styles.sectionWide]}>
          <View style={styles.sectionHeading}><Text style={styles.step}>01</Text><Text style={styles.sectionTitle}>O que vamos fazer?</Text></View>

          {partySize > 1 ? (
            <View style={styles.groupServiceModeWrap}>
              <View style={styles.groupServiceToggleRow}>
                <Pressable
                  onPress={() => { setTime(undefined); setSameServiceForGroup(true); }}
                  style={[styles.groupServiceToggleChip, sameServiceForGroup && styles.groupServiceToggleChipActive]}
                >
                  <Text style={[styles.groupServiceToggleText, sameServiceForGroup && styles.selectedText]}>Mesmo serviço para todos</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setTime(undefined); setSameServiceForGroup(false); }}
                  style={[styles.groupServiceToggleChip, !sameServiceForGroup && styles.groupServiceToggleChipActive]}
                >
                  <Text style={[styles.groupServiceToggleText, !sameServiceForGroup && styles.selectedText]}>Serviços individuais</Text>
                </Pressable>
              </View>

              {!sameServiceForGroup ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personTabsRow}>
                  {Array.from({ length: partySize }).map((_, idx) => {
                    const active = idx === activePersonIndex;
                    const pIds = groupServicesMap[idx] || ['cut'];
                    const pServices = services.filter((s) => pIds.includes(s.id));
                    const label = pServices.map((s) => s.shortName).join('+');
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => setActivePersonIndex(idx)}
                        style={[styles.personTab, active && styles.personTabActive]}
                      >
                        <Text style={[styles.personTabTitle, active && styles.selectedText]}>Pessoa {idx + 1}</Text>
                        <Text style={[styles.personTabSub, active && styles.selectedMuted]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.serviceList, isWide && styles.serviceListWide]}>
            {services.map((service) => {
              const activePersonIds = groupServicesMap[activePersonIndex] || ['cut'];
              const selected = partySize === 1 || sameServiceForGroup ? selectedServiceIds.includes(service.id) : activePersonIds.includes(service.id);
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={service.id}
                  onPress={() => toggleServiceForPerson(service.id)}
                  style={({ pressed }) => [styles.serviceCard, selected && styles.selectedCard, pressed && styles.pressed]}>
                  <View style={styles.choiceTop}>
                    <Text style={[styles.choiceName, selected && styles.selectedText]}>{service.name}</Text>
                    <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                  </View>
                  <Text style={[styles.choiceDescription, selected && styles.selectedMuted]}>{service.description}</Text>
                  <View style={styles.choiceMeta}>
                    <Text style={[styles.choicePrice, selected && styles.selectedText]}>{formatCurrency(service.price)}</Text>
                    <Text style={[styles.choiceDuration, selected && styles.selectedMuted]}>{service.duration} MIN</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide]}>
          <View style={styles.sectionHeading}><Text style={styles.step}>02</Text><Text style={styles.sectionTitle}>Para quantas pessoas?</Text></View>
          <Text style={styles.sectionHint}>
            {partySize === 1 ? 'Atendimento individual.' : groupMode === 'consecutive' ? 'O grupo usa a mesma cadeira em horários consecutivos.' : `Atendimento simultâneo por ${partySize} barbeiros no mesmo horário.`}
          </Text>
          <View style={styles.partyGrid}>{partyOptions.map((size) => <Pressable key={size} accessibilityRole="radio" accessibilityState={{ selected: partySize === size }} onPress={() => { setTime(undefined); setPartySize(size); }} style={[styles.partyChip, partySize === size && styles.partyChipActive]}><Text style={[styles.partyNumber, partySize === size && styles.selectedText]}>{size}</Text><Text style={[styles.partyLabel, partySize === size && styles.selectedMuted]}>{size === 1 ? 'PESSOA' : 'PESSOAS'}</Text></Pressable>)}</View>

          {partySize > 1 ? (
            <View style={styles.groupModeWrap}>
              <Text style={styles.groupModeHint}>COMO DESEJA O ATENDIMENTO DO GRUPO?</Text>
              <View style={styles.groupModeGrid}>
                <Pressable
                  onPress={() => { setTime(undefined); setGroupMode('consecutive'); }}
                  style={[styles.groupModeChip, groupMode === 'consecutive' && styles.groupModeChipActive]}
                >
                  <Ionicons name="time-outline" color={groupMode === 'consecutive' ? colors.white : colors.ink} size={16} />
                  <View style={styles.groupModeCopy}>
                    <Text style={[styles.groupModeTitle, groupMode === 'consecutive' && styles.selectedText]}>CONSECUTIVO</Text>
                    <Text style={[styles.groupModeSub, groupMode === 'consecutive' && styles.selectedMuted]}>Mesma cadeira em horários seguidos</Text>
                  </View>
                </Pressable>

                <Pressable
                  disabled={partySize > maxSimultaneous}
                  onPress={() => { setTime(undefined); setGroupMode('simultaneous'); }}
                  style={[
                    styles.groupModeChip,
                    groupMode === 'simultaneous' && styles.groupModeChipActive,
                    partySize > maxSimultaneous && styles.groupModeDisabled,
                  ]}
                >
                  <Ionicons name="people-outline" color={partySize > maxSimultaneous ? colors.muted : groupMode === 'simultaneous' ? colors.white : colors.ink} size={16} />
                  <View style={styles.groupModeCopy}>
                    <Text style={[styles.groupModeTitle, groupMode === 'simultaneous' && styles.selectedText, partySize > maxSimultaneous && styles.disabledText]}>
                      SIMULTÂNEO {partySize > maxSimultaneous ? '(INDISPONÍVEL)' : ''}
                    </Text>
                    <Text style={[styles.groupModeSub, groupMode === 'simultaneous' && styles.selectedMuted, partySize > maxSimultaneous && styles.disabledText]}>
                      {partySize > maxSimultaneous ? `Máximo de ${maxSimultaneous} barbeiros simultâneos` : 'Barbeiros diferentes no mesmo horário'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.section, isWide && styles.sectionWide]}>
          <View style={styles.sectionHeading}><Text style={styles.step}>03</Text><Text style={styles.sectionTitle}>Com quem?</Text></View>
          
          {clientSub && clientSub.status === 'active' && clientSub.barberId && barberId && barberId !== clientSub.barberId ? (
            <View style={{ backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFE0B2', padding: 12, borderRadius: 6, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="alert-circle-outline" size={20} color="#E65100" />
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#E65100', flex: 1, lineHeight: 16 }}>
                Atenção: Sua assinatura do Viks Club é exclusiva com <Text style={{ fontWeight: '800' }}>{assignedBarberObj?.name || 'seu barbeiro do plano'}</Text>. Agendamentos com outros profissionais serão cobrados como avulso.
              </Text>
            </View>
          ) : null}

          <View style={styles.barberList}>
            {barbers.map((barber) => {
              const selected = barber.id === barberId;
              const isAssignedToPlan = clientSub?.status === 'active' && clientSub?.barberId === barber.id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={barber.id}
                  onPress={() => { setTime(undefined); select((value) => router.setParams({ barber: value }), barber.id); }}
                  style={({ pressed }) => [styles.barberCard, selected && styles.selectedBarber, pressed && styles.pressed]}>
                  <View style={[styles.barberAvatar, selected && styles.selectedAvatar]}><Text style={[styles.barberInitials, selected && styles.selectedText]}>{barber.initials}</Text></View>
                  <View style={styles.barberCopy}>
                    {isAssignedToPlan ? (
                      <Text style={{ color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }}>
                        BARBEIRO DO SEU PLANO VIKS CLUB
                      </Text>
                    ) : (
                      <Text style={styles.barberChair}>{barber.chair}</Text>
                    )}
                    <Text style={styles.barberName}>{barber.name}</Text>
                    <Text style={styles.barberSpecialties}>{barber.specialties}</Text>
                  </View>
                  <View style={styles.barberAvailability}>
                    <Text style={styles.availableLabel}>PRÓXIMO</Text>
                    <Text style={styles.availableText}>{selectedServiceIds.length === 0 ? 'Escolha o serviço' : nextSlots[barber.id] === undefined ? 'Buscando…' : nextSlots[barber.id]?.display ?? 'Sem encaixe'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide]}>
          <View style={styles.sectionHeading}><Text style={styles.step}>04</Text><Text style={styles.sectionTitle}>Qual dia?</Text></View>
          {barberId && nextSlots[barberId] ? <Pressable onPress={() => { setDate(nextSlots[barberId]!.date); setTime(nextSlots[barberId]!.time); }} style={styles.suggestion}><View><Text style={styles.suggestionLabel}>PRÓXIMO ENCAIXE REAL</Text><Text style={styles.suggestionValue}>{nextSlots[barberId]!.display} · {nextSlots[barberId]!.barberName}</Text></View><View style={styles.suggestionAction}><Text style={styles.suggestionActionText}>USAR</Text><Ionicons name="arrow-forward" color={colors.white} size={16} /></View></Pressable> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
            {dates.map((option) => {
              const selected = option.iso === date;
              return (
                <Pressable key={option.iso} onPress={() => { setTime(undefined); select(setDate, option.iso); }} style={[styles.dateCard, selected && styles.dateSelected]}>
                  <Text style={[styles.dateWeekday, selected && styles.selectedText]}>{option.weekday.toUpperCase()}</Text>
                  <Text style={[styles.dateValue, selected && styles.selectedText]}>{option.date}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide]}>
          <View style={styles.sectionHeading}><Text style={styles.step}>05</Text><Text style={styles.sectionTitle}>Qual horário?</Text></View>
          <View style={styles.timeGrid}>
            {slotsLoading ? <ActivityIndicator color={colors.blue} style={styles.slotsLoading} /> : null}
            {!slotsLoading && availableTimes.length === 0 ? <Text style={styles.noSlots}>Nenhum encaixe disponível neste dia.</Text> : null}
            {!slotsLoading && availableTimes.map((slot) => {
              const selected = slot === time;
              return (
                <Pressable key={slot} onPress={() => select(setTime, slot)} style={[styles.timeChip, selected && styles.timeSelected]}>
                  <Text style={[styles.timeText, selected && styles.selectedText]}>{slot}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide]}>
          <View style={styles.sectionHeading}><Text style={styles.step}>06</Text><Text style={styles.sectionTitle}>Quer deixar gorjeta?</Text></View>
          <Text style={styles.sectionHint}>Opcional. O valor entra no total e na divisão do grupo.</Text>
          <View style={styles.tipGrid}>{tipOptions.map((percent) => <Pressable key={percent} accessibilityRole="radio" accessibilityState={{ selected: tipPercent === percent }} onPress={() => setTipPercent(percent)} style={[styles.tipChip, tipPercent === percent && styles.tipChipActive]}><Text style={[styles.tipChipText, tipPercent === percent && styles.selectedText]}>{percent === 0 ? 'SEM GORJETA' : `${percent}%`}</Text></Pressable>)}</View>
          <Pressable onPress={() => setSilentService(!silentService)} style={styles.smallSilentOption}>
            <Ionicons name="volume-mute-outline" color={silentService ? colors.blue : colors.muted} size={16} />
            <Text style={[styles.smallSilentText, silentService && styles.selectedText]}>Prefiro atendimento em silêncio</Text>
            <Switch
              accessibilityLabel="Prefiro atendimento em silêncio"
              value={silentService}
              onValueChange={setSilentService}
              trackColor={{ false: colors.line, true: colors.blue }}
              thumbColor={colors.white}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </Pressable>
        </View>

        </View>
        <View style={[styles.checkout, isWide && styles.checkoutWide]}>
          <View style={styles.checkoutCopy}>
            <Text style={styles.checkoutLabel}>{canConfirm ? 'TUDO CERTO' : 'FALTA POUCO'}</Text>
            <Text style={styles.checkoutTitle}>{combinedServiceName}</Text>
            {selectedServiceIds.length > 0 ? <Text style={styles.checkoutMeta}>{combinedDuration * partySize} min de serviço · {partySize} {partySize === 1 ? 'pessoa' : 'pessoas'}</Text> : null}
            {submitError ? <Text style={styles.checkoutError}>{submitError}</Text> : null}
            {isWide ? <View style={styles.checkoutDetails}>
              <View style={styles.checkoutDetail}><Text style={styles.checkoutKey}>PROFISSIONAL</Text><Text style={styles.checkoutValue}>{selectedBarber?.name ?? '—'}</Text></View>
              <View style={styles.checkoutDetail}><Text style={styles.checkoutKey}>DATA</Text><Text style={styles.checkoutValue}>{date ? formatBookingDate(date) : '—'}</Text></View>
              <View style={styles.checkoutDetail}><Text style={styles.checkoutKey}>HORÁRIO</Text><Text style={styles.checkoutValue}>{time ?? '—'}</Text></View>
              <View style={styles.checkoutDetail}><Text style={styles.checkoutKey}>TOTAL</Text><Text style={styles.checkoutValue}>{selectedServiceIds.length > 0 ? formatCurrency(total) : '—'}</Text></View>
              {partySize > 1 ? <View style={styles.checkoutDetail}><Text style={styles.checkoutKey}>POR PESSOA</Text><Text style={styles.checkoutValue}>{formatCurrency(total / partySize)}</Text></View> : null}
            </View> : null}
          </View>
          <Pressable disabled={!canConfirm} onPress={confirm} style={({ pressed }) => [styles.confirmButton, isWide && styles.confirmButtonWide, !canConfirm && styles.confirmDisabled, pressed && canConfirm && styles.pressed]}>
            {submitting ? <ActivityIndicator color={colors.white} /> : <><Text style={styles.confirmText}>CONFIRMAR</Text><Ionicons name="arrow-forward" color={colors.white} size={18} /></>}
          </Pressable>
        </View>
        </View>
      </SafeAreaView>
    </ScrollView>
    {!isWide && canConfirm ? (
      <View style={styles.mobileDock}>
        <View style={styles.mobileDockCopy}>
          <Text style={styles.mobileDockLabel}>SEU HORÁRIO</Text>
          <Text style={styles.mobileDockValue}>{time} · {formatCurrency(total)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Confirmar ${combinedServiceName} às ${time}`}
          disabled={submitting}
          onPress={confirm}
          style={({ pressed }) => [styles.mobileDockButton, pressed && styles.pressed]}>
          {submitting ? <ActivityIndicator color={colors.white} /> : <><Text style={styles.mobileDockButtonText}>CONFIRMAR</Text><Ionicons name="arrow-forward" color={colors.white} size={18} /></>}
        </Pressable>
      </View>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centeredContent: { alignItems: 'center' },
  page: { width: '100%', maxWidth: layout.maxWidth, paddingBottom: 36 },
  pageWithDock: { paddingBottom: 128 },
  header: { backgroundColor: colors.ink, paddingHorizontal: layout.pagePadding, paddingTop: 18, paddingBottom: 52 },
  bookingTopbar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
  unitLabel: { color: '#7F8086', fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 1 },
  eyebrow: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.7, marginBottom: 18 },
  title: { color: colors.white, fontFamily: fonts.sans, fontSize: 48, lineHeight: 46, letterSpacing: -3, fontWeight: '800' },
  titleWide: { fontSize: 62, lineHeight: 58, letterSpacing: -3.8 },
  titleAccent: { color: colors.blue, fontFamily: fonts.serif, fontStyle: 'italic', fontWeight: '400' },
  subtitle: { color: '#A6A7AC', fontFamily: fonts.sans, fontSize: 14, marginTop: 18 },
  progress: { flexDirection: 'row', gap: 5, paddingHorizontal: layout.pagePadding, paddingTop: 20 },
  progressBar: { flex: 1, height: 4, backgroundColor: colors.line },
  progressDone: { backgroundColor: colors.blue },
  bookingLayout: { width: '100%' },
  bookingLayoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28, paddingHorizontal: 32 },
  choicesColumn: { flex: 1, minWidth: 0 },
  section: { paddingHorizontal: layout.pagePadding, paddingTop: 54 },
  sectionWide: { paddingHorizontal: 0 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', gap: 13, marginBottom: 22 },
  step: { color: colors.blue, fontFamily: fonts.mono, fontSize: 10, fontWeight: '800' },
  sectionTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 27, fontWeight: '800', letterSpacing: -1.2 },
  sectionHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, lineHeight: 17, marginTop: -12, marginBottom: 17 },
  serviceList: { gap: 10 },
  serviceListWide: { flexDirection: 'row', flexWrap: 'wrap' },
  serviceCard: { minHeight: 156, flexGrow: 1, flexBasis: 330, padding: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  selectedCard: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  choiceName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 20, fontWeight: '800', letterSpacing: -0.7 },
  choiceDescription: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 10, maxWidth: 270, flex: 1 },
  choiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 15 },
  choicePrice: { color: colors.ink, fontFamily: fonts.sans, fontSize: 14, fontWeight: '800' },
  choiceDuration: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, letterSpacing: 0.8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.blue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
  selectedText: { color: colors.white },
  selectedMuted: { color: '#A9AAB0' },
  partyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  partyChip: { minWidth: 94, minHeight: 68, paddingHorizontal: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  partyChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  partyNumber: { color: colors.ink, fontFamily: fonts.sans, fontSize: 20, fontWeight: '800' },
  partyLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginTop: 4 },
  groupModeWrap: { marginTop: 20 },
  groupModeHint: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 0.9, marginBottom: 10 },
  groupModeGrid: { gap: 10 },
  groupModeChip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  groupModeChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  groupModeDisabled: { backgroundColor: colors.paper, opacity: 0.5 },
  groupModeCopy: { flex: 1 },
  groupModeTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: '800' },
  groupModeSub: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, marginTop: 2 },
  disabledText: { color: colors.muted },
  barberList: { gap: 9 },
  barberCard: { minHeight: 106, flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 13 },
  selectedBarber: { borderColor: colors.blue, borderWidth: 2, padding: 13 },
  barberAvatar: { width: 62, height: 76, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  selectedAvatar: { backgroundColor: colors.blue },
  barberInitials: { color: colors.white, fontFamily: fonts.sans, fontSize: 26, fontWeight: '900', letterSpacing: -1.5 },
  barberCopy: { flex: 1 },
  barberChair: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  barberName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 19, fontWeight: '800', letterSpacing: -0.5, marginTop: 5 },
  barberSpecialties: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, marginTop: 4 },
  barberAvailability: { alignItems: 'flex-end', maxWidth: 82 },
  availableLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, letterSpacing: 0.7 },
  availableText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  suggestion: { minHeight: 72, padding: 14, marginBottom: 14, backgroundColor: '#E7ECFA', borderLeftWidth: 4, borderLeftColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  suggestionLabel: { color: colors.blue, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
  suggestionValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 12, fontWeight: '800', marginTop: 5 },
  suggestionAction: { minWidth: 70, minHeight: 44, paddingHorizontal: 10, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  suggestionActionText: { color: colors.white, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  dateList: { gap: 9, paddingRight: layout.pagePadding },
  dateCard: { width: 88, minHeight: 84, padding: 13, justifyContent: 'space-between', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  dateSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  dateWeekday: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  dateValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 16, fontWeight: '800', textTransform: 'lowercase' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: 84, height: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  timeSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  timeText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 14, fontWeight: '800' },
  slotsLoading: { width: '100%', paddingVertical: 18 },
  noSlots: { width: '100%', color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, paddingVertical: 18 },
  tipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipChip: { minWidth: 100, height: 48, paddingHorizontal: 15, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  tipChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  tipChipText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  smallSilentOption: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  smallSilentText: { flex: 1, color: colors.muted, fontFamily: fonts.sans, fontSize: 11, fontWeight: '700' },
  checkout: { marginHorizontal: layout.pagePadding, marginTop: 58, padding: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkoutWide: { width: 300, marginHorizontal: 0, marginTop: 54, padding: 22, flexDirection: 'column', alignItems: 'stretch' },
  checkoutCopy: { flex: 1 },
  checkoutLabel: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  checkoutTitle: { color: colors.white, fontFamily: fonts.sans, fontSize: 17, fontWeight: '800', marginTop: 5 },
  checkoutMeta: { color: '#A8A9AE', fontFamily: fonts.sans, fontSize: 10, marginTop: 3 },
  groupServiceModeWrap: { marginBottom: 16 },
  groupServiceToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  groupServiceToggleChip: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  groupServiceToggleChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  groupServiceToggleText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '800' },
  personTabsRow: { gap: 8, paddingVertical: 4 },
  personTab: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  personTabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  personTabTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 12, fontWeight: '800' },
  personTabSub: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, marginTop: 2 },
  checkoutError: { color: '#FF8C82', fontFamily: fonts.sans, fontSize: 9, lineHeight: 13, marginTop: 8 },
  checkoutDetails: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#393A3E' },
  checkoutDetail: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: '#393A3E', justifyContent: 'center' },
  checkoutKey: { color: '#77787E', fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  checkoutValue: { color: colors.white, fontFamily: fonts.sans, fontSize: 11, fontWeight: '800', textTransform: 'capitalize', marginTop: 5 },
  confirmButton: { height: 52, paddingHorizontal: 17, flexDirection: 'row', gap: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue },
  confirmButtonWide: { width: '100%', marginTop: 24, justifyContent: 'space-between' },
  confirmDisabled: { backgroundColor: '#3A3B40' },
  confirmText: { color: colors.white, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  pressed: { opacity: 0.72 },
  successWrap: { width: '100%', maxWidth: 620, minHeight: 760, paddingHorizontal: layout.pagePadding, paddingTop: 76, paddingBottom: 40, alignItems: 'center', justifyContent: 'center' },
  successMark: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  successEyebrow: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 24 },
  successTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 50, lineHeight: 47, fontWeight: '800', letterSpacing: -3, textAlign: 'center', marginTop: 14 },
  successText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 320, marginTop: 15 },
  successCard: { width: '100%', backgroundColor: colors.white, borderTopWidth: 6, borderTopColor: colors.blue, padding: 20, marginTop: 32 },
  summaryLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  summaryDate: { color: colors.ink, fontFamily: fonts.sans, fontSize: 17, fontWeight: '700', textTransform: 'capitalize', marginTop: 18 },
  summaryTime: { color: colors.blue, fontFamily: fonts.sans, fontSize: 48, lineHeight: 52, fontWeight: '800', letterSpacing: -2.5 },
  summaryLine: { minHeight: 40, borderTopWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryKey: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, letterSpacing: 0.7 },
  summaryValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 12, fontWeight: '800' },
  pixCard: { width: '100%', marginTop: 12, padding: 16, backgroundColor: '#E7ECFA', borderWidth: 1, borderColor: '#CAD6F8', flexDirection: 'row', alignItems: 'center', gap: 12 },
  pixIcon: { width: 42, height: 42, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pixCopy: { flex: 1, minWidth: 0 },
  pixLabel: { color: colors.blue, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  pixKey: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '800', marginTop: 4 },
  pixHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 8, lineHeight: 12, marginTop: 4 },
  copyButton: { minWidth: 70, minHeight: 48, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  copyText: { color: colors.ink, fontFamily: fonts.mono, fontSize: 6, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },
  primary: { width: '100%', height: 54, marginTop: 18, backgroundColor: colors.blue, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryText: { color: colors.white, fontFamily: fonts.sans, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  secondary: { paddingVertical: 17, paddingHorizontal: 20 },
  secondaryText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  mobileDock: { position: 'absolute', left: 12, right: 12, bottom: 12, minHeight: 76, padding: 10, paddingLeft: 16, backgroundColor: colors.ink, borderWidth: 1, borderColor: '#34353A', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  mobileDockCopy: { flex: 1 },
  mobileDockLabel: { color: '#85868B', fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  mobileDockValue: { color: colors.white, fontFamily: fonts.sans, fontSize: 17, fontWeight: '800', marginTop: 5 },
  mobileDockButton: { minWidth: 132, minHeight: 54, paddingHorizontal: 14, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  mobileDockButtonText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
});
