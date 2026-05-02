/**
 * MessageInput - Message input component with send button
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../context/ThemeContext";
import { formatUsername } from "../../../utils";
import { detectMention } from "../../../utils/mentions";
import { useVoiceRecorder } from "../../../hooks/useVoiceRecorder";
import { Message } from "../../../types/messaging";
import { ReplyPreview } from "../ReplyPreview";
import { CameraCapture, CameraCaptureResult } from "../CameraCapture";
import { EmojiPickerSheet } from "../EmojiPickerSheet";
import { AttachmentSheet, AttachmentAction } from "../AttachmentSheet";
import {
  ComposerInput,
  MIN_INPUT_HEIGHT,
  MAX_INPUT_HEIGHT,
  INPUT_VERTICAL_PADDING,
  INPUT_LINE_HEIGHT,
  MentionMember,
} from "./ComposerInput";
import { RecordingBar } from "./RecordingBar";
import { SendOrMicButton } from "./SendOrMicButton";

export { buildRecordingOptions } from "../../../hooks/useVoiceRecorder";

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
  members?: MentionMember[];
  /**
   * When true, MessageInput adds its own bottom inset padding so the bar sits
   * above the home indicator / nav bar. Default false because most screens
   * already wrap MessageInput in a SafeAreaView with edges=["bottom"]; setting
   * this to true outside such a wrapper avoids the bar from being clipped.
   */
  applySafeAreaBottom?: boolean;
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
  applySafeAreaBottom = false,
}) => {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [composerWidth, setComposerWidth] = useState(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const replyingToRef = useRef(replyingTo);
  const onCancelReplyRef = useRef(onCancelReply);
  const onSendMediaRef = useRef(onSendMedia);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  useEffect(() => {
    replyingToRef.current = replyingTo;
  }, [replyingTo]);
  useEffect(() => {
    onCancelReplyRef.current = onCancelReply;
  }, [onCancelReply]);
  useEffect(() => {
    onSendMediaRef.current = onSendMedia;
  }, [onSendMedia]);

  const {
    isRecording,
    isPaused: recordingIsPaused,
    isLocked: recordingIsLocked,
    duration: recordingDuration,
    wavePhase: recordingWavePhase,
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    pause: pauseRecording,
    resume: resumeRecording,
    lock: lockRecording,
  } = useVoiceRecorder({
    onRecorded: useCallback((audio) => {
      onSendMediaRef.current?.(
        audio.uri,
        "audio",
        replyingToRef.current?.id,
        undefined,
        {
          duration: audio.duration,
          mimeType: audio.mimeType,
          filename: audio.filename,
        },
      );
      if (replyingToRef.current) {
        onCancelReplyRef.current?.();
      }
    }, []),
  });

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

  const handleLayout = useCallback((nextWidth: number) => {
    setComposerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
  }, []);

  const handleMentionSelect = useCallback(
    (member: MentionMember) => {
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
    setShowCameraCapture(true);
  }, []);

  const handleOpenEmojiPicker = useCallback(() => {
    setShowEmojiPicker(true);
  }, []);

  const handleOpenAttachmentSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAttachmentSheet(true);
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

  const handleAttachmentAction = useCallback(
    (action: AttachmentAction) => {
      switch (action) {
        case "camera":
          handleOpenCamera();
          break;
        case "gallery":
          handlePickImage();
          break;
        case "emoji":
          handleOpenEmojiPicker();
          break;
        case "document":
        case "gif":
        case "sticker":
          // Activated in later steps of WHISPR-1272 (document picker, GIF/sticker pickers)
          break;
      }
    },
    [handleOpenCamera, handlePickImage, handleOpenEmojiPicker],
  );

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const bottomPadding = applySafeAreaBottom ? insets.bottom : 0;

  return (
    <View style={styles.container}>
      <BlurView
        intensity={Platform.OS === "ios" ? 60 : 80}
        tint="dark"
        style={styles.blur}
      >
        <View style={[styles.borderOverlay, { paddingBottom: bottomPadding }]}>
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
                  <Text
                    style={[styles.editLabel, { color: themeColors.primary }]}
                  >
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
              <RecordingBar
                duration={recordingDuration}
                wavePhase={recordingWavePhase}
                isLocked={recordingIsLocked}
                isPaused={recordingIsPaused}
                onCancel={cancelRecording}
                onSend={stopRecording}
                onLock={lockRecording}
                onPause={pauseRecording}
                onResume={resumeRecording}
              />
            ) : (
              <>
                {!editingMessage && (
                  <TouchableOpacity
                    testID="attachment-sheet-trigger"
                    onPress={handleOpenAttachmentSheet}
                    style={styles.attachButton}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Ouvrir les pièces jointes"
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={28}
                      color={themeColors.text.secondary}
                    />
                  </TouchableOpacity>
                )}
                <ComposerInput
                  ref={inputRef}
                  text={text}
                  inputHeight={inputHeight}
                  composerWidth={composerWidth}
                  placeholder={
                    editingMessage
                      ? "Modifier le message"
                      : replyingTo
                        ? "Répondre"
                        : placeholder
                  }
                  showMentions={showMentions}
                  mentionQuery={mentionQuery}
                  members={members}
                  conversationType={conversationType}
                  onChangeText={handleTextChange}
                  onSubmitWeb={handleSend}
                  onMeasuredTextLayout={handleMeasuredTextLayout}
                  onLayout={handleLayout}
                  onMentionSelect={handleMentionSelect}
                />
                <SendOrMicButton
                  hasText={text.trim().length > 0}
                  isEditing={!!editingMessage}
                  onSend={handleSend}
                  onLongPressSend={handleLongPressSend}
                  onMicPress={handleMicPress}
                  onMicLongPress={startRecording}
                />
              </>
            )}
          </View>
        </View>
      </BlurView>
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
      <AttachmentSheet
        visible={showAttachmentSheet}
        onClose={() => setShowAttachmentSheet(false)}
        onSelect={handleAttachmentAction}
      />
    </View>
  );
};

// On iOS the BlurView produces a real glass effect; on Android the blur is
// often a fragile fallback, so we use a more opaque overlay tint for legibility.
const COMPOSER_OVERLAY_BG =
  Platform.OS === "ios" ? "rgba(20, 25, 50, 0.35)" : "rgba(20, 25, 50, 0.7)";

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
  },
  blur: {
    overflow: "hidden",
  },
  borderOverlay: {
    backgroundColor: COMPOSER_OVERLAY_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
    minHeight: 56,
  },
  attachButton: {
    width: 44,
    height: 44,
    marginRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
