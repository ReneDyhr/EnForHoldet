import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { TrackingSession, LocationPoint } from '../types/tracking';
import { storageService } from '../services/storage';

export const useLocationTracking = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrackingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

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

  // Request location permissions
  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission not granted');
        return false;
      }
      return true;
    } catch (err) {
      setError('Failed to request location permission');
      return false;
    }
  };

  // Start tracking
  const startTracking = useCallback(async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      setError(null);

      // Create new session
      const sessionId = `session_${Date.now()}`;
      const newSession: TrackingSession = {
        id: sessionId,
        startTime: Date.now(),
        locations: [],
      };

      setCurrentSession(newSession);
      setIsTracking(true);

      // Subscribe to location updates
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 5, // Update every 5 meters
        },
        (location) => {
          const locationPoint: LocationPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
            accuracy: location.coords.accuracy || undefined,
            altitude: location.coords.altitude || undefined,
            speed: location.coords.speed || undefined,
          };

          setCurrentSession((prev) => {
            if (!prev) return prev;
            const updatedLocations = [...prev.locations, locationPoint];
            
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

            const updatedSession = {
              ...prev,
              locations: updatedLocations,
              distance: totalDistance,
              duration: Date.now() - prev.startTime,
            };

            // Save to storage for recovery
            storageService.saveCurrentSession(updatedSession);

            return updatedSession;
          });
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tracking');
      setIsTracking(false);
    }
  }, []);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    try {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      if (currentSession) {
        const finalSession: TrackingSession = {
          ...currentSession,
          endTime: Date.now(),
          duration: Date.now() - currentSession.startTime,
        };

        // Save session to storage
        await storageService.saveSession(finalSession);
        
        // Clear current session from storage
        await storageService.saveCurrentSession(null);
        
        setCurrentSession(null);
      }

      setIsTracking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop tracking');
    }
  }, [currentSession]);

  // Load any active session on mount (for recovery)
  useEffect(() => {
    const loadActiveSession = async () => {
      const activeSession = await storageService.getCurrentSession();
      if (activeSession) {
        setCurrentSession(activeSession);
        setIsTracking(true);
        // Resume tracking by restarting location watching
        try {
          const hasPermission = await requestPermissions();
          if (hasPermission) {
            locationSubscriptionRef.current = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: 1000,
                distanceInterval: 5,
              },
              (location) => {
                const locationPoint: LocationPoint = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  timestamp: location.timestamp,
                  accuracy: location.coords.accuracy || undefined,
                  altitude: location.coords.altitude || undefined,
                  speed: location.coords.speed || undefined,
                };

                setCurrentSession((prev) => {
                  if (!prev) return prev;
                  const updatedLocations = [...prev.locations, locationPoint];
                  
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

                  const updatedSession = {
                    ...prev,
                    locations: updatedLocations,
                    distance: totalDistance,
                    duration: Date.now() - prev.startTime,
                  };

                  // Save to storage for recovery
                  storageService.saveCurrentSession(updatedSession);

                  return updatedSession;
                });
              }
            );
          }
        } catch (err) {
          console.error('Error resuming tracking:', err);
          setError('Failed to resume tracking');
        }
      }
    };
    loadActiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
    };
  }, []);

  return {
    isTracking,
    currentSession,
    error,
    startTracking,
    stopTracking,
  };
};

