import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { Booking, useBookings } from '@/context/booking-context';
import { barbers as catalogBarbers, services as catalogServices } from '@/data/catalog';
import { supabase } from '@/lib/supabase';
import { isSupabaseActive, rescheduleAppointment } from '../services/viks-club-service';
import type { DayOfWeek, ViksClubSubscription } from '../types';

type SubscriberBookingCalendarProps = {
  subscription: ViksClubSubscription;
  allowedDays?: DayOfWeek[];
  onBookingChanged?: () => void;
};

const DAY_KEYS: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export function SubscriberBookingCalendar({
  subscription,
  allowedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  onBookingChanged,
}: SubscriberBookingCalendarProps) {
  const { bookings, addBooking, cancelBooking, refreshBookings } = useBookings();

  // Current viewed month date state
  const [viewDate, setViewDate] = useState(() => new Date());
  
  // Selection states
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('17:00');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('cut');
  const [selectedBarberId, setSelectedBarberId] = useState<string>(catalogBarbers[0]?.id || 'victor');
  
  // Booking edit state
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [reschedulingBookingId, setReschedulingBookingId] = useState<string | null>(null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  // Services with an available credit or discount in the current cycle.
  const planServices = useMemo(() => {
    const creditServiceIds = (subscription.benefits || [])
      .filter((b) => ['service_credit', 'service_discount'].includes(b.benefitType) && b.serviceId && b.quantityGranted > b.quantityUsed)
      .map((b) => b.serviceId);
    if (creditServiceIds.length === 0) return [];
    return catalogServices.filter((srv) => creditServiceIds.includes(srv.id));
  }, [subscription.benefits]);

  const selectedBenefit = useMemo(
    () => (subscription.benefits || []).find(
      (benefit) => benefit.serviceId === selectedServiceId
        && ['service_credit', 'service_discount'].includes(benefit.benefitType)
        && benefit.quantityUsed < benefit.quantityGranted,
    ),
    [selectedServiceId, subscription.benefits],
  );

  useEffect(() => {
    if (planServices.length > 0 && !planServices.some((service) => service.id === selectedServiceId)) {
      queueMicrotask(() => setSelectedServiceId(planServices[0].id));
    }
  }, [planServices, selectedServiceId]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Month navigation
  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

  // Generate Calendar Days Grid
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: {
      dateIso: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      dayOfWeek: DayOfWeek;
      isAllowed: boolean;
      booking?: Booking;
    }[] = [];

    // Empty cells before start of month
    for (let i = 0; i < firstDayIndex; i++) {
      const prevDate = new Date(year, month, -firstDayIndex + i + 1);
      const dayOfWeek = DAY_KEYS[prevDate.getDay()];
      days.push({
        dateIso: prevDate.toISOString().slice(0, 10),
        dayNumber: prevDate.getDate(),
        isCurrentMonth: false,
        dayOfWeek,
        isAllowed: false,
      });
    }

    const todayObj = new Date();
    const todayIso = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    const subEndIso = subscription.currentPeriodEnd ? subscription.currentPeriodEnd.slice(0, 10) : '2099-12-31';

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      const dayOfWeek = DAY_KEYS[currDate.getDay()];
      const dateIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const isDateValid = dateIso >= todayIso && dateIso <= subEndIso;
      const isAllowed = allowedDays.includes(dayOfWeek) && isDateValid;
      const booking = bookings.find((b) => b.date === dateIso && b.status === 'confirmed');

      days.push({
        dateIso,
        dayNumber: d,
        isCurrentMonth: true,
        dayOfWeek,
        isAllowed,
        booking,
      });
    }

    return days;
  }, [year, month, allowedDays, bookings, subscription.currentPeriodEnd]);

  // Fetch available slots from DB source of truth (get_available_slots RPC)
  useEffect(() => {
    if (!selectedDateIso) return;
    const dateDay: string = selectedDateIso;
    let active = true;
    async function loadSlots() {
      setSlotsLoading(true);
      setSlotsError(null);
      if (isSupabaseActive() && supabase) {
        const targetBarber = subscription.barberId || selectedBarberId;
        const { data, error } = await supabase.rpc('get_available_slots', {
          p_unit_slug: 'betim',
          p_service_slug: selectedServiceId,
          p_day: dateDay,
          p_barber_slug: targetBarber,
          p_party_size: 1,
        });
        if (active) {
          if (error) {
            setSlotsError('Não foi possível consultar os horários disponíveis.');
            setAvailableTimeSlots([]);
          } else if (data) {
            const times: string[] = (data ?? []).map((slot: Record<string, unknown>) =>
              new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
              }).format(new Date(String(slot.starts_at)))
            );
            const uniqueTimes = Array.from(new Set(times));
            setAvailableTimeSlots(uniqueTimes);
            if (uniqueTimes.length > 0 && !uniqueTimes.includes(selectedTime)) {
              setSelectedTime(uniqueTimes[0]);
            }
          }
        }
      } else if (active) {
        setAvailableTimeSlots(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
      }
      if (active) setSlotsLoading(false);
    }
    loadSlots();
    return () => { active = false; };
  }, [selectedDateIso, selectedServiceId, subscription.barberId, selectedBarberId, selectedTime]);

  // Handle click on day cell
  function handleDayPress(day: (typeof calendarDays)[0]) {
    if (!day.isCurrentMonth) return;
    setFeedback(null);

    if (day.booking) {
      setEditingBooking(day.booking);
    } else if (day.isAllowed) {
      setSelectedDateIso(day.dateIso);
    }
  }

  // Confirm new advance booking (or rescheduling)
  async function handleConfirmBooking() {
    if (!selectedDateIso) return;
    if (!reschedulingBookingId && !selectedBenefit) {
      setFeedback({ kind: 'error', msg: 'Você não possui saldo para este serviço no ciclo atual.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const targetBarber = subscription.barberId || selectedBarberId;
      const todayObj = new Date();
      const todayIso = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
      const subEndIso = subscription.currentPeriodEnd ? subscription.currentPeriodEnd.slice(0, 10) : '2099-12-31';

      let totalAttempts = 1;
      let successCount = 0;
      let failedCount = 0;
      const availableCredits = selectedBenefit
        ? selectedBenefit.quantityGranted - selectedBenefit.quantityUsed
        : 1;

      // 1. If rescheduling existing booking, use atomic reschedule RPC
      if (reschedulingBookingId) {
        const res = await rescheduleAppointment(reschedulingBookingId, selectedDateIso, selectedTime);
        if (res.success) {
          successCount++;
          setReschedulingBookingId(null);
          refreshBookings();
        } else {
          failedCount++;
          setFeedback({ kind: 'error', msg: res.error || 'Falha ao reagendar atendimento.' });
          setBusy(false);
          return;
        }
      } else {
        try {
          await addBooking({
            serviceId: selectedServiceId,
            barberId: targetBarber,
            date: selectedDateIso,
            time: selectedTime,
            clubBenefitId: selectedBenefit?.id,
          });
          successCount++;
        } catch {
          failedCount++;
        }
      }

      // 2. Repeat weekly for remaining allowed weeks if enabled
      if (repeatWeekly) {
        const parts = selectedDateIso.split('-').map(Number);
        const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const targetDayOfWeek = DAY_KEYS[startDate.getDay()];

        const curr = new Date(startDate);
        curr.setDate(curr.getDate() + 7);

        const endDate = new Date(subEndIso + 'T23:59:59');

        while (curr <= endDate && successCount < availableCredits) {
          const iso = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
          if (iso >= todayIso && iso <= subEndIso && allowedDays.includes(targetDayOfWeek)) {
            totalAttempts++;
            try {
              await addBooking({
                serviceId: selectedServiceId,
                barberId: targetBarber,
                date: iso,
                time: selectedTime,
                clubBenefitId: selectedBenefit?.id,
              });
              successCount++;
            } catch {
              failedCount++;
            }
          }
          curr.setDate(curr.getDate() + 7);
        }
      }

      const msg = repeatWeekly
        ? `${successCount} de ${totalAttempts} agendamentos realizados com sucesso${failedCount > 0 ? ` (${failedCount} data(s) indisponível(is))` : ''}.`
        : 'Agendamento antecipado realizado com sucesso!';

      setFeedback({
        kind: successCount > 0 ? 'success' : 'error',
        msg,
      });
      setSelectedDateIso(null);
      setRepeatWeekly(false);
      onBookingChanged?.();
    } catch {
      setFeedback({ kind: 'error', msg: 'Erro ao realizar agendamento antecipado.' });
    } finally {
      setBusy(false);
    }
  }

  // Cancel booking
  async function handleCancelBooking() {
    if (!editingBooking) return;
    setBusy(true);
    setFeedback(null);
    try {
      await cancelBooking(editingBooking.id);
      setFeedback({ kind: 'success', msg: 'Agendamento cancelado com sucesso!' });
      setEditingBooking(null);
      onBookingChanged?.();
    } catch {
      setFeedback({ kind: 'error', msg: 'Erro ao cancelar agendamento.' });
    } finally {
      setBusy(false);
    }
  }

  // Reschedule booking: do NOT cancel first; set rescheduling state and open booking selector
  function handleRescheduleBooking() {
    if (!editingBooking) return;
    setReschedulingBookingId(editingBooking.id);
    setSelectedDateIso(editingBooking.date);
    setEditingBooking(null);
  }

  function formatDatePt(iso: string) {
    try {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return iso;
    }
  }

  return (
    <View style={styles.cardContainer}>
      <View style={styles.stripe} />
      {/* Calendar Header Bar */}
      <View style={styles.calendarHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>CALENDÁRIO DO ASSINANTE</Text>
          <Text style={styles.monthTitle}>{monthName}</Text>
        </View>
        <View style={styles.monthNavRow}>
          <Pressable onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.ink} />
          </Pressable>
          <Pressable onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={18} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.blue }]} />
          <Text style={styles.legendText}>Dias Autorizados pelo Plano</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.ink }]} />
          <Text style={styles.legendText}>Agendado</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.soft }]} />
          <Text style={styles.legendText}>Restrito pelo Plano</Text>
        </View>
      </View>

      {feedback ? (
        <View style={[styles.feedbackBanner, feedback.kind === 'error' && styles.feedbackError]}>
          <Ionicons
            name={feedback.kind === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={feedback.kind === 'success' ? '#2E7D32' : colors.danger}
          />
          <Text style={[styles.feedbackText, feedback.kind === 'error' && styles.feedbackTextError]}>
            {feedback.msg}
          </Text>
        </View>
      ) : null}

      {/* Weekday Headers */}
      <View style={styles.weekHeaderRow}>
        {DAY_LABELS.map((lbl) => (
          <Text key={lbl} style={styles.weekHeaderCell}>
            {lbl}
          </Text>
        ))}
      </View>

      {/* Calendar Month Grid */}
      <View style={styles.gridContainer}>
        {calendarDays.map((day, idx) => {
          if (!day.isCurrentMonth) {
            return <View key={idx} style={[styles.dayCell, styles.dayCellEmpty]} />;
          }

          const hasBooking = Boolean(day.booking);
          const isRestricted = !day.isAllowed;

          return (
            <Pressable
              key={idx}
              disabled={isRestricted && !hasBooking}
              onPress={() => handleDayPress(day)}
              style={[
                styles.dayCell,
                isRestricted && styles.dayCellRestricted,
                hasBooking && styles.dayCellBooked,
                day.isAllowed && !hasBooking && styles.dayCellAllowed,
              ]}
            >
              <View style={styles.dayTopRow}>
                <Text
                  style={[
                    styles.dayNumberText,
                    isRestricted && styles.textMuted,
                    hasBooking && styles.textWhite,
                    day.isAllowed && !hasBooking && styles.textBlue,
                  ]}
                >
                  {day.dayNumber}
                </Text>
                {isRestricted && !hasBooking ? (
                  <Ionicons name="lock-closed-outline" size={10} color={colors.muted} />
                ) : null}
              </View>

              {hasBooking ? (
                <View style={styles.bookingBadge}>
                  <Text style={styles.bookingBadgeText} numberOfLines={1}>
                    {day.booking?.time} · Corte
                  </Text>
                </View>
              ) : day.isAllowed ? (
                <View style={styles.addSlotHint}>
                  <Ionicons name="add" size={14} color={colors.blue} />
                  <Text style={styles.addSlotText}>Agendar</Text>
                </View>
              ) : (
                <Text style={styles.restrictedLabel}>Restrito</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* MODAL 1: NOVO AGENDAMENTO ANTECIPADO */}
      <Modal
        visible={selectedDateIso !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedDateIso(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>VIKS CLUB · AGENDAMENTO ANTECIPADO</Text>
                <Text style={styles.modalTitle}>
                  {selectedDateIso ? formatDatePt(selectedDateIso) : ''}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedDateIso(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Service selector */}
              <Text style={styles.fieldLabel}>SERVIÇO INCLUSO NO PLANO</Text>
              {planServices.length > 0 ? (
                <View style={styles.optionsRow}>
                  {planServices.map((srv) => {
                    const isSel = selectedServiceId === srv.id;
                    return (
                      <Pressable
                        key={srv.id}
                        onPress={() => setSelectedServiceId(srv.id)}
                        style={[styles.optionChip, isSel && styles.optionChipSelected]}
                      >
                        <Text style={[styles.optionChipText, isSel && styles.textWhite]}>{srv.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={{ backgroundColor: colors.paper, padding: 12, borderWidth: 1, borderColor: colors.line, marginVertical: 8 }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, textAlign: 'center' }}>
                    Nenhum serviço do Viks Club disponível neste período.
                  </Text>
                </View>
              )}

              {/* Barber selector */}
              <Text style={styles.fieldLabel}>BARBEIRO VINCULADO À ASSINATURA</Text>
              {subscription.barberId ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.paper, padding: 12, borderWidth: 1, borderColor: colors.blue, marginBottom: 8 }}>
                  <Ionicons name="lock-closed" size={16} color={colors.blue} />
                  <View>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: '800', color: colors.ink }}>
                      {catalogBarbers.find((b) => b.id === subscription.barberId)?.name || 'Viks Professional'}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.muted }}>
                      Exclusivo da sua assinatura Viks Club
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.optionsRow}>
                  {catalogBarbers.map((b) => {
                    const isSel = selectedBarberId === b.id;
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => setSelectedBarberId(b.id)}
                        style={[styles.optionChip, isSel && styles.optionChipSelected]}
                      >
                        <Text style={[styles.optionChipText, isSel && styles.textWhite]}>{b.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Time slots */}
              <Text style={styles.fieldLabel}>HORÁRIOS DISPONÍVEIS NA AGENDA VIKS</Text>
              {slotsLoading ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.blue} size="small" />
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 4 }}>
                    Consultando disponibilidade da agenda...
                  </Text>
                </View>
              ) : slotsError ? (
                <View style={{ backgroundColor: '#FFEBEE', padding: 12, borderWidth: 1, borderColor: '#FFCDD2', marginVertical: 8 }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#D32F2F', textAlign: 'center', fontWeight: '700' }}>
                    {slotsError}
                  </Text>
                </View>
              ) : availableTimeSlots.length > 0 ? (
                <View style={styles.timeGrid}>
                  {availableTimeSlots.map((t) => {
                    const isSel = selectedTime === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setSelectedTime(t)}
                        style={[styles.timeChip, isSel && styles.timeChipSelected]}
                      >
                        <Text style={[styles.timeChipText, isSel && styles.textWhite]}>{t}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={{ backgroundColor: colors.paper, padding: 12, borderWidth: 1, borderColor: colors.line, marginVertical: 8 }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, textAlign: 'center' }}>
                    Nenhum horário disponível para a agenda deste barbeiro nesta data.
                  </Text>
                </View>
              )}

              {/* Repeat Weekly Option */}
              <Pressable
                onPress={() => setRepeatWeekly(!repeatWeekly)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: repeatWeekly ? '#E3F2FD' : colors.paper,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: repeatWeekly ? colors.blue : colors.line,
                  marginTop: 14,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderWidth: 1,
                    borderColor: repeatWeekly ? colors.blue : colors.muted,
                    backgroundColor: repeatWeekly ? colors.blue : colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {repeatWeekly ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: '800', color: colors.ink }}>
                    REPETIR HORÁRIO NAS SEMANAS SEGUINTES
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.muted, marginTop: 2 }}>
                    Agendar às {selectedTime} nas demais semanas autorizadas do mês vigente do seu plano.
                  </Text>
                </View>
              </Pressable>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable onPress={() => setSelectedDateIso(null)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>VOLTAR</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={handleConfirmBooking}
                style={[styles.confirmBtn, busy && styles.disabledBtn]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Text style={styles.confirmBtnText}>CONFIRMAR HORÁRIO</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.white} />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: GESTÃO DO AGENDAMENTO EXISTENTE (REAGENDAR / CANCELAR) */}
      <Modal
        visible={editingBooking !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setEditingBooking(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>GERENCIAR AGENDAMENTO</Text>
                <Text style={styles.modalTitle}>
                  {editingBooking ? formatDatePt(editingBooking.date) : ''} às {editingBooking?.time}
                </Text>
              </View>
              <Pressable onPress={() => setEditingBooking(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.bookingDetailCard}>
                <Text style={styles.detailTitle}>Corte de Cabelo Viks Club</Text>
                <Text style={styles.detailSub}>
                  Data: {editingBooking ? formatDatePt(editingBooking.date) : ''} às {editingBooking?.time}
                </Text>
                <Text style={styles.detailSub}>
                  Barbeiro: {catalogBarbers.find((b) => b.id === editingBooking?.barberId)?.name || 'Viks Professional'}
                </Text>
                <Text style={styles.detailSub}>Status: Confirmado no plano</Text>
              </View>

              <Text style={styles.actionPrompt}>O que você deseja fazer com o agendamento deste dia?</Text>

              <Pressable
                disabled={busy}
                onPress={handleRescheduleBooking}
                style={[styles.outlineActionBtn, busy && styles.disabledBtn]}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.ink} />
                <Text style={styles.outlineActionText}>ALTERAR APENAS ESTA DATA ESPECÍFICA</Text>
              </Pressable>

              <Pressable
                disabled={busy}
                onPress={handleCancelBooking}
                style={[styles.dangerActionBtn, busy && styles.disabledBtn]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.dangerActionText}>CANCELAR APENAS ESTA DATA</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'relative',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
    paddingLeft: 26,
    gap: 16,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.blue,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  monthTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  feedbackError: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  feedbackText: {
    color: '#2E7D32',
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  feedbackTextError: {
    color: colors.danger,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekHeaderCell: {
    width: '14.28%',
    textAlign: 'center',
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    paddingVertical: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    minHeight: 76,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 6,
    justifyContent: 'space-between',
  },
  dayCellEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  dayCellAllowed: {
    backgroundColor: colors.white,
    borderColor: colors.line,
  },
  dayCellRestricted: {
    backgroundColor: colors.soft,
    borderColor: colors.line,
    opacity: 0.6,
  },
  dayCellBooked: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  dayTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayNumberText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '900',
  },
  textBlue: {
    color: colors.blue,
  },
  textMuted: {
    color: colors.muted,
  },
  textWhite: {
    color: colors.white,
  },
  addSlotHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  addSlotText: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bookingBadge: {
    backgroundColor: colors.blue,
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginTop: 4,
  },
  bookingBadgeText: {
    color: colors.white,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '900',
  },
  restrictedLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 8,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 16, 20, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalEyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  modalTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 14,
  },
  fieldLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 4,
  },
  optionChipSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  optionChipText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    width: '22%',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 4,
  },
  timeChipSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  timeChipText: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnText: {
    color: colors.white,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  bookingDetailCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 4,
  },
  detailTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '800',
  },
  detailSub: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 11,
  },
  actionPrompt: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  outlineActionBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  outlineActionText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dangerActionBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  dangerActionText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
