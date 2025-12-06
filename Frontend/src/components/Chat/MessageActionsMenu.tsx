/**
 * MessageActionsMenu - Context menu for message actions
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { MessageWithRelations } from '../../types/messaging';

interface MessageActionsMenuProps {
  visible: boolean;
  message: MessageWithRelations | null;
  isSent: boolean;
  isPinned: boolean;
  onClose: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: (deleteForEveryone: boolean) => void;
  onReact?: () => void;
  onPin?: () => void;
}

export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  visible,
  message,
  isSent,
  isPinned,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  if (!visible || !message) return null;

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
          style={styles.container}
          onStartShouldSetResponder={() => true}
        >
          <LinearGradient
            colors={['rgba(26, 31, 58, 0.95)', 'rgba(26, 31, 58, 0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
          >
            {onReact && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onReact();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="happy-outline" size={20} color={colors.primary.main} />
                <Text style={[styles.actionText, { color: colors.text.light }]}>
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
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-undo-outline" size={20} color={colors.primary.main} />
                <Text style={[styles.actionText, { color: colors.text.light }]}>
                  Répondre
                </Text>
              </TouchableOpacity>
            )}

            {isSent && onEdit && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onEdit();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary.main} />
                <Text style={[styles.actionText, { color: colors.text.light }]}>
                  Modifier
                </Text>
              </TouchableOpacity>
            )}

            {onPin && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onPin();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={isPinned ? "pin" : "pin-outline"} 
                  size={20} 
                  color={colors.primary.main} 
                />
                <Text style={[styles.actionText, { color: colors.text.light }]}>
                  {isPinned ? 'Désépingler' : 'Épingler'}
                </Text>
              </TouchableOpacity>
            )}

            {onDelete && (
              <>
                <View style={styles.separator} />
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => handleDelete(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.ui.error} />
                  <Text style={[styles.actionText, styles.dangerText]}>
                    Supprimer pour moi
                  </Text>
                </TouchableOpacity>
                {isSent && (
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => handleDelete(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash" size={20} color={colors.ui.error} />
                    <Text style={[styles.actionText, styles.dangerText]}>
                      Supprimer pour tous
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.actionItem}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionText, styles.cancelText]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 20,
    minWidth: 240,
    maxWidth: 280,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientContainer: {
    borderRadius: 20,
    paddingVertical: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  dangerText: {
    color: colors.ui.error,
  },
  cancelText: {
    color: colors.text.tertiary,
    textAlign: 'center',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
});


