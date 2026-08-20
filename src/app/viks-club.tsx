import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, layout } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { barbers, formatCurrency, services } from '@/data/catalog';
import { SubscriberBookingCalendar } from '@/features/viks-club/components/SubscriberBookingCalendar';
import { fetchClientSubscription, fetchLoyaltyTransactions, fetchViksClubPlans, selfSubscribe, updateSubscriptionStatus } from '@/features/viks-club/services/viks-club-service';
import type { LoyaltyTransaction, SubscriptionStatus, ViksClubPlan, ViksClubPlanBenefit, ViksClubSubscription, ViksClubSubscriptionBenefit } from '@/features/viks-club/types';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_LABELS: Record<string, string> = { monday: 'seg', tuesday: 'ter', wednesday: 'qua', thursday: 'qui', friday: 'sex', saturday: 'sáb', sunday: 'dom' };
type Feedback = { kind: 'success' | 'error'; title: string; text: string };

export default function ViksClubScreen() {
  const auth = useAuth();
  const { width } = useResponsiveLayout();
  const wide = width >= 960;
  const compact = width < 560;
  const clientId = auth.user?.id ?? 'demo-client';
  const demoMode = !UUID_PATTERN.test(clientId);
  const [plans, setPlans] = useState<ViksClubPlan[]>([]);
  const [subscription, setSubscription] = useState<ViksClubSubscription | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState('first');
  const [checkoutPlan, setCheckoutPlan] = useState<ViksClubPlan | null>(null);
  const [statusAction, setStatusAction] = useState<SubscriptionStatus | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [nextPlans, nextSubscription, nextTransactions] = await Promise.all([
        fetchViksClubPlans(demoMode), fetchClientSubscription(clientId), fetchLoyaltyTransactions(clientId),
      ]);
      setPlans(nextPlans); setSubscription(nextSubscription); setTransactions(nextTransactions);
    } catch (error: unknown) {
      setFeedback({ kind: 'error', title: 'NÃO FOI POSSÍVEL CARREGAR', text: error instanceof Error ? error.message : 'Tente novamente em instantes.' });
    } finally { setLoading(false); setRefreshing(false); }
  }, [clientId, demoMode]);

  useEffect(() => { queueMicrotask(loadData); }, [loadData]);
  const currentPlan = useMemo(() => plans.find((plan) => plan.id === subscription?.planId), [plans, subscription?.planId]);
  const hasCurrentSubscription = Boolean(subscription && ['active', 'paused'].includes(subscription.status));
  const orderedPlans = useMemo(() => [...plans].filter((plan) => plan.active).sort((a, b) => Number(b.featured) - Number(a.featured)), [plans]);

  function requestCheckout(plan: ViksClubPlan) {
    setFeedback(null);
    if (!plan.selfServiceEnabled) {
      setFeedback({ kind: 'error', title: 'ATIVAÇÃO NA LOJA', text: 'A unidade configurou este plano para contratação assistida. Fale com a equipe para ativá-lo.' });
      return;
    }
    if (auth.configured && !auth.user) { router.push('/login'); return; }
    setCheckoutPlan(plan);
  }

  async function confirmCheckout() {
    if (!checkoutPlan) return;
    setBusy(true); setFeedback(null);
    const result = await selfSubscribe(clientId, checkoutPlan.id, selectedBarberId);
    setBusy(false);
    if (!result.success) {
      setFeedback({ kind: 'error', title: 'ASSINATURA NÃO CONCLUÍDA', text: result.error ?? 'Revise os dados e tente novamente.' });
      return;
    }
    setCheckoutPlan(null);
    setFeedback({ kind: 'success', title: 'BEM-VINDO AO VIKS CLUB', text: 'Seu plano já está ativo. Escolha um benefício e reserve seu próximo horário.' });
    await auth.refreshProfile(); await loadData();
  }

  async function confirmStatusAction() {
    if (!subscription || !statusAction) return;
    setBusy(true); setFeedback(null);
    const result = await updateSubscriptionStatus(subscription.id, clientId, statusAction);
    setBusy(false);
    if (!result.success) {
      setFeedback({ kind: 'error', title: 'ALTERAÇÃO NÃO CONCLUÍDA', text: result.error ?? 'Tente novamente ou fale com a unidade.' });
      return;
    }
    const labels: Record<string, string> = { active: 'Sua assinatura foi reativada.', paused: 'Sua assinatura foi pausada. Seus créditos permanecem protegidos até o fim do ciclo.', canceled: 'Sua assinatura foi cancelada.' };
    setStatusAction(null); setFeedback({ kind: 'success', title: 'ASSINATURA ATUALIZADA', text: labels[statusAction] });
    await auth.refreshProfile(); await loadData();
  }

  if (loading) return <View style={styles.loadingScreen}><View style={styles.loadingMark}><Text style={styles.loadingMarkText}>V</Text></View><ActivityIndicator color={colors.blue} /><Text style={styles.loadingText}>PREPARANDO SEU CLUB</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(); }} tintColor={colors.blue} />}>
      <SafeAreaView edges={['top']} style={styles.page}>
        <View style={styles.topline}>
          <View style={styles.brandLockup}><View style={styles.brandMark}><Text style={styles.brandMarkText}>V</Text></View><View><Text style={styles.brandName}>VIKS CLUB</Text><Text style={styles.brandMeta}>MEMBROS · BETIM</Text></View></View>
          <View style={styles.pointsPill}><Ionicons name="diamond-outline" size={15} color={colors.blue} /><Text style={styles.pointsPillValue}>{auth.profile?.viksPointsBalance ?? 0}</Text><Text style={styles.pointsPillLabel}>PONTOS</Text></View>
        </View>
        {feedback ? <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} /> : null}
        {hasCurrentSubscription && subscription ? (
          <MemberExperience subscription={subscription} plan={currentPlan} transactions={transactions} points={auth.profile?.viksPointsBalance ?? 0} wide={wide} onStatusAction={setStatusAction} onRefresh={loadData} />
        ) : (
          <Storefront plans={orderedPlans} selectedBarberId={selectedBarberId} onSelectBarber={setSelectedBarberId} onCheckout={requestCheckout} wide={wide} compact={compact} requiresLogin={auth.configured && !auth.user} />
        )}
      </SafeAreaView>
      <CheckoutModal plan={checkoutPlan} barberId={selectedBarberId} busy={busy} onClose={() => setCheckoutPlan(null)} onConfirm={confirmCheckout} />
      <StatusModal action={statusAction} busy={busy} onClose={() => setStatusAction(null)} onConfirm={confirmStatusAction} />
    </ScrollView>
  );
}

