import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

const HOLD_DURATION = 700;
const FADE_DURATION = 320;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const [opacity] = useState(() => new Animated.Value(1));
  const [scale] = useState(() => new Animated.Value(0.96));

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(scale, {
          toValue: 1.02,
          duration: FADE_DURATION,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, HOLD_DURATION);

    return () => {
      clearTimeout(timer);
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
