import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Themes } from '@/constants/theme';

export const THEME_OPTIONS: readonly { value: Themes; label: string }[] = [
  { value: Themes.System, label: 'Same as phone' },
  { value: Themes.Light, label: 'Light' },
  { value: Themes.Dark, label: 'Dark' },
  { value: Themes.HighContrast, label: 'High contrast' },
];

export const TEXT_SCALE_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: '100 % (Normal)' },
  { value: 1.3, label: '130 % (Large)' },
  { value: 1.6, label: '160 % (XL)' },
  { value: 2, label: '200 % (XXL)' },
];

export type UserPreferences = {
  showWheelchairBadge: boolean;
  theme: Themes;
  textScale: number;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  showWheelchairBadge: true,
  theme: Themes.System,
  textScale: 1,
};

const STORAGE_KEY = 'accessway.preferences.v1';

function sanitize(raw: unknown): UserPreferences {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<
    Record<keyof UserPreferences, unknown>
  >;
  const d = DEFAULT_PREFERENCES;
  return {
    showWheelchairBadge:
      typeof r.showWheelchairBadge === 'boolean' ? r.showWheelchairBadge : d.showWheelchairBadge,
    theme: THEME_OPTIONS.some((o) => o.value === r.theme) ? (r.theme as Themes) : d.theme,
    textScale: TEXT_SCALE_OPTIONS.some((o) => o.value === r.textScale)
      ? (r.textScale as number)
      : d.textScale,
  };
}

type PreferencesContextValue = {
  preferences: UserPreferences;
  loaded: boolean;
  update: (patch: Partial<UserPreferences>) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  loaded: false,
  update: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  // 1. Read saved preferences once, when the app starts.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        if (json) setPreferences(sanitize(JSON.parse(json)));
      })
      .catch((e) => console.warn('Could not read preferences, using defaults', e))
      .finally(() => setLoaded(true));
  }, []);

  // 2. Save every change (only after loading, so the defaults never overwrite saved data).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch((e) =>
      console.warn('Could not save preferences', e),
    );
  }, [preferences, loaded]);

  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(() => ({ preferences, loaded, update }), [preferences, loaded, update]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
