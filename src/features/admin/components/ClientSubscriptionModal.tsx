import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { barbers } from '@/data/catalog';
import {
  activateSubscription,
  fetchClientSubscription,
  fetchViksClubPlans,
  renewSubscription,
  updateSubscriptionStatus,
} from '@/features/viks-club/services/viks-club-service';
import type { SubscriptionStatus, ViksClubPlan, ViksClubSubscription } from '@/features/viks-club/types';

type Props = {
  visible: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
  onUpdated?: () => void;
};

export function ClientSubscriptionModal({ visible, clientId, clientName, onClose, onUpdated }: Props) {
  const [subscription, setSubscription] = useState<ViksClubSubscription | null>(null);
  const [plans, setPlans] = useState<ViksClubPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedBarberId, setSelectedBarberId] = useState<string>(barbers[0]?.id || 'victor');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const [sub, availablePlans] = await Promise.all([
      fetchClientSubscription(clientId),
      fetchViksClubPlans(),
    ]);
    setSubscription(sub);
    setPlans(availablePlans.filter((p) => p.active));
    if (availablePlans.length > 0) {
      setSelectedPlanId(availablePlans[0].id);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (visible && clientId) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [clientId, loadData, visible]);

  async function handleActivate() {
    if (!selectedPlanId) {
      setErrorMsg('Selecione um plano.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    const res = await activateSubscription(clientId, selectedPlanId, 1, undefined, selectedBarberId);
    setSubmitting(false);
    if (res.success) {
      loadData();
      onUpdated?.();
    } else {
      setErrorMsg(res.error || 'Erro ao ativar assinatura.');
    }
  }

  async function handleRenew() {
    if (!subscription) return;
    setSubmitting(true);
    setErrorMsg(null);
    const res = await renewSubscription(subscription.id, clientId, 1);
    setSubmitting(false);
    if (res.success) {
      loadData();
      onUpdated?.();
    } else {
      setErrorMsg(res.error || 'Erro ao renovar assinatura.');
    }
  }

  async function handleStatusChange(newStatus: SubscriptionStatus) {
    if (!subscription) return;
    setSubmitting(true);
    setErrorMsg(null);
    const res = await updateSubscriptionStatus(subscription.id, clientId, newStatus);
    setSubmitting(false);
    if (res.success) {
      loadData();
      onUpdated?.();
    } else {
      setErrorMsg(res.error || 'Erro ao alterar status.');
    }
  }

  function formatDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>VIKS CLUB — ASSINATURA</Text>
              <Text style={styles.clientName}>{clientName}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.blue} style={{ marginVertical: 32 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

              {subscription ? (
                <View style={styles.subBox}>
                  <View style={styles.subHeader}>
                    <View>
                      <Text style={styles.planTitle}>{subscription.planName || 'Viks Club'}</Text>
                      <Text style={styles.subPeriod}>Período: {formatDate(subscription.currentPeriodStart)} → {formatDate(subscription.currentPeriodEnd)}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        subscription.status === 'active'
                          ? styles.status_active
                          : subscription.status === 'paused'
                            ? styles.status_paused
                            : subscription.status === 'canceled'
                              ? styles.status_canceled
                              : styles.status_expired,
                      ]}
                    >
                      <Text style={styles.statusText}>{subscription.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={styles.benefitsHeader}>BENEFÍCIOS DO PERÍODO ATUAL</Text>
                  <View style={styles.benefitsList}>
                    {(subscription.benefits || []).map((b) => {
                      const avail = Math.max(0, b.quantityGranted - b.quantityUsed);
                      const name = b.serviceId === 'cut' ? 'Corte' : b.serviceId === 'beard' ? 'Barba' : b.benefitType === 'product_discount' ? 'Desconto Produtos' : 'Benefício';
                      return (
                        <View key={b.id} style={styles.benefitRow}>
                          <Text style={styles.benefitName}>{name}</Text>
                          <Text style={styles.benefitCount}>{b.quantityUsed} de {b.quantityGranted} utilizado ({avail} disponível)</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.actionGrid}>
                    <Pressable onPress={handleRenew} disabled={submitting} style={styles.actionBtnPrimary}>
                      <Ionicons name="refresh-outline" size={14} color={colors.white} />
                      <Text style={styles.actionBtnPrimaryText}>RENOVAR (+1 MÊS)</Text>
                    </Pressable>

                    {subscription.status === 'active' ? (
                      <Pressable onPress={() => handleStatusChange('paused')} disabled={submitting} style={styles.actionBtnSecondary}>
                        <Text style={styles.actionBtnSecText}>PAUSAR</Text>
                      </Pressable>
                    ) : subscription.status === 'paused' ? (
                      <Pressable onPress={() => handleStatusChange('active')} disabled={submitting} style={styles.actionBtnSecondary}>
                        <Text style={styles.actionBtnSecText}>REATIVAR</Text>
                      </Pressable>
                    ) : null}

                    {subscription.status !== 'canceled' ? (
                      <Pressable onPress={() => handleStatusChange('canceled')} disabled={submitting} style={styles.actionBtnDanger}>
                        <Text style={styles.actionBtnDangerText}>CANCELAR ASSINATURA</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.noSubBox}>
                  <Text style={styles.noSubText}>Este cliente não possui uma assinatura ativa.</Text>
                  <Text style={styles.fieldLabel}>SELECIONAR PLANO:</Text>
                  <View style={styles.planSelector}>
                    {plans.map((p) => {
                      const isSelected = p.id === selectedPlanId;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setSelectedPlanId(p.id)}
                          style={[styles.planChip, isSelected && styles.planChipActive]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.planChipName, isSelected && styles.selectedText]}>{p.name}</Text>
                          </View>
                          <Text style={[styles.planChipPrice, isSelected && styles.selectedMuted]}>
                            R$ {p.price.toFixed(2).replace('.', ',')} / mês
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>BARBEIRO VINCULADO AO PLANO:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {barbers.map((b) => {
                  const isSel = selectedBarberId === b.id;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => setSelectedBarberId(b.id)}
                      style={[
                        {
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderWidth: 1,
                          borderColor: colors.line,
                          backgroundColor: colors.paper,
                          borderRadius: 4,
                        },
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

                  <Pressable onPress={handleActivate} disabled={submitting} style={styles.activateBtn}>
                    {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.activateBtnText}>ATIVAR ASSINATURA</Text>}
                  </Pressable>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: colors.paper, borderRadius: 8, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 12 },
  title: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.blue, letterSpacing: 1 },
  clientName: { fontFamily: fonts.sans, fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 2 },
  closeBtn: { padding: 4 },
  content: { gap: 14, paddingBottom: 16 },
  errorText: { color: '#D32F2F', fontFamily: fonts.sans, fontSize: 11, fontWeight: '700' },
  subBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 6 },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planTitle: { fontFamily: fonts.sans, fontSize: 16, fontWeight: '800', color: colors.ink },
  subPeriod: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  status_active: { backgroundColor: '#E8F5E9' },
  status_paused: { backgroundColor: '#FFF3E0' },
  status_canceled: { backgroundColor: '#FFEBEE' },
  status_expired: { backgroundColor: colors.line },
  statusText: { fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', color: colors.ink },
  benefitsHeader: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', color: colors.blue, letterSpacing: 0.8, marginTop: 8, marginBottom: 8 },
  benefitsList: { gap: 6 },
  benefitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  benefitName: { fontFamily: fonts.sans, fontSize: 13, fontWeight: '700', color: colors.ink },
  benefitCount: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  actionGrid: { gap: 8, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.blue, padding: 12, borderRadius: 4 },
  actionBtnPrimaryText: { color: colors.white, fontFamily: fonts.mono, fontSize: 10, fontWeight: '800' },
  actionBtnSecondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, padding: 10, alignItems: 'center', borderRadius: 4 },
  actionBtnSecText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.ink },
  actionBtnDanger: { backgroundColor: '#FFEBEE', padding: 10, alignItems: 'center', borderRadius: 4 },
  actionBtnDangerText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: '#D32F2F' },
  noSubBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 6, gap: 12 },
  noSubText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', color: colors.muted, letterSpacing: 0.8 },
  planSelector: { gap: 8 },
  planChip: { padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  planChipName: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '800', color: colors.ink },
  planChipPrice: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  selectedText: { color: colors.white },
  selectedMuted: { color: '#E3F2FD' },
  activateBtn: { backgroundColor: colors.blue, padding: 12, alignItems: 'center', borderRadius: 4, marginTop: 8 },
  activateBtnText: { color: colors.white, fontFamily: fonts.mono, fontSize: 10, fontWeight: '800' },
});
