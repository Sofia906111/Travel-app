import type { FeatureKey, RatingKey } from '@/types';

export const FEATURES: Record<FeatureKey, string> = {
  wheelchairEntrance: 'Wheelchair accessible entrance',
  elevators: 'Elevators',
  tactilePaving: 'Tactile paving',
  stepFreeAccess: 'Step-free access',
  brailleSigns: 'Braille signs',
};

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

export const FEATURE_GROUPS: readonly {
  id: string;
  label: string;
  description: string;
  keys: readonly FeatureKey[];
}[] = [
  {
    id: 'mobility',
    label: 'Mobility / wheelchair',
    description: 'Entrance, elevators, and step-free access.',
    keys: ['wheelchairEntrance', 'elevators', 'stepFreeAccess'],
  },
  {
    id: 'vision',
    label: 'Vision / blind',
    description: 'Tactile paving and braille signs.',
    keys: ['tactilePaving', 'brailleSigns'],
  },
];

export const RATINGS: Record<RatingKey, string> = {
  unknown: 'No info',
  accessible: 'Accessible',
  priorBooking: 'Requires prior booking',
  undesirable: 'Undesirable',
};

export const RATING_KEYS = Object.keys(RATINGS) as RatingKey[];

export type MapFeatureFilters = Record<FeatureKey, boolean>;

export function defaultMapFeatureFilters(): MapFeatureFilters {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, true])) as MapFeatureFilters;
}

export function enabledFeatureKeys(filters: MapFeatureFilters): FeatureKey[] {
  return FEATURE_KEYS.filter((key) => filters[key]);
}
