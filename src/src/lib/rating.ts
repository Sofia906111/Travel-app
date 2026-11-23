import {
  FEATURES,
  emptyRatings,
  ratingsFromRows,
  type Contribution,
  type FeatureKey,
  type RatingKey,
  type Ratings,
} from '@/types/contribution';

import { resolvePlaces, type CachedPlace } from './place-cache';
import { supabase } from './supabase';

export type Place = CachedPlace;

export interface Rating {
  id: string;
  created_at: Date;
  rating: RatingKey;
  feature: FeatureKey;
  placeOsmId: number;
  authUID: string;
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

export function getModeForPlaceRatings(ratings: Rating[]): Ratings {
  const votesByFeature = new Map<FeatureKey, RatingKey[]>();

  for (const row of ratings) {
    if (row.rating === 'unknown') continue;
    const list = votesByFeature.get(row.feature) ?? [];
    list.push(row.rating);
    votesByFeature.set(row.feature, list);
  }

  const result = emptyRatings();
  for (const { key } of FEATURES) {
    result[key] = modeForVotes(votesByFeature.get(key) ?? []);
  }
  return result;
}

export async function getRatingsForPlace(placeOsmId: number): Promise<Rating[] | null> {
  const { data, error } = await supabase
    .from('rating')
    .select('*')
    .eq('placeOsmId', placeOsmId);
  if (error) {
    throw error;
  }
  return data ?? null;
}

export async function addRating(placeOsmId: number, ratings: Ratings): Promise<void> {
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

  const rows = FEATURES.map(({ key }) => ({
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
    { rows: Array<{ feature: string; rating: string }>; createdAt: number; updatedAt: number }
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
  const placeByOsmId = await resolvePlaces(osmIds);

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