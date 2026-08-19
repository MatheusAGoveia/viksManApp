import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatCurrency } from '@/data/catalog';
import { formatDay, formatTime } from '../helpers';
import { styles } from '../styles';
import type { AdminAppointment } from '../types';

type AppointmentRowProps = {
  item: AdminAppointment;
  onPaid: () => void;
  onReschedule: () => void;
  onStatus: (status: 'cancelled' | 'completed' | 'no_show') => void;
};

const statusLabel: Record<string, string> = {
  confirmed: 'CONFIRMADO',
  checked_in: 'CHEGOU',
  in_service: 'EM ATENDIMENTO',
  completed: 'CONCLUÍDO',
  cancelled: 'CANCELADO',
  no_show: 'NÃO COMPARECEU',
};

export function AppointmentRow({ item, onPaid, onReschedule, onStatus }: AppointmentRowProps) {
  const inactive = ['cancelled', 'completed', 'no_show'].includes(item.status);

  return (
    <View style={[styles.appointment, inactive && styles.appointmentInactive]}>
      <View style={styles.appointmentTime}>
        <Text style={styles.appointmentTimeText}>{formatTime(item.startsAt)}</Text>
        <Text style={styles.appointmentDay}>{formatDay(item.startsAt)}</Text>
      </View>
      <View style={styles.appointmentCopy}>
        <View style={styles.appointmentTop}>
          <Text style={styles.appointmentClient}>{item.clientName}</Text>
          <Text style={styles.appointmentStatus}>{statusLabel[item.status] ?? item.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.appointmentMeta}>
          {item.serviceName} · {item.duration * item.partySize} min · {item.barberName} · {item.partySize}{' '}
          {item.partySize === 1 ? 'pessoa' : 'pessoas'}
        </Text>
        <Text style={styles.paymentMeta}>
          {formatCurrency(item.totalCents / 100)} ·{' '}
          {item.paymentStatus === 'paid' ? 'PAGO' : item.paymentStatus === 'partial' ? 'PAGAMENTO PARCIAL' : 'PENDENTE'}
        </Text>
        {!inactive ? (
          <View style={styles.appointmentActions}>
            {item.paymentStatus !== 'paid' ? (
              <Pressable onPress={onPaid} style={styles.paidButton}>
                <Ionicons name="logo-usd" color={colors.success} size={14} />
                <Text style={styles.paidText}>MARCAR PIX PAGO</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onReschedule} style={styles.smallActionButton}>
              <Text style={styles.smallAction}>REAGENDAR</Text>
            </Pressable>
            <Pressable onPress={() => onStatus('completed')} style={styles.smallActionButton}>
              <Text style={styles.smallAction}>CONCLUIR</Text>
            </Pressable>
            <Pressable onPress={() => onStatus('no_show')} style={styles.smallActionButton}>
              <Text style={styles.smallAction}>NO-SHOW</Text>
            </Pressable>
            <Pressable onPress={() => onStatus('cancelled')} style={styles.smallActionButton}>
              <Text style={styles.smallDanger}>CANCELAR</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
