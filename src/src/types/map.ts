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

export type MapCommandArgs = {
  setTilesUrl: [url: string];
  setView: [lat: number, lng: number, zoom?: number | null];
  clearDroppedPin: [];
  showDroppedPin: [lat: number, lng: number, title?: string | null];
  setContributionMarkers: [items: ContributionMarker[]];
  setUserLocation: [lat: number, lng: number, accuracy?: number | null];
};

export type MapCommand = keyof MapCommandArgs;

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
