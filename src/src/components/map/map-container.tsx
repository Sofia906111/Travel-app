import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import { Button } from '@/components/form-controls';
import { RatingDot, ratingColor } from '@/components/rating-legend';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useContributions } from '@/context/contributions-context';
import { useTheme } from '@/hooks/use-theme';
import {
  getContributedPlaces,
  getModeForPlaceRatings,
  getRatingsByPlaceOsmIds,
  getRatingsForPlace,
  overallAccessibilityRating,
} from '@/lib/rating';
import {
  FEATURES,
  emptyRatings,
  ratingLabel,
  type Ratings,
} from '@/types/contribution';

type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
};

type NominatimAddress = {
  building?: string;
  amenity?: string;
  tourism?: string;
  shop?: string;
  office?: string;
  leisure?: string;
  road?: string;
  pedestrian?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
  country?: string;
  [key: string]: string | undefined;
};

type PlacePreview = {
  id: string;
  latitude: number;
  longitude: number;
  name: string | null;
  address: string | null;
  featureClass: string | null;
  featureType: string | null;
  osmId: number | null;
  osmType: string | null;
  loading: boolean;
};

type Props = {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  markers?: MapMarker[];
};

const DEFAULT_CENTER = { latitude: 51.75515, longitude: 19.451391 };
const DEFAULT_ZOOM = 17;
const DEFAULT_MARKERS: MapMarker[] = [
  {
    id: 'ife',
    latitude: 51.75515,
    longitude: 19.451391,
    title: 'International Faculty of Engineering',
  },
];

function formatStreet(address: NominatimAddress | null | undefined): string | null {
  if (!address) return null;
  const road = address.road || address.pedestrian;
  const street = [road, address.house_number].filter(Boolean).join(' ');
  return street || null;
}

function formatPlaceAddress(address: NominatimAddress | null | undefined): string | null {
  if (!address) return null;
  const street = formatStreet(address);
  const locality =
    address.city || address.town || address.village || address.municipality || address.suburb;
  const parts = [street, address.postcode, locality, address.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

const PLACE_FEATURE_CLASSES = new Set([
  'amenity',
  'tourism',
  'shop',
  'office',
  'leisure',
  'building',
  'historic',
  'craft',
  'healthcare',
  'club',
  'aerialway',
]);

const CONTRIBUTABLE_FEATURE_CLASSES = new Set(
  [...PLACE_FEATURE_CLASSES].filter((c) => c !== 'amenity'),
);

function placeNameFromAddress(address: NominatimAddress | null | undefined): string | null {
  if (!address) return null;
  const building =
    address.building && address.building !== 'yes' ? address.building : null;
  return (
    address.amenity ||
    address.tourism ||
    address.shop ||
    address.office ||
    address.leisure ||
    building ||
    null
  );
}

function placeName(
  label: string | null | undefined,
  address: NominatimAddress | null | undefined,
  featureClass: string | null | undefined,
): string | null {
  const fromAddress = placeNameFromAddress(address);
  if (fromAddress) return fromAddress;
  if (label && featureClass && PLACE_FEATURE_CLASSES.has(featureClass)) {
    return label;
  }
  return null;
}

async function lookupNominatimByOsmId(osmId: number): Promise<{
  latitude: number;
  longitude: number;
  label: string | null;
  featureClass: string | null;
  featureType: string | null;
  displayName: string | null;
  address: NominatimAddress | null;
  osmType: string | null;
  osmId: number;
} | null> {
  const url = new URL('https://nominatim.openstreetmap.org/lookup');
  url.searchParams.set('osm_ids', `N${osmId},W${osmId},R${osmId}`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'AccessWayTravelApp/1.0 (local-dev)',
    },
  });
  if (!response.ok) return null;

  const results = (await response.json()) as Array<{
    osm_id?: number;
    osm_type?: string;
    lat?: string;
    lon?: string;
    name?: string;
    display_name?: string;
    class?: string;
    type?: string;
    address?: NominatimAddress;
  }>;
  const match =
    results.find((item) => String(item.osm_id) === String(osmId)) ?? results[0];
  if (!match) return null;

  const latitude = match.lat != null ? Number(match.lat) : NaN;
  const longitude = match.lon != null ? Number(match.lon) : NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    osmId,
    osmType: match.osm_type ?? null,
    latitude,
    longitude,
    label: match.name?.trim() || null,
    featureClass: match.class ?? null,
    featureType: match.type ?? null,
    displayName: match.display_name?.trim() || null,
    address: match.address ?? null,
  };
}

