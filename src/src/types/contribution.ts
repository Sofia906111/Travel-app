/** The five accessibility features rated in the Contribute screen (from the Figma prototype). */
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

/**
 * Local-first sync state. A contribution is always saved on the phone first and then sent to
 * the (mock) server. Without network it stays "pending" and is retried when the connection returns.
 */
export type SyncState = 'pendingUpload' | 'synced' | 'pendingDelete';

export type Contribution = {
  id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  ratings: Ratings;
  comment: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  syncState: SyncState;
  /** Id given by the server after the first successful upload. */
  remoteId: string | null;
  lastSyncError: string | null;
  /** Fictional sample data added from Preferences → Demo. Shown with a "TEST DATA" badge. */
  isTestData?: boolean;
};

export function emptyRatings(): Ratings {
  return Object.fromEntries(FEATURES.map((f) => [f.key, 'unknown'])) as Ratings;
}

export function ratingLabel(key: RatingKey): string {
  return RATINGS.find((r) => r.key === key)?.label ?? key;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
