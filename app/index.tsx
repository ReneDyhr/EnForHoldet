import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { formatDuration, formatDistance } from '../utils/format';

export default function Index() {
  const router = useRouter();
  const { isTracking, currentSession, error, startTracking, stopTracking } = useLocationTracking();
  const [liveDuration, setLiveDuration] = useState(0);

  // Update live duration every second when tracking
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTracking && currentSession) {
      interval = setInterval(() => {
        setLiveDuration(Date.now() - currentSession.startTime);
      }, 1000);
    } else {
      setLiveDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, currentSession]);

  const handleToggleTracking = async () => {
    if (isTracking) {
      await stopTracking();
    } else {
      await startTracking();
    }
  };

  // Use live duration if tracking, otherwise use session duration
  const duration = isTracking && liveDuration > 0 ? liveDuration : (currentSession?.duration || 0);
  const distance = currentSession?.distance || 0;
  const pointsCount = currentSession?.locations.length || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Track Session</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{formatDuration(duration)}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{formatDistance(distance)}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>{pointsCount}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.trackButton, isTracking && styles.trackButtonActive]}
        onPress={handleToggleTracking}
      >
        <Text style={styles.trackButtonText}>
          {isTracking ? 'Stop Tracking' : 'Start Tracking'}
        </Text>
      </TouchableOpacity>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/sessions')}
        >
          <Text style={styles.actionButtonText}>View Sessions</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  trackButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  trackButtonActive: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionsContainer: {
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