function Storefront({ plans, selectedBarberId, onSelectBarber, onCheckout, wide, compact, requiresLogin }: { plans: ViksClubPlan[]; selectedBarberId: string; onSelectBarber: (id: string) => void; onCheckout: (plan: ViksClubPlan) => void; wide: boolean; compact: boolean; requiresLogin: boolean }) {
  return <>
    <View style={[styles.hero, wide && styles.heroWide]}>
      <View style={styles.heroGlow} />
      <View style={styles.heroCopy}><Text style={styles.heroKicker}>SEU RITUAL, SEM IMPROVISO</Text><Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Sempre no grau.{`\n`}Sempre Viks.</Text><Text style={styles.heroText}>Garanta seus serviços do mês, escolha quando usar e agende direto pelo app. Sem mensagem, sem espera, sem depender da recepção.</Text><View style={styles.heroProofRow}><Proof icon="calendar-clear-outline" value="30 dias" label="de autonomia" /><Proof icon="flash-outline" value="1 toque" label="para agendar" /><Proof icon="refresh-outline" value="sem multa" label="para cancelar" /></View></View>
      <View style={styles.heroArt}><View style={styles.heroArtFrame}><Text style={styles.heroArtTiny}>MEMBERSHIP</Text><Text style={styles.heroArtV}>V</Text><View><Text style={styles.heroArtClub}>CLUB</Text><Text style={styles.heroArtYear}>EST. 2026</Text></View></View></View>
    </View>
    <View style={styles.journeyStrip}><JourneyStep index="01" title="Escolha seu plano" text="A loja define os benefícios e dias válidos." /><JourneyStep index="02" title="Ative pelo app" text="Confirme seu profissional e comece na hora." /><JourneyStep index="03" title="Use quando quiser" text="Cada reserva desconta um crédito automaticamente." /></View>
    <View style={styles.sectionIntro}><View><Text style={styles.sectionKicker}>PLANOS DA UNIDADE</Text><Text style={styles.sectionTitle}>Encontre o seu ritmo.</Text></View><Text style={styles.sectionText}>Todos os benefícios e regras abaixo são configurados pela Viks Man.</Text></View>
    <View style={styles.barberSelector}><View style={styles.selectorCopy}><Text style={styles.selectorLabel}>PROFISSIONAL DO PLANO</Text><Text style={styles.selectorHint}>Você pode deixar a agenda encontrar o primeiro disponível.</Text></View><View style={styles.barberOptions}>{barbers.map((barber) => { const selected = barber.id === selectedBarberId; return <Pressable key={barber.id} onPress={() => onSelectBarber(barber.id)} style={[styles.barberChip, selected && styles.barberChipSelected]}><View style={[styles.barberInitial, selected && styles.barberInitialSelected]}><Text style={[styles.barberInitialText, selected && styles.textWhite]}>{barber.initials}</Text></View><Text style={[styles.barberChipText, selected && styles.textWhite]}>{barber.name}</Text>{selected ? <Ionicons name="checkmark-circle" size={16} color={colors.white} /> : null}</Pressable>; })}</View></View>
    {plans.length ? <View style={[styles.planGrid, wide && styles.planGridWide]}>{plans.map((plan, index) => <PlanCard key={plan.id} plan={plan} index={index} requiresLogin={requiresLogin} onPress={() => onCheckout(plan)} />)}</View> : <View style={styles.noPlans}><Ionicons name="construct-outline" size={26} color={colors.blue} /><Text style={styles.noPlansTitle}>Planos em configuração</Text><Text style={styles.noPlansText}>A unidade ainda não publicou planos para contratação.</Text></View>}
    <View style={styles.assuranceRow}><Assurance icon="shield-checkmark-outline" title="Regras transparentes" text="Dias, créditos e cancelamentos ficam visíveis antes de assinar." /><Assurance icon="phone-portrait-outline" title="Controle no app" text="Acompanhe saldo, vigência, pontos e próximos horários." /><Assurance icon="storefront-outline" title="Configurado pela loja" text="Cada unidade define a experiência que faz sentido para sua operação." /></View>
  </>;
}

