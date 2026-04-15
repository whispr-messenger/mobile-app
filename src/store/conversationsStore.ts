import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Conversation, Message } from "../types/messaging";
import { messagingAPI } from "../services/messaging/api";
import { cacheService } from "../services/messaging/cache";
import { TokenService } from "../services/TokenService";
import { NotificationService } from "../services/NotificationService";
import { logger } from "../utils/logger";

// Short grace period: absorbs transient empty fetches (e.g. first WS payload
// arriving just after an HTTP fetch returns []) without flashing an empty UI.
const EMPTY_STATE_GRACE_PERIOD_MS = 2_000;
const MANUALLY_UNREAD_KEY = "@whispr/manually_unread_ids";

async function getCurrentUserId(): Promise<string | null> {
  const token = await TokenService.getAccessToken();
  if (!token) return null;
  const payload = TokenService.decodeAccessToken(token);
  return payload?.sub ?? null;
}

async function enrichSingleConversation(
  conv: Conversation,
  currentUserId: string,
): Promise<Conversation> {
  if (conv.type !== "direct" || (conv.display_name && conv.avatar_url)) {
    return conv;
  }

  try {
    let memberIds = conv.member_user_ids;

    // If member IDs are not available from the list, fetch conversation detail
    if (!memberIds || memberIds.length === 0) {
      console.log(
        "[enrich] No member_user_ids for",
        conv.id,
        "— fetching detail",
      );
      const detail = await messagingAPI.getConversation(conv.id);
      if (detail?.members) {
        memberIds = detail.members.map((m: any) => m.user_id || m.userId);
      } else if (detail?.member_user_ids) {
        memberIds = detail.member_user_ids;
      }
    }

    if (!memberIds || memberIds.length === 0) {
      console.warn("[enrich] No members found for conversation", conv.id);
      logger.warn("enrich", `No members found for conversation ${conv.id}`);
      return conv;
    }

    const otherUserId = memberIds.find((id: string) => id !== currentUserId);

    if (!otherUserId) {
      console.warn(
        "[enrich] No other user found in conversation",
        conv.id,
        "currentUser:",
        currentUserId,
        "members:",
        memberIds,
      );
      logger.warn("enrich", `No other user found in conversation ${conv.id}`);
      return conv;
    }

    const userInfo = await messagingAPI.getUserInfo(otherUserId);
    if (userInfo?.display_name) {
      console.log(
        "[enrich] Resolved",
        conv.id,
        "->",
        userInfo.display_name,
        "avatar:",
        userInfo.avatar_url ? "yes" : "no",
      );
      return {
        ...conv,
        display_name: userInfo.display_name,
        avatar_url: userInfo.avatar_url || conv.avatar_url,
        member_user_ids: memberIds,
      };
    }

    logger.warn(
      "enrich",
      `getUserInfo returned no display_name for ${otherUserId}`,
    );
    return { ...conv, member_user_ids: memberIds };
  } catch (err) {
    logger.warn("enrich", `Failed for conversation ${conv.id}`, err);
    return conv;
  }
}

async function enrichWithDisplayNames(
  conversations: Conversation[],
  currentUserId: string,
): Promise<Conversation[]> {
  const results = await Promise.all(
    conversations.map((conv) => enrichSingleConversation(conv, currentUserId)),
  );
  return results;
}

export type ConversationsStatus =
  | "loading"
  | "grace_period"
  | "empty"
  | "loaded"
  | "error";

interface ConversationsState {
  conversations: Conversation[];
  status: ConversationsStatus;
  error: string | null;
  manuallyUnreadIds: Set<string>;
  _gracePeriodTimer: ReturnType<typeof setTimeout> | null;
}

interface ConversationsActions {
  fetchConversations: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  applyConversationUpdate: (conversation: Conversation) => void;
  applyConversationSummaries: (conversations: Conversation[]) => void;
  applyNewMessage: (message: Message) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => void;
  muteConversation: (id: string) => Promise<void>;
  pinConversation: (id: string) => void;
  markAsUnread: (id: string) => Promise<void>;
  clearManualUnread: (id: string) => Promise<void>;
  resetUnreadCount: (conversationId: string) => void;
  reset: () => void;
  loadManuallyUnreadIds: () => Promise<void>;
  _startGracePeriod: () => void;
  _cancelGracePeriod: () => void;
  _setConversations: (
    conversations: Conversation[],
    fromRefresh?: boolean,
  ) => void;
}

