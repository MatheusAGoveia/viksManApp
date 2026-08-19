import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { styles } from '../styles';

type NoticeBannerProps = {
  notice: string;
  onClear: () => void;
};

export function NoticeBanner({ notice, onClear }: NoticeBannerProps) {
  if (!notice) return null;

  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{notice}</Text>
      <Pressable accessibilityLabel="Fechar aviso" hitSlop={12} onPress={onClear}>
        <Ionicons name="close" color={colors.ink} size={16} />
      </Pressable>
    </View>
  );
}
