export type PlaceLocation = {
  lat: number;
  lng: number;
  label?: string;
};

export type PlaceRow = {
  osmId: number;
  lat: number;
  lng: number;
  label: string | null;
};
