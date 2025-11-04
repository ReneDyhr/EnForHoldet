import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useState, useCallback } from 'react';
import { TrackingSession } from '../types/tracking';
import { storageService } from '../services/storage';
import { formatDate, formatDuration, formatDistance } from '../utils/format';

export default function Sessions() {
  const router = useRouter();
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const loadedSessions = await storageService.getSessions();
      // Sort by start time, newest first
      const sorted = loadedSessions.sort((a, b) => b.startTime - a.startTime);
      setSessions(sorted);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const handleDelete = (session: TrackingSession) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete the session from ${formatDate(session.startTime)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storageService.deleteSession(session.id);
            loadSessions();
          },
        },
      ]
    );
  };

  const handleViewMap = (session: TrackingSession) => {
    router.push({
      pathname: '/map',
      params: { sessionId: session.id },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No sessions yet</Text>
        <Text style={styles.emptySubtext}>Start tracking to create your first session</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionDate}>{formatDate(item.startTime)}</Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sessionStats}>
              <View style={styles.sessionStat}>
                <Text style={styles.sessionStatLabel}>Duration</Text>
                <Text style={styles.sessionStatValue}>
                  {formatDuration(item.duration || 0)}
                </Text>
              </View>

              <View style={styles.sessionStat}>
                <Text style={styles.sessionStatLabel}>Distance</Text>
                <Text style={styles.sessionStatValue}>
                  {formatDistance(item.distance || 0)}
                </Text>
              </View>

              <View style={styles.sessionStat}>
                <Text style={styles.sessionStatLabel}>Points</Text>
                <Text style={styles.sessionStatValue}>{item.locations.length}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewMapButton}
              onPress={() => handleViewMap(item)}
            >
              <Text style={styles.viewMapButtonText}>View on Map</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  list: {
    padding: 20,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  sessionStat: {
    alignItems: 'center',
  },
  sessionStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  sessionStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  viewMapButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewMapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

