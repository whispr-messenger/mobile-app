import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, FlatList, StyleSheet, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { callsApi } from "../../services/calls/callsApi";
import type { Call, CallStatus } from "../../types/calls";
import { FLOATING_TAB_BAR_RESERVED_SPACE } from "../../components/Navigation/floatingTabBarLayout";
import { colors, withOpacity } from "../../theme/colors";
import { messagingAPI } from "../../services/messaging/api";
import { TokenService } from "../../services/TokenService";
import type { Conversation } from "../../types/messaging";
import { Avatar } from "../../components/Chat/Avatar";
import { formatUsername, getConversationDisplayName } from "../../utils";

interface EnrichedCallHistoryItem extends Call {
  title: string;
  subtitle?: string;
  avatarUrl?: string;
}

type ConversationMemberPreview = {
  id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
};

/**
 * List of past calls for the current user. Pull-to-refresh rehydrates
 * from the calls-service /calls endpoint.
 */
export const CallHistoryScreen: React.FC = () => {
  const [calls, setCalls] = useState<EnrichedCallHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const stats = useMemo(
    () => ({
      total: calls.length,
      missed: calls.filter((call) => call.status === "missed").length,
      connected: calls.filter((call) => call.status === "ended").length,
    }),
    [calls],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await callsApi.list({ limit: 50 });
      setCalls(await enrichCallsForDisplay(r.data));
    } catch (err) {
      console.error("Failed to load call history", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FlatList
      data={calls}
      keyExtractor={(c) => c.id}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={colors.text.light}
        />
      }
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: insets.bottom + FLOATING_TAB_BAR_RESERVED_SPACE + 16,
      }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <BlurView intensity={45} tint="dark" style={styles.topHeaderBlur}>
            <View style={styles.topHeaderCard}>
              <View style={styles.topHeaderBadge}>
                <Ionicons
                  name="call-outline"
                  size={14}
                  color={colors.primary.main}
                />
                <Text style={styles.topHeaderBadgeText}>Centre d'appels</Text>
              </View>
              <Text style={styles.topHeaderTitle}>Appels</Text>
              <Text style={styles.topHeaderSubtitle}>
                Historique audio et vidéo.
              </Text>
            </View>
          </BlurView>
          <BlurView intensity={45} tint="dark" style={styles.heroBlur}>
            <View style={styles.heroCard}>
              <View style={styles.heroBadge}>
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={colors.primary.main}
                />
                <Text style={styles.heroBadgeText}>Historique récent</Text>
              </View>
              <Text style={styles.heroTitle}>Vos appels</Text>
              <Text style={styles.heroSubtitle}>
                Retrouvez les appels récents avec un aperçu rapide des statuts
                et durées.
              </Text>
              <View style={styles.statsRow}>
                <StatPill
                  icon="call-outline"
                  label="Total"
                  value={String(stats.total)}
                />
                <StatPill
                  icon="checkmark-done-outline"
                  label="Terminés"
                  value={String(stats.connected)}
                />
                <StatPill
                  icon="alert-circle-outline"
                  label="Manqués"
                  value={String(stats.missed)}
                />
              </View>
            </View>
          </BlurView>
        </View>
      }
      renderItem={({ item }) => {
        const meta = getStatusMeta(item.status);
        return (
          <BlurView intensity={35} tint="dark" style={styles.cardBlur}>
            <View style={styles.card}>
              <View style={styles.avatarBlock}>
                <Avatar uri={item.avatarUrl} name={item.title} size={54} />
                <View
                  style={[
                    styles.typeFloatingBadge,
                    {
                      backgroundColor:
                        item.type === "video"
                          ? withOpacity(colors.secondary.main, 0.9)
                          : withOpacity(colors.primary.main, 0.88),
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      item.type === "video"
                        ? "videocam-outline"
                        : "call-outline"
                    }
                    size={12}
                    color={colors.text.light}
                  />
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: meta.backgroundColor },
                    ]}
                  >
                    <Ionicons
                      name={meta.icon}
                      size={12}
                      color={meta.textColor}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: meta.textColor },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </View>
                </View>

                {!!item.subtitle && (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                )}

                <Text style={styles.dateText}>
                  {formatDate(item.started_at)}
                </Text>

                <View style={styles.metaInfoRow}>
                  <View style={styles.metaInfoPill}>
                    <Ionicons
                      name={
                        item.type === "video"
                          ? "videocam-outline"
                          : "call-outline"
                      }
                      size={13}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text style={styles.metaText}>
                      {item.type === "video" ? "Appel vidéo" : "Appel audio"}
                    </Text>
                  </View>
                  <View style={styles.metaInfoPill}>
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text style={styles.metaText}>
                      {relativeDayLabel(item.started_at)}
                    </Text>
                  </View>
                  {item.duration_seconds != null && (
                    <View style={styles.metaInfoPill}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color="rgba(255,255,255,0.7)"
                      />
                      <Text style={styles.metaText}>
                        Durée {formatDuration(item.duration_seconds)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </BlurView>
        );
      }}
      ListEmptyComponent={
        <BlurView intensity={35} tint="dark" style={styles.emptyBlur}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="call-outline"
                size={24}
                color="rgba(255,255,255,0.82)"
              />
            </View>
            <Text style={styles.emptyTitle}>Aucun appel pour le moment</Text>
            <Text style={styles.emptySubtitle}>
              Vos appels audio et vidéo apparaîtront ici.
            </Text>
          </View>
        </BlurView>
      }
    />
  );
};

