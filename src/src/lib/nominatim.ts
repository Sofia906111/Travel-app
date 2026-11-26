import type { NominatimPlace, PlacePreview } from '@/types/nominatim';

export type { NominatimPlace, PlacePreview } from '@/types/nominatim';

export const DROPPED_PIN = 'Dropped pin';

type RawResult = {
  osm_id?: number;
  osm_type?: string;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  /** Present on older `json` format. */
  class?: string;
  /** Present on `jsonv2` format (what we request). */
  category?: string;
  type?: string;
};

const BASE_URL = 'https://nominatim.openstreetmap.org';

const HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en',
  'User-Agent': 'AccessWayTravelApp/1.0 (local-dev)',
};

export function loadingPlace(
  id: string,
  latitude: number,
  longitude: number,
  osmId: number | null = null,
): PlacePreview {
  return {
    id,
    latitude,
    longitude,
    name: null,
    displayName: null,
    featureClass: null,
    featureType: null,
    osmId,
    osmType: null,
    loading: true,
  };
}

export function resolvedPlace(base: PlacePreview, place: NominatimPlace | null): PlacePreview {
  return {
    ...base,
    latitude: place?.latitude ?? base.latitude,
    longitude: place?.longitude ?? base.longitude,
    name: place?.name ?? DROPPED_PIN,
    displayName: place?.displayName ?? null,
    featureClass: place?.featureClass ?? null,
    featureType: place?.featureType ?? null,
    osmType: place?.osmType ?? null,
    osmId: place?.osmId ?? base.osmId,
    loading: false,
  };
}

function parsePlace(raw: RawResult | undefined): NominatimPlace | null {
  if (!raw) return null;
  const latitude = raw.lat != null ? Number(raw.lat) : NaN;
  const longitude = raw.lon != null ? Number(raw.lon) : NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const osmId = raw.osm_id != null ? Number(raw.osm_id) : NaN;
  return {
    osmId: Number.isFinite(osmId) ? osmId : null,
    osmType: raw.osm_type ?? null,
    latitude,
    longitude,
    name: raw.name?.trim() || null,
    displayName: raw.display_name?.trim() || null,
    featureClass: raw.category ?? raw.class ?? null,
    featureType: raw.type ?? null,
  };
}

export async function lookupByOsmId(osmId: number): Promise<NominatimPlace | null> {
  const url = new URL(`${BASE_URL}/lookup`);
  url.searchParams.set('osm_ids', `N${osmId},W${osmId},R${osmId}`);
  url.searchParams.set('format', 'jsonv2');

  const response = await fetch(url.toString(), { headers: HEADERS });
  if (!response.ok) {
    console.log('nominatim lookup failed', response.status, url.toString());
    return null;
  }

  const results = (await response.json()) as RawResult[];
  console.log('nominatim lookup', osmId, results);
  return parsePlace(results.find((r) => String(r.osm_id) === String(osmId)) ?? results[0]);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<NominatimPlace | null> {
  const url = new URL(`${BASE_URL}/reverse`);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '18');

  const response = await fetch(url.toString(), { headers: HEADERS });
  if (!response.ok) {
    console.log('nominatim reverse failed', response.status, url.toString());
    return null;
  }

  const raw = (await response.json()) as RawResult;
  console.log('nominatim reverse', raw);
  return parsePlace(raw);
}

/** Forward geocode a place name / address. Returns up to `limit` matches. */
export async function searchPlaces(query: string, limit = 8): Promise<NominatimPlace[]> {
  const q = query.trim();
  if (!q) return [];

  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString(), { headers: HEADERS });
  if (!response.ok) {
    console.log('nominatim search failed', response.status, url.toString());
    return [];
  }

  const results = (await response.json()) as RawResult[];
  console.log('nominatim search', q, results.length);
  return results.map(parsePlace).filter((place): place is NominatimPlace => place != null);
}
