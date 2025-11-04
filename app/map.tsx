import { View, StyleSheet, ActivityIndicator, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { TrackingSession } from '../types/tracking';
import { storageService } from '../services/storage';

// Try to import react-native-maps, but handle gracefully if it's not available
let MapView: any = null;
let Polyline: any = null;
let Marker: any = null;
let mapsAvailable = false;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Polyline = maps.Polyline;
  Marker = maps.Marker;
  mapsAvailable = true;
} catch (error) {
  console.warn('react-native-maps not available. Map visualization disabled.');
  mapsAvailable = false;
}

export default function Map() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      if (sessionId) {
        try {
          const loadedSession = await storageService.getSession(sessionId);
          setSession(loadedSession);
        } catch (error) {
          console.error('Error loading session:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!session || session.locations.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Session not found or has no locations</Text>
      </View>
    );
  }

  // If maps are not available, show coordinates list and instructions
  if (!mapsAvailable || !MapView) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.fallbackContainer}>
        <View style={styles.fallbackContent}>
          <Text style={styles.fallbackTitle}>Map Visualization Unavailable</Text>
          <Text style={styles.fallbackText}>
            To view tracks on a map, you need to create a development build with native modules enabled.
          </Text>
          
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionInfoTitle}>Session Details</Text>
            <Text style={styles.sessionInfoText}>
              <Text style={styles.bold}>Locations:</Text> {session.locations.length} points
            </Text>
            <Text style={styles.sessionInfoText}>
              <Text style={styles.bold}>Distance:</Text> {session.distance ? `${(session.distance / 1000).toFixed(2)} km` : 'N/A'}
            </Text>
            <Text style={styles.sessionInfoText}>
              <Text style={styles.bold}>Duration:</Text> {session.duration ? `${Math.floor(session.duration / 1000)}s` : 'N/A'}
            </Text>
          </View>

          <View style={styles.coordinatesContainer}>
            <Text style={styles.coordinatesTitle}>Track Coordinates:</Text>
            {session.locations.slice(0, 20).map((loc, index) => (
              <Text key={index} style={styles.coordinateText}>
                {index + 1}. {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
              </Text>
            ))}
            {session.locations.length > 20 && (
              <Text style={styles.moreText}>... and {session.locations.length - 20} more points</Text>
            )}
          </View>

          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>To Enable Maps:</Text>
            <Text style={styles.instructionsText}>
              1. Create a development build:{'\n'}
              {'   '}npx expo prebuild{'\n'}
              {'   '}npx expo run:ios (or run:android)
            </Text>
            <Text style={styles.instructionsText}>
              2. Or use EAS Build:{'\n'}
              {'   '}eas build --platform ios --profile development
            </Text>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Create coordinates array for the polyline
  const coordinates = session.locations.map((loc) => ({
    latitude: loc.latitude,
    longitude: loc.longitude,
  }));

  // Calculate region to fit all points
  const minLat = Math.min(...session.locations.map((l) => l.latitude));
  const maxLat = Math.max(...session.locations.map((l) => l.latitude));
  const minLon = Math.min(...session.locations.map((l) => l.longitude));
  const maxLon = Math.max(...session.locations.map((l) => l.longitude));

  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
    longitudeDelta: Math.max((maxLon - minLon) * 1.5, 0.01),
  };

  const startPoint = session.locations[0];
  const endPoint = session.locations[session.locations.length - 1];

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        {coordinates.length > 1 && (
          <Polyline
            coordinates={coordinates}
            strokeColor="#007AFF"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {startPoint && (
          <Marker
            coordinate={{
              latitude: startPoint.latitude,
              longitude: startPoint.longitude,
            }}
            title="Start"
            pinColor="green"
          />
        )}

        {endPoint && endPoint !== startPoint && (
          <Marker
            coordinate={{
              latitude: endPoint.latitude,
              longitude: endPoint.longitude,
            }}
            title="End"
            pinColor="red"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  fallbackContainer: {
    flexGrow: 1,
    backgroundColor: '#f5f5f5',
  },
  fallbackContent: {
    padding: 20,
  },
  fallbackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  sessionInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sessionInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  bold: {
    fontWeight: '600',
    color: '#333',
  },
  coordinatesContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    maxHeight: 300,
  },
  coordinatesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  coordinateText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  moreText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  instructionsContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
