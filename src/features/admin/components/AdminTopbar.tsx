import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { styles } from '../styles';

type AdminTopbarProps = {
  configured: boolean;
  onClose: () => void;
};

export function AdminTopbar({ configured, onClose }: AdminTopbarProps) {
  return (
    <View style={styles.topbar}>
      <View>
        <Text style={styles.brand}>
          VIKS <Text style={styles.brandAccent}>/</Text> RECEPÇÃO
        </Text>
        <Text style={styles.unit}>
          UNIDADE BETIM · {configured ? 'CONECTADO' : 'DEMONSTRAÇÃO'}
        </Text>
      </View>
      <Pressable accessibilityLabel="Fechar painel" hitSlop={8} onPress={onClose} style={styles.close}>
        <Ionicons name="close" color={colors.white} size={21} />
      </Pressable>
    </View>
  );
}
