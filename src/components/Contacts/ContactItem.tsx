/**
 * ContactItem - Contact list item component
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Contact } from "../../types/contact";
import { Avatar } from "../Chat/Avatar";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

interface ContactItemProps {
  contact: Contact;
  onPress?: (contact: Contact) => void;
  onLongPress?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  onToggleFavorite?: (contact: Contact) => void;
}

export const ContactItem: React.FC<ContactItemProps> = ({
  contact,
  onPress,
  onLongPress,
  onDelete,
  onToggleFavorite,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const user = contact.contact_user;
  const displayName =
    contact.nickname || user?.first_name || user?.username || "Contact";
  const subtitle = user?.username || user?.phone_number || "";

  const handlePress = () => {
    onPress?.(contact);
  };

  const handleLongPress = () => {
    onLongPress?.(contact);
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: themeColors.background.secondary },
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <Avatar
        uri={user?.avatar_url}
        name={displayName}
        size={48}
        showOnlineBadge={false}
        isOnline={false}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, { color: themeColors.text.primary }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {contact.is_favorite && (
            <Ionicons
              name="star"
              size={16}
              color={colors.primary.main}
              style={styles.favoriteIcon}
            />
          )}
        </View>
        {subtitle && (
          <Text
            style={[styles.subtitle, { color: themeColors.text.secondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        {onToggleFavorite && (
          <TouchableOpacity
            onPress={() => onToggleFavorite(contact)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.actionIcon}
          >
            <Ionicons
              name={contact.is_favorite ? "star" : "star-outline"}
              size={20}
              color={
                contact.is_favorite
                  ? colors.primary.main
                  : themeColors.text.tertiary
              }
            />
          </TouchableOpacity>
        )}
        {onDelete ? (
          <TouchableOpacity
            onPress={() => onDelete(contact)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.actionIcon}
          >
            <Ionicons name="trash-outline" size={20} color={colors.ui.error} />
          </TouchableOpacity>
        ) : (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={themeColors.text.tertiary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 6,
  },
  favoriteIcon: {
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    padding: 4,
  },
});
