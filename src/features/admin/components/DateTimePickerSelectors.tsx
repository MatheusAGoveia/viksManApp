import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';
import { styles } from '../styles';

type DateTimePickerSelectorsProps = {
  date: string;
  time: string;
  onSelectDate: (dateIso: string) => void;
  onSelectTime: (timeStr: string) => void;
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

function formatDisplayTime(timeStr: string): string {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 'Selecionar hora';
  return `${timeStr} hs`;
}

export function DateTimePickerSelectors({
  date,
  time,
  onSelectDate,
  onSelectTime,
}: DateTimePickerSelectorsProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const handleOpenDatePicker = () => {
    if (Platform.OS === 'web' && dateInputRef.current) {
      try {
        if (typeof dateInputRef.current.showPicker === 'function') {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.click();
        }
      } catch {
        dateInputRef.current.click();
      }
    }
  };

  const handleOpenTimePicker = () => {
    if (Platform.OS === 'web' && timeInputRef.current) {
      try {
        if (typeof timeInputRef.current.showPicker === 'function') {
          timeInputRef.current.showPicker();
        } else {
          timeInputRef.current.click();
        }
      } catch {
        timeInputRef.current.click();
      }
    }
  };

  return (
    <View style={styles.pickerPairRow}>
      {/* Date Card */}
      <View style={styles.pickerCardCol}>
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
      </View>

      {/* Time Card */}
      <View style={styles.pickerCardCol}>
        <Text style={styles.inputLabel}>HORÁRIO DO ATENDIMENTO</Text>
        <Pressable onPress={handleOpenTimePicker} style={styles.pickerCardBox}>
          <View style={styles.pickerCardIcon}>
            <Ionicons name="time" color={colors.blue} size={18} />
          </View>
          <View style={styles.pickerCardTextWrap}>
            <Text style={styles.pickerCardValue}>{formatDisplayTime(time)}</Text>
          </View>
          <Ionicons name="chevron-down" color={colors.muted} size={16} />

          {Platform.OS === 'web' ? (
            <input
              ref={timeInputRef}
              type="time"
              value={time || ''}
              onChange={(e) => e.target.value && onSelectTime(e.target.value)}
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
          ) : (
            <TextInput
              value={time}
              onChangeText={onSelectTime}
              placeholder="09:00"
              style={{ display: 'none' }}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}
