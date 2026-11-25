import { PLACE_FEATURE_CLASSES } from '@/constants/map';
import type { NominatimAddress, NominatimPlace, PlacePreview } from '@/types/nominatim';

export type { NominatimAddress, NominatimPlace, PlacePreview } from '@/types/nominatim';

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
  address?: NominatimAddress;
};

const BASE_URL = 'https://nominatim.openstreetmap.org';

const HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en',
  'User-Agent': 'AccessWayTravelApp/1.0 (local-dev)',
};

function formatStreet(address: NominatimAddress | null | undefined): string | null {
  if (!address) return null;
  const road = address.road || address.pedestrian;
  const street = [road, address.house_number].filter(Boolean).join(' ');
  return street || null;
}

export function formatPlaceAddress(address: NominatimAddress | null | undefined): string | null {
  if (!address) return null;
  const locality =
    address.city || address.town || address.village || address.municipality || address.suburb;
  const parts = [formatStreet(address), address.postcode, locality, address.country].filter(
    Boolean,
  );
  return parts.length ? parts.join(', ') : null;
}

function placeNameFromAddress(address: NominatimAddress | null | undefined): string | null {
  if (!address) return null;
  const building = address.building && address.building !== 'yes' ? address.building : null;
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

export function placeName(
  label: string | null | undefined,
  address: NominatimAddress | null | undefined,
  featureClass: string | null | undefined,
): string | null {
  const fromAddress = placeNameFromAddress(address);
  if (fromAddress) return fromAddress;
  if (label && featureClass && PLACE_FEATURE_CLASSES.has(featureClass)) return label;
  return null;
}

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
    address: null,
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
    name: place
      ? (placeName(place.label, place.address, place.featureClass) ?? DROPPED_PIN)
      : DROPPED_PIN,
    address: place ? (formatPlaceAddress(place.address) ?? place.displayName) : null,
    featureClass: place?.featureClass ?? null,
    featureType: place?.featureType ?? null,
    osmType: place?.osmType ?? null,
    osmId: place?.osmId ?? null,
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
    label: raw.name?.trim() || null,
    featureClass: raw.category ?? raw.class ?? null,
    featureType: raw.type ?? null,
    displayName: raw.display_name?.trim() || null,
    address: raw.address ?? null,
  };
}

export async function lookupByOsmId(osmId: number): Promise<NominatimPlace | null> {
  const url = new URL(`${BASE_URL}/lookup`);
  url.searchParams.set('osm_ids', `N${osmId},W${osmId},R${osmId}`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');

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
  url.searchParams.set('addressdetails', '1');
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