const StatPill: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <View style={styles.statPill}>
    <Ionicons name={icon} size={16} color={colors.text.light} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const STATUS_LABELS: Record<CallStatus, string> = {
  ringing: "Sonnerie",
  connected: "En cours",
  ended: "Terminé",
  missed: "Manqué",
  declined: "Refusé",
  failed: "Échec",
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s as CallStatus] || s;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeDayLabel(date: string): string {
  const target = new Date(date);
  const now = new Date();
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const diffDays = Math.round((today - targetDay) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return target.toLocaleDateString("fr-FR", { weekday: "long" });
}

async function getCurrentUserId(): Promise<string | null> {
  const token = await TokenService.getAccessToken();
  if (!token) return null;
  return TokenService.decodeAccessToken(token)?.sub ?? null;
}

function resolveConversationAvatar(
  conversation: Conversation,
  members: ConversationMemberPreview[],
  currentUserId: string | null,
): string | undefined {
  if (conversation.type === "direct") {
    const other = members.find(
      (member) => member.id && member.id !== currentUserId,
    );
    return other?.avatar_url || conversation.avatar_url;
  }

  const meta = (conversation.metadata ?? {}) as Record<string, any>;
  return (
    conversation.avatar_url ||
    meta.avatar_url ||
    meta.group_avatar_url ||
    meta.group_icon_url ||
    meta.icon_url ||
    meta.photo_url ||
    meta.picture_url ||
    meta.image_url
  );
}

async function enrichCallsForDisplay(
  calls: Call[],
): Promise<EnrichedCallHistoryItem[]> {
  const currentUserId = await getCurrentUserId();
  const conversationIds = Array.from(
    new Set(calls.map((call) => call.conversation_id).filter(Boolean)),
  );
  const conversationMap = new Map<
    string,
    {
      conversation: Conversation | null;
      members: ConversationMemberPreview[];
    }
  >();

  await Promise.all(
    conversationIds.map(async (conversationId) => {
      try {
        const conversation = await messagingAPI.getConversation(conversationId);
        const members = await messagingAPI
          .getConversationMembers(conversationId)
          .catch(() => []);
        conversationMap.set(conversationId, { conversation, members });
      } catch {
        conversationMap.set(conversationId, {
          conversation: null,
          members: [],
        });
      }
    }),
  );

  return calls.map((call) => {
    const preview = conversationMap.get(call.conversation_id);
    const conversation = preview?.conversation;
    const members = preview?.members ?? [];

    if (!conversation) {
      return {
        ...call,
        title: call.type === "video" ? "Appel vidéo" : "Appel audio",
        subtitle: "Conversation indisponible",
      };
    }

    if (conversation.type === "group") {
      return {
        ...call,
        title: getConversationDisplayName(conversation),
        subtitle: "Room de groupe",
        avatarUrl: resolveConversationAvatar(
          conversation,
          members,
          currentUserId,
        ),
      };
    }

    const otherMember =
      members.find((member) => member.id && member.id !== currentUserId) ??
      members[0];
    const username = formatUsername(
      otherMember?.username ??
        conversation.username ??
        conversation.metadata?.username,
    );
    const title = getConversationDisplayName({
      type: "direct",
      display_name: otherMember?.display_name ?? conversation.display_name,
      username: otherMember?.username ?? conversation.username,
      phone_number: conversation.phone_number,
      metadata: conversation.metadata,
    });

    return {
      ...call,
      title,
      subtitle:
        username && username !== title ? username : "Conversation directe",
      avatarUrl:
        otherMember?.avatar_url ||
        resolveConversationAvatar(conversation, members, currentUserId),
    };
  });
}

function getStatusMeta(status: CallStatus): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  textColor: string;
  backgroundColor: string;
} {
  switch (status) {
    case "missed":
      return {
        label: "Manqué",
        icon: "alert-circle-outline",
        textColor: "#FFD0CF",
        backgroundColor: "rgba(255,59,48,0.18)",
      };
    case "declined":
      return {
        label: "Refusé",
        icon: "close-circle-outline",
        textColor: "#FFD7B0",
        backgroundColor: "rgba(240,72,130,0.16)",
      };
    case "ringing":
      return {
        label: "Sonnerie",
        icon: "notifications-outline",
        textColor: "#FFE6A7",
        backgroundColor: "rgba(255,210,122,0.16)",
      };
    case "failed":
      return {
        label: "Échec",
        icon: "warning-outline",
        textColor: "#FFD0CF",
        backgroundColor: "rgba(255,59,48,0.18)",
      };
    case "connected":
    case "ended":
    default:
      return {
        label: statusLabel(status),
        icon: "checkmark-circle-outline",
        textColor: "#C6FFD1",
        backgroundColor: "rgba(33,192,4,0.16)",
      };
  }
}

