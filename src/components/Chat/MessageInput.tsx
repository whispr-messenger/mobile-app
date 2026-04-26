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
  FlatList,
  ScrollView,
  NativeModules,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { Message } from "../../types/messaging";
import { ReplyPreview } from "./ReplyPreview";
import { Avatar } from "./Avatar";
import { CameraCapture, CameraCaptureResult } from "./CameraCapture";
import { EmojiPickerSheet } from "./EmojiPickerSheet";

let AudioModule: any = null;
let triedLoadingAudioModule = false;

function getAudioModule(): any | null {
  if (AudioModule) return AudioModule;
  if (triedLoadingAudioModule) return null;
  const native = NativeModules as Record<string, unknown>;
  const shouldAttemptLoad =
    Platform.OS === "web" ||
    process.env.NODE_ENV === "test" ||
    Boolean(native?.ExponentAV);
  if (!shouldAttemptLoad) return null;
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
  const base = getAudioModule()?.RecordingOptionsPresets?.HIGH_QUALITY;
  if (Platform.OS !== "web") return base;
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

interface MessageInputProps {
  onSend: (message: string, replyToId?: string, mentions?: string[]) => void;
  onSendMedia?: (
    uri: string,
    type: "image" | "video" | "file" | "audio",
    replyToId?: string,
    caption?: string,
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
      updateMentionState(newText);
      updateTypingState(newText.trim());
    },
    [updateMentionState, updateTypingState],
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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
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

      // Defer setAudioModeAsync so it doesn't block the render of the
      // recording UI on iOS Safari (the call can be slow).
      setTimeout(() => {
        audioModule
          .setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          })
          .catch((err: unknown) => {
            console.warn("[MessageInput] setAudioModeAsync failed:", err);
          });
      }, 0);

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
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const audioModule = getAudioModule();
      if (audioModule) {
        await audioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      }

      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);

      if (!uri) {
        console.error("[MessageInput] No URI from recording");
        return;
      }

      // Only send if recording is at least 1 second
      const durationSec = (status?.durationMillis || 0) / 1000;
      if (durationSec < 1) {
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // On web the URI is a `blob:...uuid` with no extension; backends derive
      // filenames from the URL path and reject blobs. Rewrap with a proper
      // File so the resulting object URL carries a real name + MIME.
      let finalUri = uri;
      if (Platform.OS === "web" && uri.startsWith("blob:")) {
        try {
          const mime = recordingMimeRef.current || "audio/webm";
          const ext = mime === "audio/mp4" ? "m4a" : "webm";
          const fileName = `voice-${Date.now()}.${ext}`;
          const response = await fetch(uri);
          const blob = await response.blob();
          const file = new File([blob], fileName, { type: mime });
          finalUri = URL.createObjectURL(file);
        } catch (rewrapError) {
          console.warn(
            "[MessageInput] Failed to rewrap blob, sending raw URI:",
            rewrapError,
          );
        }
      }
      recordingMimeRef.current = null;

      onSendMedia?.(finalUri, "audio", replyingTo?.id);
      if (replyingTo) {
        onCancelReply?.();
      }
    } catch (error: any) {
      console.error("[MessageInput] Error stopping recording:", error);
      setIsRecording(false);
      setRecordingDuration(0);
      recordingRef.current = null;
    }
  }, [onSendMedia, replyingTo, onCancelReply]);

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
            </View>
            <TouchableOpacity onPress={stopRecording} activeOpacity={0.7}>
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
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    color: themeColors.text.primary,
                    backgroundColor: "rgba(26, 31, 58, 0.6)",
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
                placeholder={
                  editingMessage
                    ? "Modifier le message"
                    : replyingTo
                      ? "Répondre"
                      : placeholder
                }
                placeholderTextColor={themeColors.text.tertiary}
                maxLength={1000}
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
    alignItems: "center",
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
  },
  input: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
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
  },
});