function buildMapHtml(
  center: { latitude: number; longitude: number },
  zoom: number,
  markers: MapMarker[],
) {
  const markersJson = JSON.stringify(markers);

  return `<!DOCTYPE html>
<html style="height:100%;width:100%;">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <style>
      * { box-sizing: border-box; }
      html, body {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      #map {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      function sendToApp(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      var map = L.map('map', { zoomControl: true }).setView(
        [${center.latitude}, ${center.longitude}],
        ${zoom}
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      var skipNextClick = false;
      var droppedPin = null;

      function addPin(m) {
        var marker = L.marker([m.latitude, m.longitude]).addTo(map);
        if (m.title) {
          marker.bindPopup(m.title);
        }
        marker.on('click', function () {
          sendToApp({ type: 'markerClick', id: m.id });
        });
        return marker;
      }

      var markers = ${markersJson};
      markers.forEach(addPin);

      var contributionLayer = L.layerGroup().addTo(map);
      window.clearDroppedPin = function () {
        if (droppedPin) {
          map.removeLayer(droppedPin);
          droppedPin = null;
        }
      };
      window.showDroppedPin = function (lat, lng, title) {
        window.clearDroppedPin();
        droppedPin = addPin({
          id: 'selection',
          latitude: lat,
          longitude: lng,
          title: title || 'Selected place',
        });
      };
      window.setContributionMarkers = function (items) {
        contributionLayer.clearLayers();
        if (!items || !items.length) return;
        items.forEach(function (m) {
          var fill = m.fillColor || '#9CA3AF';
          var marker = L.circleMarker([m.latitude, m.longitude], {
            radius: 9,
            color: fill,
            weight: 2,
            fillColor: fill,
            fillOpacity: 0.9,
          }).addTo(contributionLayer);
          marker.on('click', function (e) {
            L.DomEvent.stopPropagation(e);
            skipNextClick = true;
            sendToApp({
              type: 'contributionMarkerClick',
              id: m.id,
              osmId: m.osmId,
              latitude: m.latitude,
              longitude: m.longitude,
              title: m.title || null,
            });
          });
        });
      };

      map.on('click', function (e) {
        if (skipNextClick) {
          skipNextClick = false;
          return;
        }
        sendToApp({
          type: 'mapClick',
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        });
      });

      map.on('dblclick', function (e) {
        sendToApp({
          type: 'mapDblClick',
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        });
      });

      var holdTimer = null;
      var holdStartPoint = null;
      var HOLD_MS = 500;
      var HOLD_MOVE_PX = 12;

      function clearHoldTimer() {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        holdStartPoint = null;
      }

      function reverseGeocode(lat, lng, pinId) {
        var url =
          'https://nominatim.openstreetmap.org/reverse'
          + '?lat=' + encodeURIComponent(lat)
          + '&lon=' + encodeURIComponent(lng)
          + '&format=json'
          + '&addressdetails=1'
          + '&extratags=1'
          + '&namedetails=1'
          + '&zoom=18';

        fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'en',
          },
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            var placeLat = data && data.lat != null ? Number(data.lat) : NaN;
            var placeLng = data && data.lon != null ? Number(data.lon) : NaN;
            var hasPlacePoint = Number.isFinite(placeLat) && Number.isFinite(placeLng);
            console.log('[mapHold] nominatim', {
              dropLat: lat,
              dropLng: lng,
              placeLat: hasPlacePoint ? placeLat : null,
              placeLng: hasPlacePoint ? placeLng : null,
              data: data,
            });
            if (hasPlacePoint && droppedPin) {
              droppedPin.setLatLng([placeLat, placeLng]);
            }
            sendToApp({
              type: 'mapHoldGeocode',
              id: pinId,
              // Prefer the OSM place centroid from Nominatim, not the finger drop point.
              latitude: hasPlacePoint ? placeLat : lat,
              longitude: hasPlacePoint ? placeLng : lng,
              label: data && data.name ? data.name : null,
              featureClass: data && data.class ? data.class : null,
              featureType: data && data.type ? data.type : null,
              displayName: data && data.display_name ? data.display_name : null,
              address: data && data.address ? data.address : null,
              osmType: data && data.osm_type ? data.osm_type : null,
              osmId: data && data.osm_id ? data.osm_id : null,
            });
          })
          .catch(function (err) {
            console.log('[mapHold] nominatim error', err && err.message ? err.message : err);
            sendToApp({
              type: 'mapHoldGeocodeError',
              id: pinId,
              latitude: lat,
              longitude: lng,
              error: String(err && err.message ? err.message : err),
            });
          });
      }

      function startHold(latlng, point) {
        clearHoldTimer();
        holdStartPoint = point;
        holdTimer = setTimeout(function () {
          holdTimer = null;
          skipNextClick = true;
          var pin = {
            id: 'pin-' + Date.now(),
            latitude: latlng.lat,
            longitude: latlng.lng,
            title: 'Dropped pin',
          };
          console.log('[mapHold] lat/lng', pin.latitude, pin.longitude);
          if (droppedPin) {
            map.removeLayer(droppedPin);
          }
          droppedPin = addPin(pin);
          sendToApp({
            type: 'mapHold',
            id: pin.id,
            latitude: pin.latitude,
            longitude: pin.longitude,
          });
          reverseGeocode(pin.latitude, pin.longitude, pin.id);
        }, HOLD_MS);
      }

      map.on('mousedown', function (e) {
        startHold(e.latlng, e.containerPoint);
      });
      map.on('mousemove', function (e) {
        if (holdStartPoint && e.containerPoint.distanceTo(holdStartPoint) > HOLD_MOVE_PX) {
          clearHoldTimer();
        }
      });
      map.on('mouseup', clearHoldTimer);
      map.on('contextmenu', function (e) {
        L.DomEvent.preventDefault(e);
      });

      var mapEl = map.getContainer();
      mapEl.addEventListener('touchstart', function (ev) {
        if (ev.touches.length !== 1) {
          clearHoldTimer();
          return;
        }
        var latlng = map.mouseEventToLatLng(ev.touches[0]);
        startHold(latlng, map.latLngToContainerPoint(latlng));
      }, { passive: true });
      mapEl.addEventListener('touchmove', function (ev) {
        if (!holdStartPoint || !ev.touches[0]) return;
        var point = map.mouseEventToContainerPoint(ev.touches[0]);
        if (point.distanceTo(holdStartPoint) > HOLD_MOVE_PX) {
          clearHoldTimer();
        }
      }, { passive: true });
      mapEl.addEventListener('touchend', clearHoldTimer);
      mapEl.addEventListener('touchcancel', clearHoldTimer);

      sendToApp({ type: 'mapReady' });
      setTimeout(function () { map.invalidateSize(); }, 100);
      window.addEventListener('resize', function () { map.invalidateSize(); });
    </script>
  </body>
</html>`;
}

