export type Category = 'mixed' | 'plastic' | 'metal' | 'glass' | 'paper' | 'other';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
}

export interface TrackingSession {
  id: string;
  name?: string;
  startTime: number;
  endTime?: number;
  locations: LocationPoint[];
  distance?: number; // in meters
  duration?: number; // in seconds
  totalWeightG?: number; // in grams (store in g, display kg)
  foundCategories?: Category[]; // simple list for the whole session
}