function MemberExperience({ subscription, plan, transactions, points, wide, onStatusAction, onRefresh }: { subscription: ViksClubSubscription; plan?: ViksClubPlan; transactions: LoyaltyTransaction[]; points: number; wide: boolean; onStatusAction: (status: SubscriptionStatus) => void; onRefresh: () => Promise<void> }) {
  const benefits = subscription.benefits ?? [];
  const remaining = benefits.filter((benefit) => benefit.benefitType !== 'product_discount').reduce((total, benefit) => total + Math.max(0, benefit.quantityGranted - benefit.quantityUsed), 0);
  const paused = subscription.status === 'paused';
  return <>
    <View style={[styles.memberHero, wide && styles.memberHeroWide]}><View style={styles.memberHeroCopy}><View style={styles.memberStatusRow}><View style={[styles.memberStatus, paused && styles.memberStatusPaused]}><View style={[styles.statusDot, paused && styles.statusDotPaused]} /><Text style={styles.memberStatusText}>{paused ? 'PLANO PAUSADO' : 'MEMBRO ATIVO'}</Text></View><Text style={styles.memberCode}>#{subscription.id.slice(-6).toUpperCase()}</Text></View><Text style={styles.memberEyebrow}>VIKS CLUB · SEU PAINEL</Text><Text style={styles.memberTitle}>{plan?.name ?? subscription.planName ?? 'Seu Viks Club'}</Text><Text style={styles.memberText}>{paused ? 'Seus benefícios estão protegidos. Reative para voltar a reservar pelo Club.' : 'Seu próximo cuidado já está pago. Escolha o benefício, o dia e confirme.'}</Text><View style={styles.memberActions}>{paused && plan?.allowSelfPause ? <Pressable onPress={() => onStatusAction('active')} style={styles.memberPrimaryButton}><Ionicons name="play" size={15} color={colors.white} /><Text style={styles.memberPrimaryText}>REATIVAR AGORA</Text></Pressable> : null}{!paused && plan?.allowSelfPause ? <Pressable onPress={() => onStatusAction('paused')} style={styles.memberGhostButton}><Ionicons name="pause" size={15} color={colors.white} /><Text style={styles.memberGhostText}>PAUSAR</Text></Pressable> : null}{plan?.allowSelfCancel ? <Pressable onPress={() => onStatusAction('canceled')} style={styles.memberTextButton}><Text style={styles.memberTextButtonLabel}>CANCELAR PLANO</Text></Pressable> : null}</View></View><View style={styles.memberMetrics}><MemberMetric value={String(remaining).padStart(2, '0')} label="CRÉDITOS LIVRES" /><MemberMetric value={formatShortDate(subscription.currentPeriodEnd)} label="FIM DO CICLO" /><MemberMetric value={String(points)} label="PONTOS VIKS" /></View></View>
    <View style={styles.sectionIntro}><View><Text style={styles.sectionKicker}>SEU CICLO ATUAL</Text><Text style={styles.sectionTitle}>Benefícios disponíveis.</Text></View><Text style={styles.sectionText}>O saldo é atualizado automaticamente sempre que você agenda ou cancela.</Text></View>
    <View style={[styles.memberContentGrid, wide && styles.memberContentGridWide]}><View style={styles.benefitPanel}>{benefits.map((benefit) => <MemberBenefit key={benefit.id} benefit={benefit} />)}{!benefits.length ? <Text style={styles.emptyListText}>Nenhum benefício disponível neste ciclo.</Text> : null}</View><View style={styles.loyaltyPanel}><View style={styles.loyaltyHeading}><View style={styles.loyaltyIcon}><Ionicons name="diamond-outline" size={21} color={colors.blue} /></View><View><Text style={styles.loyaltyKicker}>FIDELIDADE VIKS</Text><Text style={styles.loyaltyPoints}>{points} pontos</Text></View></View><View style={styles.transactionList}>{transactions.slice(0, 4).map((transaction) => { const positive = ['earn', 'adjustment_credit', 'adjustment'].includes(transaction.type); return <View key={transaction.id} style={styles.transactionRow}><View style={{ flex: 1 }}><Text style={styles.transactionReason}>{transaction.reason}</Text><Text style={styles.transactionDate}>{formatShortDate(transaction.createdAt)}</Text></View><Text style={[styles.transactionPoints, positive ? styles.positive : styles.negative]}>{positive ? '+' : '−'}{transaction.points}</Text></View>; })}{!transactions.length ? <Text style={styles.emptyListText}>Seu extrato aparecerá aqui.</Text> : null}</View></View></View>
    {!paused ? <SubscriberBookingCalendar subscription={subscription} allowedDays={plan?.allowedDays} onBookingChanged={onRefresh} /> : null}
  </>;
}

