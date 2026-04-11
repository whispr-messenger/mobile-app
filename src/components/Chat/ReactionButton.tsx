/**
 * ReactionButton - Individual reaction button with emoji and count
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

interface ReactionButtonProps {
  emoji: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
  /** Appui long : voir qui a réagi (spec) */
  onLongPress?: () => void;
  /** Display names of users who reacted (for hover tooltip) */
  reactorNames?: string[];
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  emoji,
  count,
  isActive,
  onPress,
  onLongPress,
  reactorNames,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [hovered, setHovered] = useState(false);

  const showTooltip =
    Platform.OS === "web" && hovered && reactorNames && reactorNames.length > 0;

  return (
    <View style={styles.tooltipWrapper}>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={380}
        style={[
          styles.container,
          {
            backgroundColor: isActive
              ? colors.primary.light + "30"
              : themeColors.background.secondary,
            borderColor: isActive ? themeColors.primary : colors.ui.divider,
          },
        ]}
        activeOpacity={0.7}
        {...(Platform.OS === "web"
          ? ({
              onMouseEnter: () => setHovered(true),
              onMouseLeave: () => setHovered(false),
            } as any)
          : {})}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        {count > 0 && (
          <Text
            style={[
              styles.count,
              {
                color: isActive
                  ? themeColors.primary
                  : themeColors.text.secondary,
              },
            ]}
          >
            {count}
          </Text>
        )}
      </TouchableOpacity>
      {showTooltip && (
        <View
          style={[
            styles.tooltip,
            { backgroundColor: themeColors.background.secondary },
          ]}
        >
          <Text
            style={[styles.tooltipText, { color: themeColors.text.primary }]}
          >
            {reactorNames!.join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tooltipWrapper: {
    position: "relative",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 4,
  },
  emoji: {
    fontSize: 16,
    marginRight: 4,
  },
  count: {
    fontSize: 12,
    fontWeight: "600",
  },
  tooltip: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.3)" } as any)
      : {}),
    zIndex: 999,
    maxWidth: 200,
  },
  tooltipText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
