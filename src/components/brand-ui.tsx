import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';

export function BrandLockup({ inverse = false }: { inverse?: boolean }) {
  return <View accessibilityLabel="Viks Man" style={styles.lockup}>
    <Image source={require('@/assets/images/viks-mark.png')} contentFit="contain" style={styles.logo} />
    <View style={[styles.divider, inverse && styles.dividerInverse]} />
    <Text style={[styles.man, inverse && styles.inverseText]}>MAN</Text>
  </View>;
}

export function PrimaryButton({ label, onPress, dark = false, disabled = false, style }: { label: string; onPress: () => void; dark?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, dark && styles.buttonDark, disabled && styles.disabled, pressed && styles.pressed, style]}>
    <Text style={[styles.buttonText, dark && styles.buttonTextDark]}>{label}</Text>
    <Ionicons name="arrow-forward" color={dark ? colors.white : colors.ink} size={18} />
  </Pressable>;
}

export function SectionHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return <View style={styles.heading}>
    <View style={styles.headingCopy}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.title}>{title}</Text></View>
    {aside}
  </View>;
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 9 }, logo: { width: 62, height: 28 }, divider: { width: 1, height: 19, backgroundColor: colors.line }, dividerInverse: { backgroundColor: '#46474C' }, man: { color: colors.ink, fontFamily: fonts.sans, fontSize: 9, fontWeight: '900', letterSpacing: 2.2 }, inverseText: { color: colors.white },
  button: { minHeight: 52, minWidth: 220, paddingHorizontal: 18, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 }, buttonDark: { backgroundColor: colors.ink }, buttonText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, buttonTextDark: { color: colors.white }, disabled: { opacity: 0.42 }, pressed: { opacity: 0.68 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }, headingCopy: { flex: 1 }, eyebrow: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 }, title: { color: colors.ink, fontFamily: fonts.sans, fontSize: 36, lineHeight: 38, fontWeight: '800', letterSpacing: -1.9 },
});
