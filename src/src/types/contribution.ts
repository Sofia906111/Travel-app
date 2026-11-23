export const FEATURES = [
  { key: 'wheelchairEntrance', label: 'Wheelchair accessible entrance' },
  { key: 'elevators', label: 'Elevators' },
  { key: 'tactilePaving', label: 'Tactile paving' },
  { key: 'stepFreeAccess', label: 'Step-free access' },
  { key: 'brailleSigns', label: 'Braille signs' },
] as const;

export const RATINGS = [
  { key: 'unknown', label: 'No info' },
  { key: 'accessible', label: 'Accessible' },
  { key: 'priorBooking', label: 'Requires prior booking' },
  { key: 'undesirable', label: 'Undesirable' },
] as const;

export type FeatureKey = (typeof FEATURES)[number]['key'];
export type RatingKey = (typeof RATINGS)[number]['key'];
export type Ratings = Record<FeatureKey, RatingKey>;

export type Contribution = {
  id: string;
  address: string;
  osmId: number;
  latitude: number | null;
  longitude: number | null;
  ratings: Ratings;
  createdAt: number;
  updatedAt: number;
};

export function emptyRatings(): Ratings {
  return Object.fromEntries(FEATURES.map((f) => [f.key, 'unknown'])) as Ratings;
}

export function ratingLabel(key: RatingKey): string {
  return RATINGS.find((r) => r.key === key)?.label ?? key;
}

function isFeatureKey(value: string): value is FeatureKey {
  return FEATURES.some((f) => f.key === value);
}

function isRatingKey(value: string): value is RatingKey {
  return RATINGS.some((r) => r.key === value);
}

export function ratingsFromRows(
  rows: Array<{ feature: string; rating: string }>,
): Ratings {
  const result = emptyRatings();
  for (const row of rows) {
    if (isFeatureKey(row.feature) && isRatingKey(row.rating)) {
      result[row.feature] = row.rating;
    }
  }
  return result;
}
