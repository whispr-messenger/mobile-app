/**
 * DeleteContactModal - Modal de confirmation de suppression d'un contact
 * Affiche une popup avec les options Confirmer et Annuler
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Contact } from "../../types/contact";
import { Avatar } from "../Chat/Avatar";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";
import { contactsAPI } from "../../services/contacts/api";

interface DeleteContactModalProps {
  visible: boolean;
  contact: Contact | null;
  onClose: () => void;
  onContactDeleted: () => void;
}

export const DeleteContactModal: React.FC<DeleteContactModalProps> = ({
  visible,
  contact,
  onClose,
  onContactDeleted,
}) => {
  const [deleting, setDeleting] = useState(false);
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  if (!contact) return null;

  const user = contact.contact_user;
  const displayName =
    contact.nickname || user?.first_name || user?.username || "Contact";

  const handleConfirm = async () => {
    try {
      setDeleting(true);
      await contactsAPI.deleteContact(contact.contact_id || contact.id);
      onContactDeleted();
      onClose();
    } catch (error: any) {
      console.error("[DeleteContactModal] Error deleting contact:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: colors.background.dark },
          ]}
        >
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: withOpacity(colors.ui.error, 0.15) },
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={32}
                color={colors.ui.error}
              />
            </View>
          </View>

          <Text style={[styles.title, { color: themeColors.text.primary }]}>
            Supprimer le contact
          </Text>

          <View style={styles.contactPreview}>
            <Avatar
              uri={user?.avatar_url}
              name={displayName}
              size={40}
              showOnlineBadge={false}
            />
            <Text
              style={[styles.contactName, { color: themeColors.text.primary }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
          </View>

          <Text style={[styles.message, { color: themeColors.text.secondary }]}>
            {
              "Êtes-vous sûr de vouloir supprimer ce contact ? Cette action est irréversible."
            }
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { borderColor: withOpacity(colors.text.light, 0.2) },
              ]}
              onPress={handleCancel}
              disabled={deleting}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: themeColors.text.primary },
                ]}
              >
                Annuler
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: colors.ui.error },
              ]}
              onPress={handleConfirm}
              disabled={deleting}
              activeOpacity={0.7}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.text.light} />
              ) : (
                <Text
                  style={[
                    styles.confirmButtonText,
                    { color: colors.text.light },
                  ]}
                >
                  Confirmer
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  container: {
    width: "100%",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  contactPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    width: "100%",
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
