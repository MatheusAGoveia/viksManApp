import { Pressable, ScrollView, Text } from 'react-native';

import { styles } from '../styles';
import type { Option } from '../types';

type OptionChipsProps = {
  options: Option[];
  selected: string;
  onSelect: (id: string) => void;
};

export function OptionChips({ options, selected, onSelect }: OptionChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onSelect(item.id)}
          style={[styles.chip, selected === item.id && styles.chipActive]}
        >
          <Text style={[styles.chipText, selected === item.id && styles.chipTextActive]}>{item.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
