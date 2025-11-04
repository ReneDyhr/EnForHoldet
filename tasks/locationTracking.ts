import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { storageService } from '../services/storage';
import { TrackingSession, LocationPoint } from '../types/tracking';

const LOCATION_TASK_NAME = 'background-location-tracking';

// Calculate distance between two points (Haversine formula)
const calculateDistance = (point1: LocationPoint, point2: LocationPoint): number => {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLonRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location tracking error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    for (const location of locations) {
      const locationPoint: LocationPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        speed: location.coords.speed || undefined,
      };

      // Load current session from storage
      const currentSession = await storageService.getCurrentSession();
      
      if (currentSession) {
        const updatedLocations = [...currentSession.locations, locationPoint];
        
        // Calculate total distance
        let totalDistance = 0;
        if (updatedLocations.length > 1) {
          for (let i = 1; i < updatedLocations.length; i++) {
            totalDistance += calculateDistance(
              updatedLocations[i - 1],
              updatedLocations[i]
            );
          }
        }

        const updatedSession: TrackingSession = {
          ...currentSession,
          locations: updatedLocations,
          distance: totalDistance,
          duration: Date.now() - currentSession.startTime,
        };

        // Save to storage
        await storageService.saveCurrentSession(updatedSession);
      } else {
        // Create new session if none exists
        const sessionId = `session_${Date.now()}`;
        const newSession: TrackingSession = {
          id: sessionId,
          startTime: Date.now(),
          locations: [locationPoint],
          distance: 0,
          duration: 0,
        };
        await storageService.saveCurrentSession(newSession);
      }
    }
  }
});

export { LOCATION_TASK_NAME };

