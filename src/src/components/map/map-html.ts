/** Static Leaflet map shell. Center/zoom/tiles come from `window.__MAP_CONFIG__`; markers via injectJavaScript. */
export const MAP_HTML = `<!DOCTYPE html>
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

      var config = window.__MAP_CONFIG__ || {};
      var center = config.center || {};
      var centerLat = typeof center.latitude === 'number' ? center.latitude : 51.75515;
      var centerLng = typeof center.longitude === 'number' ? center.longitude : 19.451391;
      var zoom = typeof config.zoom === 'number' ? config.zoom : 17;
      var tilesUrl =
        typeof config.tilesUrl === 'string' && config.tilesUrl
          ? config.tilesUrl
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      var map = L.map('map', { zoomControl: true }).setView(
        [centerLat, centerLng],
        zoom
      );

      var tileLayer = L.tileLayer(tilesUrl, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      window.setTilesUrl = function (url) {
        if (!url || url === tilesUrl) return;
        tilesUrl = url;
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(url, {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
      };

      var skipNextClick = false;
      var droppedPin = null;
      var markersLayer = L.layerGroup().addTo(map);
      var contributionLayer = L.layerGroup().addTo(map);

      function addPin(m, layer) {
        var marker = L.marker([m.latitude, m.longitude]).addTo(layer || map);
        if (m.title) {
          marker.bindPopup(m.title);
        }
        marker.on('click', function () {
          sendToApp({ type: 'markerClick', id: m.id });
        });
        return marker;
      }

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

      window.setMapMarkers = function (items) {
        markersLayer.clearLayers();
        if (!items || !items.length) return;
        items.forEach(function (m) {
          addPin(m, markersLayer);
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

      function dropPinAt(latlng) {
        skipNextClick = true;
        var pin = {
          id: 'pin-' + Date.now(),
          latitude: latlng.lat,
          longitude: latlng.lng,
          title: 'Dropped pin',
        };
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
      }

      // Leaflet fires contextmenu on long-press on mobile; also covers desktop right-click.
      map.on('contextmenu', function (e) {
        L.DomEvent.preventDefault(e);
        dropPinAt(e.latlng);
      });

      sendToApp({ type: 'mapReady' });
      setTimeout(function () { map.invalidateSize(); }, 100);
      window.addEventListener('resize', function () { map.invalidateSize(); });
    </script>
  </body>
</html>`;