function PlanCard({ plan, index, requiresLogin, onPress }: { plan: ViksClubPlan; index: number; requiresLogin: boolean; onPress: () => void }) {
  const availableDays = (plan.allowedDays ?? []).map((day) => DAY_LABELS[day]).filter(Boolean).join(' · ');
  const isHovered = useSharedValue(false);
  const isPressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = isPressed.value ? 0.97 : isHovered.value ? 1.03 : 1;
    const translateY = isHovered.value ? -6 : 0;
    const borderColor = isHovered.value ? colors.blue : plan.featured ? colors.blue : '#D6D2C9';
    return {
      transform: [
        { scale: withSpring(scale, { damping: 16, stiffness: 200 }) },
        { translateY: withSpring(translateY, { damping: 16, stiffness: 200 }) },
      ],
      borderColor: withTiming(borderColor, { duration: 150 }),
      borderWidth: isHovered.value || plan.featured ? 2 : 1,
      shadowColor: '#0D59F2',
      shadowOffset: { width: 0, height: isHovered.value ? 10 : 2 },
      shadowOpacity: isHovered.value ? 0.2 : 0.04,
      shadowRadius: isHovered.value ? 16 : 4,
      elevation: isHovered.value ? 8 : 2,
    };
  });

  const handleHoverIn = () => { isHovered.value = true; };
  const handleHoverOut = () => { isHovered.value = false; };
  const handlePressIn = () => { isPressed.value = true; };
  const handlePressOut = () => { isPressed.value = false; };

  return (
    <Pressable
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={{ flex: 1, minWidth: 290 }}
    >
      <Animated.View style={[styles.planCard, plan.featured && styles.planCardFeatured, animatedStyle]}>
        <View style={styles.planCardTopline}>
          <Text style={styles.planIndex}>0{index + 1}</Text>
          {plan.featured ? (
            <View style={styles.featuredBadge}>
              <Ionicons name="sparkles" size={12} color={colors.white} />
              <Text style={styles.featuredBadgeText}>MAIS ESCOLHIDO</Text>
            </View>
          ) : null}
        </View>
        <View>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planDescription}>{plan.description ?? 'Um plano para manter seu estilo sempre em dia.'}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.currency}>R$</Text>
          <Text style={styles.price}>{Math.floor(plan.priceCents / 100)}</Text>
          <View>
            <Text style={styles.cents}>,{String(plan.priceCents % 100).padStart(2, '0')}</Text>
            <Text style={styles.period}>/{plan.billingPeriod === 'yearly' ? 'ANO' : 'MÊS'}</Text>
          </View>
        </View>
        <View style={styles.planBenefits}>
          {(plan.benefits ?? []).map((benefit) => (
            <PlanBenefit key={benefit.id} benefit={benefit} />
          ))}
        </View>
        <View style={styles.planRules}>
          <Ionicons name="calendar-outline" size={15} color={colors.muted} />
          <Text style={styles.planRulesText}>AGENDE: {availableDays || 'CONSULTE A UNIDADE'}</Text>
        </View>
        <View style={[styles.planCta, plan.featured && styles.planCtaFeatured]}>
          <Text style={styles.planCtaText}>
            {requiresLogin ? 'ENTRAR PARA ASSINAR' : plan.selfServiceEnabled ? 'ESCOLHER ESTE PLANO' : 'FALAR COM A LOJA'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </View>
        <Text style={styles.planFinePrint}>
          {plan.refundOnCancel ? 'Crédito devolvido em cancelamentos permitidos.' : 'Créditos usados não são devolvidos ao cancelar.'}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function PlanBenefit({ benefit }: { benefit: ViksClubPlanBenefit }) { const label = benefit.description ?? benefitLabel(benefit.serviceId, benefit.quantity, benefit.discountPercent); return <View style={styles.planBenefitRow}><View style={styles.checkCircle}><Ionicons name="checkmark" size={12} color={colors.white} /></View><Text style={styles.planBenefitText}>{label}</Text></View>; }
function MemberBenefit({ benefit }: { benefit: ViksClubSubscriptionBenefit }) { const available = Math.max(0, benefit.quantityGranted - benefit.quantityUsed); const percent = benefit.quantityGranted ? Math.min(100, (benefit.quantityUsed / benefit.quantityGranted) * 100) : 0; const service = services.find((item) => item.id === benefit.serviceId); const isProduct = benefit.benefitType === 'product_discount'; return <View style={styles.memberBenefitRow}><View style={styles.memberBenefitIcon}><Ionicons name={isProduct ? 'bag-handle-outline' : 'cut-outline'} size={20} color={colors.blue} /></View><View style={{ flex: 1 }}><View style={styles.memberBenefitTop}><View><Text style={styles.memberBenefitName}>{service?.name ?? (isProduct ? 'Produtos Viks' : 'Benefício do plano')}</Text><Text style={styles.memberBenefitType}>{isProduct ? `${benefit.discountPercent ?? 0}% DE DESCONTO` : benefit.benefitType === 'service_discount' ? `${benefit.discountPercent ?? 0}% DE DESCONTO` : 'SERVIÇO INCLUSO'}</Text></View><View style={styles.balanceBox}><Text style={styles.balanceValue}>{isProduct ? `${benefit.discountPercent ?? 0}%` : available}</Text><Text style={styles.balanceLabel}>{isProduct ? 'OFF' : 'LIVRES'}</Text></View></View>{!isProduct ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View> : null}</View></View>; }
function FeedbackBanner({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) { return <View style={[styles.feedback, feedback.kind === 'error' && styles.feedbackError]}><Ionicons name={feedback.kind === 'success' ? 'checkmark-circle' : 'alert-circle'} size={22} color={feedback.kind === 'success' ? colors.success : colors.danger} /><View style={{ flex: 1 }}><Text style={styles.feedbackTitle}>{feedback.title}</Text><Text style={styles.feedbackText}>{feedback.text}</Text></View><Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={18} color={colors.ink} /></Pressable></View>; }

function CheckoutModal({ plan, barberId, busy, onClose, onConfirm }: { plan: ViksClubPlan | null; barberId: string; busy: boolean; onClose: () => void; onConfirm: () => void }) { const barber = barbers.find((item) => item.id === barberId); return <Modal visible={Boolean(plan)} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.checkoutModal}><View style={styles.modalHeader}><View style={styles.modalIcon}><Ionicons name="sparkles" size={22} color={colors.white} /></View><Pressable onPress={onClose} disabled={busy}><Ionicons name="close" size={22} color={colors.ink} /></Pressable></View><Text style={styles.modalKicker}>CONFIRME SUA ADESÃO</Text><Text style={styles.modalTitle}>{plan?.name}</Text><Text style={styles.modalText}>Seu plano será ativado agora e os benefícios ficarão disponíveis neste app.</Text><View style={styles.checkoutSummary}><SummaryRow label="PLANO" value={plan?.name ?? '—'} /><SummaryRow label="PROFISSIONAL" value={barber?.name ?? 'Primeiro disponível'} /><SummaryRow label="CICLO" value={plan?.billingPeriod === 'yearly' ? 'Anual' : 'Mensal'} /><SummaryRow label="VALOR" value={plan ? formatCurrency(plan.priceCents / 100) : '—'} strong /></View><Text style={styles.modalFinePrint}>Ao continuar, você confirma a adesão. A cobrança segue as condições informadas pela unidade.</Text><View style={styles.modalActions}><Pressable onPress={onClose} disabled={busy} style={styles.modalSecondary}><Text style={styles.modalSecondaryText}>VOLTAR</Text></Pressable><Pressable onPress={onConfirm} disabled={busy} style={styles.modalPrimary}>{busy ? <ActivityIndicator color={colors.white} /> : <><Text style={styles.modalPrimaryText}>ATIVAR MEU PLANO</Text><Ionicons name="arrow-forward" size={17} color={colors.white} /></>}</Pressable></View></View></View></Modal>; }
function StatusModal({ action, busy, onClose, onConfirm }: { action: SubscriptionStatus | null; busy: boolean; onClose: () => void; onConfirm: () => void }) { const content = action === 'paused' ? { title: 'Pausar assinatura?', text: 'Você não poderá usar créditos enquanto o plano estiver pausado, mas poderá reativar dentro do ciclo.' } : action === 'active' ? { title: 'Reativar assinatura?', text: 'Seus benefícios disponíveis voltam a ser liberados imediatamente.' } : { title: 'Cancelar assinatura?', text: 'O acesso ao Club será encerrado. Essa ação não apaga seu histórico.' }; return <Modal visible={Boolean(action)} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.statusModal}><Text style={styles.modalKicker}>GERENCIAR ASSINATURA</Text><Text style={styles.modalTitle}>{content.title}</Text><Text style={styles.modalText}>{content.text}</Text><View style={styles.modalActions}><Pressable onPress={onClose} disabled={busy} style={styles.modalSecondary}><Text style={styles.modalSecondaryText}>AGORA NÃO</Text></Pressable><Pressable onPress={onConfirm} disabled={busy} style={[styles.modalPrimary, action === 'canceled' && styles.modalDanger]}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalPrimaryText}>CONFIRMAR</Text>}</Pressable></View></View></View></Modal>; }

