export type NominatimPlace = {
  osmId: number | null;
  osmType: string | null;
  latitude: number;
  longitude: number;
  name: string | null;
  displayName: string | null;
  featureClass: string | null;
  featureType: string | null;
};

export type PlacePreview = {
  id: string;
  latitude: number;
  longitude: number;
  name: string | null;
  displayName: string | null;
  featureClass: string | null;
  featureType: string | null;
  osmId: number | null;
  osmType: string | null;
  loading: boolean;
};
