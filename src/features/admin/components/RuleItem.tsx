import { Text, View } from 'react-native';

import { styles } from '../styles';

type RuleItemProps = {
  label: string;
  value: string;
};

export function RuleItem({ label, value }: RuleItemProps) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleLabel}>{label}</Text>
      <Text style={styles.ruleValue}>{value}</Text>
    </View>
  );
}
