import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, layout } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useBookings } from '@/context/booking-context';
import { registerPushNotifications } from '@/lib/notifications';

type Feedback = { kind: 'error' | 'success'; text: string } | null;

export default function ProfileScreen() {
  const auth = useAuth();
  const { bookings, clearBookings } = useBookings();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [whatsappOverride, setWhatsappOverride] = useState<boolean>();
  const [marketingOverride, setMarketingOverride] = useState<boolean>();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const displayName = auth.profile?.fullName || auth.user?.email?.split('@')[0] || 'Visitante';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'VM';
  const whatsappEnabled = whatsappOverride ?? auth.profile?.whatsappConsent ?? false;
  const marketingEnabled = marketingOverride ?? auth.profile?.marketingConsent ?? false;

  function beginEdit() {
    setFullName(auth.profile?.fullName ?? '');
    setPhone(auth.profile?.phone ?? '');
    setBirthDate(auth.profile?.birthDate ?? '');
    setFeedback(null);
    setEditing(true);
  }

  async function saveProfile() {
    setBusy(true);
    const result = await auth.updateProfile({ fullName: fullName.trim(), phone: phone.trim() || null, birthDate: birthDate.trim() || null });
    setBusy(false);
    if (result.error) return setFeedback({ kind: 'error', text: result.error });
    setEditing(false);
    setFeedback({ kind: 'success', text: 'Dados atualizados e sincronizados.' });
  }

  async function togglePush(next: boolean) {
    if (!auth.user) {
      router.push('/login');
      return;
    }
    if (!next) return setPushEnabled(false);
    const result = await registerPushNotifications(auth.user.id);
    if (result.error) return setFeedback({ kind: 'error', text: result.error });
    setPushEnabled(true);
    setFeedback({ kind: 'success', text: 'Notificações ativadas neste dispositivo.' });
  }

  async function toggleWhatsApp(next: boolean) {
    if (!auth.user) {
      router.push('/login');
      return;
    }
    setWhatsappOverride(next);
    const result = await auth.updateProfile({ whatsappConsent: next });
    if (result.error) {
      setWhatsappOverride(!next);
      setFeedback({ kind: 'error', text: result.error });
    }
  }

  async function toggleMarketing(next: boolean) {
    if (!auth.user) { router.push('/login'); return; }
    setMarketingOverride(next);
    const result = await auth.updateProfile({ marketingConsent: next });
    if (result.error) { setMarketingOverride(!next); setFeedback({ kind: 'error', text: result.error }); }
  }

  function confirmDelete() {
    Alert.alert('Excluir conta?', 'Seus dados pessoais serão apagados. O histórico fiscal poderá ser retido pelo prazo legal.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Excluir definitivamente', style: 'destructive', onPress: async () => {
        const result = await auth.deleteAccount();
        if (result.error) setFeedback({ kind: 'error', text: result.error });
      } },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.centeredContent}>
      <SafeAreaView edges={['top']} style={styles.page}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.kicker}>CONTA VIKS MAN</Text>
            <View style={styles.statusBadge}><View style={[styles.statusDot, !auth.configured && styles.demoDot]} /><Text style={styles.statusText}>{auth.configured ? (auth.user ? 'CONECTADA' : 'DESCONECTADA') : 'MODO DEMO'}</Text></View>
          </View>
          <View style={styles.identity}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={styles.identityCopy}><Text style={styles.name}>{displayName}</Text><Text style={styles.accountMeta}>{auth.user?.email ?? 'Experimente o aplicativo sem criar uma conta'}</Text></View>
          </View>
          {!auth.user ? (
            <Pressable onPress={() => router.push('/login')} style={styles.heroButton}><Text style={styles.heroButtonText}>ENTRAR OU CRIAR CONTA</Text><Ionicons name="arrow-forward" color={colors.ink} size={18} /></Pressable>
          ) : (
            <Pressable onPress={beginEdit} style={styles.heroLink}><Ionicons name="create-outline" color={colors.white} size={17} /><Text style={styles.heroLinkText}>EDITAR DADOS</Text></Pressable>
          )}
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statNumber}>{String(bookings.length).padStart(2, '0')}</Text><Text style={styles.statLabel}>AGENDADOS</Text></View><View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statNumber}>01</Text><Text style={styles.statLabel}>UNIDADE</Text></View><View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statNumber}>{auth.user ? 'ON' : '—'}</Text><Text style={styles.statLabel}>SINCRONIZAÇÃO</Text></View>
        </View>

        {feedback ? <View style={[styles.feedback, feedback.kind === 'error' && styles.feedbackError]}><Text style={styles.feedbackText}>{feedback.text}</Text></View> : null}

        {editing ? <View style={styles.section}>
          <SectionTitle index="01" title="DADOS PESSOAIS" />
          <View style={styles.formCard}>
            <Field label="NOME COMPLETO" value={fullName} onChangeText={setFullName} placeholder="Seu nome" />
            <Field label="TELEFONE" value={phone} onChangeText={setPhone} placeholder="+55 31 99999-9999" keyboardType="phone-pad" />
            <Field label="NASCIMENTO" value={birthDate} onChangeText={setBirthDate} placeholder="AAAA-MM-DD" />
            <View style={styles.formActions}><Pressable disabled={busy} onPress={() => setEditing(false)} style={styles.secondaryButton}><Text style={styles.secondaryText}>CANCELAR</Text></Pressable><Pressable disabled={busy} onPress={saveProfile} style={styles.primaryButton}><Text style={styles.primaryText}>{busy ? 'SALVANDO…' : 'SALVAR'}</Text></Pressable></View>
          </View>
        </View> : null}

        <View style={styles.section}>
          <SectionTitle index={editing ? '02' : '01'} title="LEMBRETES" />
          <View style={styles.listCard}>
            <ToggleRow icon="notifications-outline" title="Notificações no app" hint="Confirmações, alterações e lembretes" value={pushEnabled} onValueChange={togglePush} />
            <ToggleRow icon="logo-whatsapp" title="WhatsApp" hint="Autoriza mensagens sobre seus horários" value={whatsappEnabled} onValueChange={toggleWhatsApp} />
            <ToggleRow icon="megaphone-outline" title="Promoções" hint="Autoriza ofertas no WhatsApp; desative quando quiser" value={marketingEnabled} onValueChange={toggleMarketing} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle index={editing ? '03' : '02'} title="ATENDIMENTO" />
          <View style={styles.listCard}>
            {(auth.isStaff || !auth.configured) ? <ActionRow icon="calendar-outline" title="Painel da recepção" hint={!auth.configured ? 'Abrir demonstração administrativa' : 'Agenda, clientes e bloqueios'} onPress={() => router.push('/admin')} /> : null}
            <ActionRow icon="location-outline" title="Como chegar" hint="Betim · MG" onPress={() => Linking.openURL('https://www.google.com/maps/search/?api=1&query=-19.96053886%2C-44.20162582')} />
            <ActionRow icon="logo-instagram" title="Instagram" hint="@viksbarbearia" onPress={() => Linking.openURL('https://www.instagram.com/viksbarbearia/')} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle index={editing ? '04' : '03'} title="CONTA E PRIVACIDADE" />
          <View style={styles.accountCard}>
            <Text style={styles.accountText}>{auth.configured ? 'Sua agenda acompanha você no aplicativo, no site e na recepção.' : 'No modo demonstração, os horários ficam somente neste dispositivo.'}</Text>
            {auth.user ? <><Pressable onPress={auth.signOut} style={styles.outlineButton}><Text style={styles.outlineText}>SAIR DESTA CONTA</Text></Pressable><Pressable onPress={confirmDelete} style={styles.dangerButton}><Text style={styles.dangerText}>EXCLUIR MINHA CONTA</Text></Pressable></> : !auth.configured ? <Pressable onPress={clearBookings} style={styles.outlineButton}><Text style={styles.outlineText}>LIMPAR DADOS DE DEMONSTRAÇÃO</Text></Pressable> : null}
          </View>
        </View>
        <Text style={styles.version}>VIKS MAN · MVP 0.3.0</Text>
      </SafeAreaView>
    </ScrollView>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionIndex}>{index}</Text></View>;
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'phone-pad' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput {...props} placeholderTextColor="#9C9C97" style={styles.input} /></View>;
}

