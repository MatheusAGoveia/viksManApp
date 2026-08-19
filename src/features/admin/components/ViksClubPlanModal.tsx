import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { fetchViksClubPlans, saveViksClubPlan } from '@/features/viks-club/services/viks-club-service';
import type { BenefitType, BillingPeriod, ViksClubPlan } from '@/features/viks-club/types';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ViksClubPlanModal({ visible, onClose }: Props) {
  const [plans, setPlans] = useState<ViksClubPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ViksClubPlan | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [cutQty, setCutQty] = useState('2');
  const [beardQty, setBeardQty] = useState('1');
  const [productDiscount, setProductDiscount] = useState('10');
  const [allowedDays, setAllowedDays] = useState<('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')[]>([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadPlans();
    }
  }, [visible]);

  async function loadPlans() {
    setLoading(true);
    const data = await fetchViksClubPlans();
    setPlans(data);
    setLoading(false);
  }

  function startCreate() {
    setEditingPlan({
      id: '',
      name: '',
      description: '',
      price: 99,
      priceCents: 9900,
      billingPeriod: 'monthly',
      active: true,
      benefits: [],
    });
    setName('');
    setDescription('');
    setPrice('99');
    setBillingPeriod('monthly');
    setCutQty('2');
    setBeardQty('1');
    setProductDiscount('10');
    setAllowedDays(['monday', 'tuesday', 'wednesday', 'thursday']);
    setErrorMsg(null);
  }

  function startEdit(plan: ViksClubPlan) {
    setEditingPlan(plan);
    setName(plan.name);
    setDescription(plan.description || '');
    setPrice(String(plan.price));
    setBillingPeriod(plan.billingPeriod);

    const cutB = plan.benefits?.find((b) => b.serviceId === 'cut');
    const beardB = plan.benefits?.find((b) => b.serviceId === 'beard');
    const prodB = plan.benefits?.find((b) => b.benefitType === 'product_discount');

    setCutQty(cutB ? String(cutB.quantity) : '0');
    setBeardQty(beardB ? String(beardB.quantity) : '0');
    setProductDiscount(prodB ? String(prodB.discountPercent ?? 0) : '0');
    setAllowedDays(plan.allowedDays as any ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
    setErrorMsg(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setErrorMsg('Informe o nome do plano.');
      return;
    }
    const numPrice = Number(price.replace(',', '.'));
    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMsg('Preço inválido.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const benefitsToSave: {
      benefitType: BenefitType;
      serviceId?: string;
      quantity: number;
      discountPercent?: number;
      description?: string;
    }[] = [];

    const cuts = parseInt(cutQty, 10);
    if (cuts > 0) {
      benefitsToSave.push({
        benefitType: 'service_credit',
        serviceId: 'cut',
        quantity: cuts,
        description: `${cuts} Corte${cuts > 1 ? 's' : ''} por mês`,
      });
    }

    const beards = parseInt(beardQty, 10);
    if (beards > 0) {
      benefitsToSave.push({
        benefitType: 'service_credit',
        serviceId: 'beard',
        quantity: beards,
        description: `${beards} Barba${beards > 1 ? 's' : ''} por mês`,
      });
    }

    const prodDisc = parseFloat(productDiscount);
    if (prodDisc > 0) {
      benefitsToSave.push({
        benefitType: 'product_discount',
        serviceId: undefined,
        quantity: 0,
        discountPercent: prodDisc,
        description: `${prodDisc}% de desconto em produtos`,
      });
    }

    const res = await saveViksClubPlan({
      id: editingPlan?.id || undefined,
      name: name.trim(),
      description: description.trim() || undefined,
      priceCents: Math.round(numPrice * 100),
      billingPeriod,
      allowedDays: allowedDays as any,
      active: editingPlan?.active !== undefined ? editingPlan.active : true,
      benefits: benefitsToSave,
    });

    setSaving(false);
    if (res.success) {
      setEditingPlan(null);
      loadPlans();
    } else {
      setErrorMsg(res.error || 'Erro ao salvar o plano.');
    }
  }

  async function toggleActive(plan: ViksClubPlan) {
    await saveViksClubPlan({
      id: plan.id,
      name: plan.name,
      description: plan.description || undefined,
      priceCents: plan.priceCents || Math.round(plan.price * 100),
      billingPeriod: plan.billingPeriod,
      active: !plan.active,
      benefits: (plan.benefits || []).map((b) => ({
        benefitType: b.benefitType,
        serviceId: b.serviceId || undefined,
        quantity: b.quantity,
        discountPercent: b.discountPercent,
        description: b.description || undefined,
      })),
    });
    loadPlans();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>GERENCIAR PLANOS VIKS CLUB</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          {editingPlan ? (
            <ScrollView contentContainerStyle={styles.formContent}>
              <Text style={styles.formTitle}>{editingPlan.id ? 'EDITAR PLANO' : 'NOVO PLANO'}</Text>
              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

              <Text style={styles.fieldLabel}>NOME DO PLANO</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Viks Club Premium" placeholderTextColor={colors.muted} />

              <Text style={styles.fieldLabel}>DESCRIÇÃO</Text>
              <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Descrição comercial..." placeholderTextColor={colors.muted} />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>PREÇO (R$)</Text>
                  <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="149,90" placeholderTextColor={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>PERÍODO</Text>
                  <View style={styles.periodRow}>
                    <Pressable onPress={() => setBillingPeriod('monthly')} style={[styles.periodChip, billingPeriod === 'monthly' && styles.periodChipActive]}>
                      <Text style={[styles.periodChipText, billingPeriod === 'monthly' && styles.selectedText]}>MENSAL</Text>
                    </Pressable>
                    <Pressable onPress={() => setBillingPeriod('yearly')} style={[styles.periodChip, billingPeriod === 'yearly' && styles.periodChipActive]}>
                      <Text style={[styles.periodChipText, billingPeriod === 'yearly' && styles.selectedText]}>ANUAL</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionHeader}>BENEFÍCIOS INCLUÍDOS</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>CORTES POR MÊS</Text>
                  <TextInput style={styles.input} value={cutQty} onChangeText={setCutQty} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>BARBAS POR MÊS</Text>
                  <TextInput style={styles.input} value={beardQty} onChangeText={setBeardQty} keyboardType="number-pad" />
                </View>
              </View>

              <Text style={styles.fieldLabel}>DESCONTO EM PRODUTOS (%)</Text>
              <TextInput style={styles.input} value={productDiscount} onChangeText={setProductDiscount} keyboardType="numeric" placeholder="10" placeholderTextColor={colors.muted} />

              <Text style={styles.sectionHeader}>DIAS PERMITIDOS PARA AGENDAMENTO</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[
                  { key: 'monday', label: 'Seg' },
                  { key: 'tuesday', label: 'Ter' },
                  { key: 'wednesday', label: 'Qua' },
                  { key: 'thursday', label: 'Qui' },
                  { key: 'friday', label: 'Sex' },
                  { key: 'saturday', label: 'Sáb' },
                ].map((item) => {
                  const isChecked = allowedDays.includes(item.key as any);
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        if (isChecked) {
                          if (allowedDays.length <= 1) return;
                          setAllowedDays(allowedDays.filter((d) => d !== item.key));
                        } else {
                          setAllowedDays([...allowedDays, item.key as any]);
                        }
                      }}
                      style={[
                        {
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: colors.line,
                          backgroundColor: colors.white,
                        },
                        isChecked && { backgroundColor: colors.blue, borderColor: colors.blue },
                      ]}
                    >
                      <Text style={[{ fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.ink }, isChecked && { color: colors.white }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formActions}>
                <Pressable onPress={() => setEditingPlan(null)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>VOLTAR</Text>
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
                  {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>SALVAR PLANO</Text>}
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <Pressable onPress={startCreate} style={styles.createBtn}>
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.createBtnText}>CRIAR NOVO PLANO</Text>
              </Pressable>

              {loading ? (
                <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
              ) : (
                <ScrollView contentContainerStyle={styles.planList}>
                  {plans.map((plan) => (
                    <View key={plan.id} style={[styles.planCard, !plan.active && styles.planInactive]}>
                      <View style={styles.planTop}>
                        <View>
                          <Text style={styles.planName}>{plan.name}</Text>
                          <Text style={styles.planPrice}>R$ {plan.price.toFixed(2)} / {plan.billingPeriod === 'monthly' ? 'mês' : 'ano'}</Text>
                        </View>
                        <Pressable onPress={() => toggleActive(plan)} style={[styles.statusBadge, plan.active ? styles.statusActive : styles.statusOff]}>
                          <Text style={styles.statusBadgeText}>{plan.active ? 'ATIVO' : 'INATIVO'}</Text>
                        </Pressable>
                      </View>

                      {plan.description ? <Text style={styles.planSub}>{plan.description}</Text> : null}

                      <View style={styles.benefitsBox}>
                        {(plan.benefits || []).map((b) => (
                          <Text key={b.id} style={styles.benefitItem}>• {b.description}</Text>
                        ))}
                      </View>

                      <Pressable onPress={() => startEdit(plan)} style={styles.editBtn}>
                        <Ionicons name="create-outline" size={14} color={colors.blue} />
                        <Text style={styles.editBtnText}>EDITAR PLANO</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: colors.paper, borderRadius: 8, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 12 },
  title: { fontFamily: fonts.sans, fontSize: 16, fontWeight: '800', color: colors.ink },
  closeBtn: { padding: 4 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.blue, padding: 12, borderRadius: 6, marginBottom: 16 },
  createBtnText: { color: colors.white, fontFamily: fonts.mono, fontSize: 11, fontWeight: '800' },
  planList: { gap: 12, paddingBottom: 16 },
  planCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 6 },
  planInactive: { opacity: 0.6, backgroundColor: colors.paper },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: { fontFamily: fonts.sans, fontSize: 16, fontWeight: '800', color: colors.ink },
  planPrice: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', color: colors.blue, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusActive: { backgroundColor: '#E1F5FE' },
  statusOff: { backgroundColor: colors.line },
  statusBadgeText: { fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', color: colors.ink },
  planSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 6 },
  benefitsBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, gap: 4 },
  benefitItem: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  editBtnText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.blue },
  formContent: { gap: 12, paddingBottom: 20 },
  formTitle: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '800', color: colors.blue, marginBottom: 4 },
  errorText: { color: '#D32F2F', fontFamily: fonts.sans, fontSize: 11, fontWeight: '700' },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', color: colors.muted, letterSpacing: 0.8, marginTop: 4 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 10, fontFamily: fonts.sans, fontSize: 13, color: colors.ink, borderRadius: 4 },
  row: { flexDirection: 'row', gap: 10 },
  periodRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  periodChip: { flex: 1, paddingVertical: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', borderRadius: 4 },
  periodChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  periodChipText: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', color: colors.ink },
  selectedText: { color: colors.white },
  sectionHeader: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.blue, marginTop: 12, letterSpacing: 1 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', borderRadius: 4 },
  cancelBtnText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.ink },
  saveBtn: { flex: 1, padding: 12, backgroundColor: colors.blue, alignItems: 'center', borderRadius: 4 },
  saveBtnText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.white },
});
