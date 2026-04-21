/**
 * Avatar - User avatar component with fallback
 */

import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { getApiBaseUrl } from "../../services/apiBase";
import { MEDIA_API_URL } from "../../config/api";

// Extract color values for StyleSheet.create() to avoid runtime resolution issues
const TEXT_LIGHT_COLOR = colors.text.light;
const BACKGROUND_PRIMARY_COLOR = colors.background.primary;

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
  showOnlineBadge?: boolean;
  isOnline?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 48,
  showOnlineBadge = false,
  isOnline = false,
}) => {
  const [imageError, setImageError] = React.useState(false);

  const effectiveUri = React.useMemo(() => {
    if (!uri) return undefined;
    const uuidOnly = uri.match(/^[0-9a-f-]{36}$/i);
    if (uuidOnly) return `${MEDIA_API_URL}/public/${uri}`;

    const directPublic = uri.match(
      /(?:^|\/)media\/v1\/public\/([0-9a-f-]{36})(?:[/?]|$)/i,
    );
    if (directPublic?.[1]) return `${MEDIA_API_URL}/public/${directPublic[1]}`;

    const directBlob = uri.match(
      /(?:^|\/)media\/v1\/([0-9a-f-]{36})\/(?:blob|thumbnail)(?:[/?]|$)/i,
    );
    if (directBlob?.[1]) return `${MEDIA_API_URL}/public/${directBlob[1]}`;

    const directPublicLegacy = uri.match(
      /(?:^|\/)media\/public\/([0-9a-f-]{36})(?:[/?]|$)/i,
    );
    if (directPublicLegacy?.[1])
      return `${MEDIA_API_URL}/public/${directPublicLegacy[1]}`;

    const match = uri.match(
      /(?:^|\/)(avatars|group_icons)\/[0-9a-f-]{36}\/([0-9a-f-]{36})(?:[/?]|$)/i,
    );
    if (match?.[2]) return `${MEDIA_API_URL}/public/${match[2]}`;

    const minioMatch = uri.match(
      /(?:^|\/)whispr-media\/(avatars|group_icons)\/[0-9a-f-]{36}\/([0-9a-f-]{36})(?:[/?]|$)/i,
    );
    if (minioMatch?.[2]) return `${MEDIA_API_URL}/public/${minioMatch[2]}`;

    if (uri.startsWith("/")) return `${getApiBaseUrl()}${uri}`;
    if (/^https?:\/\//i.test(uri)) return uri;
    return uri;
  }, [uri]);

  const initials =
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  // Reset error state when URI changes
  React.useEffect(() => {
    setImageError(false);
  }, [effectiveUri]);

  const shouldShowImage = effectiveUri && !imageError;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {shouldShowImage ? (
        <Image
          source={{ uri: effectiveUri }}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
          resizeMode="cover"
          onError={(error) => {
            console.log(
              "[Avatar] Image load error:",
              effectiveUri,
              error.nativeEvent?.error,
            );
            setImageError(true);
          }}
        />
      ) : (
        <LinearGradient
          colors={[colors.primary.main, colors.primary.light]}
          style={[
            styles.gradient,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
            {initials}
          </Text>
        </LinearGradient>
      )}
      {showOnlineBadge && (
        <View
          style={[
            styles.onlineBadge,
            {
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: size * 0.125,
              backgroundColor: isOnline
                ? colors.status.online
                : colors.status.offline,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  image: {
    resizeMode: "cover",
  },
  gradient: {
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    color: TEXT_LIGHT_COLOR,
    fontWeight: "600",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: BACKGROUND_PRIMARY_COLOR,
  },
});
