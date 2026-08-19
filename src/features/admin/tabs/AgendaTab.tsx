import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { AppointmentEditor } from '../components/AppointmentEditor';
import { AppointmentRow } from '../components/AppointmentRow';
import { SummaryCard } from '../components/SummaryCard';
import { formatDay } from '../helpers';
import { styles } from '../styles';
import type { AdminAppointment, CalendarMode, Client, Option } from '../types';

type AgendaTabProps = {
  mode: CalendarMode;
  anchorDate: string;
  visibleAppointments: AdminAppointment[];
  occupancy: number;
  showEditor: boolean;
  editingId?: string;
  clients: Client[];
  selectedClient?: Client | null;
  serviceOptions: Option[];
  barberOptions: Option[];
  clientId: string;
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
  saving: boolean;
  setMode: (mode: CalendarMode) => void;
  moveDate: (direction: number) => void;
  openCreate: () => void;
  onSelectClient: (client: Client) => void;
  onClearClient: () => void;
  setServiceId: (id: string) => void;
  setBarberId: (id: string) => void;
  setDate: (value: string) => void;
  setTime: (value: string) => void;
  setShowEditor: (show: boolean) => void;
  saveAppointment: () => void;
  markPaid: (item: AdminAppointment) => void;
  openReschedule: (item: AdminAppointment) => void;
  changeStatus: (item: AdminAppointment, status: 'cancelled' | 'completed' | 'no_show') => void;
  wide?: boolean;
};

export function AgendaTab({
  mode,
  anchorDate,
  visibleAppointments,
  occupancy,
  showEditor,
  editingId,
  clients,
  selectedClient,
  serviceOptions,
  barberOptions,
  clientId,
  serviceId,
  barberId,
  date,
  time,
  saving,
  setMode,
  moveDate,
  openCreate,
  onSelectClient,
  onClearClient,
  setServiceId,
  setBarberId,
  setDate,
  setTime,
  setShowEditor,
  saveAppointment,
  markPaid,
  openReschedule,
  changeStatus,
  wide,
}: AgendaTabProps) {
  return (
    <>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>AGENDA ADMINISTRATIVA</Text>
          <Text style={styles.pageTitle}>{mode === 'day' ? 'Hoje na Viks.' : 'Visão da semana.'}</Text>
        </View>
        <Pressable onPress={() => openCreate()} style={styles.createButton}>
          <Ionicons name="add" color={colors.white} size={18} />
          <Text style={styles.createText}>NOVO ATENDIMENTO</Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.segment}>
          <Pressable onPress={() => setMode('day')} style={[styles.segmentItem, mode === 'day' && styles.segmentActive]}>
            <Text style={[styles.segmentText, mode === 'day' && styles.segmentTextActive]}>DIA</Text>
          </Pressable>
          <Pressable onPress={() => setMode('week')} style={[styles.segmentItem, mode === 'week' && styles.segmentActive]}>
            <Text style={[styles.segmentText, mode === 'week' && styles.segmentTextActive]}>SEMANA</Text>
          </Pressable>
        </View>
        <View style={styles.dateNav}>
          <Pressable accessibilityLabel="Dia anterior" hitSlop={12} onPress={() => moveDate(-1)}>
            <Ionicons name="chevron-back" color={colors.ink} size={19} />
          </Pressable>
          <Text style={styles.dateNavText}>{formatDay(`${anchorDate}T12:00:00`)}</Text>
          <Pressable accessibilityLabel="Próximo dia" hitSlop={12} onPress={() => moveDate(1)}>
            <Ionicons name="chevron-forward" color={colors.ink} size={19} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.summaryGrid, wide && styles.summaryGridWide]}>
        <SummaryCard value={String(visibleAppointments.length).padStart(2, '0')} label="ATENDIMENTOS" />
        <SummaryCard value={`${occupancy}%`} label="OCUPAÇÃO" />
        <SummaryCard
          value={String(visibleAppointments.filter((item) => item.status === 'confirmed').length).padStart(2, '0')}
          label="CONFIRMADOS"
        />
      </View>

      {showEditor ? (
        <AppointmentEditor
          clients={clients}
          selectedClient={selectedClient}
          services={serviceOptions}
          barbers={barberOptions}
          clientId={clientId}
          serviceId={serviceId}
          barberId={barberId}
          date={date}
          time={time}
          editing={Boolean(editingId)}
          saving={saving}
          onSelectClient={onSelectClient}
          onClearClient={onClearClient}
          setServiceId={setServiceId}
          setBarberId={setBarberId}
          setDate={setDate}
          setTime={setTime}
          onCancel={() => setShowEditor(false)}
          onSave={saveAppointment}
        />
      ) : null}

      <View style={styles.scheduleList}>
        {visibleAppointments.length ? (
          visibleAppointments.map((item) => (
            <AppointmentRow
              key={item.id}
              item={item}
              onPaid={() => markPaid(item)}
              onReschedule={() => openReschedule(item)}
              onStatus={(status) => changeStatus(item, status)}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum atendimento.</Text>
            <Text style={styles.emptyText}>A agenda está livre para este período.</Text>
          </View>
        )}
      </View>
    </>
  );
}
