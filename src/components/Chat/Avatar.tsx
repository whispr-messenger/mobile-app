/**
 * Avatar - avatar utilisateur avec fallback initiales.
 *
 * WHISPR-1258 : passer le URL brut `/media/v1/:id/blob` a <Image> sur web
 * declenche un GET <img> sans Authorization, donc 401 cote media service.
 * On passe par `useResolvedMediaUrl` qui streame via le proxy authentifie
 * `?stream=1` et expose un URI `blob:` (web) ou `data:` (natif). Pendant
 * le chargement, on affiche les initiales plutot que l'URL non auth.
 */

import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { getApiBaseUrl } from "../../services/apiBase";
import { useResolvedMediaUrl } from "../../hooks/useResolvedMediaUrl";

// extraire les couleurs en const : StyleSheet.create() les resoud au mount,
// pas a chaque render.
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

  const effectiveCandidate = React.useMemo(() => {
    const raw = typeof uri === "string" ? uri.trim() : "";
    if (!raw) return { uri: undefined, mediaId: undefined };

    // WHISPR-1335 - sur web, le selecteur d'image fallback expose un
    // URL.createObjectURL() qui produit un URI "blob:". On doit le
    // passer tel quel a <Image> pour afficher la preview, sinon la photo
    // fraichement choisie ne s'affiche pas avant l'upload.
    if (
      raw.startsWith("file://") ||
      raw.startsWith("data:") ||
      raw.startsWith("blob:")
    ) {
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

  // reset du flag d'erreur quand la source change : sinon un ancien echec
  // masque une nouvelle URI valide pour la meme instance (cf. ConversationItem
  // qui reutilise Avatar entre re-renders).
  const candidateKey = effectiveCandidate.mediaId ?? effectiveCandidate.uri;
  const lastCandidateKeyRef = React.useRef(candidateKey);
  if (lastCandidateKeyRef.current !== candidateKey) {
    lastCandidateKeyRef.current = candidateKey;
    setImageError(false);
  }

  // toute URL /media/v1/<id>/blob (ou /thumbnail) passe par le hook resolver
  // pour eviter de filer une URL non auth a <Image>. Les URIs https / data /
  // file sont retournees telles quelles par le hook.
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