function ToggleRow({ icon, title, hint, value, onValueChange }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return <View style={styles.row}><View style={styles.rowIcon}><Ionicons name={icon} color={colors.ink} size={19} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowHint}>{hint}</Text></View><Switch accessibilityLabel={title} hitSlop={12} value={value} onValueChange={onValueChange} trackColor={{ false: colors.line, true: colors.blue }} thumbColor={colors.white} /></View>;
}

function ActionRow({ icon, title, hint, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.rowIcon}><Ionicons name={icon} color={colors.ink} size={19} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowHint}>{hint}</Text></View><Ionicons name="arrow-forward" color={colors.blue} size={18} /></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, centeredContent: { alignItems: 'center' }, page: { width: '100%', maxWidth: layout.maxWidth, paddingBottom: 42 }, hero: { backgroundColor: colors.ink, paddingHorizontal: layout.pagePadding, paddingTop: 44, paddingBottom: 34 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, kicker: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 }, statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 }, statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }, demoDot: { backgroundColor: '#F7B955' }, statusText: { color: '#A2A3A8', fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 34 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontFamily: fonts.sans, fontSize: 25, fontWeight: '900', letterSpacing: -1 }, identityCopy: { flex: 1 }, name: { color: colors.white, fontFamily: fonts.sans, fontSize: 36, fontWeight: '800', letterSpacing: -1.8 }, accountMeta: { color: '#9B9CA1', fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, marginTop: 5 },
  heroButton: { height: 50, backgroundColor: colors.white, marginTop: 26, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroButtonText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, heroLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 }, heroLinkText: { color: colors.white, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  stats: { minHeight: 92, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center' }, stat: { flex: 1, alignItems: 'center' }, statNumber: { color: colors.ink, fontFamily: fonts.sans, fontSize: 25, fontWeight: '800', letterSpacing: -1.1 }, statLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.7, marginTop: 5 }, statDivider: { width: 1, height: 38, backgroundColor: colors.line },
  feedback: { marginHorizontal: layout.pagePadding, marginTop: 18, padding: 14, backgroundColor: '#DDF5E8', borderLeftWidth: 4, borderLeftColor: colors.success }, feedbackError: { backgroundColor: '#FBE8E6', borderLeftColor: colors.danger }, feedbackText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, fontWeight: '700' }, section: { paddingHorizontal: layout.pagePadding, paddingTop: 48 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, sectionTitle: { color: colors.ink, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, sectionIndex: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900' },
  listCard: { backgroundColor: colors.white, paddingHorizontal: 16 }, row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, rowIcon: { width: 40, height: 40, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1 }, rowTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: '800' }, rowHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 14, marginTop: 3 },
  formCard: { backgroundColor: colors.white, padding: 18, gap: 16 }, field: { gap: 7 }, fieldLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1 }, input: { height: 50, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.sans, fontSize: 14 }, formActions: { flexDirection: 'row', gap: 8, marginTop: 4 }, secondaryButton: { flex: 1, height: 48, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, primaryButton: { flex: 1, height: 48, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: colors.white, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  accountCard: { padding: 18, backgroundColor: colors.white }, accountText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, lineHeight: 17 }, outlineButton: { height: 46, marginTop: 16, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, outlineText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, dangerButton: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' }, dangerText: { color: colors.danger, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, version: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, letterSpacing: 1, textAlign: 'center', marginTop: 36 }, pressed: { opacity: 0.66 },
});
