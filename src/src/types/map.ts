export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title?: string | null;
};

export type ContributionMarker = MapMarker & {
  osmId: number;
  fillColor: string;
};

export type MapEvent =
  | { type: 'mapReady' }
  | { type: 'mapClick'; latitude: number; longitude: number }
  | { type: 'mapHold'; id: string; latitude: number; longitude: number }
  | {
      type: 'contributionMarkerClick';
      osmId: number;
      latitude: number;
      longitude: number;
      title: string | null;
    };
