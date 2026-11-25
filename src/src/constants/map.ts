import { Themes, type ThemeName } from './theme';

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAP_TILES_URL: Record<ThemeName, string> = {
  [Themes.Light]: OSM_TILES,
  [Themes.Dark]: OSM_TILES,
  [Themes.HighContrast]: 'https://tiles-eu.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png',
};

export const PLACE_FEATURE_CLASSES = new Set([
  'amenity',
  'tourism',
  'shop',
  'office',
  'leisure',
  'building',
  'historic',
  'craft',
  'healthcare',
  'club',
  'aerialway',
]);

export const DEFAULT_CENTER = { latitude: 51.75515, longitude: 19.451391 };
export const DEFAULT_ZOOM = 17;
