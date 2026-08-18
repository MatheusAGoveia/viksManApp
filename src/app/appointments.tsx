import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, layout } from '@/constants/theme';
import { Booking, useBookings } from '@/context/booking-context';
import { barbers, formatBookingDate, formatCurrency, services } from '@/data/catalog';

function bookingDetails(booking: Pick<Booking, 'serviceId' | 'barberId'>) {
  return {
    service: services.find((item) => item.id === booking.serviceId),
    barber: barbers.find((item) => item.id === booking.barberId),
  };
}

export default function AppointmentsScreen() {
  const { bookings, history, cancelBooking } = useBookings();
  const [cancelId, setCancelId] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  function rebook(serviceId: string, barberId: string) {
    router.push({ pathname: '/book', params: { service: serviceId, barber: barberId } });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.centeredContent}>
      <SafeAreaView edges={['top']} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MINHA AGENDA</Text>
          <Text style={styles.title}>Seus{`\n`}horários.</Text>
          <Text style={styles.headerCount}>{String(bookings.length).padStart(2, '0')}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>PRÓXIMOS</Text>
            <Pressable onPress={() => router.push('/book')} style={styles.addButton}>
              <Ionicons name="add" color={colors.blue} size={17} />
              <Text style={styles.addText}>NOVO HORÁRIO</Text>
            </Pressable>
          </View>

          {bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><Ionicons name="calendar-outline" color={colors.blue} size={28} /></View>
              <Text style={styles.emptyTitle}>Agenda livre.</Text>
              <Text style={styles.emptyText}>Seu próximo corte pode ser marcado em menos de um minuto.</Text>
              <Pressable onPress={() => router.push('/book')} style={styles.primaryButton}><Text style={styles.primaryText}>AGENDAR AGORA</Text><Ionicons name="arrow-forward" color={colors.white} size={18} /></Pressable>
            </View>
          ) : (
            <View style={styles.bookingList}>
              {bookings.map((booking) => {
                const { service, barber } = bookingDetails(booking);
                const confirmingCancel = cancelId === booking.id;
                return (
                  <View key={booking.id} style={styles.bookingCard}>
                    <View style={styles.bookingStripe} />
                    <View style={styles.bookingTop}>
                      <View style={styles.status}><View style={styles.statusDot} /><Text style={styles.statusText}>CONFIRMADO</Text></View>
                      <Text style={styles.bookingCode}>#{booking.id.slice(-6).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.bookingDate}>{formatBookingDate(booking.date)}</Text>
                    <Text style={styles.bookingTime}>{booking.time}</Text>
                    <View style={styles.detailGrid}>
                      <View style={styles.detail}><Text style={styles.detailLabel}>SERVIÇO</Text><Text style={styles.detailValue}>{service?.name}</Text><Text style={styles.detailSub}>{service?.duration} min · {service ? formatCurrency(service.price) : ''}</Text></View>
                      <View style={styles.detail}><Text style={styles.detailLabel}>PROFISSIONAL</Text><Text style={styles.detailValue}>{barber?.name}</Text><Text style={styles.detailSub}>Viks Man · Betim</Text></View>
                    </View>
                    <View style={styles.paymentRow}>
                      <View style={styles.paymentCopy}><Text style={styles.detailLabel}>PAGAMENTO</Text><Text style={styles.paymentValue}>{booking.paymentStatus === 'paid' ? 'Pago' : booking.paymentStatus === 'partial' ? 'Parcial' : 'Pendente'} · {booking.partySize ?? 1} {(booking.partySize ?? 1) === 1 ? 'pessoa' : 'pessoas'}</Text><Text style={styles.detailSub}>Total: {formatCurrency((((booking.unitPriceCents ?? (service?.price ?? 0) * 100) * (booking.partySize ?? 1)) + (booking.gratuityCents ?? 0)) / 100)}</Text></View>
                      {booking.paymentStatus !== 'paid' && booking.pixKey ? <Pressable accessibilityLabel="Copiar chave PIX" onPress={() => Clipboard.setStringAsync(booking.pixKey ?? '')} style={styles.pixButton}><Ionicons name="copy-outline" color={colors.blue} size={16} /><Text style={styles.pixButtonText}>COPIAR PIX</Text></Pressable> : null}
                    </View>
                    {confirmingCancel ? (
                      <View style={styles.cancelConfirm}>
                        <Text style={styles.cancelQuestion}>Cancelar este horário?</Text>
                        <View style={styles.cancelActions}>
                          <Pressable onPress={() => setCancelId(undefined)} style={styles.keepButton}><Text style={styles.keepText}>MANTER</Text></Pressable>
                          <Pressable onPress={async () => { try { await cancelBooking(booking.id); setCancelId(undefined); } catch (error) { setActionError(String(error).includes('CANCELLATION_WINDOW_CLOSED') ? 'O prazo de cancelamento terminou. Fale com a recepção.' : 'Não foi possível cancelar agora.'); } }} style={styles.cancelButton}><Text style={styles.cancelButtonText}>SIM, CANCELAR</Text></Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.cardActions}>
                        <Pressable onPress={() => rebook(booking.serviceId, booking.barberId)} style={styles.actionButton}><Ionicons name="calendar-outline" color={colors.ink} size={15} /><Text style={styles.actionText}>REAGENDAR</Text></Pressable>
                        <Pressable onPress={() => setCancelId(booking.id)} style={styles.actionButton}><Text style={styles.cancelText}>CANCELAR</Text></Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionLabel}>HISTÓRICO DE CORTES</Text><Text style={styles.historyCount}>{String(history.length).padStart(2, '0')} VISITAS</Text></View>
          {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
          <View style={styles.historyList}>
            {history.map((item) => {
              const service = services.find((entry) => entry.id === item.serviceId);
              const barber = barbers.find((entry) => entry.id === item.barberId);
              return (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyInitial}><Text style={styles.historyInitialText}>{barber?.initials}</Text></View>
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyDate}>{formatBookingDate(item.date)}</Text>
                    <Text style={styles.historyTitle}>{service?.name} · {barber?.name}</Text>
                    <Text style={styles.historyNote}>{item.status === 'completed' ? 'Atendimento concluído' : item.status === 'no_show' ? 'Não compareceu' : 'Atendimento cancelado'} · {item.time}</Text>
                  </View>
                  <Pressable accessibilityLabel="Agendar este corte novamente" onPress={() => rebook(item.serviceId, item.barberId)} style={styles.repeatIcon}>
                    <Ionicons name="repeat" color={colors.blue} size={19} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.tip}>
          <Ionicons name="sparkles-outline" color={colors.blue} size={23} />
          <View style={styles.tipCopy}><Text style={styles.tipLabel}>ATALHO VIKS</Text><Text style={styles.tipText}>Use “repetir” para levar serviço e barbeiro direto ao novo agendamento.</Text></View>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centeredContent: { alignItems: 'center' },
  page: { width: '100%', maxWidth: layout.maxWidth, paddingBottom: 40 },
  header: { position: 'relative', overflow: 'hidden', minHeight: 250, backgroundColor: colors.ink, paddingHorizontal: layout.pagePadding, paddingTop: 55, paddingBottom: 42 },
  eyebrow: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: colors.white, fontFamily: fonts.sans, fontSize: 52, lineHeight: 48, fontWeight: '800', letterSpacing: -3.2, marginTop: 20 },
  headerCount: { position: 'absolute', right: -10, bottom: -40, color: '#1D1E22', fontFamily: fonts.sans, fontSize: 190, lineHeight: 190, fontWeight: '900', letterSpacing: -15 },
  section: { paddingHorizontal: layout.pagePadding, paddingTop: 54 },
  sectionHead: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  sectionLabel: { color: colors.ink, fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  addButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addText: { color: colors.blue, fontFamily: fonts.sans, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  bookingList: { gap: 14 },
  bookingCard: { position: 'relative', overflow: 'hidden', backgroundColor: colors.white, padding: 20, paddingTop: 24 },
  bookingStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 7, backgroundColor: colors.blue },
  bookingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  statusText: { color: colors.success, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  bookingCode: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, letterSpacing: 0.7 },
  bookingDate: { color: colors.ink, fontFamily: fonts.sans, fontSize: 18, fontWeight: '700', textTransform: 'capitalize', marginTop: 24 },
  bookingTime: { color: colors.blue, fontFamily: fonts.sans, fontSize: 58, lineHeight: 63, fontWeight: '800', letterSpacing: -3.5 },
  detailGrid: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, marginTop: 9 },
  detail: { flex: 1, minHeight: 88, paddingTop: 16, paddingRight: 8 },
  detailLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.9 },
  detailValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: '800', marginTop: 7 },
  detailSub: { color: colors.muted, fontFamily: fonts.sans, fontSize: 9, marginTop: 3 },
  paymentRow: { minHeight: 76, borderTopWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  paymentCopy: { flex: 1 },
  paymentValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 12, fontWeight: '800', marginTop: 5 },
  pixButton: { minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pixButtonText: { color: colors.blue, fontFamily: fonts.sans, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, paddingTop: 16, justifyContent: 'space-between' },
  actionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
  actionText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  cancelText: { color: colors.danger, fontFamily: fonts.sans, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  cancelConfirm: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 15 },
  cancelQuestion: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: '800' },
  cancelActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  keepButton: { height: 44, flex: 1, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  keepText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  cancelButton: { height: 44, flex: 1, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  emptyCard: { backgroundColor: colors.white, alignItems: 'center', padding: 28 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 27, fontWeight: '800', letterSpacing: -1.4, marginTop: 18 },
  emptyText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 280, marginTop: 8 },
  primaryButton: { width: '100%', maxWidth: 320, height: 50, marginTop: 22, paddingHorizontal: 17, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryText: { color: colors.white, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  historyCount: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, letterSpacing: 1 },
  historyList: { borderTopWidth: 1, borderColor: colors.line },
  historyCard: { minHeight: 116, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 13 },
  historyInitial: { width: 64, height: 84, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  historyInitialText: { color: '#313238', fontFamily: fonts.sans, fontSize: 42, fontWeight: '900' },
  historyCopy: { flex: 1 },
  historyDate: { color: colors.blue, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  historyTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 15, fontWeight: '800', marginTop: 7 },
  historyNote: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 15, marginTop: 5 },
  repeatIcon: { width: 44, height: 44, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  tip: { marginHorizontal: layout.pagePadding, marginTop: 54, padding: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 14 },
  tipCopy: { flex: 1 },
  tipLabel: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  tipText: { color: '#B9BAC0', fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, marginTop: 5 },
  actionError: { color: colors.danger, fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, marginBottom: 12 },
});
