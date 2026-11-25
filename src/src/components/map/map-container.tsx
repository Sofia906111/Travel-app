import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

import { ratingColor } from '@/components/rating-legend';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_TILES_URL } from '@/constants/map';
import { useContributions } from '@/context/contributions-context';
import { useSelectedPlace } from '@/hooks/use-selected-place';
import { useTheme, useThemeName } from '@/hooks/use-theme';
import {
  getContributedPlaces,
  getRatingsByPlaceOsmIds,
  overallAccessibilityRating,
  emptyRatings,
} from '@/lib/rating';

import { MAP_HTML } from './map-html';
import { parseMapEvent, type ContributionMarker, type MapMarker } from './map-events';
import { PlaceCard } from './place-card';

type Props = {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  markers?: MapMarker[];
};

// Module-level so the WebView source never changes identity (no reloads).
const WEBVIEW_SOURCE = { html: MAP_HTML, baseUrl: 'https://localhost' };
const EMPTY_MARKERS: MapMarker[] = [];

export default function MapContainer({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  markers = EMPTY_MARKERS,
}: Props) {
  const theme = useTheme();
  const themeName = useThemeName();
  const tilesUrl = MAP_TILES_URL[themeName];
  const { contributions } = useContributions();
  // Extra props generic must be non-undefined or WebView props collapse to `never`
  // (react-native-webview#3970). `object` satisfies the empty-object lint rule.
  const webRef = useRef<WebView<object>>(null);
  const [mapReady, setMapReady] = useState(false);

  const injectedConfig = useMemo(
    () =>
      `window.__MAP_CONFIG__ = ${JSON.stringify({
        center,
        zoom,
        tilesUrl,
      })}; true;`,
    [center, zoom, tilesUrl],
  );

  const callMap = useCallback((fn: string, ...args: unknown[]) => {
    const argList = args.map((a) => JSON.stringify(a ?? null)).join(', ');
    webRef.current?.injectJavaScript(`window.${fn} && window.${fn}(${argList}); true;`);
  }, []);

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
          overallAccessibilityRating(ratingsByPlace.get(p.osmId) ?? emptyRatings()),
        ),
      }));
      console.log('contribution markers', items.length);
      callMap('setContributionMarkers', items);
    } catch (error) {
      console.log('load contribution markers failed', error);
    }
  }, [callMap, theme]);

  useEffect(() => {
    if (mapReady) void loadContributionMarkers();
  }, [mapReady, contributionRevision, loadContributionMarkers]);

  useEffect(() => {
    if (mapReady) callMap('setMarkers', markers);
  }, [mapReady, markers, callMap]);

  useEffect(() => {
    if (mapReady) callMap('setView', center.latitude, center.longitude, zoom);
  }, [mapReady, center.latitude, center.longitude, zoom, callMap]);

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
      <WebView<object>
        key={tilesUrl}
        ref={webRef}
        originWhitelist={['*']}
        source={WEBVIEW_SOURCE}
        injectedJavaScriptBeforeContentLoaded={injectedConfig}
        style={styles.webview}
        containerStyle={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        mixedContentMode="always"
        scrollEnabled={false}
        scalesPageToFit={false}
        onLoadStart={() => setMapReady(false)}
        onMessage={(e) => handleMessage(e.nativeEvent.data)}
      />

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
