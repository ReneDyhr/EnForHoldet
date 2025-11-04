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
}

