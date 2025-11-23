/**
 * MessageActionsMenu - Context menu for message actions
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { Message } from '../../types/messaging';

interface MessageActionsMenuProps {
  visible: boolean;
  message: Message | null;
  isSent: boolean;
  onClose: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: (deleteForEveryone: boolean) => void;
  onReact?: () => void;
}

export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  visible,
  message,
  isSent,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onReact,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  if (!message) return null;

  // Check if message can be edited (within 24 hours)
  const messageAge = Date.now() - new Date(message.sent_at).getTime();
  const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours
  const canEdit = isSent && messageAge < maxEditAge && !message.is_deleted;

  // Check if message can be deleted (within 48 hours)
  const maxDeleteAge = 48 * 60 * 60 * 1000; // 48 hours
  const canDelete = isSent && messageAge < maxDeleteAge && !message.is_deleted;

  const handleDelete = (deleteForEveryone: boolean) => {
    onDelete?.(deleteForEveryone);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: themeColors.background.secondary },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {onReact && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                onReact();
                onClose();
              }}
            >
              <Text style={[styles.actionText, { color: themeColors.text.primary }]}>
                Réagir
              </Text>
            </TouchableOpacity>
          )}

          {onReply && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                onReply();
                onClose();
              }}
            >
              <Text style={[styles.actionText, { color: themeColors.text.primary }]}>
                Répondre
              </Text>
            </TouchableOpacity>
          )}

          {canEdit && onEdit && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                onEdit();
                onClose();
              }}
            >
              <Text style={[styles.actionText, { color: themeColors.text.primary }]}>
                Modifier
              </Text>
            </TouchableOpacity>
          )}

          {canDelete && onDelete && (
            <>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleDelete(false)}
              >
                <Text style={[styles.actionText, { color: themeColors.text.primary }]}>
                  Supprimer pour moi
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionItem, styles.dangerItem]}
                onPress={() => handleDelete(true)}
              >
                <Text style={[styles.actionText, { color: colors.ui.error }]}>
                  Supprimer pour tous
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.actionItem} onPress={onClose}>
            <Text style={[styles.actionText, { color: themeColors.text.secondary }]}>
              Annuler
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  actionItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dangerItem: {
    borderTopWidth: 1,
    borderTopColor: colors.ui.divider,
    marginTop: 4,
  },
  actionText: {
    fontSize: 16,
  },
});

