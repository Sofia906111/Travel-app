import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import { Button } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

/** Contribute button: same as places, but amenities are excluded. */
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
  // Only use Nominatim's name when the feature itself is a place, not a road.
  if (label && featureClass && PLACE_FEATURE_CLASSES.has(featureClass)) {
    return label;
  }
  return null;
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
            console.log('[mapHold] nominatim', { lat: lat, lng: lng, data: data });
            sendToApp({
              type: 'mapHoldGeocode',
              id: pinId,
              latitude: lat,
              longitude: lng,
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
  const [place, setPlace] = useState<PlacePreview | null>(null);

  const canContribute =
    !!place &&
    !place.loading &&
    place.featureClass != null &&
    CONTRIBUTABLE_FEATURE_CLASSES.has(place.featureClass);

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
        featureClass?: string | null;
        featureType?: string | null;
        displayName?: string | null;
        address?: NominatimAddress | null;
        osmId?: number | string | null;
        error?: string;
      };
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
          loading: true,
        });
        return;
      }

      if (event.type === 'mapHoldGeocode' && event.id != null) {
        const hasOsmId = event.osmId != null && event.osmId !== '';
        const name = hasOsmId
          ? placeName(event.label, event.address, event.featureClass)
          : null;
        setPlace((current) => {
          if (current && current.id !== event.id) return current;
          return {
            id: event.id!,
            latitude: event.latitude ?? current?.latitude ?? 0,
            longitude: event.longitude ?? current?.longitude ?? 0,
            name: name ?? 'Dropped pin',
            address: hasOsmId
              ? formatPlaceAddress(event.address) ?? event.displayName ?? null
              : null,
            featureClass: event.featureClass ?? null,
            featureType: event.featureType ?? null,
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
            loading: false,
          };
        });
        return;
      }

      if (event.type === 'mapClick') {
        setPlace(null);
      }
    } catch {
      console.log('Map event', raw);
    }
  }, []);

  return (
    <View style={styles.map}>
      <WebView
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
                onPress={() => setPlace(null)}
                style={[styles.closeButton, { backgroundColor: theme.backgroundSelected }]}
              >
                <ThemedText type="smallBold">X</ThemedText>
              </Pressable>
            </View>
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
