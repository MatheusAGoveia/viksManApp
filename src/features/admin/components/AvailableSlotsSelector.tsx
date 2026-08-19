import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { styles } from '../styles';

type AvailableSlotsSelectorProps = {
  time: string;
  availableTimeSlots: string[];
  loading: boolean;
  error: string;
  hasRequiredSelection: boolean;
  onSelectTime: (timeStr: string) => void;
  onRetry?: () => void;
};

export function AvailableSlotsSelector({
  time,
  availableTimeSlots,
  loading,
  error,
  hasRequiredSelection,
  onSelectTime,
  onRetry,
}: AvailableSlotsSelectorProps) {
  return (
    <View style={styles.slotsSelectorWrapper}>
      <Text style={styles.inputLabel}>HORÁRIOS DISPONÍVEIS</Text>

      {!hasRequiredSelection ? (
        <View style={styles.slotsStateBox}>
          <Ionicons name="information-circle-outline" color={colors.muted} size={18} />
          <Text style={styles.slotsStateText}>
            Selecione serviço, profissional e data para visualizar os horários.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.slotsStateBox}>
          <ActivityIndicator size="small" color={colors.blue} />
          <Text style={styles.slotsStateText}>Buscando horários disponíveis…</Text>
        </View>
      ) : error ? (
        <View style={[styles.slotsStateBox, styles.slotsErrorBox]}>
          <Ionicons name="alert-circle-outline" color={colors.danger} size={18} />
          <Text style={[styles.slotsStateText, styles.slotsErrorText]}>{error}</Text>
          {onRetry && (
            <Pressable onPress={onRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>TENTAR NOVAMENTE</Text>
            </Pressable>
          )}
        </View>
      ) : availableTimeSlots.length === 0 ? (
        <View style={styles.slotsStateBox}>
          <Ionicons name="calendar-outline" color={colors.muted} size={18} />
          <Text style={styles.slotsStateText}>Nenhum horário disponível nesta data.</Text>
        </View>
      ) : (
        <View style={styles.slotsGrid}>
          {availableTimeSlots.map((slot) => {
            const selected = time === slot;
            return (
              <Pressable
                key={slot}
                onPress={() => onSelectTime(slot)}
                style={[styles.slotChip, selected && styles.slotChipSelected]}
              >
                <Text style={[styles.slotChipText, selected && styles.slotChipTextSelected]}>
                  {slot}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
