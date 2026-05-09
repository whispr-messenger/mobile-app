/**
 * ContactItem - Contact list item component
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Contact } from "../../types/contact";
import { Avatar } from "../Chat/Avatar";
import { ProfileTrigger } from "../Profile/ProfileTrigger";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";

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
    <BlurView intensity={30} tint="dark" style={styles.blurWrap}>
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.82}
      >
        <ProfileTrigger userId={contact.contact_id}>
          <View style={styles.avatarRing}>
            <Avatar
              uri={user?.avatar_url}
              name={displayName}
              size={52}
              showOnlineBadge={false}
              isOnline={false}
            />
          </View>
        </ProfileTrigger>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, { color: themeColors.text.primary }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {contact.is_favorite && (
              <View style={styles.favoriteBadge}>
                <Ionicons
                  name="star"
                  size={12}
                  color={colors.primary.main}
                  style={styles.favoriteIcon}
                />
              </View>
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
                size={18}
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
              style={[styles.actionIcon, styles.deleteActionIcon]}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={colors.ui.error}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.chevronWrap}>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={themeColors.text.tertiary}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  blurWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 24,
    overflow: "hidden",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(11,17,36,0.2)",
    borderRadius: 24,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
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
    fontFamily: "Inter_700Bold",
    marginRight: 6,
  },
  favoriteBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(colors.primary.main, 0.16),
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.24),
  },
  favoriteIcon: {
    marginLeft: 0,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.88,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  deleteActionIcon: {
    backgroundColor: "rgba(255,59,48,0.1)",
    borderColor: "rgba(255,59,48,0.2)",
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
