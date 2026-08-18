import '@/global.css';

import { Platform } from 'react-native';

export const colors = {
  blue: '#135DFF',
  blueDeep: '#0738BA',
  ink: '#101114',
  paper: '#F1F0EC',
  white: '#FFFFFF',
  muted: '#6D6E6A',
  soft: '#E4E3DE',
  line: '#CBCAC5',
  success: '#157347',
  danger: '#B42318',
} as const;

export const fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', mono: 'ui-monospace' },
  android: { sans: 'sans-serif', serif: 'serif', mono: 'monospace' },
  default: { sans: 'Arial', serif: 'Georgia', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    mono: 'var(--font-mono)',
  },
})!;

export const layout = {
  maxWidth: 1320,
  pagePadding: 20,
  tabBarHeight: 72,
} as const;

// Compatibility exports kept for the small reusable components that ship with Expo's template.
export const Colors = {
  light: { text: colors.ink, background: colors.paper, backgroundElement: colors.soft, backgroundSelected: '#D8DFF4', textSecondary: colors.muted },
  dark: { text: colors.white, background: colors.ink, backgroundElement: '#212225', backgroundSelected: colors.blueDeep, textSecondary: '#B0B4BA' },
} as const;
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export const Fonts = { ...fonts, rounded: fonts.sans };
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const BottomTabInset = 72;
export const MaxContentWidth = layout.maxWidth;
