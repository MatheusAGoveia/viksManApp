import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { LabeledInput } from '../components/LabeledInput';
import { OptionChips } from '../components/OptionChips';
import { RuleItem } from '../components/RuleItem';
import { formatDay, formatTime } from '../helpers';
import { styles } from '../styles';
import type { Block, Option } from '../types';

type SettingsTabProps = {
  barberOptions: Option[];
  barberId: string;
  setBarberId: (id: string) => void;
  date: string;
  setDate: (value: string) => void;
  blockStart: string;
  setBlockStart: (value: string) => void;
  blockEnd: string;
  setBlockEnd: (value: string) => void;
  blockReason: string;
  setBlockReason: (value: string) => void;
  createBlock: () => void;
  ruleCancellation: string;
  setRuleCancellation: (value: string) => void;
  ruleBuffer: string;
  setRuleBuffer: (value: string) => void;
  ruleNotice: string;
  setRuleNotice: (value: string) => void;
  ruleWindow: string;
  setRuleWindow: (value: string) => void;
  pixKey: string;
  setPixKey: (value: string) => void;
  saveRules: () => void;
  blocks: Block[];
  canEditStoreSettings?: boolean;
  wide?: boolean;
};

export function SettingsTab({
  barberOptions,
  barberId,
  setBarberId,
  date,
  setDate,
  blockStart,
  setBlockStart,
  blockEnd,
  setBlockEnd,
  blockReason,
  setBlockReason,
  createBlock,
  ruleCancellation,
  setRuleCancellation,
  ruleBuffer,
  setRuleBuffer,
  ruleNotice,
  setRuleNotice,
  ruleWindow,
  setRuleWindow,
  pixKey,
  setPixKey,
  saveRules,
  blocks,
  canEditStoreSettings = true,
  wide,
}: SettingsTabProps) {
  return (
    <>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>OPERAÇÃO DA LOJA</Text>
          <Text style={styles.pageTitle}>Regras e bloqueios.</Text>
        </View>
      </View>

      <View style={[styles.operationGrid, wide && styles.operationGridWide]}>
        <View style={styles.operationCard}>
          <Text style={styles.cardTitle}>BLOQUEAR HORÁRIO</Text>
          <Text style={styles.cardHint}>Intervalo, folga, manutenção ou indisponibilidade.</Text>

          <OptionChips
            options={barberOptions.filter((item) => item.active !== false)}
            selected={barberId}
            onSelect={setBarberId}
          />

          <LabeledInput label="DATA" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" />

          <View style={styles.inputPair}>
            <LabeledInput label="INÍCIO" value={blockStart} onChangeText={setBlockStart} placeholder="12:00" />
            <LabeledInput label="FIM" value={blockEnd} onChangeText={setBlockEnd} placeholder="13:00" />
          </View>

          <LabeledInput label="MOTIVO" value={blockReason} onChangeText={setBlockReason} placeholder="Intervalo" />

          <Pressable onPress={createBlock} style={styles.operationButton}>
            <Text style={styles.operationButtonText}>SALVAR BLOQUEIO</Text>
          </Pressable>
        </View>

        {canEditStoreSettings ? (
          <View style={styles.operationCard}>
            <Text style={styles.cardTitle}>REGRAS COMERCIAIS (GERÊNCIA)</Text>

            <View style={styles.inputPair}>
              <LabeledInput label="CANCELAMENTO (H)" value={ruleCancellation} onChangeText={setRuleCancellation} placeholder="4" />
              <LabeledInput label="INTERVALO (MIN)" value={ruleBuffer} onChangeText={setRuleBuffer} placeholder="5" />
            </View>

            <View style={styles.inputPair}>
              <LabeledInput label="ANTECEDÊNCIA (MIN)" value={ruleNotice} onChangeText={setRuleNotice} placeholder="60" />
              <LabeledInput label="AGENDA ABERTA (DIAS)" value={ruleWindow} onChangeText={setRuleWindow} placeholder="60" />
            </View>

            <LabeledInput label="CHAVE PIX" value={pixKey} onChangeText={setPixKey} placeholder="Chave PIX da unidade" />

            <RuleItem label="Encaixes" value="Permitidos" />
            <RuleItem label="Primeiro disponível" value="Menor horário livre" />

            <Pressable onPress={saveRules} style={styles.operationButton}>
              <Text style={styles.operationButtonText}>SALVAR REGRAS</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={styles.subheading}>PRÓXIMOS BLOQUEIOS</Text>
      <View style={styles.blockList}>
        {blocks.length ? (
          blocks.map((block) => (
            <View key={block.id} style={styles.blockRow}>
              <View style={styles.blockIcon}>
                <Ionicons name="remove-circle-outline" color={colors.danger} size={19} />
              </View>
              <View style={styles.blockCopy}>
                <Text style={styles.blockTitle}>{block.reason}</Text>
                <Text style={styles.blockMeta}>
                  {block.barberName} · {formatDay(block.startsAt)} · {formatTime(block.startsAt)}–{formatTime(block.endsAt)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhum bloqueio futuro.</Text>
        )}
      </View>
    </>
  );
}
