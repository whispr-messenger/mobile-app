import React, { useCallback } from "react";
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";
import type { MessageLinkPreview } from "../../types/messaging";
import { isReachableUrl } from "../../utils";

interface LinkPreviewCardProps {
  preview: MessageLinkPreview;
  isSent: boolean;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  preview,
  isSent,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const handleOpen = useCallback(async () => {
    try {
      await Linking.openURL(preview.canonicalUrl || preview.url);
    } catch {
      // Ignore open failures — keeping the chat interaction resilient matters
      // more than surfacing a noisy warning.
    }
  }, [preview.canonicalUrl, preview.url]);

  const domain = preview.domain || preview.siteName || preview.url;
  const imageUri = isReachableUrl(preview.imageUrl) ? preview.imageUrl : null;
  const titleColor = isSent ? colors.text.light : themeColors.text.primary;
  const descriptionColor = isSent
    ? "rgba(255,255,255,0.8)"
    : themeColors.text.secondary;
  const domainColor = isSent
    ? "rgba(255,255,255,0.72)"
    : themeColors.text.tertiary;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        void handleOpen();
      }}
      style={[
        styles.card,
        isSent ? styles.cardSent : styles.cardReceived,
        {
          borderColor: isSent
            ? "rgba(255,255,255,0.14)"
            : withOpacity(colors.secondary.light, 0.24),
        },
      ]}
      accessibilityRole="link"
      accessibilityLabel={preview.title || domain}
      accessibilityHint={`Ouvrir le lien ${preview.canonicalUrl || preview.url}`}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} />
      ) : (
        <View
          style={[
            styles.imageFallback,
            {
              backgroundColor: isSent
                ? "rgba(255,255,255,0.08)"
                : withOpacity(colors.secondary.medium, 0.14),
            },
          ]}
        >
          <Ionicons
            name="globe-outline"
            size={22}
            color={isSent ? colors.text.light : colors.primary.main}
          />
        </View>
      )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
          {preview.title || domain}
        </Text>
        {!!preview.description && (
          <Text
            style={[styles.description, { color: descriptionColor }]}
            numberOfLines={3}
          >
            {preview.description}
          </Text>
        )}
        <Text style={[styles.domain, { color: domainColor }]} numberOfLines={1}>
          {domain}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  cardSent: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cardReceived: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  image: {
    width: "100%",
    height: 144,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  imageFallback: {
    width: "100%",
    height: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  domain: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "lowercase",
  },
});
