/**
 * ForwardMessageModal - Modal to select conversations to forward a message to.
 * Supports search and multi-select (WHISPR-1045).
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Conversation } from "../../types/messaging";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { Avatar } from "./Avatar";

interface ForwardMessageModalProps {
  visible: boolean;
  conversations: Conversation[];
  currentConversationId: string;
  sending: boolean;
  onClose: () => void;
  onSelect: (conversationIds: string[]) => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  visible,
  conversations,
  currentConversationId,
  sending,
  onClose,
  onSelect,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const filteredConversations = useMemo(() => {
    const base = conversations.filter(
      (c) => c.id !== currentConversationId && c.is_active !== false,
    );
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => (c.display_name || "").toLowerCase().includes(q));
  }, [conversations, currentConversationId, query]);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleClose = () => {
    setQuery("");
    setSelected([]);
    onClose();
  };

  const handleSend = () => {
    if (selected.length === 0 || sending) return;
    onSelect(selected);
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const isChecked = selected.includes(item.id);
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.7}
        disabled={sending}
      >
        <Avatar
          uri={item.avatar_url}
          name={item.display_name || "Contact"}
          size={40}
        />
        <View style={styles.conversationInfo}>
          <Text
            style={[
              styles.conversationName,
              { color: themeColors.text.primary },
            ]}
            numberOfLines={1}
          >
            {item.display_name || "Contact"}
          </Text>
          {item.type === "group" ? (
            <Text
              style={[
                styles.conversationType,
                { color: themeColors.text.tertiary },
              ]}
            >
              Groupe
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={isChecked ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          color={isChecked ? colors.primary.main : themeColors.text.tertiary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={colors.background.gradient.app}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: themeColors.text.primary }]}>
                Transférer vers
              </Text>
              <TouchableOpacity onPress={handleClose} disabled={sending}>
                <Ionicons
                  name="close"
                  size={24}
                  color={themeColors.text.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <Ionicons
                name="search"
                size={16}
                color={themeColors.text.tertiary}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  { color: themeColors.text.primary },
                ]}
                placeholder="Rechercher une conversation"
                placeholderTextColor={themeColors.text.tertiary}
                value={query}
                onChangeText={setQuery}
                editable={!sending}
              />
            </View>

            {sending ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary.main} />
                <Text
                  style={[
                    styles.loadingText,
                    { color: themeColors.text.secondary },
                  ]}
                >
                  Envoi en cours...
                </Text>
              </View>
            ) : null}

            {filteredConversations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text
                  style={[
                    styles.emptyText,
                    { color: themeColors.text.tertiary },
                  ]}
                >
                  Aucune conversation disponible
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredConversations}
                keyExtractor={(item) => item.id}
                renderItem={renderConversationItem}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              />
            )}

            <TouchableOpacity
              style={[
                styles.sendButton,
                (selected.length === 0 || sending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={selected.length === 0 || sending}
              activeOpacity={0.8}
            >
              <Text style={styles.sendButtonText}>
                {selected.length > 0
                  ? `Transférer (${selected.length})`
                  : "Transférer"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  container: {
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  gradientContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    padding: 0,
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "500",
  },
  conversationType: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    marginLeft: 8,
  },
  sendButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
