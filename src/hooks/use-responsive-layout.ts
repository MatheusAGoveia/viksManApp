import { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

function getWebWidth(fallback: number) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return fallback;
  return window.innerWidth;
}

export function useResponsiveLayout() {
  const nativeWindow = useWindowDimensions();
  const [webWidth, setWebWidth] = useState(() => getWebWidth(nativeWindow.width));

  const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

  useBrowserLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const updateWidth = () => setWebWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);

    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const width = Platform.OS === 'web' ? webWidth : nativeWindow.width;

  return {
    width,
    height: nativeWindow.height,
    compact: width < 480,
    tablet: width >= 768,
    desktop: width >= 1024,
  };
}
