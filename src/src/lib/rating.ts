import { FEATURE_KEYS, RATINGS } from '@/constants/accessibility';
import type {
  Contribution,
  FeatureKey,
  PlaceLocation,
  PlaceRow,
  RatingKey,
  Ratings,
} from '@/types';

import { supabase } from './supabase';

export type { PlaceLocation, PlaceRow } from '@/types';

export interface Rating {
  id: string;
  created_at: Date;
  rating: RatingKey;
  feature: FeatureKey;
  placeOsmId: number;
  authUID: string;
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as string[]).includes(value);
}

export function isRatingKey(value: string): value is RatingKey {
  return value in RATINGS;
}

export function emptyRatings(): Ratings {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, 'unknown'])) as Ratings;
}

export function ratingLabel(key: RatingKey): string {
  return RATINGS[key];
}

export function ratingsFromRows(rows: { feature: string; rating: string }[]): Ratings {
  const result = emptyRatings();
  for (const row of rows) {
    if (isFeatureKey(row.feature) && isRatingKey(row.rating)) {
      result[row.feature] = row.rating;
    }
  }
  return result;
}

function modeForVotes(votes: RatingKey[]): RatingKey {
  if (votes.length === 0) return 'unknown';

  const counts = new Map<RatingKey, number>();
  for (const vote of votes) {
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }

  let mode: RatingKey = 'unknown';
  let bestCount = -1;
  for (const [rating, count] of counts) {
    if (count > bestCount) {
      mode = rating;
      bestCount = count;
    }
  }
  return mode;
}

type RatingVote = Pick<Rating, 'feature' | 'rating'>;

export function getModeForPlaceRatings(ratings: RatingVote[]): Ratings {
  const votesByFeature = new Map<FeatureKey, RatingKey[]>();

  for (const row of ratings) {
    if (row.rating === 'unknown') continue;
    const list = votesByFeature.get(row.feature) ?? [];
    list.push(row.rating);
    votesByFeature.set(row.feature, list);
  }

  const result = emptyRatings();
  for (const key of FEATURE_KEYS) {
    result[key] = modeForVotes(votesByFeature.get(key) ?? []);
  }
  return result;
}

export function overallAccessibilityRating(ratings: Ratings): RatingKey {
  const votes = FEATURE_KEYS.map((key) => ratings[key]).filter((r) => r !== 'unknown');
  if (votes.includes('undesirable')) return 'undesirable';
  if (votes.includes('priorBooking')) return 'priorBooking';
  if (votes.includes('accessible')) return 'accessible';
  return 'unknown';
}

export async function getRatingsForPlace(placeOsmId: number): Promise<Rating[] | null> {
  const { data, error } = await supabase.from('rating').select('*').eq('placeOsmId', placeOsmId);
  if (error) {
    throw error;
  }
  return data ?? null;
}

export async function getContributedOsmIds(): Promise<number[]> {
  const { data, error } = await supabase.from('rating').select('placeOsmId');
  if (error) {
    throw error;
  }
  const ids = new Set<number>();
  for (const row of data ?? []) {
    const osmId = Number(row.placeOsmId);
    if (Number.isFinite(osmId)) ids.add(osmId);
  }
  return [...ids];
}

export async function getRatingsByPlaceOsmIds(
  placeOsmIds: number[],
): Promise<Map<number, Ratings>> {
  const result = new Map<number, Ratings>();
  if (placeOsmIds.length === 0) return result;

  const { data, error } = await supabase
    .from('rating')
    .select('placeOsmId, feature, rating')
    .in(
      'placeOsmId',
      placeOsmIds.map((id) => String(id)),
    );
  if (error) {
    throw error;
  }

  const rowsByPlace = new Map<number, RatingVote[]>();
  for (const row of data ?? []) {
    const list = rowsByPlace.get(row.placeOsmId) ?? [];
    list.push({
      feature: row.feature as FeatureKey,
      rating: row.rating as RatingKey,
    });
    rowsByPlace.set(row.placeOsmId, list);
  }

  for (const [placeOsmId, rows] of rowsByPlace) {
    result.set(placeOsmId, getModeForPlaceRatings(rows));
  }
  return result;
}

