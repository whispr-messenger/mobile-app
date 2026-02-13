/**
 * MediaUploadProgress - Composant pour afficher la progression de l'upload
 * WHISPR-267: Envoi de médias avec progression et gestion d'erreurs
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface MediaUploadProgressProps {
  progress: number; // 0-100
  status: 'uploading' | 'success' | 'error' | 'cancelled';
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  isSent?: boolean;
}

export const MediaUploadProgress: React.FC<MediaUploadProgressProps> = ({
  progress,
  status,
  error,
  onCancel,
  onRetry,
  isSent = false,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const progressWidth = useSharedValue(0);
  const [shouldHide, setShouldHide] = useState(false);

  // Animate progress bar
  useEffect(() => {
    progressWidth.value = withTiming(progress, { duration: 200 });
  }, [progress, progressWidth]);

  // Auto-hide after success for a few seconds
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        setShouldHide(true);
      }, 3000); // Hide after 3 seconds of success
      return () => clearTimeout(timer);
    } else {
      setShouldHide(false);
    }
  }, [status]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // Show success state for sent messages (keep visible longer)
  // Don't show if completed and not sent by current user
  if (status === 'success' && !isSent) {
    return null;
  }

  // Don't show if cancelled
  if (status === 'cancelled') {
    return null;
  }

  // Hide if shouldHide is true
  if (shouldHide) {
    return null;
  }
  
  // Debug: Log what we're rendering
  console.log('[MediaUploadProgress] Rendering:', { status, progress, isSent, shouldHide });

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            progressBarStyle,
            {
              backgroundColor:
                status === 'error'
                  ? '#FF3B30'
                  : status === 'success'
                  ? '#4CAF50'
                  : '#FFB07B', // Orange vif pour être visible
            },
          ]}
        />
      </View>

      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          {status === 'uploading' && (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>
                Envoi en cours... {Math.round(progress)}%
              </Text>
            </>
          )}
          {status === 'success' && (
            <>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={styles.icon} />
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>Envoyé</Text>
            </>
          )}
          {status === 'error' && (
            <>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" style={styles.icon} />
              <Text style={[styles.statusText, { color: '#FF3B30' }]} numberOfLines={1}>
                {error || 'Erreur lors de l\'envoi'}
              </Text>
            </>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {status === 'uploading' && onCancel && (
            <TouchableOpacity onPress={onCancel} style={styles.actionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {status === 'error' && onRetry && (
            <TouchableOpacity onPress={onRetry} style={styles.actionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <LinearGradient
                colors={[colors.primary.main, colors.primary.dark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.retryButton}
              >
                <Ionicons name="refresh" size={16} color={colors.text.light} />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    marginBottom: 6,
    marginHorizontal: 0, // Removed negative margin that could cause clipping
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Noir semi-transparent pour meilleure visibilité
    borderRadius: 10,
    minHeight: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', // Bordure blanche plus subtile
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    width: '100%', // Ensure full width
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF', // Explicit white color
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  retryButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
