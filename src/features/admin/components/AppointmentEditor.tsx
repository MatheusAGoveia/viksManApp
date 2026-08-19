import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { styles } from '../styles';
import type { Client, Option } from '../types';
import { ClientSearchAutocomplete } from './ClientSearchAutocomplete';
import { DateTimePickerSelectors } from './DateTimePickerSelectors';
import { OptionChips } from './OptionChips';

type AppointmentEditorProps = {
  clients: Client[];
  selectedClient?: Client | null;
  services: Option[];
  barbers: Option[];
  clientId: string;
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
  editing: boolean;
  saving: boolean;
  availableTimeSlots: string[];
  slotsLoading: boolean;
  slotsError: string;
  onSelectClient: (client: Client) => void;
  onClearClient: () => void;
  setServiceId: (id: string) => void;
  setBarberId: (id: string) => void;
  setDate: (value: string) => void;
  setTime: (value: string) => void;
  onRetrySlots?: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function AppointmentEditor({
  clients,
  selectedClient,
  services,
  barbers,
  clientId,
  serviceId,
  barberId,
  date,
  time,
  editing,
  saving,
  availableTimeSlots,
  slotsLoading,
  slotsError,
  onSelectClient,
  onClearClient,
  setServiceId,
  setBarberId,
  setDate,
  setTime,
  onRetrySlots,
  onCancel,
  onSave,
}: AppointmentEditorProps) {
  const hasRequiredSelection = Boolean(serviceId && barberId && date);

  return (
    <View style={styles.editor}>
      <View style={styles.editorHead}>
        <View>
          <Text style={styles.cardTitle}>{editing ? 'REAGENDAR ATENDIMENTO' : 'NOVO ATENDIMENTO'}</Text>
          <Text style={styles.cardHint}>A restrição do banco impede conflito de horários.</Text>
        </View>
        <Pressable accessibilityLabel="Fechar editor" hitSlop={12} onPress={onCancel}>
          <Ionicons name="close" color={colors.ink} size={20} />
        </Pressable>
      </View>

      <Text style={styles.inputLabel}>CLIENTE</Text>
      <ClientSearchAutocomplete
        selectedClientId={clientId}
        selectedClient={selectedClient}
        onSelectClient={onSelectClient}
        onClearClient={onClearClient}
        demoClients={clients}
      />

      <Text style={styles.inputLabel}>SERVIÇO</Text>
      <OptionChips options={services} selected={serviceId} onSelect={setServiceId} />

      <Text style={styles.inputLabel}>PROFISSIONAL</Text>
      <OptionChips options={barbers} selected={barberId} onSelect={setBarberId} />

      <DateTimePickerSelectors
        date={date}
        time={time}
        onSelectDate={setDate}
        onSelectTime={setTime}
        availableTimeSlots={availableTimeSlots}
        slotsLoading={slotsLoading}
        slotsError={slotsError}
        hasRequiredSelection={hasRequiredSelection}
        onRetrySlots={onRetrySlots}
      />

      <Pressable disabled={saving} onPress={onSave} style={styles.editorSave}>
        <Text style={styles.editorSaveText}>
          {saving ? 'SALVANDO…' : editing ? 'CONFIRMAR NOVO HORÁRIO' : 'CRIAR ATENDIMENTO'}
        </Text>
        <Ionicons name="arrow-forward" color={colors.white} size={17} />
      </Pressable>
    </View>
  );
}
