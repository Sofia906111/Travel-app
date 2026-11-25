export type NominatimAddress = {
  building?: string;
  amenity?: string;
  tourism?: string;
  shop?: string;
  office?: string;
  leisure?: string;
  road?: string;
  pedestrian?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
  country?: string;
  [key: string]: string | undefined;
};

export type NominatimPlace = {
  osmId: number | null;
  osmType: string | null;
  latitude: number;
  longitude: number;
  label: string | null;
  featureClass: string | null;
  featureType: string | null;
  displayName: string | null;
  address: NominatimAddress | null;
};

export type PlacePreview = {
  id: string;
  latitude: number;
  longitude: number;
  name: string | null;
  address: string | null;
  featureClass: string | null;
  featureType: string | null;
  osmId: number | null;
  osmType: string | null;
  loading: boolean;
};
