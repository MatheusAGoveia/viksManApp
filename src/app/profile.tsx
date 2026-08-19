import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, layout } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useBookings } from '@/context/booking-context';
import { fetchClientSubscription, fetchLoyaltyTransactions } from '@/features/viks-club/services/viks-club-service';
import type { LoyaltyTransaction, ViksClubSubscription } from '@/features/viks-club/types';
import { ClientViksClubModal } from '@/features/viks-club/components/ClientViksClubModal';
import { barbers as catalogBarbers } from '@/data/catalog';
import { registerPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

type Feedback = { kind: 'error' | 'success'; text: string } | null;

type BarberOption = { id: string; name: string };

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
  const [preferredBarberOverride, setPreferredBarberOverride] = useState<string | null>(null);
  const [silentServiceOverride, setSilentServiceOverride] = useState<boolean | null>(null);
  const [clientSub, setClientSub] = useState<ViksClubSubscription | null>(null);
  const [loyaltyTxs, setLoyaltyTxs] = useState<LoyaltyTransaction[]>([]);
  const [clientClubModalVisible, setClientClubModalVisible] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const [availableBarbers, setAvailableBarbers] = useState<BarberOption[]>([]);

  const displayName = auth.profile?.fullName || auth.user?.email?.split('@')[0] || 'Visitante';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'VM';
  const whatsappEnabled = whatsappOverride ?? auth.profile?.whatsappConsent ?? false;
  const marketingEnabled = marketingOverride ?? auth.profile?.marketingConsent ?? false;
  const currentPreferredBarberId = preferredBarberOverride !== undefined ? preferredBarberOverride : (auth.profile?.preferredBarberId ?? null);
  const silentServiceEnabled = silentServiceOverride ?? auth.profile?.prefersSilentService ?? false;

  useEffect(() => {
    if (auth.profile?.id) {
      fetchClientSubscription(auth.profile.id).then(setClientSub).catch(() => undefined);
      fetchLoyaltyTransactions(auth.profile.id).then(setLoyaltyTxs).catch(() => undefined);
    }
  }, [auth.profile?.id]);

  useEffect(() => {
    if (supabase) {
      supabase
        .from('barbers')
        .select('id, name')
        .eq('active', true)
        .order('sort_order')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setAvailableBarbers(data);
          } else {
            setAvailableBarbers(
              catalogBarbers.filter((b) => b.id !== 'first').map((b) => ({ id: b.id, name: b.name })),
            );
          }
        });
    } else {
      const timer = setTimeout(() => {
        setAvailableBarbers(
          catalogBarbers.filter((b) => b.id !== 'first').map((b) => ({ id: b.id, name: b.name })),
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

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
    if (!auth.user && auth.configured) {
      router.push('/login');
      return;
    }
    if (!next) return setPushEnabled(false);
    if (auth.user) {
      const result = await registerPushNotifications(auth.user.id);
      if (result.error) return setFeedback({ kind: 'error', text: result.error });
    }
    setPushEnabled(true);
    setFeedback({ kind: 'success', text: 'Notificações ativadas neste dispositivo.' });
  }

  async function toggleWhatsApp(next: boolean) {
    if (!auth.user && auth.configured) {
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
    if (!auth.user && auth.configured) { router.push('/login'); return; }
    setMarketingOverride(next);
    const result = await auth.updateProfile({ marketingConsent: next });
    if (result.error) { setMarketingOverride(!next); setFeedback({ kind: 'error', text: result.error }); }
  }

  async function selectPreferredBarber(barberId: string | null) {
    if (!auth.user && auth.configured) {
      router.push('/login');
      return;
    }
    setPreferredBarberOverride(barberId);
    const result = await auth.updateProfile({ preferredBarberId: barberId });
    if (result.error) {
      setPreferredBarberOverride(auth.profile?.preferredBarberId ?? null);
      setFeedback({ kind: 'error', text: result.error });
    } else {
      setFeedback({ kind: 'success', text: 'Barbeiro preferido atualizado.' });
    }
  }

  async function toggleSilentService(next: boolean) {
    if (!auth.user && auth.configured) {
      router.push('/login');
      return;
    }
    setSilentServiceOverride(next);
    const result = await auth.updateProfile({ prefersSilentService: next });
    if (result.error) {
      setSilentServiceOverride(!next);
      setFeedback({ kind: 'error', text: result.error });
    } else {
      setFeedback({
        kind: 'success',
        text: next ? 'Atendimento silencioso ativado.' : 'Atendimento silencioso desativado.',
      });
    }
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
            <View style={styles.statusGroup}>
              {auth.isStaff ? <View style={styles.roleBadge}><Text style={styles.roleText}>{auth.profile?.role.toUpperCase()}</Text></View> : null}
              <View style={styles.statusBadge}><View style={[styles.statusDot, !auth.configured && styles.demoDot]} /><Text style={styles.statusText}>{auth.configured ? (auth.user ? 'CONECTADA' : 'DESCONECTADA') : 'MODO DEMO'}</Text></View>
            </View>
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
          <SectionTitle index={editing ? '03' : '02'} title="VIKS CLUB" />
          <View style={styles.listCard}>
            {clientSub && (clientSub.status === 'active' || clientSub.status === 'paused') ? (
              <View style={styles.clubCard}>
                <View style={styles.clubHeader}>
                  <View>
                    <Text style={styles.clubPlanName}>{clientSub.planName || 'Viks Club Premium'}</Text>
                    <Text style={styles.clubPeriod}>Vigência: {new Date(clientSub.currentPeriodStart).toLocaleDateString('pt-BR')} até {new Date(clientSub.currentPeriodEnd).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <View style={[styles.clubStatusBadge, clientSub.status === 'paused' && { backgroundColor: '#FFF3E0' }]}>
                    <Text style={[styles.clubStatusText, clientSub.status === 'paused' && { color: '#E65100' }]}>
                      {clientSub.status === 'active' ? 'ATIVO' : 'PAUSADO'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.clubSectionTitle}>BENEFÍCIOS DO PERÍODO</Text>
                <View style={styles.clubBenefitsList}>
                  {(clientSub.benefits || []).map((b) => {
                    const avail = Math.max(0, b.quantityGranted - b.quantityUsed);
                    const label = b.serviceId === 'cut' ? 'Cortes' : b.serviceId === 'beard' ? 'Barbas' : 'Desconto';
                    return (
                      <View key={b.id} style={styles.clubBenefitRow}>
                        <Text style={styles.clubBenefitLabel}>{label}</Text>
                        <Text style={styles.clubBenefitMeter}>{b.quantityUsed} de {b.quantityGranted} utilizado ({avail} disponível)</Text>
                      </View>
                    );
                  })}
                </View>
                <Pressable
                  onPress={() => router.push('/viks-club')}
                  style={{
                    marginTop: 14,
                    height: 42,
                    backgroundColor: colors.blue,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: colors.white, fontFamily: fonts.sans, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                    GERENCIAR MINHA ASSINATURA
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.noClubCard}>
                <Ionicons name="sparkles-outline" color={colors.blue} size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noClubTitle}>Viks Club</Text>
                  <Text style={styles.noClubText}>Você ainda não possui um plano ativo. Clique no botão abaixo para conhecer os planos e assinar!</Text>
                  <Pressable
                    onPress={() => router.push('/viks-club')}
                    style={{
                      marginTop: 10,
                      height: 38,
                      backgroundColor: colors.blue,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: colors.white, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
                      VER PLANOS E ASSINAR
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle index={editing ? '04' : '03'} title="PONTOS DE FIDELIDADE" />
          <View style={styles.listCard}>
            <View style={styles.loyaltyHeader}>
              <View style={styles.loyaltyIconBox}><Ionicons name="ribbon-outline" color={colors.blue} size={22} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.loyaltyBalanceLabel}>SEU SALDO</Text>
                <Text style={styles.loyaltyBalanceValue}>{(auth.profile?.viksPointsBalance ?? 0).toLocaleString('pt-BR')} pts</Text>
              </View>
            </View>

            {loyaltyTxs.length > 0 ? (
              <View style={styles.loyaltyTxList}>
                <Text style={styles.loyaltyTxTitle}>EXTRATO RECENTE</Text>
                {loyaltyTxs.slice(0, 5).map((tx) => {
                  const isPositive = tx.type === 'earn' || tx.type === 'adjustment';
                  return (
                    <View key={tx.id} style={styles.loyaltyTxRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.loyaltyTxReason}>{tx.reason}</Text>
                        <Text style={styles.loyaltyTxDate}>{new Date(tx.createdAt).toLocaleDateString('pt-BR')}</Text>
                      </View>
                      <Text style={[styles.loyaltyTxPts, isPositive ? styles.txEarn : styles.txRedeem]}>
                        {isPositive ? '+' : '-'}{tx.points} pts
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle index={editing ? '05' : '04'} title="ATENDIMENTO" />
          <View style={styles.listCard}>
            <View style={styles.prefHeaderRow}>
              <View style={styles.rowIcon}><Ionicons name="person-outline" color={colors.ink} size={19} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Barbeiro preferido</Text>
                <Text style={styles.rowHint}>Seleção inicial preferencial no agendamento</Text>
              </View>
            </View>

            <View style={styles.barberChipsContainer}>
              <Pressable
                onPress={() => selectPreferredBarber(null)}
                style={[styles.barberChip, !currentPreferredBarberId && styles.barberChipSelected]}
              >
                <Text style={[styles.barberChipText, !currentPreferredBarberId && styles.barberChipTextSelected]}>
                  Sem preferência
                </Text>
              </Pressable>
              {availableBarbers.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => selectPreferredBarber(b.id)}
                  style={[styles.barberChip, currentPreferredBarberId === b.id && styles.barberChipSelected]}
                >
                  <Text style={[styles.barberChipText, currentPreferredBarberId === b.id && styles.barberChipTextSelected]}>
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ToggleRow
              icon="volume-mute-outline"
              title="Prefiro atendimento em silêncio"
              hint="Seu profissional verá essa preferência antes do atendimento."
              value={silentServiceEnabled}
              onValueChange={toggleSilentService}
            />

            {(auth.isStaff || !auth.configured) ? <ActionRow icon="calendar-outline" title="Painel da recepção" hint={!auth.configured ? 'Abrir demonstração administrativa' : 'Agenda, clientes e bloqueios'} onPress={() => router.push('/admin')} /> : null}
            <ActionRow icon="location-outline" title="Como chegar" hint="Betim · MG" onPress={() => Linking.openURL('https://www.google.com/maps/search/?api=1&query=-19.96053886%2C-44.20162582')} />
            <ActionRow icon="logo-instagram" title="Instagram" hint="@viksbarbearia" onPress={() => Linking.openURL('https://www.instagram.com/viksbarbearia/')} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle index={editing ? '06' : '05'} title="CONTA E PRIVACIDADE" />
          <View style={styles.accountCard}>
            <Text style={styles.accountText}>{auth.configured ? 'Sua agenda acompanha você no aplicativo, no site e na recepção.' : 'No modo demonstração, os horários ficam somente neste dispositivo.'}</Text>
            {auth.user ? <><Pressable onPress={auth.signOut} style={styles.outlineButton}><Text style={styles.outlineText}>SAIR DESTA CONTA</Text></Pressable><Pressable onPress={confirmDelete} style={styles.dangerButton}><Text style={styles.dangerText}>EXCLUIR MINHA CONTA</Text></Pressable></> : !auth.configured ? <Pressable onPress={clearBookings} style={styles.outlineButton}><Text style={styles.outlineText}>LIMPAR DADOS DE DEMONSTRAÇÃO</Text></Pressable> : null}
          </View>
        </View>
        <Text style={styles.version}>VIKS MAN · MVP 0.3.0</Text>
      </SafeAreaView>

      {auth.profile?.id ? (
        <ClientViksClubModal
          visible={clientClubModalVisible}
          clientId={auth.profile.id}
          onClose={() => setClientClubModalVisible(false)}
          onUpdated={() => {
            if (auth.profile?.id) {
              fetchClientSubscription(auth.profile.id).then(setClientSub).catch(() => undefined);
            }
          }}
        />
      ) : null}
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
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, kicker: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 }, statusGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 }, roleBadge: { backgroundColor: colors.blue, paddingHorizontal: 8, paddingVertical: 5 }, roleText: { color: colors.white, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 }, statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 }, statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }, demoDot: { backgroundColor: '#F7B955' }, statusText: { color: '#A2A3A8', fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 34 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontFamily: fonts.sans, fontSize: 25, fontWeight: '900', letterSpacing: -1 }, identityCopy: { flex: 1 }, name: { color: colors.white, fontFamily: fonts.sans, fontSize: 36, fontWeight: '800', letterSpacing: -1.8 }, accountMeta: { color: '#9B9CA1', fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, marginTop: 5 },
  heroButton: { height: 50, backgroundColor: colors.white, marginTop: 26, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroButtonText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, heroLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 }, heroLinkText: { color: colors.white, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  stats: { minHeight: 92, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center' }, stat: { flex: 1, alignItems: 'center' }, statNumber: { color: colors.ink, fontFamily: fonts.sans, fontSize: 25, fontWeight: '800', letterSpacing: -1.1 }, statLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.7, marginTop: 5 }, statDivider: { width: 1, height: 38, backgroundColor: colors.line },
  feedback: { marginHorizontal: layout.pagePadding, marginTop: 18, padding: 14, backgroundColor: '#DDF5E8', borderLeftWidth: 4, borderLeftColor: colors.success }, feedbackError: { backgroundColor: '#FBE8E6', borderLeftColor: colors.danger }, feedbackText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, fontWeight: '700' }, section: { paddingHorizontal: layout.pagePadding, paddingTop: 48 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, sectionTitle: { color: colors.ink, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, sectionIndex: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900' },
  listCard: { backgroundColor: colors.white, paddingHorizontal: 16 }, row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, rowIcon: { width: 40, height: 40, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1 }, rowTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: '800' }, rowHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 14, marginTop: 3 },
  prefHeaderRow: { paddingTop: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  barberChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  barberChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  barberChipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  barberChipText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '700' },
  barberChipTextSelected: { color: colors.white },
  clubCard: { paddingVertical: 14 },
  clubHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clubPlanName: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '800', color: colors.ink },
  clubPeriod: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted, marginTop: 2 },
  clubStatusBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  clubStatusText: { fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', color: '#2E7D32' },
  clubSectionTitle: { fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', color: colors.blue, letterSpacing: 0.8, marginTop: 12, marginBottom: 6 },
  clubBenefitsList: { gap: 6 },
  clubBenefitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  clubBenefitLabel: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '700', color: colors.ink },
  clubBenefitMeter: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  noClubCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  noClubTitle: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '800', color: colors.ink },
  noClubText: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, lineHeight: 15, marginTop: 2 },
  loyaltyHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  loyaltyIconBox: { width: 42, height: 42, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  loyaltyBalanceLabel: { fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', color: colors.blue, letterSpacing: 0.8 },
  loyaltyBalanceValue: { fontFamily: fonts.sans, fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 2 },
  loyaltyTxList: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, paddingBottom: 12, gap: 6 },
  loyaltyTxTitle: { fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', color: colors.blue, letterSpacing: 0.8, marginBottom: 4 },
  loyaltyTxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  loyaltyTxReason: { fontFamily: fonts.sans, fontSize: 11, fontWeight: '700', color: colors.ink },
  loyaltyTxDate: { fontFamily: fonts.mono, fontSize: 8, color: colors.muted },
  loyaltyTxPts: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '800' },
  txEarn: { color: '#2E7D32' },
  txRedeem: { color: '#D32F2F' },
  formCard: { backgroundColor: colors.white, padding: 18, gap: 16 }, field: { gap: 7 }, fieldLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1 }, input: { height: 50, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.sans, fontSize: 14 }, formActions: { flexDirection: 'row', gap: 8, marginTop: 4 }, secondaryButton: { flex: 1, height: 48, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, primaryButton: { flex: 1, height: 48, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: colors.white, fontFamily: fonts.sans, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  accountCard: { padding: 18, backgroundColor: colors.white }, accountText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, lineHeight: 17 }, outlineButton: { height: 46, marginTop: 16, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, outlineText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, dangerButton: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' }, dangerText: { color: colors.danger, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, version: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, letterSpacing: 1, textAlign: 'center', marginTop: 36 }, pressed: { opacity: 0.66 },
});
