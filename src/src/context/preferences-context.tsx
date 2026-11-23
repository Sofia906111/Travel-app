import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * User preferences (Preferences tab).
 *
 * PERSISTENCE: the whole object is stored as JSON in AsyncStorage (a key-value store on the
 * phone), so every value survives closing and reopening the app.
 *
 * Any screen can read them with `usePreferences()`:
 *  - theme / textScale  -> used by `useTheme()` and `ThemedText` (whole app)
 *  - showWheelchairBadge -> meant for the Map screen
 *  - name + surname     -> author of contributions
 */

export type ThemeOption = 'system' | 'light' | 'dark' | 'highContrast';

export const THEME_OPTIONS: readonly { value: ThemeOption; label: string }[] = [
  { value: 'system', label: 'Same as phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'highContrast', label: 'High contrast' },
];

export const TEXT_SCALE_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: '100 % (normal)' },
  { value: 1.3, label: '130 % (large)' },
  { value: 1.6, label: '160 % (XL)' },
  { value: 2, label: '200 % (XXL)' },
];

export type UserPreferences = {
  name: string;
  surname: string;
  showWheelchairBadge: boolean;
  theme: ThemeOption;
  textScale: number;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  name: '',
  surname: '',
  showWheelchairBadge: true,
  theme: 'system',
  textScale: 1,
};

const STORAGE_KEY = 'accessway.preferences.v1';

export function displayName(p: UserPreferences): string {
  return [p.name.trim(), p.surname.trim()].filter(Boolean).join(' ');
}

/** Keeps only valid values, so a corrupted or old saved object can never crash the app. */
function sanitize(raw: unknown): UserPreferences {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof UserPreferences, unknown>>;
  const d = DEFAULT_PREFERENCES;
  return {
    name: typeof r.name === 'string' ? r.name : d.name,
    surname: typeof r.surname === 'string' ? r.surname : d.surname,
    showWheelchairBadge: typeof r.showWheelchairBadge === 'boolean' ? r.showWheelchairBadge : d.showWheelchairBadge,
    theme: THEME_OPTIONS.some((o) => o.value === r.theme) ? (r.theme as ThemeOption) : d.theme,
    textScale: TEXT_SCALE_OPTIONS.some((o) => o.value === r.textScale) ? (r.textScale as number) : d.textScale,
  };
}

type PreferencesContextValue = {
  preferences: UserPreferences;
  /** True once the saved values have been read from storage. */
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
