import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { fetchLoyaltyTransactions, manageLoyaltyPoints } from '@/features/viks-club/services/viks-club-service';
import type { LoyaltyTransaction, LoyaltyTransactionType } from '@/features/viks-club/types';

type Props = {
  visible: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
  onUpdated?: () => void;
};

export function LoyaltyPointsModal({ visible, clientId, clientName, onClose, onUpdated }: Props) {
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<LoyaltyTransactionType>('earn');
  const [points, setPoints] = useState('100');
  const [reason, setReason] = useState('Atendimento presencial');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const balance = transactions.reduce((acc, t) => {
    return acc + (t.type === 'earn' || t.type === 'adjustment' ? t.points : -t.points);
  }, 0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const txs = await fetchLoyaltyTransactions(clientId);
    setTransactions(txs);
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

  async function handleSubmit() {
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts <= 0) {
      setErrorMsg('Informe uma quantidade de pontos maior que zero.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Informe o motivo da transação.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const res = await manageLoyaltyPoints(clientId, mode, pts, reason.trim());
    setSubmitting(false);

    if (res.success) {
      loadData();
      onUpdated?.();
      setPoints('100');
      setReason(mode === 'earn' ? 'Atendimento presencial' : mode === 'redeem' ? 'Resgate de recompensa' : 'Ajuste administrativo');
    } else {
      setErrorMsg(res.error || 'Erro ao processar transação.');
    }
  }

  function formatDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>PONTOS DE FIDELIDADE VIKS</Text>
              <Text style={styles.clientName}>{clientName}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>SALDO ATUAL DE PONTOS</Text>
            <Text style={styles.balanceValue}>{balance.toLocaleString('pt-BR')} pts</Text>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>NOVA TRANSAÇÃO DE PONTOS</Text>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <View style={styles.typeRow}>
              <Pressable onPress={() => setMode('earn')} style={[styles.typeChip, mode === 'earn' && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, mode === 'earn' && styles.selectedText]}>GANHAR (+)</Text>
              </Pressable>
              <Pressable onPress={() => setMode('redeem')} style={[styles.typeChip, mode === 'redeem' && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, mode === 'redeem' && styles.selectedText]}>RESGATAR (-)</Text>
              </Pressable>
              <Pressable onPress={() => setMode('adjustment')} style={[styles.typeChip, mode === 'adjustment' && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, mode === 'adjustment' && styles.selectedText]}>AJUSTE</Text>
              </Pressable>
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>PONTOS</Text>
                <TextInput style={styles.input} value={points} onChangeText={setPoints} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.fieldLabel}>MOTIVO / DESCRIÇÃO</Text>
                <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Ex: Atendimento presencial" placeholderTextColor={colors.muted} />
              </View>
            </View>

            <Pressable onPress={handleSubmit} disabled={submitting} style={styles.submitBtn}>
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitBtnText}>REGISTRAR TRANSAÇÃO</Text>}
            </Pressable>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>EXTRATO AUDITÁVEL DE TRANSAÇÕES</Text>
            {loading ? (
              <ActivityIndicator color={colors.blue} style={{ marginVertical: 16 }} />
            ) : (
              <View style={styles.txList}>
                {transactions.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma transação registrada.</Text>
                ) : (
                  transactions.map((tx) => {
                    const isPositive = tx.type === 'earn' || tx.type === 'adjustment';
                    return (
                      <View key={tx.id} style={styles.txRow}>
                        <View style={styles.txCopy}>
                          <Text style={styles.txReason}>{tx.reason}</Text>
                          <Text style={styles.txDate}>{formatDate(tx.createdAt)} · {tx.type.toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.txPoints, isPositive ? styles.txEarn : styles.txRedeem]}>
                          {isPositive ? '+' : '-'}{tx.points} pts
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 540, maxHeight: '90%', backgroundColor: colors.paper, borderRadius: 8, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 12 },
  title: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.blue, letterSpacing: 1 },
  clientName: { fontFamily: fonts.sans, fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 2 },
  closeBtn: { padding: 4 },
  balanceBox: { backgroundColor: colors.ink, padding: 16, borderRadius: 6, alignItems: 'center', marginBottom: 16 },
  balanceLabel: { fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', color: colors.blue, letterSpacing: 1 },
  balanceValue: { fontFamily: fonts.sans, fontSize: 26, fontWeight: '900', color: colors.white, marginTop: 4 },
  content: { gap: 10, paddingBottom: 16 },
  sectionTitle: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', color: colors.blue, letterSpacing: 0.8 },
  errorText: { color: '#D32F2F', fontFamily: fonts.sans, fontSize: 11, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 6 },
  typeChip: { flex: 1, paddingVertical: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', borderRadius: 4 },
  typeChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  typeChipText: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', color: colors.ink },
  selectedText: { color: colors.white },
  formRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', color: colors.muted, marginTop: 4 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 8, fontFamily: fonts.sans, fontSize: 13, color: colors.ink, borderRadius: 4 },
  submitBtn: { backgroundColor: colors.blue, padding: 10, alignItems: 'center', borderRadius: 4, marginTop: 6 },
  submitBtnText: { color: colors.white, fontFamily: fonts.mono, fontSize: 10, fontWeight: '800' },
  txList: { gap: 6 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  txCopy: { flex: 1 },
  txReason: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '700', color: colors.ink },
  txDate: { fontFamily: fonts.mono, fontSize: 8, color: colors.muted, marginTop: 2 },
  txPoints: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '900' },
  txEarn: { color: '#2E7D32' },
  txRedeem: { color: '#D32F2F' },
});
