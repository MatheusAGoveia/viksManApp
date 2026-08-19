import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, layout } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { barbers as catalogBarbers } from '@/data/catalog';
import {
  activateSubscription,
  fetchClientSubscription,
  fetchLoyaltyTransactions,
  fetchViksClubPlans,
  updateSubscriptionStatus,
} from '@/features/viks-club/services/viks-club-service';
import { SubscriberBookingCalendar } from '@/features/viks-club/components/SubscriberBookingCalendar';
import type {
  LoyaltyTransaction,
  SubscriptionStatus,
  ViksClubPlan,
  ViksClubSubscription,
} from '@/features/viks-club/types';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function ViksClubScreen() {
  const { desktop, width } = useResponsiveLayout();
  const wide = desktop || width >= 820;
  const auth = useAuth();

  const [subscription, setSubscription] = useState<ViksClubSubscription | null>(null);
  const [plans, setPlans] = useState<ViksClubPlan[]>([]);
  const [loyaltyTxs, setLoyaltyTxs] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<string>(catalogBarbers[0]?.id || 'victor');
  const [confirmModalTarget, setConfirmModalTarget] = useState<SubscriptionStatus | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ kind: 'success' | 'error'; title: string; text: string } | null>(null);

  const clientId = auth.profile?.id || 'demo-client';

  const loadData = useCallback(async () => {
    setFeedbackMsg(null);
    try {
      const [subData, plansData, txsData] = await Promise.all([
        fetchClientSubscription(clientId),
        fetchViksClubPlans(),
        fetchLoyaltyTransactions(clientId),
      ]);
      setSubscription(subData);
      const activePlans = plansData.filter((p) => p.active);
      setPlans(activePlans);
      setLoyaltyTxs(txsData);
      if (activePlans.length > 0 && !selectedPlanId) {
        setSelectedPlanId(activePlans[0].id);
      }
    } catch {
      setFeedbackMsg({
        kind: 'error',
        title: 'ERRO DE CARREGAMENTO',
        text: 'Não foi possível carregar as informações da sua assinatura no momento.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId, selectedPlanId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  async function handleSubscribe(planId: string) {
    if (!auth.user && auth.configured) {
      setFeedbackMsg({
        kind: 'error',
        title: 'CONTA NECESSÁRIA',
        text: 'Faça login na sua conta Viks Man para assinar um plano do clube.',
      });
      return;
    }

    const isStaffOrAdmin = auth.profile?.role === 'manager' || auth.profile?.role === 'admin';
    if (!isStaffOrAdmin) {
      setFeedbackMsg({
        kind: 'error',
        title: 'CONTRATAÇÃO NA RECEPÇÃO',
        text: 'Viks Club ainda não está disponível para contratação online. Fale com a equipe na recepção da barbearia para ativar seu plano.',
      });
      return;
    }

    setBusy(true);
    setFeedbackMsg(null);
    const res = await activateSubscription(clientId, planId, 1, selectedBarberId);
    setBusy(false);
    if (res.success) {
      setFeedbackMsg({
        kind: 'success',
        title: 'ASSINATURA ATIVADA',
        text: 'Parabéns! Sua assinatura do Viks Club foi ativada com sucesso. Aproveite seus benefícios!',
      });
      loadData();
    } else {
      setFeedbackMsg({
        kind: 'error',
        title: 'FALHA NA ATIVAÇÃO',
        text: res.error || 'Não foi possível ativar sua assinatura. Tente novamente.',
      });
    }
  }

  async function executeStatusChange(newStatus: SubscriptionStatus) {
    if (!subscription) return;

    const isStaffOrAdmin = auth.profile?.role === 'manager' || auth.profile?.role === 'admin';
    if (!isStaffOrAdmin) {
      setFeedbackMsg({
        kind: 'error',
        title: 'SOLICITAÇÃO NA RECEPÇÃO',
        text: 'A alteração de status da sua assinatura (pausa/cancelamento) deve ser realizada juntamente à recepção da barbearia.',
      });
      setConfirmModalTarget(null);
      return;
    }

    setBusy(true);
    setFeedbackMsg(null);
    const res = await updateSubscriptionStatus(subscription.id, clientId, newStatus);
    setBusy(false);
    setConfirmModalTarget(null);

    if (res.success) {
      const statusTitle =
        newStatus === 'paused'
          ? 'ASSINATURA PAUSADA'
          : newStatus === 'canceled'
            ? 'ASSINATURA CANCELADA'
            : 'ASSINATURA REATIVADA';
      const statusText =
        newStatus === 'paused'
          ? 'Sua assinatura foi pausada temporariamente. Seus benefícios ficarão suspensos até você reativar.'
          : newStatus === 'canceled'
            ? 'Sua assinatura do Viks Club foi encerrada com sucesso.'
            : 'Sua assinatura foi reativada com sucesso! Seus benefícios voltam a ficar disponíveis.';

      setFeedbackMsg({
        kind: 'success',
        title: statusTitle,
        text: statusText,
      });
      await loadData();
    } else {
      setFeedbackMsg({
        kind: 'error',
        title: 'FALHA NA OPERAÇÃO',
        text: res.error || 'Não foi possível atualizar o status da assinatura.',
      });
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('pt-BR');
    } catch {
      return iso;
    }
  }

  const hasActiveSub = subscription && (subscription.status === 'active' || subscription.status === 'paused');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.centeredContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
    >
      <SafeAreaView edges={['top']} style={styles.page}>
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>VIKS CLUB & FIDELIDADE</Text>
          <Text style={styles.title}>{hasActiveSub ? 'Seu painel.' : 'Seu plano.'}</Text>
          <View style={styles.pointsBadgeHeader}>
            <Ionicons name="ribbon-outline" color={colors.blue} size={15} />
            <Text style={styles.pointsHeaderText}>
              {(auth.profile?.viksPointsBalance ?? 0).toLocaleString('pt-BR')} PTS
            </Text>
          </View>
        </View>

        {/* Personalized High-End Notification Toast Banner */}
        {feedbackMsg ? (
          <View style={[styles.toastBanner, feedbackMsg.kind === 'error' && styles.toastBannerError]}>
            <View
              style={[
                styles.toastIconBox,
                feedbackMsg.kind === 'error' && { backgroundColor: '#FFEBEE' },
              ]}
            >
              <Ionicons
                name={feedbackMsg.kind === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={22}
                color={feedbackMsg.kind === 'success' ? '#2E7D32' : colors.danger}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toastTitle, feedbackMsg.kind === 'error' && { color: colors.danger }]}>
                {feedbackMsg.title}
              </Text>
              <Text style={styles.toastText}>{feedbackMsg.text}</Text>
            </View>
            <Pressable onPress={() => setFeedbackMsg(null)} style={styles.toastCloseBtn}>
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.emptyText}>Buscando informações do Viks Club...</Text>
          </View>
        ) : hasActiveSub ? (
          /* ====================================================================== */
          /* 1. ACTIVE SUBSCRIPTION DASHBOARD                                      */
          /* ====================================================================== */
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>SUA ASSINATURA VIGENTE & FIDELIDADE</Text>
            </View>

            {/* Sub Card + Loyalty Audit */}
            <View style={[styles.subGrid, wide && styles.subGridWide, { marginBottom: 24 }]}>
              <View style={styles.activeCard}>
                <View style={styles.stripe} />

                <View style={styles.cardTop}>
                  <View style={styles.statusChip}>
                    <View style={[styles.statusDot, subscription.status === 'paused' && styles.dotPaused]} />
                    <Text style={styles.statusChipText}>
                      {subscription.status === 'active' ? 'ASSINATURA ATIVA' : 'ASSINATURA PAUSADA'}
                    </Text>
                  </View>
                  <Text style={styles.planCode}>#{subscription.id.slice(-6).toUpperCase()}</Text>
                </View>

                <Text style={styles.planTitle}>{subscription.planName || 'Viks Club Premium'}</Text>
                <Text style={styles.planVigency}>
                  Vigência: {formatDate(subscription.currentPeriodStart)} até {formatDate(subscription.currentPeriodEnd)}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.paper, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, alignSelf: 'flex-start', marginVertical: 8 }}>
                  <Ionicons name="person" size={14} color={colors.blue} />
                  <Text style={{ fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.ink }}>
                    BARBEIRO DO PLANO: {catalogBarbers.find((b) => b.id === subscription.barberId)?.name?.toUpperCase() || 'VICTOR'}
                  </Text>
                </View>

                {/* Benefits List Grid */}
                <Text style={styles.benefitsHeader}>BENEFÍCIOS DISPONÍVEIS NO MÊS</Text>

                <View style={styles.benefitsContainer}>
                  {(subscription.benefits || []).map((b) => {
                    const avail = Math.max(0, b.quantityGranted - b.quantityUsed);
                    const percent = b.quantityGranted > 0 ? (b.quantityUsed / b.quantityGranted) * 100 : 0;
                    const label =
                      b.serviceId === 'cut'
                        ? 'Cortes de Cabelo'
                        : b.serviceId === 'beard'
                          ? 'Barbas'
                          : b.benefitType === 'product_discount'
                            ? 'Desconto em Produtos'
                            : 'Benefício';

                    return (
                      <View key={b.id} style={styles.benefitRow}>
                        <View style={styles.benefitInfoRow}>
                          <Text style={styles.benefitLabel}>{label}</Text>
                          <Text style={styles.benefitCounter}>
                            {b.benefitType === 'product_discount'
                              ? `${b.discountPercent}% OFF`
                              : `${b.quantityUsed} de ${b.quantityGranted} usado (${avail} disponível)`}
                          </Text>
                        </View>

                        {b.benefitType !== 'product_discount' ? (
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                { width: `${Math.min(100, percent)}%` },
                                percent >= 100 && styles.progressFull,
                              ]}
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  {subscription.status === 'active' ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => setConfirmModalTarget('paused')}
                      style={[styles.outlineButton, busy && styles.disabled]}
                    >
                      <Ionicons name="pause-outline" color={colors.ink} size={16} />
                      <Text style={styles.outlineText}>PAUSAR PLANO</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={busy}
                      onPress={() => setConfirmModalTarget('active')}
                      style={[styles.primaryButton, busy && styles.disabled]}
                    >
                      <Ionicons name="play-outline" color={colors.white} size={16} />
                      <Text style={styles.primaryText}>REATIVAR PLANO</Text>
                    </Pressable>
                  )}

                  <Pressable
                    disabled={busy}
                    onPress={() => setConfirmModalTarget('canceled')}
                    style={[styles.dangerButton, busy && styles.disabled]}
                  >
                    <Ionicons name="trash-outline" color={colors.danger} size={16} />
                    <Text style={styles.dangerText}>CANCELAR</Text>
                  </Pressable>
                </View>
              </View>

              {/* Loyalty Audit Card */}
              <View style={styles.loyaltyCard}>
                <View style={styles.loyaltyHeader}>
                  <View style={styles.loyaltyIconBox}>
                    <Ionicons name="ribbon-outline" color={colors.blue} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loyaltyLabel}>SEU SALDO DE PONTOS</Text>
                    <Text style={styles.loyaltyValue}>{(auth.profile?.viksPointsBalance ?? 0).toLocaleString('pt-BR')} pts</Text>
                  </View>
                </View>

                {loyaltyTxs.length > 0 ? (
                  <View style={styles.txList}>
                    <Text style={styles.txListTitle}>EXTRATO RECENTE DE PONTOS</Text>
                    {loyaltyTxs.slice(0, 5).map((tx) => {
                      const isPositive = tx.type === 'earn' || tx.type === 'adjustment_credit' || tx.type === 'adjustment';
                      return (
                        <View key={tx.id} style={styles.txRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.txReason}>{tx.reason}</Text>
                            <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                          </View>
                          <Text style={[styles.txPoints, isPositive ? styles.txEarn : styles.txRedeem]}>
                            {isPositive ? '+' : '-'}{tx.points} pts
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.txEmptyText}>Acumule pontos a cada atendimento presencial na Viks.</Text>
                )}
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>AGENDAMENTOS ANTECIPADOS DO MÊS</Text>
            </View>

            {/* Main Calendar View */}
            <View style={{ marginBottom: 24 }}>
              <SubscriberBookingCalendar
                subscription={subscription}
                allowedDays={
                  plans.find((p) => p.id === subscription.planId)?.allowedDays ?? ['monday', 'tuesday', 'wednesday', 'thursday']
                }
                onBookingChanged={loadData}
              />
            </View>
          </View>
        ) : (
          /* ====================================================================== */
          /* 2. NO ACTIVE SUBSCRIPTION — SHOW CATALOG OF PLANS                     */
          /* ====================================================================== */
          <View style={styles.section}>
            <View style={styles.bannerCard}>
              <View style={styles.bannerIconBox}>
                <Ionicons name="sparkles" color={colors.white} size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>Garanta seu estilo todos os meses.</Text>
                <Text style={styles.bannerText}>
                  Escolha um dos planos Viks Club e economize em seus cortes e barbas com mensalidade sem fidelidade.
                </Text>
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>PLANOS DISPONÍVEIS</Text>
            </View>

            <View style={{ backgroundColor: colors.white, padding: 16, borderWidth: 1, borderColor: colors.line, marginBottom: 12 }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', color: colors.blue, letterSpacing: 1, marginBottom: 8 }}>
                SELECIONE SEU BARBEIRO DE PREFERÊNCIA PARA O PLANO
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {catalogBarbers.map((b) => {
                  const isSel = selectedBarberId === b.id;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => setSelectedBarberId(b.id)}
                      style={[
                        { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 4 },
                        isSel && { backgroundColor: colors.blue, borderColor: colors.blue },
                      ]}
                    >
                      <Text style={[{ fontFamily: fonts.sans, fontSize: 11, fontWeight: '700', color: colors.ink }, isSel && { color: colors.white }]}>
                        {b.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.plansGrid, wide && styles.plansGridWide]}>
              {plans.map((p) => {
                const isSelected = selectedPlanId === p.id;
                return (
                  <View key={p.id} style={[styles.planCard, isSelected && styles.planCardSelected]}>
                    <View style={styles.planStripe} />
                    <View style={styles.planCardHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planCardTitle}>{p.name}</Text>
                        {p.description ? <Text style={styles.planCardDesc}>{p.description}</Text> : null}
                      </View>
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceNumber}>R$ {((p.priceCents || Math.round(p.price * 100)) / 100).toFixed(2).replace('.', ',')}</Text>
                        <Text style={styles.pricePeriod}>/ {p.billingPeriod === 'yearly' ? 'ano' : 'mês'}</Text>
                      </View>
                    </View>

                    <Text style={styles.planBenefitsTitle}>BENEFÍCIOS INCLUSOS:</Text>
                    <View style={styles.benefitChipsContainer}>
                      {(p.benefits || []).map((b) => (
                        <View key={b.id} style={styles.chipRow}>
                          <Ionicons name="checkmark-circle" color={colors.blue} size={16} />
                          <Text style={styles.chipText}>{b.description || `${b.quantity}x Benefício`}</Text>
                        </View>
                      ))}
                    </View>

                    <Pressable
                      disabled={busy}
                      onPress={() => handleSubscribe(p.id)}
                      style={[styles.primaryButton, busy && styles.disabled]}
                    >
                      <Text style={styles.primaryText}>{busy ? 'PROCESSANDO…' : 'ASSINAR ESTE PLANO'}</Text>
                      <Ionicons name="arrow-forward" color={colors.white} size={18} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* Custom Viks Man Branded Status Change Confirmation Modal */}
      <Modal
        visible={confirmModalTarget !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmModalTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalTopHeader}>
              <View
                style={[
                  styles.modalIconBox,
                  confirmModalTarget === 'canceled' && { backgroundColor: '#FFEBEE' },
                  confirmModalTarget === 'paused' && { backgroundColor: '#FFF3E0' },
                ]}
              >
                <Ionicons
                  name={
                    confirmModalTarget === 'paused'
                      ? 'pause-circle'
                      : confirmModalTarget === 'active'
                        ? 'play-circle'
                        : 'alert-circle'
                  }
                  size={28}
                  color={
                    confirmModalTarget === 'paused'
                      ? '#E65100'
                      : confirmModalTarget === 'active'
                        ? colors.blue
                        : colors.danger
                  }
                />
              </View>
              <Pressable onPress={() => setConfirmModalTarget(null)} style={styles.modalCloseIcon}>
                <Ionicons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <Text style={styles.modalEyebrow}>CONFIRMAÇÃO DE ASSINATURA</Text>
            <Text style={styles.modalTitle}>
              {confirmModalTarget === 'paused'
                ? 'Pausar plano do Viks Club?'
                : confirmModalTarget === 'active'
                  ? 'Reativar plano do Viks Club?'
                  : 'Cancelar plano do Viks Club?'}
            </Text>

            <Text style={styles.modalDescription}>
              {confirmModalTarget === 'paused'
                ? 'Ao pausar sua assinatura, seus benefícios mensais ficarão congelados temporariamente. Você poderá reativá-los a qualquer momento sem perder histórico.'
                : confirmModalTarget === 'active'
                  ? 'Ao reativar, seus benefícios inclusos no plano voltam a ficar totalmente disponíveis para consumo no app e presencialmente.'
                  : 'Atenção: Ao cancelar, seu plano atual será encerrado. Você perderá os benefícios do ciclo e precisará assinar um novo plano no futuro.'}
            </Text>

            <View style={styles.modalButtonsRow}>
              <Pressable
                disabled={busy}
                onPress={() => setConfirmModalTarget(null)}
                style={[styles.modalSecondaryBtn, busy && styles.disabled]}
              >
                <Text style={styles.modalSecondaryText}>MANTER ASSINATURA</Text>
              </Pressable>

              <Pressable
                disabled={busy}
                onPress={() => confirmModalTarget && executeStatusChange(confirmModalTarget)}
                style={[
                  styles.modalPrimaryBtn,
                  confirmModalTarget === 'canceled' && styles.modalDangerBtn,
                  busy && styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalPrimaryText}>
                    {confirmModalTarget === 'paused'
                      ? 'CONFIRMAR E PAUSAR'
                      : confirmModalTarget === 'active'
                        ? 'CONFIRMAR E REATIVAR'
                        : 'CONFIRMAR E CANCELAR'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  centeredContent: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  page: {
    width: '100%',
    maxWidth: layout.maxWidth,
    paddingHorizontal: layout.pagePadding,
    gap: 16,
  },
  header: {
    position: 'relative',
    marginTop: 16,
    marginBottom: 8,
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1.9,
  },
  pointsBadgeHeader: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pointsHeaderText: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    padding: 16,
    marginBottom: 8,
  },
  toastBannerError: {
    borderLeftColor: colors.danger,
  },
  toastIconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  toastTitle: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  toastText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  toastCloseBtn: {
    padding: 6,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 13,
  },
  section: {
    gap: 16,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  subGrid: {
    gap: 20,
  },
  subGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activeCard: {
    flex: 2,
    position: 'relative',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
    paddingLeft: 26,
    gap: 14,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.blue,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  dotPaused: {
    backgroundColor: '#E65100',
  },
  statusChipText: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  planCode: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 9,
  },
  planTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '800',
  },
  planVigency: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 11,
  },
  benefitsHeader: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  benefitsContainer: {
    gap: 12,
  },
  benefitRow: {
    gap: 6,
  },
  benefitInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  benefitLabel: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
  },
  benefitCounter: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.soft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.blue,
    borderRadius: 4,
  },
  progressFull: {
    backgroundColor: colors.success,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  outlineButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  primaryButton: {
    flex: 1,
    height: 52,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: {
    color: colors.white,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  dangerButton: {
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dangerText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  loyaltyCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    gap: 14,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  loyaltyIconBox: {
    width: 44,
    height: 44,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyLabel: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loyaltyValue: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  txList: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
    gap: 8,
  },
  txListTitle: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  txReason: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  txDate: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 8,
  },
  txPoints: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '800',
  },
  txEarn: {
    color: '#2E7D32',
  },
  txRedeem: {
    color: colors.danger,
  },
  txEmptyText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 11,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.ink,
    padding: 22,
  },
  bannerIconBox: {
    width: 46,
    height: 46,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: colors.white,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
  },
  bannerText: {
    color: '#A0A1A6',
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  plansGrid: {
    gap: 18,
  },
  plansGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  planCard: {
    flex: 1,
    minWidth: 280,
    position: 'relative',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
    paddingLeft: 26,
    gap: 14,
  },
  planCardSelected: {
    borderColor: colors.blue,
  },
  planStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.blue,
  },
  planCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  planCardTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '900',
  },
  planCardDesc: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 11,
    marginTop: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceNumber: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 17,
    fontWeight: '900',
  },
  pricePeriod: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 9,
  },
  planBenefitsTitle: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  benefitChipsContainer: {
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 16, 20, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  modalCloseIcon: {
    padding: 4,
  },
  modalEyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  modalTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '800',
  },
  modalDescription: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 8,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalPrimaryBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerBtn: {
    backgroundColor: colors.danger,
  },
  modalPrimaryText: {
    color: colors.white,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
