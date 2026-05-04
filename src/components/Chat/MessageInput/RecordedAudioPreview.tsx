import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors } from "../../../theme/colors";
import type { RecordedAudio } from "../../../hooks/useVoiceRecorder";

interface RecordedAudioPreviewProps {
  audio: RecordedAudio;
  onCancel: () => void;
  onSend: () => void;
}

const formatTime = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const WAVE_BARS = 26;
const STATIC_WAVE = Array.from({ length: WAVE_BARS }, (_, i) => {
  const base = 6 + (i % 5) * 2;
  const pulse = Math.round(((Math.sin(i * 0.9) + 1) / 2) * 12);
  return base + pulse;
});

export const RecordedAudioPreview: React.FC<RecordedAudioPreviewProps> = ({
  audio,
  onCancel,
  onSend,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const soundRef = useRef<any>(null);

  const cleanupSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // ignore — sound may already be unloaded
      }
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupSound();
    };
  }, [cleanupSound]);

  const handlePlaybackStatus = useCallback((status: any) => {
    if (!status?.isLoaded) return;
    const ms = Number(status.positionMillis ?? 0);
    setPositionSec(Math.floor(ms / 1000));
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionSec(0);
      if (soundRef.current?.setPositionAsync) {
        soundRef.current.setPositionAsync(0).catch(() => {});
      }
    }
  }, []);

  const handleTogglePlay = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    let expoAv: any = null;
    try {
      expoAv = require("expo-av");
    } catch (error) {
      console.warn("[RecordedAudioPreview] expo-av not available", error);
      return;
    }

    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status?.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      } catch (error) {
        console.warn("[RecordedAudioPreview] toggle failed", error);
      }
      return;
    }

    try {
      await expoAv.Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await expoAv.Audio.Sound.createAsync(
        { uri: audio.uri },
        { shouldPlay: true },
        handlePlaybackStatus,
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (error) {
      console.warn("[RecordedAudioPreview] failed to load sound", error);
    }
  }, [audio.uri, handlePlaybackStatus]);

  const totalDuration = Math.max(1, audio.duration);
  const displaySec = isPlaying || positionSec > 0 ? positionSec : totalDuration;
  const progress = Math.min(1, positionSec / totalDuration);
  const filledBars = Math.round(progress * WAVE_BARS);

  const handleCancel = useCallback(async () => {
    await cleanupSound();
    onCancel();
  }, [cleanupSound, onCancel]);

  const handleSend = useCallback(async () => {
    await cleanupSound();
    onSend();
  }, [cleanupSound, onSend]);

  return (
    <View style={styles.row} testID="recorded-audio-preview">
      <TouchableOpacity
        testID="recorded-audio-cancel"
        onPress={handleCancel}
        style={styles.sideButton}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Supprimer le message vocal"
      >
        <Ionicons name="trash-outline" size={22} color={colors.ui.error} />
      </TouchableOpacity>

      <View style={styles.pill}>
        <TouchableOpacity
          testID="recorded-audio-play"
          onPress={handleTogglePlay}
          style={styles.playButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            isPlaying ? "Mettre en pause" : "Lire le message vocal"
          }
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={16}
            color={colors.text.light}
          />
        </TouchableOpacity>
        <View style={styles.waveform} pointerEvents="none">
          {STATIC_WAVE.map((height, index) => (
            <View
              key={`preview-bar-${index}`}
              style={[
                styles.waveBar,
                {
                  height,
                  backgroundColor:
                    index < filledBars ? "#FFB07B" : "rgba(255, 143, 148, 0.5)",
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.timeText}>{formatTime(displaySec)}</Text>
      </View>

      <TouchableOpacity
        testID="recorded-audio-send"
        onPress={handleSend}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Envoyer le message vocal"
      >
        <LinearGradient
          colors={["#FFB07B", "#F04882"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sendButton}
        >
          <Ionicons name="send" size={16} color={colors.text.light} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const PILL_BG = "rgba(11, 17, 36, 0.85)";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    height: 40,
  },
  sideButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  pill: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    backgroundColor: PILL_BG,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginHorizontal: 4,
  },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  waveform: {
    flex: 1,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  waveBar: {
    width: 2,
    borderRadius: 999,
    marginRight: 2,
  },
  timeText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    marginLeft: 6,
    marginRight: 4,
    minWidth: 30,
    textAlign: "right",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
