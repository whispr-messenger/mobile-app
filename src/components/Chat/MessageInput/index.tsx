/**
 * MessageInput - barre de saisie + bouton d'envoi.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../../../context/ThemeContext";
import { formatUsername } from "../../../utils";
import { detectMention } from "../../../utils/mentions";
import {
  useVoiceRecorder,
  RecordedAudio,
} from "../../../hooks/useVoiceRecorder";
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
  INPUT_EXTRA_TOP_PADDING,
  INPUT_EXTRA_BOTTOM_PADDING,
  MentionMember,
} from "./ComposerInput";
import { RecordingBar } from "./RecordingBar";
import { RecordedAudioPreview } from "./RecordedAudioPreview";
import { SendOrMicButton } from "./SendOrMicButton";
import { AttachButton } from "./AttachButton";

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
   * Quand true, on ajoute soi-même le padding bottom safe-area pour que la
   * barre passe au-dessus du home indicator. Par defaut false : la plupart
   * des ecrans wrappent deja MessageInput dans une SafeAreaView avec
   * edges=["bottom"]. A activer uniquement quand ce n'est pas le cas, sinon
   * la barre se fait clipper.
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(
    null,
  );
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

  // Quand le clavier est ouvert, on degage le padding bottom safe-area : il
  // recouvre deja le home indicator, et le KeyboardAvoidingView pousse la
  // barre au-dessus.
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () =>
      setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setIsKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
      setRecordedAudio(audio);
    }, []),
  });

  const handleSendRecordedAudio = useCallback(() => {
    if (!recordedAudio) return;
    onSendMediaRef.current?.(
      recordedAudio.uri,
      "audio",
      replyingToRef.current?.id,
      undefined,
      {
        duration: recordedAudio.duration,
        mimeType: recordedAudio.mimeType,
        filename: recordedAudio.filename,
      },
    );
    if (replyingToRef.current) {
      onCancelReplyRef.current?.();
    }
    setRecordedAudio(null);
  }, [recordedAudio]);

  const handleDiscardRecordedAudio = useCallback(() => {
    setRecordedAudio(null);
  }, []);

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
        // ne fermer le picker de mentions que dans les groupes : ailleurs
        // l'ancien comportement laissait l'etat ouvert.
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

  const updateInputHeightFromLineCount = useCallback(
    (lineCount: number, addExtraBottomRow: boolean) => {
      const effectiveLineCount = lineCount + (addExtraBottomRow ? 1 : 0);
      const nextHeight = Math.max(
        MIN_INPUT_HEIGHT,
        Math.min(
          MAX_INPUT_HEIGHT,
          effectiveLineCount * INPUT_LINE_HEIGHT +
            INPUT_VERTICAL_PADDING * 2 +
            INPUT_EXTRA_TOP_PADDING +
            INPUT_EXTRA_BOTTOM_PADDING,
        ),
      );
      setInputHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    },
    [],
  );

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
      const didWrap = measuredLineCount > explicitLineCount;
      updateInputHeightFromLineCount(lineCount, didWrap);
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

      inputRef.current?.focus();
    },
    [text, mentionStartIndex],
  );

  const handleSend = useCallback(() => {
    if (text.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

  const handleCameraCapture = useCallback(
    (result: CameraCaptureResult) => {
      // envoie le media + caption dans le meme message (un seul tour reseau)
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

      // WHISPR-1039 : pas de crop force, on garde le ratio natif de l'image.
      // WHISPR-1197 : ne pas passer `quality` non plus - des qu'il est defini,
      // expo-image-picker re-encode en JPEG sur iOS/Android, ce qui aplatit
      // les GIFs animes (1er frame seulement) et casse le HEIC. La taille
      // est deja bornee a l'upload (WHISPR-1220), donc on accepte le leger
      // surcout reseau pour preserver l'animation et le format Apple.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
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

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }
      const asset = result.assets[0];

      // borne client-side pour eviter un upload qui echoue cote serveur.
      const MAX_BYTES = 25 * 1024 * 1024;
      if (typeof asset.size === "number" && asset.size > MAX_BYTES) {
        Alert.alert(
          "Fichier trop volumineux",
          "Les documents sont limités à 25 Mo.",
        );
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSendMedia?.(asset.uri, "file", replyingTo?.id, undefined, {
        mimeType: asset.mimeType ?? "application/octet-stream",
        filename: asset.name,
      });
      onCancelReply?.();
    } catch (error: any) {
      console.error("[MessageInput] Error picking document:", error);
      Alert.alert(
        "Erreur",
        `Impossible de sélectionner un document.${error?.message ? `\n\n${error.message}` : ""}`,
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
        case "document":
          handlePickDocument();
          break;
        case "emoji":
          handleOpenEmojiPicker();
          break;
      }
    },
    [
      handleOpenCamera,
      handlePickImage,
      handlePickDocument,
      handleOpenEmojiPicker,
    ],
  );

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // clavier ouvert : on veut un petit espace entre la barre et le clavier.
  // Sinon on utilise l'inset du home indicator.
  const KEYBOARD_OPEN_GAP = 8;
  const bottomPadding = isKeyboardVisible
    ? KEYBOARD_OPEN_GAP
    : applySafeAreaBottom
      ? insets.bottom
      : 0;

  const overlayStyle = [styles.barWrapper, { paddingBottom: bottomPadding }];

  return (
    <View style={styles.container}>
      <View style={overlayStyle}>
        {(replyingTo || editingMessage) && (
          <View
            style={[
              styles.replyContainer,
              { backgroundColor: "rgba(11, 17, 36, 0.7)" },
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
              onStop={stopRecording}
              onLock={lockRecording}
              onPause={pauseRecording}
              onResume={resumeRecording}
            />
          ) : recordedAudio ? (
            <RecordedAudioPreview
              audio={recordedAudio}
              onCancel={handleDiscardRecordedAudio}
              onSend={handleSendRecordedAudio}
            />
          ) : (
            <>
              {!editingMessage && (
                <View style={styles.attachButtonWrapper}>
                  <AttachButton onPress={handleOpenAttachmentSheet} />
                </View>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
  },
  barWrapper: {
    backgroundColor: "transparent",
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
  attachButtonWrapper: {
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
