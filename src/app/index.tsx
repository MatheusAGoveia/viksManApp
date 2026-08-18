import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup, PrimaryButton, SectionHeading } from '@/components/brand-ui';
import { colors, fonts, layout } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useBookings } from '@/context/booking-context';
import { barbers, formatBookingDate, formatCurrency, services } from '@/data/catalog';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { supabase } from '@/lib/supabase';

type LivePromotion = { id: string; title: string; message: string; discountLabel: string };

export default function HomeScreen() {
  const { width } = useResponsiveLayout();
  const { profile, user } = useAuth();
  const { bookings } = useBookings();
  const wide = width >= 820;
  const next = bookings[0];
  const nextService = services.find((service) => service.id === next?.serviceId);
  const nextBarber = barbers.find((barber) => barber.id === next?.barberId);
  const firstName = profile?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const [promotion, setPromotion] = useState<LivePromotion>();

  useEffect(() => {
    if (!supabase) return;
    supabase.from('promotions').select('id, title, message, discount_label').eq('status', 'sent').lte('starts_at', new Date().toISOString()).gt('ends_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) setPromotion({ id: data.id, title: data.title, message: data.message, discountLabel: data.discount_label ?? '' });
    });
  }, []);

  function openBooking(serviceId?: string, barberId?: string) {
    router.push({ pathname: '/book', params: { service: serviceId, barber: barberId } });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.centered}>
      <SafeAreaView edges={['top']} style={styles.page}>
        <View style={styles.topbar}>
          <BrandLockup inverse />
          <View style={styles.topActions}>
            <Text style={styles.location}>BETIM · MG</Text>
            <Pressable accessibilityLabel="Abrir perfil" hitSlop={8} onPress={() => router.push('/profile')} style={styles.profileButton}>
              <Ionicons name="person-outline" color={colors.white} size={18} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>{firstName ? `OLÁ, ${firstName.toUpperCase()}` : 'BARBEARIA VIKS MAN'}</Text>
            <Text style={[styles.heroTitle, wide && styles.heroTitleWide]}>Seu horário.{`\n`}Seu estilo.</Text>
            <Text style={styles.heroBody}>Agende em poucos passos. A disponibilidade é a mesma no app, no site e na recepção.</Text>
            <PrimaryButton label="AGENDAR AGORA" onPress={() => openBooking()} />
          </View>
          <View style={styles.bluePanel}>
            <Text style={styles.bluePanelIndex}>01</Text>
            <View>
              <Text style={styles.bluePanelLabel}>PRÓXIMO ENCAIXE</Text>
              <Text style={styles.bluePanelTime}>Hoje{`\n`}14:30</Text>
            </View>
            <Pressable onPress={() => openBooking()} style={styles.bluePanelLink}><Text style={styles.bluePanelLinkText}>VER DISPONIBILIDADE</Text><Ionicons name="arrow-forward" color={colors.white} size={17} /></Pressable>
          </View>
        </View>

        {promotion ? <Pressable onPress={() => openBooking()} style={[styles.promotion, wide && styles.promotionWide]}><View style={styles.promotionIcon}><Ionicons name="megaphone-outline" color={colors.white} size={24} /></View><View style={styles.promotionCopy}><Text style={styles.promotionKicker}>{promotion.discountLabel || 'PROMOÇÃO VIKS'}</Text><Text style={styles.promotionTitle}>{promotion.title}</Text><Text numberOfLines={2} style={styles.promotionText}>{promotion.message}</Text></View><View style={styles.promotionAction}><Text style={styles.promotionActionText}>AGENDAR</Text><Ionicons name="arrow-forward" color={colors.white} size={18} /></View></Pressable> : null}

        <View style={[styles.mainGrid, wide && styles.mainGridWide]}>
          <View style={styles.nextBlock}>
            <Text style={styles.blockEyebrow}>{next ? 'SEU PRÓXIMO HORÁRIO' : 'SUA AGENDA'}</Text>
            {next ? <>
              <View style={styles.dateRow}><Text style={styles.nextTime}>{next.time}</Text><View style={styles.dateCopy}><Text style={styles.nextDate}>{formatBookingDate(next.date)}</Text><Text style={styles.confirmed}>● CONFIRMADO</Text></View></View>
              <View style={styles.metaRow}><Text style={styles.metaKey}>SERVIÇO</Text><Text style={styles.metaValue}>{nextService?.name}</Text></View>
              <View style={styles.metaRow}><Text style={styles.metaKey}>PROFISSIONAL</Text><Text style={styles.metaValue}>{nextBarber?.name}</Text></View>
              <Pressable onPress={() => router.push('/appointments')} style={styles.inlineLink}><Text style={styles.inlineLinkText}>GERENCIAR HORÁRIO</Text><Ionicons name="arrow-forward" color={colors.blue} size={17} /></Pressable>
            </> : <>
              <Text style={styles.emptyTitle}>Agenda livre.</Text>
              <Text style={styles.emptyText}>Escolha o serviço, o profissional e um horário disponível.</Text>
              <Pressable onPress={() => openBooking()} style={styles.inlineLink}><Text style={styles.inlineLinkText}>ESCOLHER HORÁRIO</Text><Ionicons name="arrow-forward" color={colors.blue} size={17} /></Pressable>
            </>}
          </View>
          <View style={styles.returnBlock}>
            <Text style={styles.returnIndex}>21</Text>
            <Text style={styles.returnUnit}>DIAS</Text>
            <Text style={styles.returnTitle}>O intervalo ideal para manter o corte em dia.</Text>
            <Pressable onPress={() => openBooking('combo', 'victor')} style={styles.repeatLink}><Ionicons name="repeat" color={colors.white} size={17} /><Text style={styles.repeatText}>REPETIR ÚLTIMO CORTE</Text></Pressable>
          </View>
        </View>

        <View style={styles.servicesSection}>
          <SectionHeading eyebrow="SERVIÇOS" title="Escolha o seu." aside={<Text style={styles.count}>04 OPÇÕES</Text>} />
          <View style={styles.serviceList}>
            {services.map((service, index) => <Pressable key={service.id} onPress={() => openBooking(service.id)} style={({ pressed }) => [styles.serviceRow, pressed && styles.pressed]}>
              <Text style={styles.serviceIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.serviceCopy}><Text style={styles.serviceName}>{service.name}</Text><Text style={styles.serviceDescription}>{service.description}</Text></View>
              <View style={styles.serviceInfo}><Text style={styles.servicePrice}>{formatCurrency(service.price)}</Text><Text style={styles.serviceDuration}>{service.duration} MIN</Text></View>
              <View style={styles.serviceArrow}><Ionicons name="arrow-forward" color={colors.ink} size={18} /></View>
            </Pressable>)}
          </View>
        </View>

        <Pressable onPress={() => Linking.openURL('https://www.google.com/maps/search/?api=1&query=-19.96053886%2C-44.20162582')} style={styles.address}>
          <View><Text style={styles.addressKicker}>VIKS MAN · UNIDADE BETIM</Text><Text style={styles.addressText}>Rua do Rosário, 497 · Angola</Text></View>
          <View style={styles.addressIcon}><Ionicons name="location-outline" color={colors.white} size={21} /></View>
        </Pressable>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, centered: { alignItems: 'center' }, page: { width: '100%', maxWidth: layout.maxWidth, paddingBottom: 40 },
  topbar: { height: 74, paddingHorizontal: layout.pagePadding, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topActions: { flexDirection: 'row', alignItems: 'center', gap: 14 }, location: { color: '#9C9DA2', fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 1 }, profileButton: { width: 38, height: 38, borderWidth: 1, borderColor: '#393A3E', borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.ink, paddingHorizontal: layout.pagePadding, paddingTop: 48, paddingBottom: 24, gap: 42 }, heroWide: { minHeight: 470, paddingLeft: 50, paddingRight: 0, paddingTop: 64, paddingBottom: 0, flexDirection: 'row', alignItems: 'stretch', gap: 44 }, heroCopy: { flex: 1, paddingBottom: 42, justifyContent: 'center' }, kicker: { color: '#9C9DA2', fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginBottom: 20 }, heroTitle: { color: colors.white, fontFamily: fonts.sans, fontSize: 50, lineHeight: 47, letterSpacing: -3, fontWeight: '800' }, heroTitleWide: { fontSize: 68, lineHeight: 62, letterSpacing: -4.2 }, heroBody: { color: '#A7A8AD', fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, maxWidth: 420, marginTop: 20, marginBottom: 28 },
  bluePanel: { backgroundColor: colors.blue, minHeight: 300, padding: 24, justifyContent: 'space-between', flex: 0.68 }, bluePanelIndex: { color: '#B9CCFF', fontFamily: fonts.mono, fontSize: 9, fontWeight: '800' }, bluePanelLabel: { color: '#C9D7FF', fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12 }, bluePanelTime: { color: colors.white, fontFamily: fonts.sans, fontSize: 43, lineHeight: 41, fontWeight: '800', letterSpacing: -2.4 }, bluePanelLink: { minHeight: 46, borderTopWidth: 1, borderTopColor: '#5E8AFF', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, bluePanelLinkText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  promotion: { minHeight: 126, marginHorizontal: layout.pagePadding, marginTop: 20, padding: 18, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', gap: 14 }, promotionWide: { marginHorizontal: 32, paddingHorizontal: 24 }, promotionIcon: { width: 50, height: 50, backgroundColor: '#0C48CC', alignItems: 'center', justifyContent: 'center' }, promotionCopy: { flex: 1, minWidth: 0 }, promotionKicker: { color: '#C9D7FF', fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 1 }, promotionTitle: { color: colors.white, fontFamily: fonts.sans, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginTop: 5 }, promotionText: { color: '#D9E2FF', fontFamily: fonts.sans, fontSize: 10, lineHeight: 15, marginTop: 4 }, promotionAction: { minHeight: 48, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', gap: 3 }, promotionActionText: { color: colors.white, fontFamily: fonts.sans, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  mainGrid: { marginHorizontal: layout.pagePadding, marginTop: 20, gap: 12 }, mainGridWide: { flexDirection: 'row', marginHorizontal: 32, marginTop: 28 }, nextBlock: { backgroundColor: colors.white, padding: 24, flex: 1.55, minHeight: 305 }, blockEyebrow: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, dateRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 28, marginBottom: 18 }, nextTime: { color: colors.ink, fontFamily: fonts.sans, fontSize: 53, lineHeight: 56, fontWeight: '800', letterSpacing: -2.8 }, dateCopy: { flex: 1 }, nextDate: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'capitalize' }, confirmed: { color: colors.success, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.7, marginTop: 7 }, metaRow: { minHeight: 42, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, metaKey: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 }, metaValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '800' }, inlineLink: { minHeight: 44, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 3 }, inlineLinkText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, emptyTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 34, fontWeight: '800', letterSpacing: -1.5, marginTop: 42 }, emptyText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, maxWidth: 300, marginTop: 9, flex: 1 },
  returnBlock: { backgroundColor: colors.ink, padding: 24, flex: 1, minHeight: 280 }, returnIndex: { color: colors.blue, fontFamily: fonts.sans, fontSize: 68, lineHeight: 68, fontWeight: '800', letterSpacing: -4 }, returnUnit: { color: '#85868C', fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, returnTitle: { color: colors.white, fontFamily: fonts.sans, fontSize: 22, lineHeight: 24, fontWeight: '700', letterSpacing: -0.7, maxWidth: 280, marginTop: 25, flex: 1 }, repeatLink: { minHeight: 48, borderTopWidth: 1, borderTopColor: '#393A3E', flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, repeatText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  servicesSection: { paddingHorizontal: layout.pagePadding, paddingTop: 70 }, count: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1, paddingTop: 4 }, serviceList: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.line }, serviceRow: { minHeight: 118, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 17 }, serviceIndex: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900' }, serviceCopy: { flex: 1 }, serviceName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 21, fontWeight: '800', letterSpacing: -0.7 }, serviceDescription: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 14, maxWidth: 420, marginTop: 5 }, serviceInfo: { alignItems: 'flex-end' }, servicePrice: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: '800' }, serviceDuration: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, marginTop: 4 }, serviceArrow: { width: 40, height: 40, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  address: { minHeight: 92, marginHorizontal: layout.pagePadding, marginTop: 68, backgroundColor: colors.ink, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, addressKicker: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, addressText: { color: colors.white, fontFamily: fonts.sans, fontSize: 12, marginTop: 7 }, addressIcon: { width: 42, height: 42, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.62 },
});
