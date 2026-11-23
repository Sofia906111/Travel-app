/**
 * Below are the colors that are used in the app. There are three palettes:
 * light, dark and high contrast (chosen in the Preferences screen, see `hooks/use-theme.ts`).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#DFECEA',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    tabsColor: '#0E6E67',
    primary: '#0E6E67',
    onPrimary: '#ffffff',
    border: '#9AA5A4',
    danger: '#B3261E',
    success: '#1B6E2E',
    info: '#1D4E89',
    ratingNone: '#6B7280',
    ratingGood: '#1B6E2E',
    ratingWarn: '#FFC300',
    ratingBad: '#B3261E',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    tabsColor: '#0E6E67',
    primary: '#4FB8AE',
    onPrimary: '#000000',
    border: '#4A4E54',
    danger: '#F2B8B5',
    success: '#8FD19E',
    info: '#9CC3F5',
    ratingNone: '#9CA3AF',
    ratingGood: '#4CAF50',
    ratingWarn: '#F5C542',
    ratingBad: '#EF5350',
  },
  /** Yellow on black, the usual high contrast scheme for low-vision users. */
  highContrast: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#141414',
    backgroundSelected: '#333333',
    textSecondary: '#ffffff',
    tabsColor: '#FFD600',
    primary: '#FFD600',
    onPrimary: '#000000',
    border: '#ffffff',
    danger: '#FF8A80',
    success: '#7CFF7C',
    info: '#7CC8FF',
    ratingNone: '#B0B0B0',
    ratingGood: '#7CFF7C',
    ratingWarn: '#FFD600',
    ratingBad: '#FF8A80',
  },
} as const;

export type ThemeName = keyof typeof Colors;
export type ThemeColor = keyof typeof Colors.light &
  keyof typeof Colors.dark &
  keyof typeof Colors.highContrast;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
