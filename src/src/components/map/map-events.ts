import type { MapEvent } from '@/types/map';

export type { ContributionMarker, MapEvent, MapMarker } from '@/types/map';

export function parseMapEvent(raw: string): MapEvent | null {
  let parsed: MapEvent;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (parsed.type === undefined) return null;

  console.log('parsed', parsed);

  switch (parsed.type) {
    case 'mapReady':
      return { type: 'mapReady' };

    case 'mapClick': {
      const latitude = parsed.latitude;
      const longitude = parsed.longitude;
      return { type: 'mapClick', latitude, longitude };
    }

    case 'mapHold': {
      return {
        type: 'mapHold',
        id: parsed.id,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      };
    }

    case 'contributionMarkerClick': {
      return {
        type: 'contributionMarkerClick',
        osmId: parsed.osmId,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        title: parsed.title,
      };
    }

    default:
      return null;
  }
}
