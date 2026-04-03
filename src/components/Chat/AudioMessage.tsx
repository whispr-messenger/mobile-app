/**
 * AudioMessage - Playback component for voice messages
 * Uses expo-av Audio.Sound for playback with play/pause and duration display.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Import expo-av with error handling
let AudioModule: any = null;
try {
  const expoAv = require('expo-av');
  AudioModule = expoAv.Audio;
} catch (error) {
  console.warn('[AudioMessage] expo-av not available:', error);
}

interface AudioMessageProps {
  uri: string;
  duration?: number; // duration in seconds from metadata
  isSent?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const AudioMessage: React.FC<AudioMessageProps> = ({ uri, duration, isSent = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [isLoaded, setIsLoaded] = useState(false);
  const soundRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      // Cleanup sound on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const loadSound = useCallback(async () => {
    if (!AudioModule || !uri) return null;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
      }

      const { sound, status } = await AudioModule.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        onPlaybackStatusUpdate,
      );
      soundRef.current = sound;

      if (status?.isLoaded && status.durationMillis) {
        setTotalDuration(status.durationMillis / 1000);
      }
      setIsLoaded(true);
      return sound;
    } catch (error) {
      console.error('[AudioMessage] Error loading sound:', error);
      return null;
    }
  }, [uri]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status || typeof status !== 'object') return;

    if (status.isLoaded) {
      setCurrentPosition((status.positionMillis || 0) / 1000);
      if (status.durationMillis) {
        setTotalDuration(status.durationMillis / 1000);
      }
      setIsPlaying(status.isPlaying || false);

      // Reset when playback finishes
      if (status.didJustFinish) {
        setIsPlaying(false);
        setCurrentPosition(0);
        soundRef.current?.setPositionAsync(0).catch(() => {});
      }
    }
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!AudioModule) return;

    try {
      // Configure audio mode for playback
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      let sound = soundRef.current;
      if (!sound || !isLoaded) {
        sound = await loadSound();
        if (!sound) return;
      }

      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('[AudioMessage] Error toggling playback:', error);
    }
  }, [isPlaying, isLoaded, loadSound]);

  const progress = totalDuration > 0 ? currentPosition / totalDuration : 0;

  const textColor = isSent ? colors.text.light : 'rgba(255, 255, 255, 0.9)';
  const secondaryColor = isSent ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)';
  const trackBg = isSent ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)';
  const trackFill = isSent ? colors.text.light : colors.primary.main;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePlayPause}
        style={[styles.playButton, { backgroundColor: isSent ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)' }]}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={22}
          color={textColor}
          style={isPlaying ? undefined : { marginLeft: 2 }}
        />
      </TouchableOpacity>

      <View style={styles.trackContainer}>
        <View style={[styles.trackBackground, { backgroundColor: trackBg }]}>
          <View style={[styles.trackFill, { backgroundColor: trackFill, width: `${Math.min(progress * 100, 100)}%` }]} />
        </View>
        <Text style={[styles.durationText, { color: secondaryColor }]}>
          {isPlaying || currentPosition > 0
            ? formatDuration(currentPosition)
            : formatDuration(totalDuration)}
        </Text>
      </View>

      <Ionicons name="mic" size={16} color={secondaryColor} style={styles.micIcon} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    maxWidth: 250,
    paddingVertical: 4,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  trackContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  trackBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
  durationText: {
    fontSize: 11,
    marginTop: 4,
  },
  micIcon: {
    marginLeft: 8,
  },
});
