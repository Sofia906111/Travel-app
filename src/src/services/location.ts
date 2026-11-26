import * as Location from 'expo-location';

export type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type LocationResult =
  | ({ kind: 'success'; address: string | null } & LocationCoords)
  | { kind: 'permissionDenied'; canAskAgain: boolean }
  | { kind: 'servicesDisabled' }
  | { kind: 'error'; message: string };

const TIMEOUT_MS = 15000;
const POLL_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);
}

async function ensureLocationReady(): Promise<
  | { kind: 'ready' }
  | { kind: 'permissionDenied'; canAskAgain: boolean }
  | { kind: 'servicesDisabled' }
> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return { kind: 'permissionDenied', canAskAgain: permission.canAskAgain };
  }
  if (!(await Location.hasServicesEnabledAsync())) return { kind: 'servicesDisabled' };
  return { kind: 'ready' };
}

async function readPosition(timeoutMs: number): Promise<Location.LocationObject | null> {
  return (
    (await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutMs,
    ).catch(() => null)) ?? (await Location.getLastKnownPositionAsync())
  );
}

/** Lat/lng/accuracy only — suitable for frequent map updates. */
export async function getCurrentCoordinates(): Promise<LocationResult> {
  try {
    const ready = await ensureLocationReady();
    if (ready.kind !== 'ready') return ready;

    const position = await readPosition(POLL_TIMEOUT_MS);
    if (!position) return { kind: 'error', message: 'no location fix' };

    const { latitude, longitude, accuracy } = position.coords;
    return {
      kind: 'success',
      latitude,
      longitude,
      accuracy: typeof accuracy === 'number' ? accuracy : null,
      address: null,
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'location error' };
  }
}

export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    const ready = await ensureLocationReady();
    if (ready.kind !== 'ready') return ready;

    const position = await readPosition(TIMEOUT_MS);
    if (!position) return { kind: 'error', message: 'no location fix' };

    const { latitude, longitude, accuracy } = position.coords;
    return {
      kind: 'success',
      latitude,
      longitude,
      accuracy: typeof accuracy === 'number' ? accuracy : null,
      address: await reverseGeocode(latitude, longitude),
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'location error' };
  }
}

/** Returns null when geocoding is unavailable (for example offline); the caller uses coordinates. */
async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const [a] = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      TIMEOUT_MS,
    );
    if (!a) return null;
    if (a.formattedAddress) return a.formattedAddress;
    const street = [a.street, a.streetNumber].filter(Boolean).join(' ');
    const parts = [street, a.postalCode, a.city, a.country].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  } catch {
    return null;
  }
}
