/**
 * AudioMessage - Playback component for voice messages
 * Uses expo-av Audio.Sound for playback with play/pause and duration display.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import {
  uriNeedsAuthResolution,
  useResolvedMediaUrl,
} from "../../hooks/useResolvedMediaUrl";
import { MediaService } from "../../services/MediaService";

let AudioModule: any = null;
let triedLoadingAudioModule = false;

function getAudioModule(): any | null {
  if (AudioModule) return AudioModule;
  if (triedLoadingAudioModule) return null;
  triedLoadingAudioModule = true;
  try {
    const expoAv = require("expo-av");
    AudioModule = expoAv.Audio;
    return AudioModule;
  } catch (error) {
    console.warn("[AudioMessage] expo-av not available:", error);
    return null;
  }
}

interface AudioMessageProps {
  uri: string;
  mediaId?: string;
  duration?: number; // duration in seconds from metadata
  isSent?: boolean;
}

function isStableMediaId(value?: string): boolean {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function buildWaveform(seed: string, barCount = 28): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return Array.from({ length: barCount }, (_, index) => {
    const next = Math.sin(hash + index * 1.7);
    const normalized = (next + 1) / 2;
    return 8 + Math.round(normalized * 18);
  });
}

export const AudioMessage: React.FC<AudioMessageProps> = ({
  uri,
  mediaId,
  duration,
  isSent = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [isLoaded, setIsLoaded] = useState(false);
  const soundRef = useRef<any>(null);
  const waveformBars = useMemo(
    () => buildWaveform(`${uri}:${duration ?? 0}`),
    [uri, duration],
  );

  const shouldCacheNativeAudio =
    Platform.OS !== "web" &&
    isStableMediaId(mediaId) &&
    uriNeedsAuthResolution(uri);
  const [nativeAudioUri, setNativeAudioUri] = useState("");

  // `/media/v1/:id/blob` returns `{ url, expiresAt }` JSON — not the raw
  // audio bytes. On web we resolve it to a streamed blob URL. On native iOS/
  // Android, prefer a real local `file://` path because expo-av playback is
  // more reliable there than `data:` URIs for audio.
  const { resolvedUri: streamedResolvedUri } = useResolvedMediaUrl(
    shouldCacheNativeAudio ? undefined : uri,
  );
  const resolvedUri = shouldCacheNativeAudio
    ? nativeAudioUri
    : streamedResolvedUri;

  useEffect(() => {
    if (!shouldCacheNativeAudio || !mediaId) {
      setNativeAudioUri("");
      return;
    }

    let cancelled = false;
    setNativeAudioUri("");

    void MediaService.downloadAudioToCacheFile(mediaId)
      .then((fileUri) => {
        if (!cancelled) {
          setNativeAudioUri(fileUri);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[AudioMessage] Error caching audio:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, shouldCacheNativeAudio]);

  useEffect(() => {
    return () => {
      // Cleanup sound on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // Unload any previously-loaded sound when the resolved URI changes so the
  // next play reloads from the fresh source.
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
      setIsLoaded(false);
    }
  }, [resolvedUri]);

  const loadSound = useCallback(async () => {
    const audioModule = getAudioModule();
    if (!audioModule || !resolvedUri) return null;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
      }

      const { sound, status } = await audioModule.Sound.createAsync(
        { uri: resolvedUri },
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
      console.error("[AudioMessage] Error loading sound:", error);
      return null;
    }
  }, [resolvedUri]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status || typeof status !== "object") return;

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
    const audioModule = getAudioModule();
    if (!audioModule) return;

    try {
      // Configure audio mode for playback
      await audioModule.setAudioModeAsync({
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
      console.error("[AudioMessage] Error toggling playback:", error);
    }
  }, [isPlaying, isLoaded, loadSound]);

  const progress = totalDuration > 0 ? currentPosition / totalDuration : 0;

  const textColor = isSent ? colors.text.light : "rgba(255, 255, 255, 0.95)";
  const secondaryColor = isSent
    ? "rgba(255, 255, 255, 0.72)"
    : "rgba(255, 255, 255, 0.62)";
  const shellColor = isSent
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(255, 255, 255, 0.06)";
  const playButtonColor = isSent ? "#FFFFFF" : colors.primary.main;
  const playIconColor = isSent ? "#111111" : colors.text.light;
  const inactiveBarColor = isSent
    ? "rgba(255, 255, 255, 0.28)"
    : "rgba(255, 255, 255, 0.18)";
  const activeBarColor = isSent ? "#FFFFFF" : "#FFB07B";
  const playedBarCount = Math.max(
    0,
    Math.min(waveformBars.length, Math.round(progress * waveformBars.length)),
  );
  return (
    <View style={[styles.container, { backgroundColor: shellColor }]}>
      <TouchableOpacity
        onPress={handlePlayPause}
        style={[
          styles.playButton,
          {
            backgroundColor: playButtonColor,
          },
        ]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          isPlaying
            ? "Mettre en pause le message vocal"
            : "Lire le message vocal"
        }
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={20}
          color={playIconColor}
          style={isPlaying ? undefined : { marginLeft: 2 }}
        />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.waveformRow}>
            {waveformBars.map((height, index) => (
              <View
                key={`${uri}-bar-${index}`}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor:
                      index < playedBarCount
                        ? activeBarColor
                        : inactiveBarColor,
                    marginRight: index === waveformBars.length - 1 ? 0 : 3,
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.audioLabel, { color: textColor }]}>
            Message vocal
          </Text>
          <Text style={[styles.durationPill, { color: secondaryColor }]}>
            {formatDuration(totalDuration)}
          </Text>
        </View>
      </View>
      <View style={styles.trailingColumn}>
        <View
          style={[
            styles.micBadge,
            {
              backgroundColor: isSent
                ? "rgba(255, 255, 255, 0.14)"
                : "rgba(255, 255, 255, 0.08)",
            },
          ]}
        >
          <Ionicons name="mic" size={12} color={secondaryColor} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 228,
    maxWidth: 286,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 22,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    marginBottom: 6,
  },
  waveformRow: {
    height: 22,
    flexDirection: "row",
    alignItems: "flex-end",
    overflow: "hidden",
  },
  waveformBar: {
    width: 3,
    borderRadius: 999,
  },
  micBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  trailingColumn: {
    marginLeft: 10,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  durationPill: {
    fontSize: 10,
    fontWeight: "600",
  },
});
