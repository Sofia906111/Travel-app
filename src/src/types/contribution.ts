import type { Ratings } from '@/types/rating';

export type Contribution = {
  id: string;
  address: string;
  osmId: number;
  latitude: number | null;
  longitude: number | null;
  ratings: Ratings;
  createdAt: number;
  updatedAt: number;
};
