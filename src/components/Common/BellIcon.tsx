/**
 * BellIcon - Icone cloche avec badge unread count (WHISPR-1437).
 * A placer en top-right des headers principaux.
 */

import React, { memo } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

interface BellIconProps {
  unreadCount: number;
  onPress: () => void;
  color?: string;
  size?: number;
}

export const BellIcon = memo<BellIconProps>(
  ({ unreadCount, onPress, color = colors.text.light, size = 22 }) => {
    const badgeLabel =
      unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : null;

    return (
      <TouchableOpacity
        onPress={onPress}
        style={styles.container}
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0
            ? `Notifications, ${unreadCount} non lues`
            : "Notifications"
        }
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="notifications-outline" size={size} color={color} />
        {badgeLabel !== null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);
BellIcon.displayName = "BellIcon";

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.ui.error,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.text.light,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
  },
});
