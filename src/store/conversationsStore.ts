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

/**
 * Valeurs sentinelles que le messaging-service injecte quand la resolution du
 * profil echoue cote backend. Ces valeurs NE doivent PAS bloquer l enrichment
 * cote frontend - elles doivent etre traitees comme "absent" dans les gardes
 * early-return de enrichSingleConversation et enrichWithDisplayNames.
 * cf WHISPR-1426 : "Utilisateur" faux positif bloque l early-return.
 */
const SENTINEL_DISPLAY_NAMES = new Set(["Utilisateur", "User"]);

function isEnrichedDisplayName(value: string | undefined | null): boolean {
  if (!value) return false;
  return !SENTINEL_DISPLAY_NAMES.has(value.trim());
}
const MANUALLY_UNREAD_KEY = "@whispr/manually_unread_ids";
const RECENT_MESSAGE_IDS_MAX = 50;
const recentMessageIdsByConversation = new Map<string, string[]>();

function wasMessageSeen(conversationId: string, messageId: string): boolean {
  if (!conversationId || !messageId) return false;
  const list = recentMessageIdsByConversation.get(conversationId) ?? [];
  if (list.includes(messageId)) return true;
  const next = [messageId, ...list];
  recentMessageIdsByConversation.set(
    conversationId,
    next.slice(0, RECENT_MESSAGE_IDS_MAX),
  );
  return false;
}

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
  if (
    conv.type !== "direct" ||
    (isEnrichedDisplayName(conv.display_name) && conv.avatar_url)
  ) {
    return conv;
  }

  try {
    let memberIds = conv.member_user_ids;

    // If member IDs are not available from the list, fetch conversation detail
    if (!memberIds || memberIds.length === 0) {
      const detail = await messagingAPI.getConversation(conv.id);
      if (detail?.members) {
        memberIds = detail.members.map((m: any) => m.user_id || m.userId);
      } else if (detail?.member_user_ids) {
        memberIds = detail.member_user_ids;
      }
    }

    if (!memberIds || memberIds.length === 0) {
      logger.warn("enrich", `No members found for conversation ${conv.id}`);
      return conv;
    }

    const otherUserId = memberIds.find((id: string) => id !== currentUserId);

    if (!otherUserId) {
      logger.warn("enrich", `No other user found in conversation ${conv.id}`);
      return conv;
    }

    const userInfo = await messagingAPI.getUserInfo(otherUserId);
    // fallback chain robuste pour eviter "Utilisateur" affiche en clair
    // quand le profil est masque par privacy CONTACTS (display_name vide
    // mais username ou phone_number_masked presents) cf WHISPR-1423
    const userPhoneMasked = (userInfo as any)?.phone_number_masked;
    if (
      userInfo?.display_name ||
      (userInfo as any)?.username ||
      userPhoneMasked
    ) {
      return {
        ...conv,
        display_name: userInfo?.display_name || conv.display_name,
        username: (userInfo as any)?.username ?? conv.username,
        phone_number: userPhoneMasked ?? conv.phone_number,
        avatar_url: userInfo?.avatar_url || conv.avatar_url,
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
  // WHISPR-1357 : pre-warming du cache profils via 1 seul batch /profiles/batch
  // au lieu de N fetchs unitaires. enrichSingleConversation continue d'utiliser
  // getUserInfo pour le fallback (member_user_ids absents qui forcent un
  // getConversation), mais l'appel reseau retourne en cache hit.
  const otherIdsToWarmup = new Set<string>();
  for (const conv of conversations) {
    if (conv.type !== "direct") continue;
    if (isEnrichedDisplayName(conv.display_name) && conv.avatar_url) continue;
    const memberIds = conv.member_user_ids;
    if (!memberIds || memberIds.length === 0) continue;
    const other = memberIds.find((id: string) => id && id !== currentUserId);
    if (other) otherIdsToWarmup.add(other);
  }

  if (otherIdsToWarmup.size > 0) {
    try {
      await messagingAPI.getUsersInfoBatch(Array.from(otherIdsToWarmup));
    } catch (err) {
      // batch en best-effort : si echec, enrichSingleConversation fallback
      // sur les fetchs unitaires existants.
      logger.warn("enrich", "Batch profile warmup failed", err);
    }
  }

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

export type ArchivedStatus = "idle" | "loading" | "loaded" | "error";

export type GroupAvatar = { uri?: string; name: string };

const ARCHIVED_PAGE_SIZE = 50;

interface ArchivedState {
  items: Conversation[];
  status: ArchivedStatus;
  error: string | null;
  offset: number;
  hasMore: boolean;
  loadingMore: boolean;
}

interface ConversationsState {
  conversations: Conversation[];
  status: ConversationsStatus;
  error: string | null;
  manuallyUnreadIds: Set<string>;
  groupAvatars: Record<string, GroupAvatar[]>;
  archived: ArchivedState;
  _gracePeriodTimer: ReturnType<typeof setTimeout> | null;
}

interface ConversationsActions {
  fetchConversations: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  applyConversationUpdate: (conversation: Conversation) => void;
  applyConversationSummaries: (conversations: Conversation[]) => void;
  applyNewMessage: (message: Message, currentUserId?: string) => Promise<void>;
  applyMessageUpdated: (message: Message) => void;
  applyMessageDeleted: (messageId: string, deleteForEveryone: boolean) => void;
  applyMessageUnread: (params: {
    messageId: string;
    conversationId: string;
  }) => void;
  deleteConversation: (id: string) => Promise<void>;
  removeConversationLocal: (id: string) => void;
  archiveConversation: (id: string) => Promise<void>;
  unarchiveConversation: (id: string) => Promise<void>;
  applyArchiveBroadcast: (conversationId: string, archived: boolean) => void;
  fetchArchivedConversations: () => Promise<void>;
  loadMoreArchivedConversations: () => Promise<void>;
  muteConversation: (id: string) => Promise<void>;
  pinConversation: (id: string) => void;
  markAsUnread: (id: string) => Promise<void>;
  clearManualUnread: (id: string) => Promise<void>;
  resetUnreadCount: (conversationId: string) => void;
  setGroupAvatars: (conversationId: string, avatars: GroupAvatar[]) => void;
  reset: () => void;
  loadManuallyUnreadIds: () => Promise<void>;
  _startGracePeriod: () => void;
  _cancelGracePeriod: () => void;
  _setConversations: (
    conversations: Conversation[],
    fromRefresh?: boolean,
  ) => void;
}

const initialArchivedState: ArchivedState = {
  items: [],
  status: "idle",
  error: null,
  offset: 0,
  hasMore: false,
  loadingMore: false,
};

export const useConversationsStore = create<
  ConversationsState & ConversationsActions
>((set, get) => ({
  conversations: [],
  status: "loading",
  error: null,
  manuallyUnreadIds: new Set<string>(),
  groupAvatars: {},
  archived: { ...initialArchivedState },
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
      groupAvatars: {},
      archived: { ...initialArchivedState },
      _gracePeriodTimer: null,
    });
  },

  setGroupAvatars: (conversationId, avatars) => {
    set({
      groupAvatars: { ...get().groupAvatars, [conversationId]: avatars },
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
        (!isEnrichedDisplayName(conversation.display_name) ||
          !conversation.avatar_url);
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
        avatar_url: wsConv.avatar_url || wsConv.avatarUrl,
      };
      const existing = existingMap.get(conv.id);
      if (existing) {
        return {
          ...conv,
          display_name: existing.display_name || conv.display_name,
          member_user_ids: conv.member_user_ids || existing.member_user_ids,
          avatar_url: conv.avatar_url || existing.avatar_url,
          // Preserve local enrichments the backend summary doesn't include
          last_message: conv.last_message || existing.last_message,
          is_pinned: conv.is_pinned || existing.is_pinned,
          is_muted: conv.is_muted || existing.is_muted,
          // Le serveur est source de vérité pour is_archived : on prend
          // toujours la valeur WS. L'ancien `|| existing.is_archived` causait
          // un re-archivage silencieux après un unarchive optimiste (le WS
          // summary suivant remettait true depuis l'état mémoire stale).
          is_archived: conv.is_archived,
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
        c.type === "direct" &&
        (!isEnrichedDisplayName(c.display_name) || !c.avatar_url),
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

  applyNewMessage: async (message, currentUserId) => {
    if (wasMessageSeen(message.conversation_id, message.id)) return;
    const { conversations, archived, _cancelGracePeriod } = get();
    const mainIndex = conversations.findIndex(
      (conv) => conv.id === message.conversation_id,
    );
    const archivedIndex = archived.items.findIndex(
      (conv) => conv.id === message.conversation_id,
    );
    // WHISPR-1050: a message echoed back from our own device still arrives over
    // the socket. We must not count it as unread, otherwise the badge flickers
    // on every send and stays >0 after closing the chat.
    const isOwnMessage = !!currentUserId && message.sender_id === currentUserId;

    // Conv connue de la liste principale : update + bump au top.
    // Si elle s'avère archivée (cas multi-device : un autre device a archivé,
    // le broadcast n'est pas encore arrivé), on la garde dans la main list
    // mais le filtre is_archived l'occultera. Le broadcast la déplacera vers
    // archived au prochain tick.
    if (mainIndex !== -1) {
      const previousUnread = conversations[mainIndex].unread_count || 0;
      const updated = {
        ...conversations[mainIndex],
        last_message: message,
        updated_at: message.sent_at,
        unread_count: isOwnMessage ? previousUnread : previousUnread + 1,
      };
      // Bug B fix: move the updated conversation to the top, sorted by recency
      const next = [
        updated,
        ...conversations.filter((_, i) => i !== mainIndex),
      ];
      set({ conversations: next });
      return;
    }

    // Conv connue uniquement de la liste archivée : update sans la sortir
    // d'archives. Le badge "Archivées" affichera l'unread sans réimporter
    // la conv dans la liste principale.
    if (archivedIndex !== -1) {
      const previousUnread = archived.items[archivedIndex].unread_count || 0;
      const updated = {
        ...archived.items[archivedIndex],
        last_message: message,
        updated_at: message.sent_at,
        unread_count: isOwnMessage ? previousUnread : previousUnread + 1,
      };
      const nextItems = [
        updated,
        ...archived.items.filter((_, i) => i !== archivedIndex),
      ];
      set({ archived: { ...archived, items: nextItems } });
      return;
    }

    // Conv inconnue des deux listes — fetch et prépend dans la bonne liste
    // selon son flag is_archived côté serveur.
    try {
      const fetched = await messagingAPI.getConversation(
        message.conversation_id,
      );
      if (!fetched) return;

      const newConv: Conversation = {
        ...fetched,
        last_message: message,
        updated_at: message.sent_at,
        unread_count: isOwnMessage ? 0 : 1,
      };

      // Enrich display name for new direct conversations
      const userId = await getCurrentUserId();
      const enriched = userId
        ? (await enrichWithDisplayNames([newConv], userId))[0]
        : newConv;

      if (enriched.is_archived) {
        // Insérer dans archived.items uniquement si la liste a déjà été
        // chargée — sinon le badge serait incohérent (compté avant le fetch).
        const currentArchived = get().archived;
        if (currentArchived.status === "loaded") {
          set({
            archived: {
              ...currentArchived,
              items: [enriched, ...currentArchived.items],
              offset: currentArchived.offset + 1,
            },
          });
        }
      } else {
        _cancelGracePeriod();
        set({
          conversations: [enriched, ...get().conversations],
          status: "loaded",
        });
      }
    } catch (err) {
      logger.error(
        "conversationsStore",
        "applyNewMessage: failed to fetch unknown conversation",
        err,
      );
    }
  },

  applyMessageUpdated: (message) => {
    const { conversations, archived } = get();
    const mainIndex = conversations.findIndex(
      (c) => c.last_message?.id === message.id,
    );
    if (mainIndex !== -1) {
      const current = conversations[mainIndex];
      set({
        conversations: conversations.map((c, i) =>
          i === mainIndex
            ? {
                ...current,
                last_message: {
                  ...(current.last_message as Message),
                  ...message,
                },
              }
            : c,
        ),
      });
      return;
    }

    const archivedIndex = archived.items.findIndex(
      (c) => c.last_message?.id === message.id,
    );
    if (archivedIndex !== -1) {
      const current = archived.items[archivedIndex];
      set({
        archived: {
          ...archived,
          items: archived.items.map((c, i) =>
            i === archivedIndex
              ? {
                  ...current,
                  last_message: {
                    ...(current.last_message as Message),
                    ...message,
                  },
                }
              : c,
          ),
        },
      });
    }
  },

  applyMessageDeleted: (messageId, deleteForEveryone) => {
    if (!deleteForEveryone) return;
    const { conversations, archived } = get();

    const mainIndex = conversations.findIndex(
      (c) => c.last_message?.id === messageId,
    );
    if (mainIndex !== -1) {
      const current = conversations[mainIndex];
      set({
        conversations: conversations.map((c, i) =>
          i === mainIndex
            ? {
                ...current,
                last_message: {
                  ...(current.last_message as Message),
                  is_deleted: true,
                  delete_for_everyone: true,
                  content: "[Message supprimé]",
                },
              }
            : c,
        ),
      });
      return;
    }

    const archivedIndex = archived.items.findIndex(
      (c) => c.last_message?.id === messageId,
    );
    if (archivedIndex !== -1) {
      const current = archived.items[archivedIndex];
      set({
        archived: {
          ...archived,
          items: archived.items.map((c, i) =>
            i === archivedIndex
              ? {
                  ...current,
                  last_message: {
                    ...(current.last_message as Message),
                    is_deleted: true,
                    delete_for_everyone: true,
                    content: "[Message supprimé]",
                  },
                }
              : c,
          ),
        },
      });
    }
  },

  applyMessageUnread: ({ messageId, conversationId }) => {
    // symetrique de applyMessageDeleted : si le destinataire repasse un message
    // en non-lu, on retire le status "read" de la preview locale (le ticker
    // bleu redevient gris). Le delivery_status broadcast par le backend sera
    // intercepte par useWebSocket et gere par les ChatScreen ouverts.
    const { conversations, archived } = get();

    const updateLastMessage = (conv: Conversation): Conversation => {
      if (conv.id !== conversationId) return conv;
      if (!conv.last_message || conv.last_message.id !== messageId) return conv;
      const last = conv.last_message;
      const nextStatus =
        last.status === "read" ? ("delivered" as const) : last.status;
      return {
        ...conv,
        last_message: {
          ...last,
          status: nextStatus,
        },
      };
    };

    const mainIndex = conversations.findIndex((c) => c.id === conversationId);
    if (mainIndex !== -1) {
      const next = conversations.map(updateLastMessage);
      set({ conversations: next });
    }

    const archivedIndex = archived.items.findIndex(
      (c) => c.id === conversationId,
    );
    if (archivedIndex !== -1) {
      set({
        archived: {
          ...archived,
          items: archived.items.map(updateLastMessage),
        },
      });
    }
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

  removeConversationLocal: (id) => {
    const { conversations, groupAvatars, manuallyUnreadIds } = get();
    const next = conversations.filter((c) => c.id !== id);
    const nextAvatars = { ...groupAvatars };
    delete nextAvatars[id];
    const nextUnread = new Set(manuallyUnreadIds);
    nextUnread.delete(id);
    set({
      conversations: next,
      status: next.length === 0 ? "empty" : "loaded",
      groupAvatars: nextAvatars,
      manuallyUnreadIds: nextUnread,
    });
    cacheService.saveConversations(next);
    AsyncStorage.setItem(
      MANUALLY_UNREAD_KEY,
      JSON.stringify(Array.from(nextUnread)),
    ).catch(() => {});
  },

  archiveConversation: async (id) => {
    const { conversations, archived } = get();
    const target = conversations.find((c) => c.id === id);

    // Optimistic update : flag is_archived côté liste principale.
    // L'écran principal filtre déjà sur !is_archived, donc la conv disparaît.
    set({
      conversations: conversations.map((c) =>
        c.id === id ? { ...c, is_archived: true } : c,
      ),
    });

    try {
      await messagingAPI.archiveConversation(id);

      // Si la liste archivée a déjà été chargée et que la conv n'y figure pas,
      // on l'y insère localement pour rester cohérent (sans refetch).
      if (target && archived.status === "loaded") {
        const alreadyListed = archived.items.some((c) => c.id === id);
        if (!alreadyListed) {
          set({
            archived: {
              ...archived,
              items: [{ ...target, is_archived: true }, ...archived.items],
              offset: archived.offset + 1,
            },
          });
        }
      }
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      // 422 : déjà archivée côté serveur (race avec un autre device).
      // L'état serveur est déjà celui qu'on voulait, on garde l'optimistic.
      if (apiErr.status === 422) return;
      // 404 : conv inexistante / soft-deletée — la retirer définitivement.
      if (apiErr.status === 404) {
        set({
          conversations: get().conversations.filter((c) => c.id !== id),
        });
        cacheService.saveConversations(get().conversations).catch(() => {});
        throw err;
      }
      // Tout le reste : rollback.
      set({ conversations });
      throw err;
    }
  },

  unarchiveConversation: async (id) => {
    const { conversations, archived } = get();
    const wasInMain = conversations.find((c) => c.id === id);
    const archivedItem = archived.items.find((c) => c.id === id);

    // Optimistic : retirer de la liste archivée + remettre is_archived=false
    // dans la liste principale (l'ajouter si absente — ex. ouverte uniquement
    // depuis l'écran archivées).
    const nextArchivedItems = archived.items.filter((c) => c.id !== id);
    const nextMain = wasInMain
      ? conversations.map((c) =>
          c.id === id ? { ...c, is_archived: false } : c,
        )
      : archivedItem
        ? [{ ...archivedItem, is_archived: false }, ...conversations]
        : conversations;

    set({
      conversations: nextMain,
      archived: {
        ...archived,
        items: nextArchivedItems,
        offset: Math.max(0, archived.offset - (archivedItem ? 1 : 0)),
      },
    });

    try {
      await messagingAPI.unarchiveConversation(id);
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      // 422 : déjà désarchivée — on garde l'optimistic.
      if (apiErr.status === 422) return;
      // 404 : conv soft-deletée — la retirer partout (déjà retirée de
      // archived.items, on enlève aussi de main si on l'y avait remise).
      if (apiErr.status === 404) {
        set({
          conversations: get().conversations.filter((c) => c.id !== id),
        });
        cacheService.saveConversations(get().conversations).catch(() => {});
        throw err;
      }
      // Rollback complet.
      set({ conversations, archived });
      throw err;
    }
  },

  /**
   * Synchronisation depuis le broadcast WS `conversation_archived`. Source
   * de vérité quand un autre device de l'utilisateur (ou notre propre POST
   * suite à un optimistic) confirme l'état serveur.
   */
  applyArchiveBroadcast: (conversationId, archivedFlag) => {
    const { conversations, archived } = get();
    const inMain = conversations.find((c) => c.id === conversationId);
    const inArchived = archived.items.find((c) => c.id === conversationId);

    if (archivedFlag) {
      // Marquer comme archivée dans la main list ; insérer dans archived si
      // déjà chargée et absente.
      const nextMain = inMain
        ? conversations.map((c) =>
            c.id === conversationId ? { ...c, is_archived: true } : c,
          )
        : conversations;
      const shouldInsertArchived =
        archived.status === "loaded" && inMain && !inArchived;
      set({
        conversations: nextMain,
        archived: shouldInsertArchived
          ? {
              ...archived,
              items: [{ ...inMain!, is_archived: true }, ...archived.items],
              offset: archived.offset + 1,
            }
          : archived,
      });
    } else {
      const nextMain = inMain
        ? conversations.map((c) =>
            c.id === conversationId ? { ...c, is_archived: false } : c,
          )
        : inArchived
          ? [{ ...inArchived, is_archived: false }, ...conversations]
          : conversations;
      set({
        conversations: nextMain,
        archived: {
          ...archived,
          items: archived.items.filter((c) => c.id !== conversationId),
          offset: Math.max(0, archived.offset - (inArchived ? 1 : 0)),
        },
      });
    }
  },

  fetchArchivedConversations: async () => {
    const current = get().archived;
    set({
      archived: {
        ...current,
        status: "loading",
        error: null,
        items: [],
        offset: 0,
        hasMore: false,
      },
    });
    try {
      const { data, meta } = await messagingAPI.getArchivedConversations({
        limit: ARCHIVED_PAGE_SIZE,
        offset: 0,
      });
      const userId = await getCurrentUserId();
      const enriched = userId
        ? await enrichWithDisplayNames(data, userId)
        : data;
      set({
        archived: {
          items: enriched.map((c) => ({ ...c, is_archived: true })),
          status: "loaded",
          error: null,
          offset: meta.offset + enriched.length,
          hasMore: meta.has_more,
          loadingMore: false,
        },
      });
    } catch (err) {
      logger.error(
        "conversationsStore",
        "fetchArchivedConversations error",
        err,
      );
      set({
        archived: {
          ...get().archived,
          status: "error",
          error: "Failed to load archived conversations",
        },
      });
    }
  },

  loadMoreArchivedConversations: async () => {
    const current = get().archived;
    if (
      current.loadingMore ||
      !current.hasMore ||
      current.status !== "loaded"
    ) {
      return;
    }
    set({ archived: { ...current, loadingMore: true } });
    try {
      const { data, meta } = await messagingAPI.getArchivedConversations({
        limit: ARCHIVED_PAGE_SIZE,
        offset: current.offset,
      });
      const userId = await getCurrentUserId();
      const enriched = userId
        ? await enrichWithDisplayNames(data, userId)
        : data;
      // Dédupliquer : la pagination offset sur données mutables peut produire
      // des doublons si une conv archivée a son updated_at qui change entre
      // deux pages. On filtre par id.
      const existingIds = new Set(current.items.map((c) => c.id));
      const fresh = enriched
        .filter((c) => !existingIds.has(c.id))
        .map((c) => ({ ...c, is_archived: true }));
      set({
        archived: {
          ...get().archived,
          items: [...current.items, ...fresh],
          offset: meta.offset + enriched.length,
          hasMore: meta.has_more,
          loadingMore: false,
        },
      });
    } catch (err) {
      logger.error(
        "conversationsStore",
        "loadMoreArchivedConversations error",
        err,
      );
      set({ archived: { ...get().archived, loadingMore: false } });
    }
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
    const target = conversations.find((c) => c.id === id);
    const lastMessageId = target?.last_message?.id;

    // optimistic local update : ajoute au Set + bump unread_count, comme avant
    const nextIds = new Set(manuallyUnreadIds);
    nextIds.add(id);
    const optimisticConvs = conversations.map((c) =>
      c.id === id
        ? { ...c, unread_count: Math.max(c.unread_count || 0, 1) }
        : c,
    );
    set({
      manuallyUnreadIds: nextIds,
      conversations: optimisticConvs,
    });
    AsyncStorage.setItem(
      MANUALLY_UNREAD_KEY,
      JSON.stringify([...nextIds]),
    ).catch(() => {});

    if (!lastMessageId) {
      // pas de message a marquer cote backend (conv vide), on garde juste le
      // flag local pour l affichage
      return;
    }

    try {
      await messagingAPI.markMessageAsUnread(lastMessageId, id);
    } catch (err) {
      // rollback : retire le flag, restore unread_count
      const { manuallyUnreadIds: currentIds, conversations: currentConvs } =
        get();
      const rolledBackIds = new Set(currentIds);
      rolledBackIds.delete(id);
      set({
        manuallyUnreadIds: rolledBackIds,
        conversations: currentConvs.map((c) =>
          c.id === id ? { ...c, unread_count: target?.unread_count || 0 } : c,
        ),
      });
      AsyncStorage.setItem(
        MANUALLY_UNREAD_KEY,
        JSON.stringify([...rolledBackIds]),
      ).catch(() => {});
      logger.warn("conversationsStore", "markAsUnread API failed", err);
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
