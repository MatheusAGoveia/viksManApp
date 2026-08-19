import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';
import { LabeledInput } from '../components/LabeledInput';
import { OptionChips } from '../components/OptionChips';
import { styles } from '../styles';
import type { Promotion } from '../types';

type MarketingTabProps = {
  promoTitle: string;
  setPromoTitle: (value: string) => void;
  promoDiscount: string;
  setPromoDiscount: (value: string) => void;
  promoMessage: string;
  setPromoMessage: (value: string) => void;
  promoAudience: string;
  setPromoAudience: (value: string) => void;
  promoSendAt: string;
  setPromoSendAt: (value: string) => void;
  promoEndsAt: string;
  setPromoEndsAt: (value: string) => void;
  saving: boolean;
  createPromotion: () => void;
  promotions: Promotion[];
  cancelPromotion: (id: string) => void;
  wide?: boolean;
};

const audienceOptions = [
  { id: 'all', slug: 'all', name: 'Todos autorizados' },
  { id: 'inactive_30d', slug: 'inactive_30d', name: 'Inativos 30 dias' },
  { id: 'inactive_60d', slug: 'inactive_60d', name: 'Inativos 60 dias' },
  { id: 'birthday_month', slug: 'birthday_month', name: 'Aniversariantes' },
];

export function MarketingTab({
  promoTitle,
  setPromoTitle,
  promoDiscount,
  setPromoDiscount,
  promoMessage,
  setPromoMessage,
  promoAudience,
  setPromoAudience,
  promoSendAt,
  setPromoSendAt,
  promoEndsAt,
  setPromoEndsAt,
  saving,
  createPromotion,
  promotions,
  cancelPromotion,
  wide,
}: MarketingTabProps) {
  return (
    <>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>AUTOMAÇÃO DE MARKETING</Text>
          <Text style={styles.pageTitle}>Promoções no WhatsApp.</Text>
        </View>
      </View>

      <View style={[styles.promoLayout, wide && styles.promoLayoutWide]}>
        <View style={styles.promoForm}>
          <Text style={styles.cardTitle}>NOVA CAMPANHA</Text>
          <Text style={styles.cardHint}>Sem SMS. O disparo usa WhatsApp e respeita os consentimentos do cliente.</Text>
          <LabeledInput label="TÍTULO" value={promoTitle} onChangeText={setPromoTitle} placeholder="Semana do corte" />
          <LabeledInput label="DESTAQUE" value={promoDiscount} onChangeText={setPromoDiscount} placeholder="Ex.: 10% OFF" />

          <Text style={styles.inputLabel}>MENSAGEM</Text>
          <TextInput
            multiline
            value={promoMessage}
            onChangeText={setPromoMessage}
            placeholder="Conte a promoção e inclua como agendar."
            placeholderTextColor="#9A9B96"
            style={styles.messageInput}
          />

          <Text style={styles.inputLabel}>PÚBLICO</Text>
          <OptionChips options={audienceOptions} selected={promoAudience} onSelect={setPromoAudience} />

          <View style={styles.inputPair}>
            <LabeledInput label="ENVIAR EM" value={promoSendAt} onChangeText={setPromoSendAt} placeholder="AAAA-MM-DD HH:MM" />
            <LabeledInput label="VÁLIDA ATÉ" value={promoEndsAt} onChangeText={setPromoEndsAt} placeholder="AAAA-MM-DD HH:MM" />
          </View>

          <Pressable disabled={saving} onPress={createPromotion} style={styles.editorSave}>
            <Text style={styles.editorSaveText}>AGENDAR NO WHATSAPP</Text>
            <Ionicons name="logo-whatsapp" color={colors.white} size={18} />
          </Pressable>
        </View>

        <View style={styles.promoHistory}>
          <Text style={styles.cardTitle}>CAMPANHAS</Text>
          {promotions.length ? (
            promotions.map((promo) => (
              <View key={promo.id} style={styles.promoRow}>
                <View style={styles.promoTop}>
                  <Text style={styles.promoTitle}>{promo.title}</Text>
                  <Text style={styles.promoStatus}>{promo.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.promoMessage}>{promo.message}</Text>
                <Text style={styles.catalogMeta}>
                  {promo.audience} · {new Date(promo.sendAt).toLocaleString('pt-BR')}
                </Text>
                {['draft', 'scheduled'].includes(promo.status) ? (
                  <Pressable onPress={() => cancelPromotion(promo.id)} style={styles.cancelPromo}>
                    <Text style={styles.smallDanger}>CANCELAR CAMPANHA</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhuma campanha criada.</Text>
          )}
        </View>
      </View>
    </>
  );
}
