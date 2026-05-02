/**
 * MessageInput - Message input component with send button
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { formatUsername } from "../../utils";
import { detectMention } from "../../utils/mentions";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { Message } from "../../types/messaging";
import { ReplyPreview } from "./ReplyPreview";
import { Avatar } from "./Avatar";
import { CameraCapture, CameraCaptureResult } from "./CameraCapture";
import { EmojiPickerSheet } from "./EmojiPickerSheet";

const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = 120;
const INPUT_VERTICAL_PADDING = 10;
const INPUT_LINE_HEIGHT = 20;

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
    console.warn("[MessageInput] expo-av not available for recording:", error);
    return null;
  }
}

// Derive a Safari-compatible MIME on web; keep HIGH_QUALITY preset on native.
// expo-av's HIGH_QUALITY preset forces `audio/webm` on web, which iOS Safari
// refuses with NotSupportedError. Safari (iOS + macOS) supports `audio/mp4`.
export const buildRecordingOptions = () => {
  const audioModule = getAudioModule();
  const base = audioModule?.RecordingOptionsPresets?.HIGH_QUALITY ?? {};
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return {
      ...base,
      android: {
        ...(base?.android ?? {}),
        extension: ".m4a",
        outputFormat:
          audioModule?.AndroidOutputFormat?.MPEG_4 ??
          base?.android?.outputFormat,
        audioEncoder:
          audioModule?.AndroidAudioEncoder?.AAC ?? base?.android?.audioEncoder,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        ...(base?.ios ?? {}),
        extension: ".m4a",
        outputFormat:
          audioModule?.IOSOutputFormat?.MPEG4AAC ?? base?.ios?.outputFormat,
        audioQuality:
          audioModule?.IOSAudioQuality?.MAX ?? base?.ios?.audioQuality,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    };
  }
  const webMime =
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
  return {
    ...base,
    web: { mimeType: webMime, bitsPerSecond: 128000 },
  };
};

function inferAudioMimeFromFilename(filename?: string | null): string {
  const extension = filename?.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "mp3":
      return "audio/mpeg";
    case "aac":
      return "audio/aac";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "caf":
      return "audio/x-caf";
    default:
      return "audio/mp4";
  }
}

function canonicalizeAudioMime(mime?: string | null): string {
  const normalized = mime?.split(";")[0]?.trim().toLowerCase();
  switch (normalized) {
    case "audio/x-m4a":
    case "audio/m4a":
      return "audio/mp4";
    default:
      return normalized || "audio/mp4";
  }
}

function forceAudioUploadFilename(filename: string, mimeType: string): string {
  if (canonicalizeAudioMime(mimeType) !== "audio/mp4") {
    return filename;
  }
  const baseName = filename.replace(/\.[^/.]+$/, "") || `voice-${Date.now()}`;
  return `${baseName}.mp4`;
}

async function remapAudioUploadUri(
  uri: string,
  filename: string,
  mimeType: string,
): Promise<string> {
  if (Platform.OS === "web") {
    return uri;
  }
  if (canonicalizeAudioMime(mimeType) !== "audio/mp4") {
    return uri;
  }
  if (!uri.startsWith("file://")) {
    return uri;
  }
  if (/\.mp4$/i.test(uri)) {
    return uri;
  }

  const cacheRoot =
    (FileSystem as any).cacheDirectory ||
    (FileSystem as any).documentDirectory ||
    "";
  if (!cacheRoot) {
    return uri;
  }

  const targetUri = `${cacheRoot}${filename}`;
  try {
    await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => {});
    await FileSystem.copyAsync({ from: uri, to: targetUri });
    return targetUri;
  } catch (error) {
    console.warn("[MessageInput] Failed to remap audio upload URI:", error);
    return uri;
  }
}

interface MessageInputProps {
  onSend: (message: string, replyToId?: string, mentions?: string[]) => void;
  onSendMedia?: (
    uri: string,
    type: "image" | "video" | "file" | "audio",
    replyToId?: string,
    caption?: string,
    options?: {
      duration?: number;
      mimeType?: string;
      filename?: string;
    },
  ) => void;
  onScheduleSend?: (message: string) => void;
  onTyping?: (typing: boolean) => void;
  placeholder?: string;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  conversationType?: "direct" | "group";
  members?: Array<{ id: string; display_name: string; username?: string }>;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onSendMedia,
  onScheduleSend,
  onTyping,
  placeholder = "",
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  conversationType = "direct",
  members = [],
}) => {
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingWavePhase, setRecordingWavePhase] = useState(0);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [composerWidth, setComposerWidth] = useState(0);
  const recordingRef = useRef<any>(null);
  const recordingMimeRef = useRef<string | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  // Update text when editing message changes
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
    } else if (!replyingTo) {
      setText("");
      setInputHeight(MIN_INPUT_HEIGHT);
    }
  }, [editingMessage, replyingTo]);

  const updateMentionState = useCallback(
    (newText: string) => {
      const detection = detectMention(
        newText,
        conversationType,
        members.length,
      );
      if (detection) {
        setMentionQuery(detection.query);
        setMentionStartIndex(detection.startIndex);
        setShowMentions(true);
      } else if (conversationType === "group" && members.length > 0) {
        // Only clear mentions when we're in a group — matches the previous
        // behaviour which only toggled mentions in that branch.
        setShowMentions(false);
      }
    },
    [conversationType, members.length],
  );

  const updateTypingState = useCallback(
    (trimmed: string) => {
      if (trimmed.length > 0 && !isTypingRef.current) {
        onTyping?.(true);
        isTypingRef.current = true;
      }
      if (trimmed.length === 0 && isTypingRef.current) {
        onTyping?.(false);
        isTypingRef.current = false;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (trimmed.length > 0) {
        typingTimeoutRef.current = setTimeout(() => {
          onTyping?.(false);
          isTypingRef.current = false;
          typingTimeoutRef.current = null;
        }, 3000);
      }
    },
    [onTyping],
  );

  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);
      if (!newText) {
        setInputHeight(MIN_INPUT_HEIGHT);
      }
      updateMentionState(newText);
      updateTypingState(newText.trim());
    },
    [updateMentionState, updateTypingState],
  );

  const updateInputHeightFromLineCount = useCallback((lineCount: number) => {
    const nextHeight = Math.max(
      MIN_INPUT_HEIGHT,
      Math.min(
        MAX_INPUT_HEIGHT,
        lineCount * INPUT_LINE_HEIGHT + INPUT_VERTICAL_PADDING * 2,
      ),
    );
    setInputHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const handleMeasuredTextLayout = useCallback(
    (event: { nativeEvent: { lines?: Array<unknown> } }) => {
      if (!text.trim()) {
        setInputHeight((prev) =>
          prev === MIN_INPUT_HEIGHT ? prev : MIN_INPUT_HEIGHT,
        );
        return;
      }

      const measuredLineCount = Math.max(
        1,
        event.nativeEvent.lines?.length ?? 1,
      );
      const explicitLineCount = Math.max(1, text.split("\n").length);
      const lineCount = Math.max(measuredLineCount, explicitLineCount);
      updateInputHeightFromLineCount(lineCount);
    },
    [text, updateInputHeightFromLineCount],
  );

  const handleMentionSelect = useCallback(
    (member: { id: string; display_name: string; username?: string }) => {
      if (mentionStartIndex === -1) return;

      const beforeMention = text.substring(0, mentionStartIndex);
      const afterMention = text
        .substring(mentionStartIndex)
        .replace(/@[^\s]*/, "");
      const mentionText = member.username
        ? `${formatUsername(member.username)} `
        : `${formatUsername(member.display_name)} `;
      const newText = beforeMention + mentionText + afterMention;

      setText(newText);
      setShowMentions(false);
      setMentionQuery("");
      setMentionStartIndex(-1);

      // Focus back on input
      inputRef.current?.focus();
    },
    [text, mentionStartIndex],
  );

  const handleSend = useCallback(() => {
    if (text.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Extract mentions from text
      const mentionRegex = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(text)) !== null) {
        const username = match[1];
        const member = members.find(
          (m) =>
            m.username === username ||
            (m.display_name || "").toLowerCase() === username.toLowerCase(),
        );
        if (member) {
          mentions.push(member.id);
        }
      }

      onSend(
        text.trim(),
        replyingTo?.id,
        mentions.length > 0 ? mentions : undefined,
      );
      setText("");
      setInputHeight(MIN_INPUT_HEIGHT);
      setShowMentions(false);
      onCancelReply?.();
      onCancelEdit?.();
    }
  }, [text, onSend, replyingTo, onCancelReply, onCancelEdit, members]);

  const handleLongPressSend = useCallback(() => {
    if (text.trim() && onScheduleSend) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onScheduleSend(text.trim());
    }
  }, [text, onScheduleSend]);

  // Open camera capture modal
  const handleOpenCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCameraCapture(true);
  }, []);

  const handleOpenEmojiPicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowEmojiPicker(true);
  }, []);

  // Handle camera capture result
  const handleCameraCapture = useCallback(
    (result: CameraCaptureResult) => {
      // Send media with caption integrated in the same message
      onSendMedia?.(
        result.uri,
        result.type,
        replyingTo?.id,
        result.caption?.trim() || undefined,
      );

      if (replyingTo) {
        onCancelReply?.();
      }
    },
    [onSendMedia, replyingTo, onCancelReply],
  );

  const handlePickImage = useCallback(async () => {
    try {
      // Request permissions
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission requise",
          "Nous avons besoin de votre permission pour accéder à vos photos.",
        );
        return;
      }

      // Launch image picker without forcing a crop: WHISPR-1039 wants the
      // user to send images in their native ratio (portrait/landscape/square).
      // WHISPR-1197 : on ne passe PAS `quality` ici — sur iOS/Android
      // expo-image-picker re-encode en JPEG dès que `quality` est défini,
      // ce qui aplatit les GIFs animés (premier frame seulement) et perd
      // la compression native HEIC. La taille du fichier est déjà bornée
      // côté upload par WHISPR-1220, on accepte donc un léger surcoût
      // réseau pour préserver l'animation et le format Apple.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSendMedia?.(asset.uri, "image", replyingTo?.id);
        onCancelReply?.();
      }
    } catch (error: any) {
      console.error("[MessageInput] Error picking image:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.substring(0, 200),
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      Alert.alert(
        "Erreur",
        `Impossible de sélectionner une image.${error?.message ? `\n\n${error.message}` : ""}`,
      );
    }
  }, [onSendMedia, replyingTo, onCancelReply]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      setRecordingWavePhase(0);
      return;
    }
    const waveformTimer = setInterval(() => {
      setRecordingWavePhase((prev) => prev + 1);
    }, 140);
    return () => clearInterval(waveformTimer);
  }, [isRecording]);

  // Pre-warm mic permission on web so the long-press doesn't trigger the
  // browser permission prompt synchronously (which freezes the tap UI).
  // On web getUserMedia permission is sticky per-origin once granted.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const audioModule = getAudioModule();
    if (!audioModule?.requestPermissionsAsync) return;
    audioModule.requestPermissionsAsync().catch(() => {});
  }, []);

  const startRecording = useCallback(async () => {
    const audioModule = getAudioModule();
    if (!audioModule) {
      Alert.alert("Erreur", "L'enregistrement audio n'est pas disponible.");
      return;
    }

    // Flip UI to "Recording" immediately so the user gets instant feedback.
    // Reverted in the catch block on failure.
    setIsRecording(true);
    setRecordingDuration(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const permission = await audioModule.requestPermissionsAsync();
      if (permission.status !== "granted") {
        setIsRecording(false);
        Alert.alert(
          "Permission requise",
          "Nous avons besoin de votre permission pour enregistrer des messages vocaux.",
        );
        return;
      }

      await audioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const options = buildRecordingOptions();
      recordingMimeRef.current =
        Platform.OS === "web" ? (options?.web?.mimeType ?? null) : null;
      const { recording } = await audioModule.Recording.createAsync(options);
      recordingRef.current = recording;

      // Start duration timer
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (error: any) {
      console.error("[MessageInput] Error starting recording:", error);
      setIsRecording(false);
      setRecordingDuration(0);
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      const activeRecording = recordingRef.current;
      const displayedDuration = recordingDuration;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const stopResult = await activeRecording.stopAndUnloadAsync();
      const stopStatus =
        typeof stopResult === "object" && stopResult !== null ? stopResult : null;
      const audioModule = getAudioModule();
      if (audioModule) {
        await audioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      }

      const uri = activeRecording.getURI();
      const status =
        typeof activeRecording.getStatusAsync === "function"
          ? await activeRecording.getStatusAsync()
          : null;
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);

      if (!uri) {
        console.error("[MessageInput] No URI from recording");
        return;
      }

      // Only send if recording is at least 1 second
      const durationMs =
        Number((status as { durationMillis?: number } | null)?.durationMillis) ||
        Number(
          (stopStatus as { durationMillis?: number } | null)?.durationMillis,
        ) ||
        displayedDuration * 1000;
      const durationSec = durationMs / 1000;
      if (durationSec < 1) {
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // On web the URI is a `blob:...uuid` with no extension; backends derive
      // filenames from the URL path and reject blobs. Rewrap with a proper
      // File so the resulting object URL carries a real name + MIME.
      let finalUri = uri;
      let finalFilename = uri.split("/").pop() || `voice-${Date.now()}.m4a`;
      if (!/\.[a-z0-9]+$/i.test(finalFilename)) {
        finalFilename = `${finalFilename}.m4a`;
      }
      let finalMimeType =
        canonicalizeAudioMime(
          recordingMimeRef.current || inferAudioMimeFromFilename(finalFilename),
        );
      finalFilename = forceAudioUploadFilename(finalFilename, finalMimeType);
      finalUri = await remapAudioUploadUri(finalUri, finalFilename, finalMimeType);
      if (Platform.OS === "web" && uri.startsWith("blob:")) {
        try {
          const mime = recordingMimeRef.current || "audio/webm";
          const ext = mime === "audio/mp4" ? "m4a" : "webm";
          const fileName = `voice-${Date.now()}.${ext}`;
          const response = await fetch(uri);
          const blob = await response.blob();
          const file = new File([blob], fileName, { type: mime });
          finalUri = URL.createObjectURL(file);
          finalFilename = fileName;
          finalMimeType = mime;
        } catch (rewrapError) {
          console.warn(
            "[MessageInput] Failed to rewrap blob, sending raw URI:",
            rewrapError,
          );
        }
      }
      recordingMimeRef.current = null;

      onSendMedia?.(finalUri, "audio", replyingTo?.id, undefined, {
        duration: Math.max(1, Math.round(durationSec)),
        mimeType: finalMimeType,
        filename: finalFilename,
      });
      if (replyingTo) {
        onCancelReply?.();
      }
    } catch (error: any) {
      console.error("[MessageInput] Error stopping recording:", error);
      setIsRecording(false);
      setRecordingDuration(0);
      recordingRef.current = null;
    }
  }, [onSendMedia, replyingTo, onCancelReply, recordingDuration]);

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      recordingMimeRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("[MessageInput] Error cancelling recording:", error);
      setIsRecording(false);
      setRecordingDuration(0);
      recordingRef.current = null;
      recordingMimeRef.current = null;
    }
  }, []);

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const recordingWaveBars = Array.from({ length: 16 }, (_, index) => {
    const base = 7 + (index % 4) * 2;
    const pulse = Math.round(
      ((Math.sin(recordingWavePhase * 0.7 + index * 0.9) + 1) / 2) * 14,
    );
    return base + pulse;
  });

  return (
    <View style={[styles.container, { backgroundColor: "transparent" }]}>
      {(replyingTo || editingMessage) && (
        <View
          style={[
            styles.replyContainer,
            { backgroundColor: "rgba(26, 31, 58, 0.6)" }, // Dark card with transparency
          ]}
        >
          {replyingTo && <ReplyPreview replyTo={replyingTo} />}
          {editingMessage && (
            <View style={styles.editContainer}>
              <Text style={[styles.editLabel, { color: themeColors.primary }]}>
                Modifier le message
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={replyingTo ? onCancelReply : onCancelEdit}
            style={styles.cancelReplyButton}
            accessibilityRole="button"
            accessibilityLabel={
              replyingTo ? "Annuler la réponse" : "Annuler la modification"
            }
          >
            <Ionicons
              name="close"
              size={20}
              color={themeColors.text.secondary}
            />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputContainer}>
        {isRecording ? (
          <>
            <TouchableOpacity
              onPress={cancelRecording}
              style={styles.attachButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Annuler l'enregistrement vocal"
            >
              <Ionicons
                name="trash-outline"
                size={24}
                color={colors.ui.error}
              />
            </TouchableOpacity>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                {formatRecordingTime(recordingDuration)}
              </Text>
              <View
                testID="recording-waveform"
                style={styles.recordingWaveform}
                pointerEvents="none"
              >
                {recordingWaveBars.map((height, index) => (
                  <View
                    key={`recording-bar-${index}`}
                    testID="recording-wave-bar"
                    style={[
                      styles.recordingWaveBar,
                      {
                        height,
                        opacity: 0.45 + ((index + recordingWavePhase) % 4) * 0.12,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <TouchableOpacity
              onPress={stopRecording}
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
                <Ionicons name="send" size={18} color={colors.text.light} />
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {!editingMessage && (
              <View style={styles.attachButtons}>
                <TouchableOpacity
                  onPress={handleOpenCamera}
                  style={styles.attachButton}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Prendre une photo"
                >
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={themeColors.text.secondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={styles.attachButton}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Joindre une image"
                >
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={themeColors.text.secondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleOpenEmojiPicker}
                  style={styles.attachButton}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Ouvrir le clavier emoji"
                >
                  <Ionicons
                    name="happy-outline"
                    size={24}
                    color={themeColors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            )}
            <View
              testID="message-composer-shell"
              style={[
                styles.inputWrapper,
                {
                  height: inputHeight,
                  backgroundColor: "rgba(26, 31, 58, 0.6)",
                },
              ]}
              onLayout={(event) => {
                const nextWidth = Math.round(event.nativeEvent.layout.width);
                setComposerWidth((prev) =>
                  prev === nextWidth ? prev : nextWidth,
                );
              }}
            >
              <Text
                testID="message-composer-measure"
                pointerEvents="none"
                onTextLayout={handleMeasuredTextLayout}
                style={[
                  styles.measurementText,
                  composerWidth > 0
                    ? { width: composerWidth - 32 }
                    : styles.measurementTextHidden,
                ]}
              >
                {text || " "}
              </Text>
              <TextInput
                testID="message-composer-input"
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    color: themeColors.text.primary,
                  },
                ]}
                value={text}
                onChangeText={handleTextChange}
                onKeyPress={(event) => {
                  if (
                    Platform.OS === "web" &&
                    event.nativeEvent.key === "Enter"
                  ) {
                    if (typeof (event as any).preventDefault === "function") {
                      (event as any).preventDefault();
                    }
                    handleSend();
                  }
                }}
                multiline
                scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
                placeholder={
                  editingMessage
                    ? "Modifier le message"
                    : replyingTo
                      ? "Répondre"
                      : placeholder
                }
                placeholderTextColor={themeColors.text.tertiary}
                maxLength={1000}
                textAlignVertical="top"
              />
              {showMentions &&
                conversationType === "group" &&
                members.length > 0 && (
                  <View
                    style={[
                      styles.mentionsList,
                      { backgroundColor: "rgba(26, 31, 58, 0.95)" },
                    ]}
                  >
                    <ScrollView
                      style={styles.mentionsScroll}
                      nestedScrollEnabled
                    >
                      {members
                        .filter((member) => {
                          if (!mentionQuery) return true;
                          const name = (
                            member.display_name || ""
                          ).toLowerCase();
                          const username = member.username?.toLowerCase() || "";
                          return (
                            name.includes(mentionQuery) ||
                            username.includes(mentionQuery)
                          );
                        })
                        .slice(0, 5)
                        .map((member) => (
                          <TouchableOpacity
                            key={member.id}
                            style={styles.mentionItem}
                            onPress={() => handleMentionSelect(member)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`Mentionner ${member.display_name}`}
                          >
                            <Avatar
                              size={32}
                              name={member.display_name}
                              showOnlineBadge={false}
                              isOnline={false}
                            />
                            <View style={styles.mentionInfo}>
                              <Text
                                style={[
                                  styles.mentionName,
                                  { color: themeColors.text.primary },
                                ]}
                              >
                                {member.display_name}
                              </Text>
                              {member.username && (
                                <Text
                                  style={[
                                    styles.mentionUsername,
                                    { color: themeColors.text.secondary },
                                  ]}
                                >
                                  {formatUsername(member.username)}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                )}
            </View>
            {text.trim() ? (
              <TouchableOpacity
                onPress={handleSend}
                onLongPress={handleLongPressSend}
                delayLongPress={500}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  editingMessage
                    ? "Enregistrer la modification"
                    : "Envoyer le message"
                }
                accessibilityHint="Maintenir pour programmer l'envoi"
              >
                <LinearGradient
                  colors={["#FFB07B", "#F04882"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendButton}
                >
                  <Text style={styles.sendIcon}>→</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleMicPress}
                onLongPress={startRecording}
                delayLongPress={Platform.OS === "web" ? 200 : 300}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Enregistrer un message vocal"
                accessibilityHint="Maintenir pour démarrer l'enregistrement"
                style={
                  // iOS Safari: block native context menu / text-selection
                  // popup from stealing the long-press gesture.
                  Platform.OS === "web"
                    ? ({
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        WebkitTouchCallout: "none",
                      } as any)
                    : undefined
                }
              >
                <LinearGradient
                  colors={["#FFB07B", "#F04882"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendButton}
                >
                  <Ionicons name="mic" size={20} color={colors.text.light} />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
      <CameraCapture
        visible={showCameraCapture}
        onClose={() => setShowCameraCapture(false)}
        onCapture={handleCameraCapture}
        allowVideo={true}
      />
      <EmojiPickerSheet
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        title="Emojis"
        validateForReaction={false}
        closeOnSelect={false}
        onSelect={(emoji) => {
          setText((t) => (t + emoji).slice(0, 1000));
          inputRef.current?.focus();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  cancelReplyButton: {
    marginLeft: "auto",
    padding: 4,
  },
  editContainer: {
    flex: 1,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  attachButtons: {
    flexDirection: "row",
    marginRight: 8,
    gap: 4,
  },
  attachButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
    borderRadius: 20,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: INPUT_VERTICAL_PADDING,
    minHeight: MIN_INPUT_HEIGHT,
    fontSize: 15,
    lineHeight: INPUT_LINE_HEIGHT,
    backgroundColor: "transparent",
  },
  measurementText: {
    position: "absolute",
    left: 16,
    top: INPUT_VERTICAL_PADDING,
    opacity: 0,
    fontSize: 15,
    lineHeight: INPUT_LINE_HEIGHT,
    includeFontPadding: false,
  },
  measurementTextHidden: {
    width: 0,
  },
  mentionsList: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    maxHeight: 200,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  mentionsScroll: {
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  mentionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  mentionName: {
    fontSize: 15,
    fontWeight: "600",
  },
  mentionUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    color: colors.text.light,
    fontSize: 20,
    fontWeight: "600",
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ui.error,
    marginRight: 8,
  },
  recordingText: {
    color: colors.ui.error,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 12,
  },
  recordingWaveform: {
    flex: 1,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
  },
  recordingWaveBar: {
    width: 3,
    borderRadius: 999,
    marginRight: 3,
    backgroundColor: "#FF8F94",
  },
});