export async function upsertPlace(location: PlaceLocation & { osmId: number }): Promise<void> {
  const { error } = await supabase.from('places').upsert(
    {
      osmId: location.osmId,
      lat: location.lat,
      lng: location.lng,
      label: location.label?.trim() || null,
    },
    { onConflict: 'osmId' },
  );
  if (error) {
    throw error;
  }
}

export async function getPlacesByOsmIds(osmIds: number[]): Promise<PlaceRow[]> {
  if (osmIds.length === 0) return [];
  const { data, error } = await supabase
    .from('places')
    .select('osmId, lat, lng, label')
    .in(
      'osmId',
      osmIds.map((id) => String(id)),
    );
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    osmId: Number(row.osmId),
    lat: Number(row.lat),
    lng: Number(row.lng),
    label: row.label ?? null,
  }));
}

export async function getContributedPlaces(): Promise<PlaceRow[]> {
  const osmIds = await getContributedOsmIds();
  return getPlacesByOsmIds(osmIds);
}

export async function addRating(
  placeOsmId: number,
  ratings: Ratings,
  location: PlaceLocation,
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    throw authError;
  }
  if (!user) {
    throw new Error('Not signed in');
  }
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    throw new Error('Place latitude/longitude required');
  }

  await upsertPlace({
    osmId: placeOsmId,
    lat: location.lat,
    lng: location.lng,
    label: location.label,
  });

  const rows = FEATURE_KEYS.map((key) => ({
    authUID: user.id,
    placeOsmId,
    feature: key,
    rating: ratings[key],
  }));

  const { error } = await supabase.from('rating').upsert(rows, {
    onConflict: 'authUID,placeOsmId,feature',
  });
  if (error) {
    throw error;
  }
}

export async function getMyContributions(authUID: string): Promise<Contribution[]> {
  const { data: ratingRows, error: ratingError } = await supabase
    .from('rating')
    .select('placeOsmId, feature, rating, created_at')
    .eq('authUID', authUID)
    .order('created_at', { ascending: false });
  if (ratingError) {
    throw ratingError;
  }
  if (!ratingRows?.length) return [];

  const byPlace = new Map<
    number,
    { rows: { feature: string; rating: string }[]; createdAt: number; updatedAt: number }
  >();

  for (const row of ratingRows) {
    const osmId = Number(row.placeOsmId);
    if (!Number.isFinite(osmId)) continue;
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();
    const existing = byPlace.get(osmId);
    if (!existing) {
      byPlace.set(osmId, {
        rows: [{ feature: row.feature, rating: row.rating }],
        createdAt,
        updatedAt: createdAt,
      });
    } else {
      existing.rows.push({ feature: row.feature, rating: row.rating });
      existing.createdAt = Math.min(existing.createdAt, createdAt);
      existing.updatedAt = Math.max(existing.updatedAt, createdAt);
    }
  }

  const osmIds = [...byPlace.keys()];
  const places = await getPlacesByOsmIds(osmIds);
  const placeByOsmId = new Map(places.map((place) => [place.osmId, place] as const));

  return osmIds
    .map((osmId) => {
      const group = byPlace.get(osmId)!;
      const place = placeByOsmId.get(osmId);
      return {
        id: String(osmId),
        osmId,
        address: place?.label?.trim() || `OSM ${osmId}`,
        latitude: place?.lat ?? null,
        longitude: place?.lng ?? null,
        ratings: ratingsFromRows(group.rows),
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      } satisfies Contribution;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteMyRatingsForPlace(placeOsmId: number): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    throw authError;
  }
  if (!user) {
    throw new Error('Not signed in');
  }

  const { error } = await supabase
    .from('rating')
    .delete()
    .eq('authUID', user.id)
    .eq('placeOsmId', placeOsmId);
  if (error) {
    throw error;
  }
}