const styles = StyleSheet.create({
  headerBlock: {
    marginBottom: 16,
    gap: 12,
  },
  topHeaderBlur: {
    borderRadius: 30,
    overflow: "hidden",
  },
  topHeaderCard: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(11,17,36,0.18)",
  },
  topHeaderBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  topHeaderBadgeText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  topHeaderTitle: {
    marginTop: 14,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: colors.text.light,
  },
  topHeaderSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.72)",
  },
  heroBlur: {
    borderRadius: 28,
    overflow: "hidden",
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(11,17,36,0.24)",
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroBadgeText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  heroTitle: {
    marginTop: 14,
    color: colors.text.light,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Inter_700Bold",
  },
  heroSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  statPill: {
    flex: 1,
    minHeight: 78,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statValue: {
    color: colors.text.light,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
  statLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  cardBlur: {
    borderRadius: 24,
    overflow: "hidden",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(11,17,36,0.22)",
  },
  avatarBlock: {
    position: "relative",
    marginRight: 14,
  },
  typeFloatingBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(11,17,36,0.88)",
  },
  cardBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 17,
    color: colors.text.light,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    color: withOpacity(colors.text.light, 0.72),
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  dateText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  metaInfoRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  metaInfoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  metaText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  emptyBlur: {
    borderRadius: 28,
    overflow: "hidden",
    marginTop: 20,
  },
  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(11,17,36,0.22)",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.text.light,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});

export default CallHistoryScreen;
