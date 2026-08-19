import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { styles } from '../styles';
import { AvailableSlotsSelector } from './AvailableSlotsSelector';
import { CalendarModal } from './CalendarModal';

type DateTimePickerSelectorsProps = {
  date: string;
  time: string;
  onSelectDate: (dateIso: string) => void;
  onSelectTime: (timeStr: string) => void;
  availableTimeSlots: string[];
  slotsLoading: boolean;
  slotsError: string;
  hasRequiredSelection: boolean;
  onRetrySlots?: () => void;
};

function formatDisplayDate(dateIso: string): string {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return 'Selecionar data';
  const [year, month, day] = dateIso.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(d.getTime())) return dateIso;
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d);
  const formattedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', '');
  return `${formattedWeekday}, ${day}/${month}/${year}`;
}

export function DateTimePickerSelectors({
  date,
  time,
  onSelectDate,
  onSelectTime,
  availableTimeSlots,
  slotsLoading,
  slotsError,
  hasRequiredSelection,
  onRetrySlots,
}: DateTimePickerSelectorsProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const handleOpenDatePicker = () => {
    if (Platform.OS === 'web' && dateInputRef.current) {
      try {
        if (typeof dateInputRef.current.showPicker === 'function') {
          dateInputRef.current.showPicker();
          return;
        }
      } catch {
        // Fallback to custom CalendarModal on failure or mobile browsers
      }
    }
    setShowCalendarModal(true);
  };

  return (
    <View style={{ marginTop: 12 }}>
      {/* Date Selection Card */}
      <Text style={styles.inputLabel}>DATA DO ATENDIMENTO</Text>
      <Pressable onPress={handleOpenDatePicker} style={styles.pickerCardBox}>
        <View style={styles.pickerCardIcon}>
          <Ionicons name="calendar" color={colors.blue} size={18} />
        </View>
        <View style={styles.pickerCardTextWrap}>
          <Text style={styles.pickerCardValue}>{formatDisplayDate(date)}</Text>
        </View>
        <Ionicons name="chevron-down" color={colors.muted} size={16} />

        {Platform.OS === 'web' && (
          <input
            ref={dateInputRef}
            type="date"
            value={date || ''}
            onChange={(e) => e.target.value && onSelectDate(e.target.value)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 10,
            }}
          />
        )}
      </Pressable>

      <CalendarModal
        visible={showCalendarModal}
        selectedDateIso={date}
        onSelectDate={onSelectDate}
        onClose={() => setShowCalendarModal(false)}
      />

      {/* Available Slots Grid & State Selector */}
      <AvailableSlotsSelector
        time={time}
        availableTimeSlots={availableTimeSlots}
        loading={slotsLoading}
        error={slotsError}
        hasRequiredSelection={hasRequiredSelection}
        onSelectTime={onSelectTime}
        onRetry={onRetrySlots}
      />
    </View>
  );
}
