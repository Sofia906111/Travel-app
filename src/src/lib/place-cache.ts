import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'accessway.place-cache.v1';
const NOMINATIM_USER_AGENT = 'AccessWayTravelApp/1.0 (local-dev)';

export type CachedPlace = {
  osmId: number;
  osmType?: string | null;
  label: string;
  address?: string;
  lat: number | null;
  lng: number | null;
  featureClass?: string | null;
  featureType?: string | null;
  cachedAt: number;
};

type PlaceCache = Record<string, CachedPlace>;

async function readCache(): Promise<PlaceCache> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as PlaceCache;
  } catch {
    return {};
  }
}

async function writeCache(cache: PlaceCache): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export async function getCachedPlace(osmId: number): Promise<CachedPlace | null> {
  const cache = await readCache();
  return cache[String(osmId)] ?? null;
}

export async function getCachedPlaces(osmIds: number[]): Promise<Map<number, CachedPlace>> {
  const cache = await readCache();
  const result = new Map<number, CachedPlace>();
  for (const osmId of osmIds) {
    const place = cache[String(osmId)];
    if (place) result.set(osmId, place);
  }
  return result;
}

export async function cachePlace(place: Omit<CachedPlace, 'cachedAt'>): Promise<CachedPlace> {
  const entry: CachedPlace = { ...place, cachedAt: Date.now() };
  const cache = await readCache();
  cache[String(place.osmId)] = entry;
  await writeCache(cache);
  return entry;
}

function osmLookupPrefix(osmType?: string | null): string {
  const t = (osmType ?? '').toLowerCase();
  if (t.startsWith('n')) return 'N';
  if (t.startsWith('w')) return 'W';
  if (t.startsWith('r')) return 'R';
  return '';
}

async function fetchNominatimPlace(
  osmId: number,
  osmType?: string | null,
): Promise<CachedPlace | null> {
  const prefix = osmLookupPrefix(osmType);
  const osmIds = prefix
    ? `${prefix}${osmId}`
    : `N${osmId},W${osmId},R${osmId}`;

  const url = new URL('https://nominatim.openstreetmap.org/lookup');
  url.searchParams.set('osm_ids', osmIds);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });
  if (!response.ok) return null;

  const results = (await response.json()) as Array<{
    osm_id?: number;
    osm_type?: string;
    name?: string;
    display_name?: string;
    lat?: string;
    lon?: string;
    class?: string;
    type?: string;
  }>;

  const match =
    results.find((item) => String(item.osm_id) === String(osmId)) ?? results[0];
  if (!match) return null;

  const lat = match.lat != null ? Number(match.lat) : NaN;
  const lng = match.lon != null ? Number(match.lon) : NaN;
  const label = match.name?.trim() || match.display_name?.trim() || `OSM ${osmId}`;

  return cachePlace({
    osmId,
    osmType: match.osm_type ?? osmType ?? null,
    label,
    address: match.display_name?.trim() || undefined,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    featureClass: match.class ?? null,
    featureType: match.type ?? null,
  });
}

/** Local cache first; Nominatim lookup only on miss. */
export async function resolvePlace(
  osmId: number,
  osmType?: string | null,
): Promise<CachedPlace | null> {
  const cached = await getCachedPlace(osmId);
  if (cached) return cached;
  try {
    return await fetchNominatimPlace(osmId, osmType);
  } catch (error) {
    console.log('nominatim place lookup failed', error);
    return null;
  }
}

export async function resolvePlaces(osmIds: number[]): Promise<Map<number, CachedPlace>> {
  const cached = await getCachedPlaces(osmIds);
  const missing = osmIds.filter((id) => !cached.has(id));
  for (const osmId of missing) {
    const place = await resolvePlace(osmId);
    if (place) cached.set(osmId, place);
  }
  return cached;
}
