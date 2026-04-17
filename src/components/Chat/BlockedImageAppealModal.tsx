/**
 * BlockedImageAppealModal - UI to contest a locally blocked image
 */

import React, { useCallback, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { colors } from "../../theme/colors";
import { useModerationStore } from "../../store/moderationStore";

const MIN_CHARS = 20;

interface Props {
  visible: boolean;
  onClose: () => void;
  imageUri: string;
  blockReason?: string;
  scores?: Record<string, number>;
  messageTempId: string;
  conversationId: string;
  recipientId?: string;
}

export const BlockedImageAppealModal: React.FC<Props> = ({
  visible,
  onClose,
  imageUri,
  blockReason,
  scores,
  messageTempId,
  conversationId,
  recipientId,
}) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { createBlockedImageAppeal } = useModerationStore();

  const canSubmit = reason.trim().length >= MIN_CHARS && !loading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await createBlockedImageAppeal({
        imageUri,
        reason: reason.trim(),
        conversationId,
        recipientId,
        messageTempId,
        blockReason,
        scores,
      });
      setReason("");
      onClose();
      Alert.alert(
        "Contestation envoyée",
        "Un administrateur va examiner ton image.",
      );
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.message || "Impossible d'envoyer la contestation.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    canSubmit,
    createBlockedImageAppeal,
    imageUri,
    reason,
    conversationId,
    recipientId,
    messageTempId,
    blockReason,
    scores,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    if (loading) return;
    setReason("");
    onClose();
  }, [loading, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Contester le blocage</Text>
            <Text style={styles.subtitle}>
              Explique pourquoi ton image est conforme. Un administrateur
              l'examinera.
            </Text>

            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.preview}
                resizeMode="cover"
              />
            ) : null}

            {blockReason ? (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Raison du blocage</Text>
                <Text style={styles.reasonText}>{blockReason}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Explique pourquoi ton image est OK"
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              maxLength={500}
              value={reason}
              onChangeText={setReason}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>
              {reason.trim().length}/500 (min {MIN_CHARS})
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.submitBtn,
                  !canSubmit && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Envoyer la contestation</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1A1F3A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  scroll: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 16,
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 12,
  },
  reasonBox: {
    backgroundColor: "rgba(240, 72, 72, 0.12)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F04848",
    marginBottom: 3,
  },
  reasonText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  counter: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  submitBtn: {
    backgroundColor: colors.primary.main,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default BlockedImageAppealModal;
