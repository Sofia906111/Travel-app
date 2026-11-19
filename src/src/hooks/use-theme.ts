/**
 * Light / dark / high contrast. The user picks it in Preferences; "Same as phone" follows the
 * system setting. Learn more: https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type ThemeName } from '@/constants/theme';
import { usePreferences } from '@/context/preferences-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeName(): ThemeName {
  const system = useColorScheme();
  const { preferences } = usePreferences();
  if (preferences.theme === 'system') return system === 'dark' ? 'dark' : 'light';
  return preferences.theme;
}

export function useTheme() {
  return Colors[useThemeName()];
}
