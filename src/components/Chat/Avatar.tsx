/**
 * Avatar - User avatar component with fallback
 *
 * WHISPR-1258 — passing the bare `/media/v1/:id/blob` URL to <Image> on web
 * triggers an `<img>` request without `Authorization`, which the media service
 * answers with 401. We now route the URL through `useResolvedMediaUrl`, the
 * shared hook that streams the bytes via the authenticated `?stream=1` proxy
 * and surfaces them as a `blob:` (web) or `data:` (native) URI safe for any
 * renderer. While the hook is loading we show the initials placeholder rather
 * than the unauthenticated URL.
 */

import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { getApiBaseUrl } from "../../services/apiBase";
import { useResolvedMediaUrl } from "../../hooks/useResolvedMediaUrl";

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

function extractMediaIdFromUri(raw: string): {
  mediaId: string | undefined;
  kind: "blob" | "thumbnail";
} {
  const mediaMatch = raw.match(
    /\/media\/v1\/(?:public\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(blob|thumbnail)(?:\?.*)?$/i,
  );
  if (mediaMatch?.[1]) {
    return {
      mediaId: mediaMatch[1],
      kind: (mediaMatch?.[2] as "blob" | "thumbnail") || "blob",
    };
  }

  const uuidMatch = raw.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  if (uuidMatch) return { mediaId: raw, kind: "blob" };

  const looksLikeMinioAvatar =
    /minio/i.test(raw) || /\/avatars\//i.test(raw) || /whispr-media/i.test(raw);
  if (looksLikeMinioAvatar) {
    const trailingUuid = raw.match(
      /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\?.*)?$/i,
    );
    if (trailingUuid?.[1]) return { mediaId: trailingUuid[1], kind: "blob" };
  }

  return { mediaId: undefined, kind: "blob" };
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 48,
  showOnlineBadge = false,
  isOnline = false,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const triedAuthResolveRef = React.useRef(false);

  const effectiveCandidate = React.useMemo(() => {
    const raw = typeof uri === "string" ? uri.trim() : "";
    if (!raw) return { uri: undefined, mediaId: undefined };

    if (raw.startsWith("file://") || raw.startsWith("data:")) {
      return { uri: raw, mediaId: undefined };
    }

    if (/^https?:\/\//i.test(raw)) {
      const base = getApiBaseUrl();
      const extracted = extractMediaIdFromUri(raw);
      if (extracted.mediaId) {
        return {
          uri: `${base}/media/v1/${encodeURIComponent(extracted.mediaId)}/${extracted.kind}`,
          mediaId: extracted.mediaId,
        };
      }
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

  // Reset the local error flag whenever the source changes — otherwise an
  // earlier failure would mask a fresh URI for the same component instance
  // (e.g. ConversationItem re-using the same Avatar across rerenders).
  const candidateKey = effectiveCandidate.mediaId ?? effectiveCandidate.uri;
  const lastCandidateKeyRef = React.useRef(candidateKey);
  if (lastCandidateKeyRef.current !== candidateKey) {
    lastCandidateKeyRef.current = candidateKey;
    setImageError(false);
  }

  // Route every /media/v1/<id>/blob (or /thumbnail) URL through the shared
  // resolver hook so we never hand an unauthenticated URL to <Image>. Plain
  // https / data / file URIs are passed through unchanged by the hook.
  const { resolvedUri, loading, error } = useResolvedMediaUrl(
    effectiveCandidate.uri,
  );

  const initials =
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const shouldShowImage = !!resolvedUri && !loading && !error && !imageError;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {shouldShowImage ? (
        <Image
          source={{ uri: resolvedUri }}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
          resizeMode="cover"
          onError={() => setImageError(true)}
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