function Proof({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) { return <View style={styles.proof}><Ionicons name={icon} size={17} color={colors.blue} /><View><Text style={styles.proofValue}>{value}</Text><Text style={styles.proofLabel}>{label}</Text></View></View>; }
function JourneyStep({ index, title, text }: { index: string; title: string; text: string }) { return <View style={styles.journeyStep}><Text style={styles.journeyIndex}>{index}</Text><View><Text style={styles.journeyTitle}>{title}</Text><Text style={styles.journeyText}>{text}</Text></View></View>; }
function Assurance({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) { return <View style={styles.assurance}><Ionicons name={icon} size={22} color={colors.blue} /><View style={{ flex: 1 }}><Text style={styles.assuranceTitle}>{title}</Text><Text style={styles.assuranceText}>{text}</Text></View></View>; }
function MemberMetric({ value, label }: { value: string; label: string }) { return <View style={styles.memberMetric}><Text style={styles.memberMetricValue}>{value}</Text><Text style={styles.memberMetricLabel}>{label}</Text></View>; }
function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, strong && styles.summaryValueStrong]}>{value}</Text></View>; }
function benefitLabel(serviceId?: string | null, quantity = 1, discountPercent?: number) { if (discountPercent) return `${discountPercent}% de desconto`; const service = services.find((item) => item.id === serviceId)?.name ?? 'serviço'; return `${quantity}× ${service} por ciclo`; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '').toUpperCase(); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F2EB' }, scrollContent: { alignItems: 'center', paddingBottom: 64 }, page: { width: '100%', maxWidth: layout.maxWidth, paddingHorizontal: layout.pagePadding },
  loadingScreen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 14 }, loadingMark: { width: 58, height: 58, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] }, loadingMarkText: { color: colors.white, fontFamily: fonts.serif, fontSize: 34, fontWeight: '900', transform: [{ rotate: '-8deg' }] }, loadingText: { color: '#8D8F98', fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  topline: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 11 }, brandMark: { width: 34, height: 34, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: colors.white, fontFamily: fonts.serif, fontSize: 21, fontWeight: '900' }, brandName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 }, brandMeta: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 1, marginTop: 3 }, pointsPill: { height: 42, paddingHorizontal: 13, borderWidth: 1, borderColor: '#D6D2C9', backgroundColor: '#FBF9F4', flexDirection: 'row', alignItems: 'center', gap: 6 }, pointsPillValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: '900' }, pointsPillLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  feedback: { minHeight: 68, marginBottom: 16, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: '#E8F5ED', borderLeftWidth: 4, borderLeftColor: colors.success, flexDirection: 'row', alignItems: 'center', gap: 12 }, feedbackError: { backgroundColor: '#FDEDEA', borderLeftColor: colors.danger }, feedbackTitle: { color: colors.ink, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, feedbackText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, marginTop: 3 },
  hero: { minHeight: 560, backgroundColor: colors.ink, overflow: 'hidden', padding: 30, justifyContent: 'space-between' }, heroWide: { minHeight: 530, padding: 52, flexDirection: 'row', alignItems: 'center' }, heroGlow: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: '#16357A', opacity: 0.38, right: -150, top: -180 }, heroCopy: { flex: 1, maxWidth: 700, zIndex: 2 }, heroKicker: { color: '#79A2FF', fontFamily: fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 2.1, marginBottom: 22 }, heroTitle: { color: colors.white, fontFamily: fonts.sans, fontSize: 64, lineHeight: 63, fontWeight: '900', letterSpacing: -3.6 }, heroTitleCompact: { fontSize: 43, lineHeight: 44, letterSpacing: -2.3 }, heroText: { maxWidth: 590, color: '#B7B9C0', fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, marginTop: 24 }, heroProofRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 34 }, proof: { flexDirection: 'row', alignItems: 'center', gap: 9 }, proofValue: { color: colors.white, fontFamily: fonts.sans, fontSize: 12, fontWeight: '900' }, proofLabel: { color: '#777A84', fontFamily: fonts.mono, fontSize: 7, letterSpacing: 0.6, marginTop: 2 },
  heroArt: { flex: 0.65, minHeight: 280, alignItems: 'center', justifyContent: 'center', zIndex: 2 }, heroArtFrame: { width: 250, height: 300, padding: 24, backgroundColor: colors.blue, justifyContent: 'space-between', transform: [{ rotate: '4deg' }], borderWidth: 1, borderColor: '#6291FF' }, heroArtTiny: { color: '#BFD0FF', fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 2 }, heroArtV: { color: colors.white, fontFamily: fonts.serif, fontSize: 136, lineHeight: 142, fontWeight: '900', alignSelf: 'center' }, heroArtClub: { color: colors.white, fontFamily: fonts.sans, fontSize: 31, fontWeight: '900', letterSpacing: 5 }, heroArtYear: { color: '#BFD0FF', fontFamily: fonts.mono, fontSize: 7, letterSpacing: 1.4, marginTop: 5 },
  journeyStrip: { backgroundColor: '#EAE6DE', padding: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 24 }, journeyStep: { flex: 1, minWidth: 220, flexDirection: 'row', gap: 13 }, journeyIndex: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900' }, journeyTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 12, fontWeight: '900' }, journeyText: { maxWidth: 260, color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 15, marginTop: 4 },
  sectionIntro: { marginTop: 58, marginBottom: 22, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }, sectionKicker: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.8, marginBottom: 10 }, sectionTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 34, lineHeight: 36, fontWeight: '900', letterSpacing: -1.5 }, sectionText: { maxWidth: 390, color: colors.muted, fontFamily: fonts.sans, fontSize: 11, lineHeight: 17 },
  barberSelector: { backgroundColor: '#FBF9F4', borderWidth: 1, borderColor: '#D6D2C9', padding: 18, gap: 16 }, selectorCopy: { flex: 1 }, selectorLabel: { color: colors.ink, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, selectorHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, marginTop: 5 }, barberOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, barberChip: { minHeight: 48, paddingHorizontal: 11, backgroundColor: '#EFEBE3', borderWidth: 1, borderColor: '#D6D2C9', flexDirection: 'row', alignItems: 'center', gap: 8 }, barberChipSelected: { backgroundColor: colors.blue, borderColor: colors.blue }, barberInitial: { width: 28, height: 28, backgroundColor: '#DCD7CE', alignItems: 'center', justifyContent: 'center' }, barberInitialSelected: { backgroundColor: '#0B47D0' }, barberInitialText: { color: colors.ink, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900' }, barberChipText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 10, fontWeight: '800' }, textWhite: { color: colors.white },
  planGrid: { gap: 14, marginTop: 14 }, planGridWide: { flexDirection: 'row', alignItems: 'stretch' }, planCard: { flex: 1, minWidth: 290, backgroundColor: '#FBF9F4', borderWidth: 1, borderColor: '#D6D2C9', padding: 24, gap: 22 }, planCardFeatured: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.blue, padding: 23 }, planCardTopline: { minHeight: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, planIndex: { color: '#A29E96', fontFamily: fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, featuredBadge: { minHeight: 25, paddingHorizontal: 9, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', gap: 5 }, featuredBadgeText: { color: colors.white, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 }, planName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 23, fontWeight: '900', letterSpacing: -0.7 }, planDescription: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, lineHeight: 17, marginTop: 7 },
  priceRow: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-start' }, currency: { color: colors.blue, fontFamily: fonts.mono, fontSize: 11, fontWeight: '900', marginTop: 11, marginRight: 4 }, price: { color: colors.ink, fontFamily: fonts.sans, fontSize: 52, lineHeight: 58, fontWeight: '900', letterSpacing: -3 }, cents: { color: colors.ink, fontFamily: fonts.sans, fontSize: 18, fontWeight: '900', marginTop: 6 }, period: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', marginTop: 2 }, planBenefits: { gap: 12, minHeight: 84 }, planBenefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, checkCircle: { width: 21, height: 21, borderRadius: 11, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, planBenefitText: { flex: 1, color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '700' }, planRules: { minHeight: 42, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D6D2C9', flexDirection: 'row', alignItems: 'center', gap: 8 }, planRulesText: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }, planCta: { minHeight: 52, paddingHorizontal: 15, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, planCtaFeatured: { backgroundColor: colors.blue }, planCtaText: { color: colors.white, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 }, planFinePrint: { color: '#8C8982', fontFamily: fonts.sans, fontSize: 9, lineHeight: 13, textAlign: 'center' },
  noPlans: { marginTop: 14, minHeight: 200, backgroundColor: '#FBF9F4', borderWidth: 1, borderColor: '#D6D2C9', alignItems: 'center', justifyContent: 'center', gap: 8 }, noPlansTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 18, fontWeight: '900' }, noPlansText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11 }, assuranceRow: { marginTop: 48, paddingTop: 28, borderTopWidth: 1, borderTopColor: '#D6D2C9', flexDirection: 'row', flexWrap: 'wrap', gap: 24 }, assurance: { flex: 1, minWidth: 240, flexDirection: 'row', gap: 13 }, assuranceTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 12, fontWeight: '900' }, assuranceText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 15, marginTop: 4 },
  memberHero: { minHeight: 480, padding: 30, backgroundColor: colors.ink, overflow: 'hidden', justifyContent: 'space-between' }, memberHeroWide: { minHeight: 430, padding: 48, flexDirection: 'row', alignItems: 'stretch' }, memberHeroCopy: { flex: 1, justifyContent: 'center', maxWidth: 680 }, memberStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 42 }, memberStatus: { minHeight: 28, paddingHorizontal: 10, backgroundColor: '#153D2E', flexDirection: 'row', alignItems: 'center', gap: 7 }, memberStatusPaused: { backgroundColor: '#49351C' }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#48D597' }, statusDotPaused: { backgroundColor: '#FFB657' }, memberStatusText: { color: colors.white, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 1 }, memberCode: { color: '#6F7179', fontFamily: fonts.mono, fontSize: 8, letterSpacing: 1 }, memberEyebrow: { color: '#79A2FF', fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.8, marginBottom: 13 }, memberTitle: { color: colors.white, fontFamily: fonts.sans, fontSize: 43, lineHeight: 45, fontWeight: '900', letterSpacing: -2 }, memberText: { maxWidth: 530, color: '#AEB0B7', fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, marginTop: 16 }, memberActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 26 }, memberPrimaryButton: { minHeight: 46, paddingHorizontal: 16, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', gap: 8 }, memberPrimaryText: { color: colors.white, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, memberGhostButton: { minHeight: 46, paddingHorizontal: 16, borderWidth: 1, borderColor: '#44464E', flexDirection: 'row', alignItems: 'center', gap: 8 }, memberGhostText: { color: colors.white, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, memberTextButton: { minHeight: 46, paddingHorizontal: 10, justifyContent: 'center' }, memberTextButtonLabel: { color: '#8C8E96', fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  memberMetrics: { flex: 0.72, minWidth: 260, marginTop: 30, borderWidth: 1, borderColor: '#34363D' }, memberMetric: { flex: 1, minHeight: 102, padding: 18, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#34363D' }, memberMetricValue: { color: colors.white, fontFamily: fonts.sans, fontSize: 30, fontWeight: '900', letterSpacing: -1 }, memberMetricLabel: { color: '#71737C', fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 7 },
  memberContentGrid: { gap: 14 }, memberContentGridWide: { flexDirection: 'row', alignItems: 'stretch' }, benefitPanel: { flex: 1.7, backgroundColor: '#FBF9F4', borderWidth: 1, borderColor: '#D6D2C9' }, memberBenefitRow: { minHeight: 116, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 15, borderBottomWidth: 1, borderBottomColor: '#DEDAD1' }, memberBenefitIcon: { width: 48, height: 48, backgroundColor: '#E6ECFA', alignItems: 'center', justifyContent: 'center' }, memberBenefitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, memberBenefitName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 15, fontWeight: '900' }, memberBenefitType: { color: colors.blue, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 }, balanceBox: { alignItems: 'flex-end' }, balanceValue: { color: colors.ink, fontFamily: fonts.sans, fontSize: 25, fontWeight: '900' }, balanceLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 }, progressTrack: { height: 5, marginTop: 13, backgroundColor: '#E0DCD3', overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: colors.blue },
  loyaltyPanel: { flex: 1, padding: 20, backgroundColor: colors.ink }, loyaltyHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#34363D' }, loyaltyIcon: { width: 44, height: 44, backgroundColor: '#1B2D55', alignItems: 'center', justifyContent: 'center' }, loyaltyKicker: { color: '#79A2FF', fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 1 }, loyaltyPoints: { color: colors.white, fontFamily: fonts.sans, fontSize: 20, fontWeight: '900', marginTop: 3 }, transactionList: { marginTop: 10 }, transactionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#2D2F35' }, transactionReason: { color: colors.white, fontFamily: fonts.sans, fontSize: 10, fontWeight: '700' }, transactionDate: { color: '#74767E', fontFamily: fonts.mono, fontSize: 7, marginTop: 3 }, transactionPoints: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '900' }, positive: { color: '#58D9A0' }, negative: { color: '#FF837A' }, emptyListText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(7, 8, 11, 0.82)', alignItems: 'center', justifyContent: 'center', padding: 18 }, checkoutModal: { width: '100%', maxWidth: 520, backgroundColor: '#FBF9F4', padding: 26, gap: 12 }, statusModal: { width: '100%', maxWidth: 460, backgroundColor: '#FBF9F4', padding: 26, gap: 12 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, modalIcon: { width: 44, height: 44, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, modalKicker: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, modalTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 27, lineHeight: 30, fontWeight: '900', letterSpacing: -1 }, modalText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18 }, checkoutSummary: { marginTop: 10, borderTopWidth: 1, borderColor: '#D6D2C9' }, summaryRow: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: '#D6D2C9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, summaryLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 }, summaryValue: { flex: 1, color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '800', textAlign: 'right' }, summaryValueStrong: { color: colors.blue, fontSize: 15, fontWeight: '900' }, modalFinePrint: { color: '#8B8880', fontFamily: fonts.sans, fontSize: 9, lineHeight: 14, marginTop: 4 }, modalActions: { flexDirection: 'row', gap: 9, marginTop: 12 }, modalSecondary: { flex: 0.7, minHeight: 50, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, modalSecondaryText: { color: colors.ink, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, modalPrimary: { flex: 1.3, minHeight: 50, paddingHorizontal: 15, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, modalDanger: { backgroundColor: colors.danger }, modalPrimaryText: { color: colors.white, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
});
