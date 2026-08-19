import { Text, TextInput, TextInputProps, View } from 'react-native';

import { styles } from '../styles';

type LabeledInputProps = TextInputProps & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

export function LabeledInput({ label, ...props }: LabeledInputProps) {
  return (
    <View style={styles.labeledInput}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#9A9B96" style={styles.input} />
    </View>
  );
}