export const useConversationsStore = create<
  ConversationsState & ConversationsActions
>((set, get) => ({
  conversations: [],
  status: "loading",
  error: null,
  manuallyUnreadIds: new Set<string>(),
  _gracePeriodTimer: null,

  reset: () => {
    const { _gracePeriodTimer } = get();
    if (_gracePeriodTimer) {
      clearTimeout(_gracePeriodTimer);
    }
    set({
      conversations: [],
      status: "loading",
      error: null,
      manuallyUnreadIds: new Set<string>(),
      _gracePeriodTimer: null,
    });
  },

  _startGracePeriod: () => {
    const { _gracePeriodTimer } = get();
    if (_gracePeriodTimer) return;
    const timer = setTimeout(() => {
      set({ status: "empty", _gracePeriodTimer: null });
    }, EMPTY_STATE_GRACE_PERIOD_MS);
    set({ status: "grace_period", _gracePeriodTimer: timer });
  },

  _cancelGracePeriod: () => {
    const { _gracePeriodTimer } = get();
    if (_gracePeriodTimer) {
      clearTimeout(_gracePeriodTimer);
      set({ _gracePeriodTimer: null });
    }
  },

  _setConversations: (conversations, fromRefresh = false) => {
    const { _cancelGracePeriod, _startGracePeriod } = get();
    if (conversations.length > 0) {
      _cancelGracePeriod();
      set({ conversations, status: "loaded", error: null });
    } else if (fromRefresh) {
      _cancelGracePeriod();
      set({ conversations: [], status: "empty", error: null });
    } else {
      set({ conversations: [] });
      _startGracePeriod();
    }
  },

  fetchConversations: async () => {
    const { _setConversations, _startGracePeriod } = get();
    set({ status: "loading", error: null });

    try {
      // Show cached data immediately while fetching
      const cached = await cacheService.getConversations();
      if (cached && cached.length > 0) {
        set({ conversations: cached, status: "loaded" });
      }

      const data = await messagingAPI.getConversations();
      const userId = await getCurrentUserId();
      const enriched = userId
        ? await enrichWithDisplayNames(data, userId)
        : data;
      await cacheService.saveConversations(enriched);
      _setConversations(enriched);
    } catch (err) {
      logger.error("conversationsStore", "fetchConversations error", err);
      // If we already have cached data shown, stay on it but start grace period
      // so skeletons don't flash forever if cache was empty
      const { conversations } = get();
      if (conversations.length === 0) {
        _startGracePeriod();
      }
      set({ error: "Failed to load conversations" });
    }
  },

  refreshConversations: async () => {
    const { _setConversations } = get();
    try {
      const data = await messagingAPI.getConversations();
      const userId = await getCurrentUserId();
      const enriched = userId
        ? await enrichWithDisplayNames(data, userId)
        : data;
      await cacheService.saveConversations(enriched);
      _setConversations(enriched, true);
    } catch (err) {
      logger.error("conversationsStore", "refreshConversations error", err);
      set({ error: "Failed to refresh conversations" });
    }
  },

  applyConversationUpdate: (conversation) => {
    const { conversations, _cancelGracePeriod } = get();
    const index = conversations.findIndex((c) => c.id === conversation.id);
    let next: Conversation[];
    let needsEnrichment = false;
    if (index === -1) {
      next = [conversation, ...conversations];
      needsEnrichment =
        conversation.type === "direct" &&
        (!conversation.display_name || !conversation.avatar_url);
    } else {
      // Preserve display_name from existing conversation if the update doesn't include one
      const existing = conversations[index];
      const merged = {
        ...conversation,
        display_name: conversation.display_name || existing.display_name,
        avatar_url: conversation.avatar_url || existing.avatar_url,
        member_user_ids:
          conversation.member_user_ids || existing.member_user_ids,
      };
      next = [...conversations];
      next[index] = merged;
    }
    if (next.length > 0) {
      _cancelGracePeriod();
      set({ conversations: next, status: "loaded" });
    }

    // Async enrichment for new direct conversations without display_name
    if (needsEnrichment) {
      getCurrentUserId().then((userId) => {
        if (!userId) return;
        enrichSingleConversation(conversation, userId).then((enriched) => {
          if (enriched.display_name) {
            const { conversations: current } = get();
            const idx = current.findIndex((c) => c.id === enriched.id);
            if (idx !== -1) {
              const updated = [...current];
              updated[idx] = {
                ...current[idx],
                display_name: enriched.display_name,
                avatar_url: enriched.avatar_url || current[idx].avatar_url,
                member_user_ids: enriched.member_user_ids,
              };
              set({ conversations: updated });
            }
          }
        });
      });
    }
  },

  applyConversationSummaries: (wsConversations) => {
    // conversation_summaries WS event: merge with existing enriched data,
    // then enrich any new conversations that lack display_name.
    const { conversations, _cancelGracePeriod } = get();
    const existingMap = new Map(conversations.map((c) => [c.id, c]));

    const merged = wsConversations.map((wsConv: any) => {
      // Normalise camelCase keys from WS to snake_case
      const conv: Conversation = {
        id: wsConv.id,
        type: wsConv.type,
        metadata: wsConv.metadata || {},
        created_at:
          wsConv.created_at ||
          wsConv.createdAt ||
          wsConv.inserted_at ||
          wsConv.insertedAt ||
          "",
        updated_at: wsConv.updated_at || wsConv.updatedAt || "",
        is_active: wsConv.is_active ?? wsConv.isActive ?? true,
        last_message: wsConv.last_message || wsConv.lastMessage,
        unread_count: wsConv.unread_count ?? wsConv.unreadCount ?? 0,
        member_user_ids: wsConv.member_user_ids || wsConv.memberUserIds,
        is_pinned: wsConv.is_pinned ?? wsConv.isPinned ?? false,
        is_muted: wsConv.is_muted ?? wsConv.isMuted ?? false,
        is_archived: wsConv.is_archived ?? wsConv.isArchived ?? false,
      };
      const existing = existingMap.get(conv.id);
      if (existing) {
        return {
          ...conv,
          display_name: existing.display_name || conv.display_name,
          member_user_ids: conv.member_user_ids || existing.member_user_ids,
          avatar_url: existing.avatar_url,
          // Preserve local enrichments the backend summary doesn't include
          last_message: conv.last_message || existing.last_message,
          is_pinned: conv.is_pinned || existing.is_pinned,
          is_muted: conv.is_muted || existing.is_muted,
          is_archived: conv.is_archived || existing.is_archived,
        };
      }
      return conv;
    });

    if (merged.length > 0) {
      _cancelGracePeriod();
      set({ conversations: merged, status: "loaded" });
    }

    // Async enrichment for any conversations without display_name
    const needEnrichment = merged.filter(
      (c: Conversation) =>
        c.type === "direct" && (!c.display_name || !c.avatar_url),
    );
    if (needEnrichment.length > 0) {
      getCurrentUserId().then((userId) => {
        if (!userId) return;
        enrichWithDisplayNames(needEnrichment, userId).then((enriched) => {
          const { conversations: current } = get();
          const enrichedMap = new Map(
            enriched.filter((e) => e.display_name).map((e) => [e.id, e]),
          );
          if (enrichedMap.size === 0) return;
          const updated = current.map((c) => {
            const e = enrichedMap.get(c.id);
            return e
              ? {
                  ...c,
                  display_name: e.display_name,
                  avatar_url: e.avatar_url || c.avatar_url,
                  member_user_ids: e.member_user_ids,
                }
              : c;
          });
          set({ conversations: updated });
          cacheService.saveConversations(updated);
        });
      });
    }
  },

  applyNewMessage: async (message) => {
    const { conversations, _cancelGracePeriod } = get();
    const index = conversations.findIndex(
      (conv) => conv.id === message.conversation_id,
    );

    if (index === -1) {
      // Bug C fix: conversation not in the list — fetch it from the API and prepend
      try {
        const fetched = await messagingAPI.getConversation(
          message.conversation_id,
        );
        if (fetched) {
          const newConv: Conversation = {
            ...fetched,
            last_message: message,
            updated_at: message.sent_at,
            unread_count: 1,
          };
          // Enrich display name for new direct conversations
          const userId = await getCurrentUserId();
          if (userId) {
            const enriched = await enrichWithDisplayNames([newConv], userId);
            _cancelGracePeriod();
            set({
              conversations: [enriched[0], ...get().conversations],
              status: "loaded",
            });
          } else {
            _cancelGracePeriod();
            set({
              conversations: [newConv, ...get().conversations],
              status: "loaded",
            });
          }
        }
      } catch (err) {
        logger.error(
          "conversationsStore",
          "applyNewMessage: failed to fetch unknown conversation",
          err,
        );
      }
      return;
    }

    const updated = {
      ...conversations[index],
      last_message: message,
      updated_at: message.sent_at,
      unread_count: (conversations[index].unread_count || 0) + 1,
    };
    // Bug B fix: move the updated conversation to the top, sorted by recency
    const next = [updated, ...conversations.filter((_, i) => i !== index)];
    set({ conversations: next });
  },

  deleteConversation: async (id) => {
    const { conversations } = get();
    // Optimistic update
    const next = conversations.filter((c) => c.id !== id);
    set({
      conversations: next,
      status: next.length === 0 ? "empty" : "loaded",
    });
    try {
      await messagingAPI.deleteConversation(id);
    } catch (err) {
      // Rollback on failure
      set({ conversations, status: "loaded" });
      throw err;
    }
  },

  archiveConversation: (id) => {
    const { conversations } = get();
    set({
      conversations: conversations.map((c) =>
        c.id === id ? { ...c, is_archived: !c.is_archived } : c,
      ),
    });
  },

  muteConversation: async (id) => {
    const { conversations } = get();
    const conversation = conversations.find((c) => c.id === id);
    const wasMuted = conversation?.is_muted ?? false;

    // Optimistic update
    set({
      conversations: conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              is_muted: !c.is_muted,
              updated_at: new Date().toISOString(),
            }
          : c,
      ),
    });

    try {
      if (wasMuted) {
        await NotificationService.unmuteConversation(id);
      } else {
        await NotificationService.muteConversation(id);
      }
    } catch (err) {
      logger.error("conversationsStore", "muteConversation error", err);
      // Rollback on failure
      set({ conversations });
    }
  },

  pinConversation: (id) => {
    const { conversations } = get();
    set({
      conversations: conversations.map((c) =>
        c.id === id ? { ...c, is_pinned: !c.is_pinned } : c,
      ),
    });
  },

  markAsUnread: async (id) => {
    const { conversations, manuallyUnreadIds } = get();
    const nextIds = new Set(manuallyUnreadIds);
    nextIds.add(id);
    set({
      manuallyUnreadIds: nextIds,
      conversations: conversations.map((c) =>
        c.id === id
          ? { ...c, unread_count: Math.max(c.unread_count || 0, 1) }
          : c,
      ),
    });
    try {
      await AsyncStorage.setItem(
        MANUALLY_UNREAD_KEY,
        JSON.stringify([...nextIds]),
      );
    } catch {
      // Storage write failed — local state is still correct for this session
    }
  },

  clearManualUnread: async (id) => {
    const { manuallyUnreadIds } = get();
    if (!manuallyUnreadIds.has(id)) return;
    const nextIds = new Set(manuallyUnreadIds);
    nextIds.delete(id);
    set({ manuallyUnreadIds: nextIds });
    try {
      await AsyncStorage.setItem(
        MANUALLY_UNREAD_KEY,
        JSON.stringify([...nextIds]),
      );
    } catch {
      // Storage write failed — local state is still correct for this session
    }
  },

  resetUnreadCount: (conversationId) => {
    const { conversations } = get();
    const index = conversations.findIndex((c) => c.id === conversationId);
    if (index === -1 || conversations[index].unread_count === 0) return;
    const updated = [...conversations];
    updated[index] = { ...updated[index], unread_count: 0 };
    set({ conversations: updated });
  },

  loadManuallyUnreadIds: async () => {
    try {
      const raw = await AsyncStorage.getItem(MANUALLY_UNREAD_KEY);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        const idSet = new Set(ids);
        const { conversations } = get();
        set({
          manuallyUnreadIds: idSet,
          conversations: conversations.map((c) =>
            idSet.has(c.id)
              ? { ...c, unread_count: Math.max(c.unread_count || 0, 1) }
              : c,
          ),
        });
      }
    } catch {
      // Storage read failed — start with empty set
    }
  },
}));
