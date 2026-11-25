import type { FeatureKey, RatingKey } from '@/types';

export const FEATURES: Record<FeatureKey, string> = {
  wheelchairEntrance: 'Wheelchair accessible entrance',
  elevators: 'Elevators',
  tactilePaving: 'Tactile paving',
  stepFreeAccess: 'Step-free access',
  brailleSigns: 'Braille signs',
};

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

export const RATINGS: Record<RatingKey, string> = {
  unknown: 'No info',
  accessible: 'Accessible',
  priorBooking: 'Requires prior booking',
  undesirable: 'Undesirable',
};

export const RATING_KEYS = Object.keys(RATINGS) as RatingKey[];
