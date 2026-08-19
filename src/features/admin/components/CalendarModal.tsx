import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { addIsoDays, brasiliaTodayIso } from '@/lib/brasilia-time';
import { styles } from '../styles';

type CalendarModalProps = {
  visible: boolean;
  selectedDateIso: string;
  onSelectDate: (dateIso: string) => void;
  onClose: () => void;
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarModal({
  visible,
  selectedDateIso,
  onSelectDate,
  onClose,
}: CalendarModalProps) {
  const initialDate = useMemo(() => {
    if (selectedDateIso && /^\d{4}-\d{2}-\d{2}$/.test(selectedDateIso)) {
      const [year, month] = selectedDateIso.split('-').map(Number);
      return { year, month: month - 1 };
    }
    const today = brasiliaTodayIso();
    const [year, month] = today.split('-').map(Number);
    return { year, month: month - 1 };
  }, [selectedDateIso]);

  const [activeYear, setActiveYear] = useState(initialDate.year);
  const [activeMonth, setActiveMonth] = useState(initialDate.month);

  const monthLabel = useMemo(() => {
    const d = new Date(activeYear, activeMonth, 1);
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d);
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${activeYear}`;
  }, [activeYear, activeMonth]);

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(activeYear, activeMonth, 1).getDay();
    const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
    const days = [];

    // Empty padding for previous month days
    for (let i = 0; i < firstDayIndex; i += 1) {
      days.push(null);
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day += 1) {
      const monthStr = String(activeMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const iso = `${activeYear}-${monthStr}-${dayStr}`;
      days.push({ day, iso });
    }

    return days;
  }, [activeYear, activeMonth]);

  function moveMonth(delta: number) {
    let nextMonth = activeMonth + delta;
    let nextYear = activeYear;

    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    setActiveMonth(nextMonth);
    setActiveYear(nextYear);
  }

  const todayIso = brasiliaTodayIso();
  const maxBookingIso = addIsoDays(todayIso, 90);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.calendarModalBox}>
          {/* Header */}
          <View style={styles.calendarModalHeader}>
            <Pressable onPress={() => moveMonth(-1)} hitSlop={12} style={styles.calendarNavBtn}>
              <Ionicons name="chevron-back" color={colors.ink} size={20} />
            </Pressable>
            <Text style={styles.calendarMonthTitle}>{monthLabel}</Text>
            <Pressable onPress={() => moveMonth(1)} hitSlop={12} style={styles.calendarNavBtn}>
              <Ionicons name="chevron-forward" color={colors.ink} size={20} />
            </Pressable>
          </View>

          {/* Weekday Labels */}
          <View style={styles.calendarWeekdaysRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.calendarWeekdayText}>
                {day}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.calendarDaysGrid}>
            {calendarDays.map((item, index) => {
              if (!item) {
                return <View key={`empty-${index}`} style={styles.calendarDayCell} />;
              }

              const isSelected = item.iso === selectedDateIso;
              const isToday = item.iso === todayIso;
              const isPast = item.iso < todayIso;
              const isTooFar = item.iso > maxBookingIso;
              const isDisabled = isPast || isTooFar;

              return (
                <Pressable
                  key={item.iso}
                  disabled={isDisabled}
                  onPress={() => {
                    onSelectDate(item.iso);
                    onClose();
                  }}
                  style={[
                    styles.calendarDayCell,
                    isSelected && styles.calendarDaySelected,
                    isToday && !isSelected && styles.calendarDayToday,
                    isDisabled && styles.calendarDayDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      isSelected && styles.calendarDayTextSelected,
                      isDisabled && styles.calendarDayTextDisabled,
                    ]}
                  >
                    {item.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={styles.calendarCloseBtn}>
            <Text style={styles.calendarCloseBtnText}>CANCELAR</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
