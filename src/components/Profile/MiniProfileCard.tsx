/**
 * MiniProfileCard - aperçu rapide d'un profil utilisateur ouvert via clic
 * gauche (web desktop) ou appui long (touch). Read-only, ne remplace pas
 * UserProfileScreen.
 *
 * Le composant ne gere PAS le positionnement : il rend uniquement le contenu
 * de la card. Le wrapping (Modal mobile / Popover web) est dans le host.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, withOpacity } from "../../theme/colors";
import { UserService, UserProfile } from "../../services/UserService";
import { contactsAPI } from "../../services/contacts/api";
import { getCached, setCached } from "../../services/profile/miniProfileCache";

type Relation = "self" | "blocked" | "contact" | "unknown";
type CardState = "loading" | "loaded" | "error" | "notFound";

interface ErrorInfo {
  kind: "network" | "forbidden" | "timeout";
  retriable: boolean;
}

interface MiniProfileCardProps {
  userId: string;
  /** id du user authentifie - sert a detecter le mode "self" */
  currentUserId: string | null;
  onClose: () => void;
  onOpenFullProfile: () => void;
  onOpenSelfProfile: () => void;
  onMessage: () => void;
}

const FETCH_TIMEOUT_MS = 8000;

function fetchWithTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function formatLastSeen(iso?: string): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return "vu a l'instant";
  if (diffMin < 60) return `vu il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vu il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "vu hier";
  if (diffD < 7) return `vu il y a ${diffD} j`;
  return `vu le ${new Date(ts).toLocaleDateString("fr-FR")}`;
}

function buildDisplayName(profile: UserProfile): string {
  const full = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim();
  return full.length > 0 ? full : profile.username || "Utilisateur";
}

export const MiniProfileCard: React.FC<MiniProfileCardProps> = ({
  userId,
  currentUserId,
  onClose,
  onOpenFullProfile,
  onOpenSelfProfile,
  onMessage,
}) => {
  const [state, setState] = useState<CardState>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [relation, setRelation] = useState<Relation>("unknown");
  const [busyAction, setBusyAction] = useState<null | "block" | "unblock">(
    null,
  );
  // mounted ref pour eviter les setState apres demontage (memory leak si l'user
  // ferme la card pendant un fetch en cours).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const isSelf = !!currentUserId && currentUserId === userId;

  const computeRelation = useCallback(
    async (id: string): Promise<Relation> => {
      if (currentUserId && currentUserId === id) return "self";
      try {
        const { blocked } = await contactsAPI.getBlockedUsers();
        if (blocked.some((b) => b.blocked_user_id === id)) return "blocked";
      } catch {
        // ne pas bloquer le rendu si la liste blocked echoue
      }
      try {
        const { contacts } = await contactsAPI.getContacts();
        if (contacts.some((c) => c.contact_id === id)) return "contact";
      } catch {
        // idem
      }
      return "unknown";
    },
    [currentUserId],
  );

  const load = useCallback(
    async (opts: { forceRefresh?: boolean } = {}) => {
      // 1. cache hit
      const cached = getCached(userId);
      if (cached && !opts.forceRefresh) {
        if (!mounted.current) return;
        setProfile(cached.profile);
        setState("loaded");
        // si stale, on continue jusqu'au fetch en background
        if (!cached.isStale) {
          // on resoud quand meme la relation
          computeRelation(userId).then((rel) => {
            if (!mounted.current) return;
            setRelation(rel);
          });
          return;
        }
      } else if (!cached) {
        if (!mounted.current) return;
        setState("loading");
      }

      try {
        const result = await fetchWithTimeout(
          UserService.getInstance().getUserProfile(userId),
        );
        if (!mounted.current) return;
        if (!result.success || !result.profile) {
          // 404 -> on l'identifie par message contenant "404"
          if (result.message?.includes("404")) {
            setState("notFound");
            return;
          }
          if (result.message?.includes("403")) {
            setError({ kind: "forbidden", retriable: false });
            setState("error");
            return;
          }
          setError({ kind: "network", retriable: true });
          setState("error");
          return;
        }
        setCached(userId, result.profile);
        if (!mounted.current) return;
        setProfile(result.profile);
        setState("loaded");
        const rel = await computeRelation(userId);
        if (!mounted.current) return;
        setRelation(rel);
      } catch (e) {
        if (!mounted.current) return;
        const isTimeout = (e as Error)?.message === "timeout";
        setError({
          kind: isTimeout ? "timeout" : "network",
          retriable: true,
        });
        // si on a deja une version cachee on reste en loaded, sinon error
        if (!cached) setState("error");
      }
    },
    [userId, computeRelation],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleBlock = useCallback(async () => {
    if (busyAction) return;
    setBusyAction("block");
    try {
      await contactsAPI.blockUser(userId);
      if (!mounted.current) return;
      setRelation("blocked");
    } catch {
      // si l'appel rate, on garde le relation precedent
    } finally {
      if (mounted.current) setBusyAction(null);
    }
  }, [userId, busyAction]);

  const handleUnblock = useCallback(async () => {
    if (busyAction) return;
    setBusyAction("unblock");
    try {
      await contactsAPI.unblockUser(userId);
      if (!mounted.current) return;
      setRelation("contact");
    } catch {
      // idem
    } finally {
      if (mounted.current) setBusyAction(null);
    }
  }, [userId, busyAction]);

  // ----- rendu states -----

  if (state === "loading") {
    return (
      <View style={styles.card} testID="mini-profile-card-loading">
        <ActivityIndicator color={colors.primary.main} />
        <Text style={styles.helperText}>Chargement…</Text>
      </View>
    );
  }

  if (state === "notFound") {
    return (
      <View style={styles.card} testID="mini-profile-card-notfound">
        <View style={styles.placeholder}>
          <Ionicons name="person-outline" size={36} color="#FFF" />
        </View>
        <Text style={styles.title}>Compte supprime</Text>
        <Text style={styles.helperText}>Cet utilisateur n'existe plus.</Text>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryText}>Fermer</Text>
        </Pressable>
      </View>
    );
  }

  if (state === "error" && (!profile || !error)) {
    return (
      <View style={styles.card} testID="mini-profile-card-error">
        <View style={styles.placeholder}>
          <Ionicons name="alert-circle-outline" size={36} color="#FFF" />
        </View>
        <Text style={styles.title}>
          {error?.kind === "forbidden" ? "Indisponible" : "Erreur"}
        </Text>
        {error?.kind !== "forbidden" && (
          <Text style={styles.helperText}>
            Impossible de charger le profil.
          </Text>
        )}
        {error?.retriable && (
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => void load({ forceRefresh: true })}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryText}>Reessayer</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!profile) return null;

  const displayName = buildDisplayName(profile);
  const lastSeenText = profile.isOnline
    ? "en ligne"
    : formatLastSeen(profile.lastSeen);

  return (
    <View style={styles.card} testID="mini-profile-card-loaded">
      {profile.profilePicture ? (
        <Image
          source={{ uri: profile.profilePicture }}
          style={styles.avatar}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarFallback}>
            {displayName.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <Text style={styles.title}>{displayName}</Text>
      {profile.username ? (
        <Text style={styles.subtitle}>@{profile.username}</Text>
      ) : null}

      {profile.biography ? (
        <Text style={styles.bio} numberOfLines={2}>
          {profile.biography}
        </Text>
      ) : null}

      {lastSeenText ? (
        <Text style={styles.lastSeen}>{lastSeenText}</Text>
      ) : null}

      {relation === "blocked" ? (
        <View style={styles.blockedBadge} testID="mini-profile-card-blocked">
          <Ionicons name="ban" size={14} color="#FFF" />
          <Text style={styles.blockedBadgeText}>Bloque</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {isSelf ? (
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={onOpenSelfProfile}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryText}>Modifier mon profil</Text>
          </Pressable>
        ) : (
          <>
            {relation !== "blocked" ? (
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={onMessage}
                accessibilityRole="button"
              >
                <Ionicons name="chatbubble" size={16} color="#FFF" />
                <Text style={styles.btnPrimaryText}>Message</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onOpenFullProfile}
              accessibilityRole="button"
            >
              <Text style={styles.btnSecondaryText}>Voir profil complet</Text>
            </Pressable>
            {relation === "blocked" ? (
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={handleUnblock}
                disabled={busyAction !== null}
                accessibilityRole="button"
              >
                <Text style={styles.btnSecondaryText}>
                  {busyAction === "unblock" ? "…" : "Debloquer"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                onPress={handleBlock}
                disabled={busyAction !== null}
                accessibilityRole="button"
              >
                <Text style={styles.btnDangerText}>
                  {busyAction === "block" ? "…" : "Bloquer"}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.darkCard,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    gap: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: withOpacity(colors.primary.main, 0.4),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarFallback: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "700",
  },
  placeholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: withOpacity("#FFFFFF", 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: withOpacity("#FFFFFF", 0.7),
    fontSize: 14,
  },
  bio: {
    color: withOpacity("#FFFFFF", 0.85),
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  lastSeen: {
    color: withOpacity("#FFFFFF", 0.55),
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    color: withOpacity("#FFFFFF", 0.7),
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  blockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.ui.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  blockedBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    width: "100%",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 110,
  },
  btnPrimary: {
    backgroundColor: colors.primary.main,
  },
  btnPrimaryText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  btnSecondary: {
    backgroundColor: withOpacity("#FFFFFF", 0.1),
    borderWidth: 1,
    borderColor: withOpacity("#FFFFFF", 0.18),
  },
  btnSecondaryText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "500",
  },
  btnDanger: {
    backgroundColor: withOpacity(colors.ui.error, 0.18),
    borderWidth: 1,
    borderColor: withOpacity(colors.ui.error, 0.4),
  },
  btnDangerText: {
    color: colors.ui.error,
    fontSize: 14,
    fontWeight: "600",
  },
});
