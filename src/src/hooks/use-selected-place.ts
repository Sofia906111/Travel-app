import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { PLACE_FEATURE_CLASSES } from '@/constants/map';
import {
  DROPPED_PIN,
  loadingPlace,
  lookupByOsmId,
  resolvedPlace,
  reverseGeocode,
  type PlacePreview,
} from '@/lib/nominatim';
import { emptyRatings, getModeForPlaceRatings, getRatingsForPlace } from '@/lib/rating';
import type { Ratings } from '@/types';

type PinHelpers = {
  showDroppedPin: (latitude: number, longitude: number, title?: string) => void;
  clearDroppedPin: () => void;
};

type RatingsCache = {
  placeId: string;
  ratings: Ratings;
};

export function useSelectedPlace({ showDroppedPin, clearDroppedPin }: PinHelpers) {
  const router = useRouter();
  const [place, setPlace] = useState<PlacePreview | null>(null);
  const [ratingsCache, setRatingsCache] = useState<RatingsCache | null>(null);
  const [loadingPlaceId, setLoadingPlaceId] = useState<string | null>(null);

  const closePlace = useCallback(() => {
    clearDroppedPin();
    setPlace(null);
  }, [clearDroppedPin]);

  const selectDroppedPin = useCallback(
    async (id: string, latitude: number, longitude: number) => {
      showDroppedPin(latitude, longitude, DROPPED_PIN);
      setPlace(loadingPlace(id, latitude, longitude));

      try {
        const result = await reverseGeocode(latitude, longitude);
        setPlace((current) => {
          if (!current || current.id !== id) return current;
          const next = resolvedPlace(current, result);
          if (result) {
            showDroppedPin(next.latitude, next.longitude, next.name ?? undefined);
          }
          return next;
        });
      } catch (error) {
        console.log('reverse geocode failed', error);
        setPlace((current) =>
          current && current.id === id ? resolvedPlace(current, null) : current,
        );
      }
    },
    [showDroppedPin],
  );

  const openPlaceFromOsm = useCallback(
    async (input: {
      osmId: number;
      latitude: number;
      longitude: number;
      title?: string | null;
    }) => {
      const pinId = `osm-${input.osmId}`;
      showDroppedPin(input.latitude, input.longitude, input.title ?? undefined);
      setPlace(loadingPlace(pinId, input.latitude, input.longitude, input.osmId));

      try {
        const lookedUp = await lookupByOsmId(input.osmId);
        if (!lookedUp) {
          setPlace((current) =>
            current && current.id === pinId
              ? {
                  ...current,
                  name: input.title ?? `OSM ${input.osmId}`,
                  loading: false,
                }
              : current,
          );
          return;
        }

        const next = resolvedPlace(
          loadingPlace(pinId, lookedUp.latitude, lookedUp.longitude, lookedUp.osmId),
          lookedUp,
        );
        showDroppedPin(next.latitude, next.longitude, next.name ?? undefined);
        setPlace((current) => (current && current.id === pinId ? next : current));
      } catch (error) {
        console.log('nominatim lookup failed', error);
        setPlace((current) =>
          current && current.id === pinId ? { ...current, loading: false } : current,
        );
      }
    },
    [showDroppedPin],
  );

  const canContribute =
    !!place &&
    !place.loading &&
    place.osmId != null &&
    place.featureClass != null &&
    PLACE_FEATURE_CLASSES.has(place.featureClass);

  const placeId = place?.id;
  const placeLoading = place?.loading;
  const placeOsmId = place?.osmId;

  useEffect(() => {
    if (!placeId || placeLoading || placeOsmId == null) return;

    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoadingPlaceId(placeId);
      try {
        const rows = await getRatingsForPlace(placeOsmId);
        if (cancelled) return;
        setRatingsCache({
          placeId,
          ratings: getModeForPlaceRatings(rows ?? []),
        });
      } catch (err) {
        console.log("can't load rating", err);
        if (!cancelled) {
          setRatingsCache({ placeId, ratings: emptyRatings() });
        }
      } finally {
        if (!cancelled) {
          setLoadingPlaceId((current) => (current === placeId ? null : current));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placeId, placeLoading, placeOsmId]);

  const placeRatings =
    place && !place.loading && place.osmId != null && ratingsCache?.placeId === place.id
      ? ratingsCache.ratings
      : null;
  const ratingsLoading =
    !!place &&
    !place.loading &&
    place.osmId != null &&
    loadingPlaceId === place.id &&
    ratingsCache?.placeId !== place.id;

  const onContribute = useCallback(() => {
    if (!place || !canContribute) return;
    const name =
      place.name && place.name !== DROPPED_PIN
        ? place.name
        : (place.displayName ?? 'Selected place');
    const addressLine = place.displayName && place.displayName !== name ? place.displayName : '';
    const address = addressLine ? `${name}, ${addressLine}` : name;
    router.push({
      pathname: '/contribute',
      params: {
        name,
        addressLine,
        address,
        featureClass: place.featureClass ?? '',
        featureType: place.featureType ?? '',
        osmId: place.osmId != null ? String(place.osmId) : '',
        osmType: place.osmType ?? '',
        latitude: String(place.latitude),
        longitude: String(place.longitude),
      },
    });
  }, [canContribute, place, router]);

  return {
    place,
    placeRatings,
    ratingsLoading,
    canContribute,
    closePlace,
    selectDroppedPin,
    openPlaceFromOsm,
    onContribute,
  };
}
