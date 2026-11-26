import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

import { ratingColor } from '@/components/rating-legend';
import { enabledFeatureKeys } from '@/constants/accessibility';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_TILES_URL } from '@/constants/map';
import { useContributions } from '@/context/contributions-context';
import { usePreferences } from '@/context/preferences-context';
import { useSelectedPlace } from '@/hooks/use-selected-place';
import { useTheme, useThemeName } from '@/hooks/use-theme';
import {
  emptyRatings,
  getContributedPlaces,
  getRatingsByPlaceOsmIds,
  overallAccessibilityRating,
} from '@/lib/rating';
import { getCurrentCoordinates } from '@/services/location';

import { MAP_HTML } from './map-html';
import {
  parseMapEvent,
  type ContributionMarker,
  type MapCommand,
  type MapCommandArgs,
} from './map-events';
import { PlaceCard } from './place-card';

const USER_LOCATION_POLL_MS = 2000;

type Props = {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  /** When set/changed, pan to `center` (e.g. search result). */
  focusKey?: string | null;
};

// Module-level so the WebView source never changes identity (no reloads).
const WEBVIEW_SOURCE = { html: MAP_HTML, baseUrl: 'https://localhost' };

export default function MapContainer({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  focusKey = null,
}: Props) {
  const theme = useTheme();
  const themeName = useThemeName();
  const tilesUrl = MAP_TILES_URL[themeName];
  const { preferences, loaded: preferencesLoaded } = usePreferences();
  const mapFeatureKeys = enabledFeatureKeys(preferences.mapFeatures);
  const { contributions } = useContributions();

  const webRef = useRef<WebView<object>>(null);
  const didCenterOnUser = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null>(null);

  const callMap = useCallback(<K extends MapCommand>(fn: K, ...args: MapCommandArgs[K]) => {
    const argList = args.map((a) => JSON.stringify(a ?? null)).join(', ');
    webRef.current?.injectJavaScript(`window.${fn} && window.${fn}(${argList}); true;`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const result = await getCurrentCoordinates();
        if (cancelled || result.kind !== 'success') return;
        setUserLocation({
          latitude: result.latitude,
          longitude: result.longitude,
          accuracy: result.accuracy,
        });
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const id = setInterval(() => void poll(), USER_LOCATION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !userLocation) return;
    callMap(
      'setUserLocation',
      userLocation.latitude,
      userLocation.longitude,
      userLocation.accuracy,
    );
  }, [mapReady, userLocation, callMap]);

  const showPin = useCallback(
    (latitude: number, longitude: number, title?: string) =>
      callMap('showDroppedPin', latitude, longitude, title ?? 'Selected place'),
    [callMap],
  );
  const clearPin = useCallback(() => callMap('clearDroppedPin'), [callMap]);

  const {
    place,
    placeRatings,
    ratingsLoading,
    canContribute,
    closePlace,
    selectDroppedPin,
    openPlaceFromOsm,
    onContribute,
  } = useSelectedPlace({ showDroppedPin: showPin, clearDroppedPin: clearPin });

  const contributionRevision = useMemo(
    () => contributions.map((item) => `${item.osmId}:${item.updatedAt}`).join('|'),
    [contributions],
  );

  const loadContributionMarkers = useCallback(async () => {
    try {
      const places = await getContributedPlaces();
      const ratingsByPlace = await getRatingsByPlaceOsmIds(places.map((p) => p.osmId));
      const items: ContributionMarker[] = places.map((p) => ({
        id: String(p.osmId),
        osmId: p.osmId,
        latitude: p.lat,
        longitude: p.lng,
        title: p.label?.trim() || `OSM ${p.osmId}`,
        fillColor: ratingColor(
          theme,
          overallAccessibilityRating(ratingsByPlace.get(p.osmId) ?? emptyRatings(), mapFeatureKeys),
        ),
      }));
      console.log('contribution markers', items.length);
      callMap('setContributionMarkers', items);
    } catch (error) {
      console.log('load contribution markers failed', error);
    }
  }, [callMap, theme, mapFeatureKeys]);

  useEffect(() => {
    if (mapReady) void loadContributionMarkers();
  }, [mapReady, contributionRevision, loadContributionMarkers]);

  useEffect(() => {
    if (mapReady) callMap('setTilesUrl', MAP_TILES_URL[themeName]);
  }, [mapReady, tilesUrl, callMap, themeName]);

  useEffect(() => {
    if (!mapReady || !focusKey) return;
    didCenterOnUser.current = true;
    callMap('setView', center.latitude, center.longitude, zoom);
  }, [mapReady, focusKey, center.latitude, center.longitude, zoom, callMap]);

  useEffect(() => {
    if (!mapReady || !userLocation || didCenterOnUser.current) return;
    didCenterOnUser.current = true;
    callMap('setView', userLocation.latitude, userLocation.longitude, zoom);
  }, [mapReady, userLocation, zoom, callMap]);

  const handleMessage = useCallback(
    (raw: string) => {
      const event = parseMapEvent(raw);
      if (!event) return;
      console.log('Map event', event);

      switch (event.type) {
        case 'mapReady':
          setMapReady(true);
          break;
        case 'mapClick':
          closePlace();
          break;
        case 'mapHold':
          void selectDroppedPin(event.id, event.latitude, event.longitude);
          break;
        case 'contributionMarkerClick':
          void openPlaceFromOsm(event);
          break;
      }
    },
    [closePlace, selectDroppedPin, openPlaceFromOsm],
  );

  return (
    <View style={styles.map}>
      {preferencesLoaded ? (
        <WebView<object>
          ref={webRef}
          originWhitelist={['*']}
          source={WEBVIEW_SOURCE}
          style={styles.webview}
          containerStyle={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          mixedContentMode="always"
          scrollEnabled={false}
          scalesPageToFit={false}
          onLoadStart={() => {
            setMapReady(false);
            didCenterOnUser.current = false;
          }}
          onMessage={(e) => handleMessage(e.nativeEvent.data)}
        />
      ) : null}

      {place ? (
        <PlaceCard
          place={place}
          ratings={placeRatings}
          ratingsLoading={ratingsLoading}
          canContribute={canContribute}
          onClose={closePlace}
          onContribute={onContribute}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, alignSelf: 'stretch', width: '100%', overflow: 'hidden' },
  webview: { flex: 1, width: '100%', height: '100%', backgroundColor: 'transparent' },
});
