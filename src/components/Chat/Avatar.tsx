/**
 * Avatar - User avatar component with fallback
 */

import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { getApiBaseUrl } from "../../services/apiBase";
import { TokenService } from "../../services/TokenService";

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

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("FileReader did not produce a data URL"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

async function streamMediaToRenderableUri(
  uri: string,
  token: string | null,
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const separator = uri.includes("?") ? "&" : "?";
  const response = await fetch(`${uri}${separator}stream=1`, { headers });
  if (!response.ok) {
    throw new Error(`stream failed: HTTP ${response.status}`);
  }

  // Some media-service deployments return a presigned URL JSON envelope
  // ({ url, expiresAt }) instead of the raw binary, even with stream=1 +
  // Accept: octet-stream. Detect this and follow the URL.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null as any);
    const followUrl = typeof data?.url === "string" ? data.url : undefined;
    if (!followUrl) {
      throw new Error("stream returned JSON without a usable url");
    }
    const followed = await fetch(followUrl);
    if (!followed.ok) {
      throw new Error(`presigned fetch failed: HTTP ${followed.status}`);
    }
    return await blobToDataUrl(await followed.blob());
  }

  return await blobToDataUrl(await response.blob());
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

            TokenService.getAccessToken()
              .then((token) =>
                streamMediaToRenderableUri(
                  `${getApiBaseUrl()}/media/v1/${encodeURIComponent(mediaId)}/blob`,
                  token,
                ),
              )
              .then((dataUrl) => {
                setResolvedUri(dataUrl);
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
