/**
 * Avatar - User avatar component with fallback
 */

import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { getApiBaseUrl } from "../../services/apiBase";
import MediaService from "../../services/MediaService";

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
  const [resolvedUri, setResolvedUri] = React.useState<string | undefined>(
    undefined,
  );
  const triedAuthResolveRef = React.useRef(false);

  const effectiveCandidate = React.useMemo(() => {
    const raw = typeof uri === "string" ? uri.trim() : "";
    if (!raw) return { uri: undefined, mediaId: undefined };

    if (raw.startsWith("file://") || raw.startsWith("data:")) {
      return { uri: raw, mediaId: undefined };
    }

    if (/^https?:\/\//i.test(raw)) {
      return { uri: raw, mediaId: undefined };
    }

    const publicMediaMatch = raw.match(
      /^\/?media\/v1\/public\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    );
    if (publicMediaMatch?.[1]) {
      const base = getApiBaseUrl();
      const id = publicMediaMatch[1];
      return {
        uri: `${base}/media/v1/${encodeURIComponent(id)}/blob`,
        mediaId: id,
      };
    }

    const uuidMatch = raw.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    if (uuidMatch) {
      const base = getApiBaseUrl();
      return {
        uri: `${base}/media/v1/${encodeURIComponent(raw)}/blob`,
        mediaId: raw,
      };
    }

    const base = getApiBaseUrl();
    if (raw.startsWith("/")) {
      return { uri: `${base}${raw}`, mediaId: undefined };
    }

    if (raw.includes("/")) {
      return { uri: `${base}/${raw.replace(/^\/+/, "")}`, mediaId: undefined };
    }

    return { uri: undefined, mediaId: undefined };
  }, [uri]);

  const effectiveUri = resolvedUri ?? effectiveCandidate.uri;

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
    setResolvedUri(undefined);
    triedAuthResolveRef.current = false;
  }, [uri]);

  const shouldShowImage = !!effectiveUri && !imageError;

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
              "[PDP-DEBUG][Avatar] Image load error:",
              effectiveUri,
              error.nativeEvent?.error,
            );
            setImageError(true);

            if (triedAuthResolveRef.current) return;
            triedAuthResolveRef.current = true;

            const raw = typeof uri === "string" ? uri.trim() : "";
            const directMediaId =
              effectiveCandidate.mediaId ||
              (raw.match(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
              )
                ? raw
                : undefined);

            const parsedFromUrl = (() => {
              const candidate = effectiveUri ?? "";
              const m = candidate.match(
                /\/media\/v1\/(?:public\/)?([^/]+)(?:\/|$)/,
              );
              if (!m?.[1]) return undefined;
              try {
                return decodeURIComponent(m[1]);
              } catch {
                return m[1];
              }
            })();

            const mediaId = directMediaId || parsedFromUrl;
            if (!mediaId) return;

            MediaService.downloadMediaToCacheFile(mediaId)
              .then((localOrUrl) => {
                if (!localOrUrl) return;
                setResolvedUri(localOrUrl);
                setImageError(false);
              })
              .catch(() => undefined);
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
