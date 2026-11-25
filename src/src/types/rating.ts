import type { FeatureKey } from '@/types/feature';

export type RatingKey = 'unknown' | 'accessible' | 'priorBooking' | 'undesirable';

export type Ratings = Record<FeatureKey, RatingKey>;
