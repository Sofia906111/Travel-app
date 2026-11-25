import * as Location from 'expo-location';

export type LocationResult =
  | { kind: 'success'; latitude: number; longitude: number; address: string | null }
  | { kind: 'permissionDenied'; canAskAgain: boolean }
  | { kind: 'servicesDisabled' }
  | { kind: 'error'; message: string };

const TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);
}

export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { kind: 'permissionDenied', canAskAgain: permission.canAskAgain };
    }
    if (!(await Location.hasServicesEnabledAsync())) return { kind: 'servicesDisabled' };

    const position =
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        TIMEOUT_MS,
      ).catch(() => null)) ?? (await Location.getLastKnownPositionAsync());
    if (!position) return { kind: 'error', message: 'no location fix' };

    const { latitude, longitude } = position.coords;
    return {
      kind: 'success',
      latitude,
      longitude,
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
