import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
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
      var map = L.map('map', { zoomControl: true }).setView(
        [${center.latitude}, ${center.longitude}],
        ${zoom}
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      var markers = ${markersJson};
      markers.forEach(function (m) {
        var marker = L.marker([m.latitude, m.longitude]).addTo(map);
        if (m.title) {
          marker.bindPopup(m.title);
        }
      });

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
  const html = useMemo(
    () => buildMapHtml(center, zoom, markers),
    [center, zoom, markers],
  );

  return (
    <View style={styles.map}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        containerStyle={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        mixedContentMode="always"
        scrollEnabled={false}
        scalesPageToFit={false}
      />
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
});
