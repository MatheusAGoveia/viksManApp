import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

const HOLD_DURATION = 700;
const FADE_DURATION = 320;

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const [opacity] = useState(() => new Animated.Value(1));
  const [scale] = useState(() => new Animated.Value(0.96));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function revealApp() {
      if (Platform.OS !== 'web') {
        await SplashScreen.hideAsync().catch(() => undefined);
      }
      if (cancelled) return;

      timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: FADE_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.02,
            duration: FADE_DURATION,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && !cancelled) setVisible(false);
        });
      }, HOLD_DURATION);
    }

    revealApp();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [opacity, scale]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityLabel="Viks Man"
      style={[styles.splashOverlay, { opacity }]}
    >
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }] }]}>
        <Image
          accessibilityLabel="Logo da Viks Man"
          contentFit="contain"
          source={require('@/assets/images/viks-mark.png')}
          style={styles.logo}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: '#000000',
    justifyContent: 'center',
    zIndex: 10000,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 360,
    width: '58%',
  },
  logo: {
    aspectRatio: 1665 / 943,
    width: '100%',
  },
});
