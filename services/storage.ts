import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackingSession } from '../types/tracking';

const SESSIONS_KEY = '@tracking_sessions';
const CURRENT_SESSION_KEY = '@current_tracking_session';

export const storageService = {
  // Save a tracking session
  async saveSession(session: TrackingSession): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const updatedSessions = [...sessions, session];
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  },

  // Get all sessions
  async getSessions(): Promise<TrackingSession[]> {
    try {
      const data = await AsyncStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting sessions:', error);
      return [];
    }
  },

  // Get a specific session by ID
  async getSession(id: string): Promise<TrackingSession | null> {
    try {
      const sessions = await this.getSessions();
      return sessions.find(s => s.id === id) || null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  // Delete a session
  async deleteSession(id: string): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const updatedSessions = sessions.filter(s => s.id !== id);
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  },

  // Save current active session (for recovery if app closes)
  async saveCurrentSession(session: TrackingSession | null): Promise<void> {
    try {
      if (session) {
        await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
      } else {
        await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('Error saving current session:', error);
    }
  },

  // Get current active session
  async getCurrentSession(): Promise<TrackingSession | null> {
    try {
      const data = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  },
};

