import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Category } from '../types/tracking';
import { storageService } from '../services/storage';
import { TrackingSession } from '../types/tracking';

const sessionSummarySchema = z.object({
  totalWeightKg: z.number().min(0, 'Weight must be 0 or greater'),
  foundCategories: z.array(z.enum(['mixed', 'plastic', 'metal', 'glass', 'paper', 'other'])).min(1, 'Select at least one category'),
});

type SessionSummaryFormData = z.infer<typeof sessionSummarySchema>;

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'metal', label: 'Metal' },
  { value: 'glass', label: 'Glass' },
  { value: 'paper', label: 'Paper' },
  { value: 'other', label: 'Other' },
];

export default function SessionSummary() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<TrackingSession | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<SessionSummaryFormData>({
    resolver: zodResolver(sessionSummarySchema),
    defaultValues: {
      totalWeightKg: 0,
      foundCategories: [],
    },
  });

  // Load session data and pre-fill form
  useEffect(() => {
    const loadSession = async () => {
      if (params.sessionId) {
        const loadedSession = await storageService.getSession(params.sessionId);
        if (loadedSession) {
          setSession(loadedSession);
          // Pre-fill form with existing summary data if available
          const weightKg = loadedSession.totalWeightG 
            ? loadedSession.totalWeightG / 1000 
            : 0;
          const categories = loadedSession.foundCategories || [];
          
          reset({
            totalWeightKg: weightKg,
            foundCategories: categories,
          });
        } else {
          // Try to get current session if not found in saved sessions
          const currentSession = await storageService.getCurrentSession();
          if (currentSession && currentSession.id === params.sessionId) {
            setSession(currentSession);
            // Pre-fill form with existing summary data if available
            const weightKg = currentSession.totalWeightG 
              ? currentSession.totalWeightG / 1000 
              : 0;
            const categories = currentSession.foundCategories || [];
            
            reset({
              totalWeightKg: weightKg,
              foundCategories: categories,
            });
          } else {
            Alert.alert('Error', 'Session not found');
            router.back();
          }
        }
      }
    };
    loadSession();
  }, [params.sessionId, reset]);

  const toggleCategory = (category: Category, currentCategories: Category[]) => {
    if (currentCategories.includes(category)) {
      return currentCategories.filter((c) => c !== category);
    }
    return [...currentCategories, category];
  };

  const onSubmit = async (data: SessionSummaryFormData) => {
    if (!session) return;

    setLoading(true);
    try {
      // Convert kg to grams
      const totalWeightG = Math.round(data.totalWeightKg * 1000);

      const updatedSession: TrackingSession = {
        ...session,
        endTime: session.endTime || Date.now(),
        totalWeightG,
        foundCategories: data.foundCategories,
      };

      // Save the session with summary data
      await storageService.saveSession(updatedSession);
      
      // Clear current session from storage if it matches
      const currentSession = await storageService.getCurrentSession();
      if (currentSession?.id === session.id) {
        await storageService.saveCurrentSession(null);
      }

      // Navigate back - if session was already saved, go to sessions list, otherwise go home
      if (session.totalWeightG !== undefined || session.foundCategories) {
        // Was editing an existing session, go back to sessions list
        router.back();
      } else {
        // Was a new session, go to home
        router.replace('/');
      }
    } catch (error) {
      console.error('Error saving session summary:', error);
      Alert.alert('Error', 'Failed to save session summary');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {session.totalWeightG !== undefined || session.foundCategories ? 'Edit Session Summary' : 'Session Summary'}
        </Text>
        <Text style={styles.subtitle}>
          {session.totalWeightG !== undefined || session.foundCategories 
            ? 'Update details about your litter picking session'
            : 'Enter details about your litter picking session'}
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Total Weight (kg)</Text>
          <Controller
            control={control}
            name="totalWeightKg"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, errors.totalWeightKg && styles.inputError]}
                value={value?.toString() || '0'}
                onChangeText={(text) => {
                  const numValue = parseFloat(text) || 0;
                  onChange(numValue);
                }}
                keyboardType="numeric"
                placeholder="0.0"
                placeholderTextColor="#999"
              />
            )}
          />
          {errors.totalWeightKg && (
            <Text style={styles.errorText}>{errors.totalWeightKg.message}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Found Categories *</Text>
          <View style={styles.categoriesContainer}>
            {CATEGORIES.map((category) => (
              <Controller
                key={category.value}
                control={control}
                name="foundCategories"
                render={({ field: { onChange, value } }) => (
                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      value?.includes(category.value) && styles.categoryButtonSelected,
                    ]}
                    onPress={() => onChange(toggleCategory(category.value, value || []))}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        value?.includes(category.value) && styles.categoryButtonTextSelected,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            ))}
          </View>
          {errors.foundCategories && (
            <Text style={styles.errorText}>{errors.foundCategories.message}</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={async () => {
            if (!session) {
              router.back();
              return;
            }
            
            // Save session without summary data if user cancels
            Alert.alert(
              'Cancel Session Summary',
              'The session will be saved without summary data. Continue?',
              [
                { text: 'Go Back', style: 'cancel', onPress: () => router.back() },
                {
                  text: 'Save Without Summary',
                  style: 'default',
                  onPress: async () => {
                    try {
                      const sessionWithoutSummary: TrackingSession = {
                        ...session,
                        endTime: session.endTime || Date.now(),
                      };
                      await storageService.saveSession(sessionWithoutSummary);
                      await storageService.saveCurrentSession(null);
                      // Navigate back appropriately
                      if (session.totalWeightG !== undefined || session.foundCategories) {
                        router.back();
                      } else {
                        router.replace('/');
                      }
                    } catch (error) {
                      console.error('Error saving session:', error);
                      Alert.alert('Error', 'Failed to save session');
                    }
                  },
                },
              ]
            );
          }}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Saving...' : 'Save Session'}
          </Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    marginBottom: 30,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  },
});