export default function MapContainer({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  markers = DEFAULT_MARKERS,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { contributions } = useContributions();
  const webRef = useRef<WebView>(null);
  const mapReadyRef = useRef(false);
  const [place, setPlace] = useState<PlacePreview | null>(null);
  const [placeRatings, setPlaceRatings] = useState<Ratings | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  const contributionRevision = useMemo(
    () => contributions.map((item) => `${item.osmId}:${item.updatedAt}`).join('|'),
    [contributions],
  );

  const setContributionMarkers = useCallback(
    (
      items: Array<{
        id: string;
        osmId: number;
        latitude: number;
        longitude: number;
        title: string;
        fillColor: string;
      }>,
    ) => {
      const payload = JSON.stringify(items);
      webRef.current?.injectJavaScript(
        `window.setContributionMarkers && window.setContributionMarkers(${payload}); true;`,
      );
    },
    [],
  );

  const clearDroppedPin = useCallback(() => {
    webRef.current?.injectJavaScript(
      'window.clearDroppedPin && window.clearDroppedPin(); true;',
    );
  }, []);

  const showDroppedPin = useCallback((latitude: number, longitude: number, title?: string) => {
    const safeTitle = JSON.stringify(title ?? 'Selected place');
    webRef.current?.injectJavaScript(
      `window.showDroppedPin && window.showDroppedPin(${latitude}, ${longitude}, ${safeTitle}); true;`,
    );
  }, []);

  const closePlace = useCallback(() => {
    clearDroppedPin();
    setPlace(null);
  }, [clearDroppedPin]);

  const openPlaceFromOsm = useCallback(
    async (input: {
      osmId: number;
      latitude: number;
      longitude: number;
      title?: string | null;
    }) => {
      const pinId = `osm-${input.osmId}`;
      showDroppedPin(input.latitude, input.longitude, input.title ?? undefined);
      setPlace({
        id: pinId,
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.title ?? null,
        address: null,
        featureClass: null,
        featureType: null,
        osmId: input.osmId,
        osmType: null,
        loading: true,
      });

      try {
        const lookedUp = await lookupNominatimByOsmId(input.osmId);
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

        const name =
          placeName(lookedUp.label, lookedUp.address, lookedUp.featureClass) ??
          lookedUp.label ??
          input.title ??
          `OSM ${input.osmId}`;
        const address =
          formatPlaceAddress(lookedUp.address) ?? lookedUp.displayName ?? null;

        showDroppedPin(lookedUp.latitude, lookedUp.longitude, name);
        setPlace((current) => {
          if (!current || current.id !== pinId) return current;
          return {
            id: pinId,
            latitude: lookedUp.latitude,
            longitude: lookedUp.longitude,
            name,
            address,
            featureClass: lookedUp.featureClass,
            featureType: lookedUp.featureType,
            osmId: lookedUp.osmId,
            osmType: lookedUp.osmType,
            loading: false,
          };
        });
      } catch (error) {
        console.log('nominatim lookup failed', error);
        setPlace((current) =>
          current && current.id === pinId ? { ...current, loading: false } : current,
        );
      }
    },
    [showDroppedPin],
  );

  const loadContributionMarkers = useCallback(async () => {
    try {
      const places = await getContributedPlaces();
      const ratingsByPlace = await getRatingsByPlaceOsmIds(places.map((place) => place.osmId));
      const markersForMap = places.map((place) => {
        const ratings = ratingsByPlace.get(place.osmId) ?? emptyRatings();
        const overall = overallAccessibilityRating(ratings);
        return {
          id: String(place.osmId),
          osmId: place.osmId,
          latitude: place.lat,
          longitude: place.lng,
          title: place.label?.trim() || `OSM ${place.osmId}`,
          fillColor: ratingColor(theme, overall),
        };
      });
      console.log('contribution markers', markersForMap.length);
      setContributionMarkers(markersForMap);
    } catch (error) {
      console.log('load contribution markers failed', error);
    }
  }, [setContributionMarkers, theme]);

  useEffect(() => {
    if (!mapReadyRef.current) return;
    void loadContributionMarkers();
  }, [contributionRevision, loadContributionMarkers]);

  const canContribute =
    !!place &&
    !place.loading &&
    place.featureClass != null &&
    CONTRIBUTABLE_FEATURE_CLASSES.has(place.featureClass);

  useEffect(() => {
    if (!place || place.loading || place.osmId == null) {
      setPlaceRatings(null);
      setRatingsLoading(false);
      return;
    }

    let cancelled = false;
    setRatingsLoading(true);
    getRatingsForPlace(place.osmId)
      .then((rows) => {
        if (cancelled) return;
        setPlaceRatings(getModeForPlaceRatings(rows ?? []));
      })
      .catch((err) => {
        console.warn('cant load ratign', err);
        if (!cancelled) setPlaceRatings(emptyRatings());
      })
      .finally(() => {
        if (!cancelled) setRatingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [place?.id, place?.loading, place?.osmId]);

  const onContribute = useCallback(() => {
    if (!place || !canContribute) return;
    const name =
      place.name && place.name !== 'Dropped pin' ? place.name : place.address ?? 'Selected place';
    const addressLine = place.address ?? '';
    const address = addressLine && name !== addressLine ? `${name}, ${addressLine}` : name;
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

  const html = useMemo(
    () => buildMapHtml(center, zoom, markers),
    [center, zoom, markers],
  );

  const handleMessage = useCallback((raw: string) => {
    try {
      const event = JSON.parse(raw) as {
        type: string;
        id?: string;
        latitude?: number;
        longitude?: number;
        label?: string | null;
        title?: string | null;
        featureClass?: string | null;
        featureType?: string | null;
        displayName?: string | null;
        address?: NominatimAddress | null;
        osmId?: number | string | null;
        osmType?: string | null;
        error?: string;
      };

      if (event.type === 'mapReady') {
        mapReadyRef.current = true;
        void loadContributionMarkers();
        return;
      }

      console.log('Map event', event);

      if (event.type === 'mapHold' && event.id != null && event.latitude != null && event.longitude != null) {
        setPlace({
          id: event.id,
          latitude: event.latitude,
          longitude: event.longitude,
          name: null,
          address: null,
          featureClass: null,
          featureType: null,
          osmId: null,
          osmType: null,
          loading: true,
        });
        return;
      }

      if (event.type === 'mapHoldGeocode' && event.id != null) {
        const osmIdNum =
          event.osmId != null && event.osmId !== '' ? Number(event.osmId) : NaN;
        const hasOsmId = Number.isFinite(osmIdNum);
        const name = hasOsmId
          ? placeName(event.label, event.address, event.featureClass)
          : null;
        const latitude = event.latitude ?? 0;
        const longitude = event.longitude ?? 0;
        const address = hasOsmId
          ? formatPlaceAddress(event.address) ?? event.displayName ?? null
          : null;
        const osmType =
          typeof event.osmType === 'string' && event.osmType.trim()
            ? event.osmType.trim()
            : null;
        setPlace((current) => {
          if (current && current.id !== event.id) return current;
          return {
            id: event.id!,
            latitude: event.latitude ?? current?.latitude ?? 0,
            longitude: event.longitude ?? current?.longitude ?? 0,
            name: name ?? 'Dropped pin',
            address,
            featureClass: event.featureClass ?? null,
            featureType: event.featureType ?? null,
            osmId: hasOsmId ? osmIdNum : null,
            osmType,
            loading: false,
          };
        });
        return;
      }

      if (event.type === 'mapHoldGeocodeError' && event.id != null) {
        setPlace((current) => {
          if (current && current.id !== event.id) return current;
          return {
            id: event.id!,
            latitude: event.latitude ?? current?.latitude ?? 0,
            longitude: event.longitude ?? current?.longitude ?? 0,
            name: 'Dropped pin',
            address: null,
            featureClass: null,
            featureType: null,
            osmId: null,
            osmType: null,
            loading: false,
          };
        });
        return;
      }

      if (event.type === 'contributionMarkerClick' && event.osmId != null) {
        const osmIdNum = Number(event.osmId);
        if (!Number.isFinite(osmIdNum) || event.latitude == null || event.longitude == null) {
          return;
        }
        void openPlaceFromOsm({
          osmId: osmIdNum,
          latitude: event.latitude,
          longitude: event.longitude,
          title: typeof event.title === 'string' ? event.title : null,
        });
        return;
      }

      if (event.type === 'mapClick') {
        closePlace();
      }
    } catch {
      console.log('Map event', raw);
    }
  }, [closePlace, loadContributionMarkers, openPlaceFromOsm]);

  return (
    <View style={styles.map}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        style={styles.webview}
        containerStyle={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        mixedContentMode="always"
        scrollEnabled={false}
        scalesPageToFit={false}
        onLoadEnd={() => {
          console.log('Map WebView loaded');
        }}
        onMessage={(event) => {
          handleMessage(event.nativeEvent.data);
        }}
      />

      {place ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.placeCardWrap,
            { paddingBottom: Math.max(insets.bottom, Spacing.three) },
          ]}
        >
          <View
            style={[
              styles.placeCard,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.placeCardHeader}>
              <View style={styles.placeCardText}>
                {place.loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.primary} size="small" />
                    <ThemedText themeColor="textSecondary">Looking up place…</ThemedText>
                  </View>
                ) : (
                  <>
                    <ThemedText type="heading" numberOfLines={2}>
                      {place.name ?? 'Dropped pin'}
                    </ThemedText>
                    {place.address ? (
                      <ThemedText themeColor="textSecondary" numberOfLines={3}>
                        {place.address}
                      </ThemedText>
                    ) : null}
                  </>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close place details"
                hitSlop={12}
                onPress={closePlace}
                style={[styles.closeButton, { backgroundColor: theme.backgroundSelected }]}
              >
                <ThemedText type="smallBold">X</ThemedText>
              </Pressable>
            </View>

            {!place.loading && place.osmId != null ? (
              <View style={styles.ratingsList}>
                {ratingsLoading || !placeRatings ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.primary} size="small" />
                    <ThemedText type="small" themeColor="textSecondary">
                      Loading ratings…
                    </ThemedText>
                  </View>
                ) : (
                  FEATURES.map((feature) => {
                    const rating = placeRatings[feature.key];
                    return (
                      <View key={feature.key} style={styles.ratingRow}>
                        <RatingDot rating={rating} />
                        <ThemedText type="small" style={styles.ratingLabel} numberOfLines={2}>
                          {feature.label}: {ratingLabel(rating)}
                        </ThemedText>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {canContribute ? (
              <View style={styles.contributeRow}>
                <Button
                  title="Contribute"
                  onPress={onContribute}
                  accessibilityHint={`Rate accessibility for ${place.name ?? 'this place'}`}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  placeCardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  placeCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  placeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  placeCardText: {
    flex: 1,
    gap: 4,
  },
  contributeRow: {
    marginTop: Spacing.three,
  },
  ratingsList: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ratingLabel: {
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 28,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
