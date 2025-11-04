import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { TrackingSession, LocationPoint } from '../types/tracking';
import { storageService } from '../services/storage';
import { LOCATION_TASK_NAME } from '../tasks/locationTracking';

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

  // Request location permissions (foreground and background)
  const requestPermissions = async (): Promise<boolean> => {
    try {
      // First check if foreground permission is already granted
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
      
      let foregroundStatus = currentStatus;
      
      // Request foreground permission if not already granted
      if (currentStatus !== 'granted') {
        const requestResult = await Location.requestForegroundPermissionsAsync();
        foregroundStatus = requestResult.status;
      }
      
      if (foregroundStatus !== 'granted') {
        setError('Location permission is required to track your workout. Please enable it in Settings.');
        return false;
      }

      // Try to request background permission (may not be available on all platforms)
      try {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          // On iOS, background permission might require user to enable "Always" in Settings
          console.warn('Background location permission not granted. Tracking may stop when app is backgrounded.');
          // Don't set error here - allow tracking to continue with foreground permission
        }
      } catch (backgroundErr) {
        // Background permission request might fail on some platforms or iOS versions
        console.warn('Could not request background permission:', backgroundErr);
        // Continue with foreground permission only
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Permission request error:', err);
      setError(`Failed to request location permission: ${errorMessage}`);
      return false;
    }
  };

  // Location update handler
  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    const locationPoint: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      accuracy: location.coords.accuracy || undefined,
      altitude: location.coords.altitude || undefined,
      speed: location.coords.speed || undefined,
    };

    setCurrentSession((prev) => {
      if (!prev) {
        // If no session exists, create one (for background recovery)
        const sessionId = `session_${Date.now()}`;
        const newSession: TrackingSession = {
          id: sessionId,
          startTime: Date.now(),
          locations: [locationPoint],
          distance: 0,
          duration: 0,
        };
        storageService.saveCurrentSession(newSession);
        return newSession;
      }

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
  }, []);

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

      // Try to start background location updates (may not work in Expo Go)
      try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 5, // Update every 5 meters
          foregroundService: {
            notificationTitle: 'Tracking Session',
            notificationBody: 'Your workout is being tracked',
            notificationColor: '#007AFF',
          },
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.Fitness,
          mayShowUserSettingsDialog: true,
          deferredUpdatesInterval: 0, // Process updates immediately
          deferredUpdatesDistance: 0,
        });
      } catch (backgroundError) {
        // Background location may not be available in Expo Go
        console.warn('Background location not available (may be running in Expo Go):', backgroundError);
        // Continue with foreground tracking only
      }

      // Always use watchPositionAsync for immediate updates (works in foreground)
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        handleLocationUpdate
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tracking');
      setIsTracking(false);
    }
  }, [handleLocationUpdate]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    try {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      // Stop background location updates (if they were started)
      try {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      } catch (stopError) {
        // Ignore errors if background tracking wasn't started (e.g., in Expo Go)
        console.warn('Could not stop background location updates:', stopError);
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
            // Try to restart background location updates (may not work in Expo Go)
            try {
              await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: 1000,
                distanceInterval: 5,
                foregroundService: {
                  notificationTitle: 'Tracking Session',
                  notificationBody: 'Your workout is being tracked',
                  notificationColor: '#007AFF',
                },
                pausesUpdatesAutomatically: false,
                activityType: Location.ActivityType.Fitness,
                deferredUpdatesInterval: 0,
                deferredUpdatesDistance: 0,
              });
            } catch (backgroundError) {
              console.warn('Background location not available:', backgroundError);
            }

            // Always use watchPositionAsync for immediate updates
            locationSubscriptionRef.current = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: 1000,
                distanceInterval: 5,
              },
              handleLocationUpdate
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

