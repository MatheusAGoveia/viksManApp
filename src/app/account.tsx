import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

// Compatibility route for confirmation links generated before /profile became
// the canonical account screen. Waiting for AuthProvider preserves URL sessions.
export default function AccountRedirectScreen() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) router.replace('/profile');
  }, [loading]);

  return <View style={styles.screen}><ActivityIndicator color={colors.blue} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
});
