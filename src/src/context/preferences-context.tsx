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

import {
  defaultMapFeatureFilters,
  FEATURE_KEYS,
  type MapFeatureFilters,
} from '@/constants/accessibility';
import { Themes } from '@/constants/theme';
import type { FeatureKey } from '@/types';

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
  mapFeatures: MapFeatureFilters;
  theme: Themes;
  textScale: number;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  mapFeatures: defaultMapFeatureFilters(),
  theme: Themes.System,
  textScale: 1,
};

const STORAGE_KEY = 'accessway.preferences.v2';

function sanitizeMapFeatures(raw: unknown, legacyWheelchair?: boolean): MapFeatureFilters {
  const filters = defaultMapFeatureFilters();
  if (raw && typeof raw === 'object') {
    const record = raw as Partial<Record<FeatureKey, unknown>>;
    for (const key of FEATURE_KEYS) {
      if (typeof record[key] === 'boolean') filters[key] = record[key];
    }
    return filters;
  }
  // Migrate old single "wheelchair badge" toggle into mobility features.
  if (legacyWheelchair === false) {
    filters.wheelchairEntrance = false;
    filters.elevators = false;
    filters.stepFreeAccess = false;
  }
  return filters;
}

function sanitize(raw: unknown): UserPreferences {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<
    Record<keyof UserPreferences | 'showWheelchairBadge', unknown>
  >;
  const d = DEFAULT_PREFERENCES;
  return {
    mapFeatures: sanitizeMapFeatures(
      r.mapFeatures,
      typeof r.showWheelchairBadge === 'boolean' ? r.showWheelchairBadge : undefined,
    ),
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
  setMapFeature: (key: FeatureKey, enabled: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  loaded: false,
  update: () => {},
  setMapFeature: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          setPreferences(sanitize(JSON.parse(json)));
          return;
        }
        // One-time read of v1 prefs for migration.
        const legacy = await AsyncStorage.getItem('accessway.preferences.v1');
        if (legacy) setPreferences(sanitize(JSON.parse(legacy)));
      } catch (e) {
        console.warn('Could not read preferences, using defaults', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch((e) =>
      console.warn('Could not save preferences', e),
    );
  }, [preferences, loaded]);

  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const setMapFeature = useCallback((key: FeatureKey, enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      mapFeatures: { ...prev.mapFeatures, [key]: enabled },
    }));
  }, []);

  const value = useMemo(
    () => ({ preferences, loaded, update, setMapFeature }),
    [preferences, loaded, update, setMapFeature],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
