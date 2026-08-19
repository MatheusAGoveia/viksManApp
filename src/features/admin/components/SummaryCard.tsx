import { Text, View } from 'react-native';

import { styles } from '../styles';

type SummaryCardProps = {
  value: string;
  label: string;
};

export function SummaryCard({ value, label }: SummaryCardProps) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}
