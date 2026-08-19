import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fonts } from '@/constants/theme';
import {
  activateSubscription,
  fetchClientSubscription,
  fetchViksClubPlans,
  updateSubscriptionStatus,
} from '../services/viks-club-service';
import type { SubscriptionStatus, ViksClubPlan, ViksClubSubscription } from '../types';

type ClientViksClubModalProps = {
  visible: boolean;
  clientId: string;
  onClose: () => void;
  onUpdated?: () => void;
};

export function ClientViksClubModal({
  visible,
  clientId,
  onClose,
  onUpdated,
}: ClientViksClubModalProps) {
  const [subscription, setSubscription] = useState<ViksClubSubscription | null>(null);
  const [plans, setPlans] = useState<ViksClubPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const [subData, plansData] = await Promise.all([
        fetchClientSubscription(clientId),
        fetchViksClubPlans(),
      ]);
      setSubscription(subData);
      const activePlans = plansData.filter((p) => p.active);
      setPlans(activePlans);
      if (activePlans.length > 0 && !selectedPlanId) {
        setSelectedPlanId(activePlans[0].id);
      }
    } catch {
      setFeedbackMsg({ kind: 'error', text: 'Não foi possível carregar as informações da assinatura.' });
    } finally {
      setLoading(false);
    }
  }, [clientId, selectedPlanId]);

  useEffect(() => {
    if (visible && clientId) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [clientId, loadData, visible]);

  async function handleSubscribePlan(planId: string) {
    setBusy(true);
    setFeedbackMsg(null);
    const res = await activateSubscription(clientId, planId, 1);
    setBusy(false);
    if (res.success) {
      setFeedbackMsg({ kind: 'success', text: 'Assinatura ativada com sucesso!' });
      await loadData();
      onUpdated?.();
    } else {
      setFeedbackMsg({ kind: 'error', text: res.error || 'Erro ao ativar assinatura.' });
    }
  }

  async function handleStatusChange(newStatus: SubscriptionStatus) {
    if (!subscription) return;
    const actionLabel = newStatus === 'paused' ? 'pausar' : newStatus === 'canceled' ? 'cancelar' : 'reativar';

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Deseja realmente ${actionLabel} a sua assinatura do Viks Club?`);
      if (!confirmed) return;
      await executeStatusChange(newStatus);
    } else {
      Alert.alert(
        `Confirmar ${actionLabel}`,
        `Deseja realmente ${actionLabel} a sua assinatura do Viks Club?`,
        [
          { text: 'Voltar', style: 'cancel' },
          {
            text: 'Confirmar',
            style: newStatus === 'canceled' ? 'destructive' : 'default',
            onPress: () => executeStatusChange(newStatus),
          },
        ],
      );
    }
  }

  async function executeStatusChange(newStatus: SubscriptionStatus) {
    if (!subscription) return;
    setBusy(true);
    setFeedbackMsg(null);
    const res = await updateSubscriptionStatus(subscription.id, clientId, newStatus);
    setBusy(false);
    if (res.success) {
      setFeedbackMsg({
        kind: 'success',
        text: `Assinatura ${newStatus === 'paused' ? 'pausada' : newStatus === 'canceled' ? 'cancelada' : 'reativada'}!`,
      });
      await loadData();
      onUpdated?.();
    } else {
      setFeedbackMsg({ kind: 'error', text: res.error || 'Erro ao atualizar status.' });
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('pt-BR');
    } catch {
      return iso;
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles" size={20} color={colors.blue} />
              <Text style={styles.title}>GERENCIAR ASSINATURA</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.blue} />
              <Text style={styles.loadingText}>Carregando Viks Club...</Text>
            </View>
          ) : (
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 24 }}>
              {feedbackMsg ? (
                <View style={[styles.feedbackBanner, feedbackMsg.kind === 'error' && styles.feedbackError]}>
                  <Ionicons
                    name={feedbackMsg.kind === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                    size={18}
                    color={feedbackMsg.kind === 'success' ? '#2E7D32' : colors.danger}
                  />
                  <Text style={[styles.feedbackText, feedbackMsg.kind === 'error' && styles.feedbackTextError]}>
                    {feedbackMsg.text}
                  </Text>
                </View>
              ) : null}

              {/* Active Subscription View */}
              {subscription && (subscription.status === 'active' || subscription.status === 'paused') ? (
                <View style={styles.activeCard}>
                  <View style={styles.subTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subPlanTitle}>{subscription.planName || 'Viks Club Premium'}</Text>
                      <Text style={styles.subDates}>
                        Vigência: {formatDate(subscription.currentPeriodStart)} até {formatDate(subscription.currentPeriodEnd)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        subscription.status === 'active' ? styles.badgeActive : styles.badgePaused,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          subscription.status === 'active' ? styles.badgeTextActive : styles.badgeTextPaused,
                        ]}
                      >
                        {subscription.status === 'active' ? 'ATIVO' : 'PAUSADO'}
                      </Text>
                    </View>
                  </View>

                  {/* Benefit Progress Meters */}
                  <Text style={styles.sectionHeader}>BENEFÍCIOS DO MÊS ATUAL</Text>
                  <View style={styles.meterList}>
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
                        <View key={b.id} style={styles.meterItem}>
                          <View style={styles.meterTop}>
                            <Text style={styles.meterLabel}>{label}</Text>
                            <Text style={styles.meterValue}>
                              {b.benefitType === 'product_discount'
                                ? `${b.discountPercent}% OFF`
                                : `${b.quantityUsed} / ${b.quantityGranted} (${avail} disponível)`}
                            </Text>
                          </View>

                          {b.benefitType !== 'product_discount' ? (
                            <View style={styles.progressBarTrack}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${Math.min(100, percent)}%` },
                                  percent >= 100 && styles.progressBarFull,
                                ]}
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>

                  {/* Actions Bar */}
                  <View style={styles.actionButtonsRow}>
                    {subscription.status === 'active' ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => handleStatusChange('paused')}
                        style={[styles.outlineBtn, busy && styles.disabledBtn]}
                      >
                        <Ionicons name="pause-outline" size={16} color={colors.ink} />
                        <Text style={styles.outlineBtnText}>PAUSAR PLANO</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        disabled={busy}
                        onPress={() => handleStatusChange('active')}
                        style={[styles.primaryBtn, busy && styles.disabledBtn]}
                      >
                        <Ionicons name="play-outline" size={16} color={colors.white} />
                        <Text style={styles.primaryBtnText}>REATIVAR PLANO</Text>
                      </Pressable>
                    )}

                    <Pressable
                      disabled={busy}
                      onPress={() => handleStatusChange('canceled')}
                      style={[styles.dangerBtn, busy && styles.disabledBtn]}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      <Text style={styles.dangerBtnText}>CANCELAR</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* No Active Plan / Change Plan Section */
                <View style={styles.noSubCard}>
                  <View style={styles.noSubHeader}>
                    <Ionicons name="sparkles-outline" size={28} color={colors.blue} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noSubTitle}>Assine o Viks Club</Text>
                      <Text style={styles.noSubDesc}>
                        Garanta seu visual impecável todos os meses com cortes e barbas inclusos por um valor fixo.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.sectionHeader}>PLANOS DISPONÍVEIS</Text>
                  <View style={styles.plansList}>
                    {plans.map((p) => {
                      const isSelected = selectedPlanId === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setSelectedPlanId(p.id)}
                          style={[styles.planOptionCard, isSelected && styles.planOptionSelected]}
                        >
                          <View style={styles.planOptionHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.planOptionTitle, isSelected && styles.textSelected]}>
                                {p.name}
                              </Text>
                              {p.description ? (
                                <Text style={styles.planOptionDesc}>{p.description}</Text>
                              ) : null}
                            </View>
                            <Text style={styles.planOptionPrice}>
                              R$ {p.price.toFixed(2).replace('.', ',')} / mês
                            </Text>
                          </View>

                          {/* Benefits list */}
                          <View style={styles.planBenefitsChipList}>
                            {(p.benefits || []).map((b) => (
                              <View key={b.id} style={styles.benefitChip}>
                                <Ionicons name="checkmark-circle" size={14} color={colors.blue} />
                                <Text style={styles.benefitChipText}>{b.description || `${b.quantity}x Benefício`}</Text>
                              </View>
                            ))}
                          </View>

                          <Pressable
                            disabled={busy}
                            onPress={() => handleSubscribePlan(p.id)}
                            style={[styles.subscribeBtn, busy && styles.disabledBtn]}
                          >
                            <Text style={styles.subscribeBtnText}>
                              {busy ? 'PROCESSANDO…' : 'ASSINAR ESTE PLANO'}
                            </Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.white} />
                          </Pressable>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: colors.paper,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
  },
  content: {
    padding: 20,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  feedbackError: {
    backgroundColor: '#FFEBEE',
  },
  feedbackText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    flex: 1,
  },
  feedbackTextError: {
    color: colors.danger,
  },
  activeCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 16,
  },
  subTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  subPlanTitle: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '900',
    color: colors.ink,
  },
  subDates: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeActive: {
    backgroundColor: '#E8F5E9',
  },
  badgePaused: {
    backgroundColor: '#FFF3E0',
  },
  statusBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  badgeTextActive: {
    color: '#2E7D32',
  },
  badgeTextPaused: {
    color: '#E65100',
  },
  sectionHeader: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.blue,
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  meterList: {
    gap: 12,
  },
  meterItem: {
    gap: 6,
  },
  meterTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  meterValue: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.soft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.blue,
    borderRadius: 4,
  },
  progressBarFull: {
    backgroundColor: colors.success,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  outlineBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 6,
  },
  outlineBtnText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
  },
  primaryBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 6,
  },
  primaryBtnText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  dangerBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 6,
  },
  dangerBtnText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  noSubCard: {
    gap: 16,
  },
  noSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noSubTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  noSubDesc: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 2,
  },
  plansList: {
    gap: 12,
  },
  planOptionCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.line,
    gap: 12,
  },
  planOptionSelected: {
    borderColor: colors.blue,
  },
  planOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  planOptionTitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  planOptionDesc: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  planOptionPrice: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: colors.blue,
  },
  textSelected: {
    color: colors.blue,
  },
  planBenefitsChipList: {
    gap: 6,
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitChipText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.ink,
  },
  subscribeBtn: {
    height: 44,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  subscribeBtnText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 1,
  },
});
