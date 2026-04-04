import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Conversation, Message } from '../types/messaging';
import { messagingAPI } from '../services/messaging/api';
import { cacheService } from '../services/messaging/cache';
import { TokenService } from '../services/TokenService';
import { NotificationService } from '../services/NotificationService';

const EMPTY_STATE_GRACE_PERIOD_MS = 10_000;
const MANUALLY_UNREAD_KEY = '@whispr/manually_unread_ids';

async function getCurrentUserId(): Promise<string | null> {
  const token = await TokenService.getAccessToken();
  if (!token) return null;
  const payload = TokenService.decodeAccessToken(token);
  return payload?.sub ?? null;
}

async function enrichWithDisplayNames(
  conversations: Conversation[],
  currentUserId: string,
): Promise<Conversation[]> {
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      if (conv.type === 'direct' && !conv.display_name) {
        try {
          // The list endpoint doesn't return members, so fetch conversation detail
          let memberIds = conv.member_user_ids;
          if (!memberIds || memberIds.length === 0) {
            const detail = await messagingAPI.getConversation(conv.id);
            if (detail?.members) {
              memberIds = detail.members.map((m: { user_id: string }) => m.user_id);
            } else if (detail?.member_user_ids) {
              memberIds = detail.member_user_ids;
            }
          }

          const otherUserId = memberIds?.find(
            (id: string) => id !== currentUserId,
          );
          if (otherUserId) {
            const userInfo = await messagingAPI.getUserInfo(otherUserId);
            if (userInfo) {
              return {
                ...conv,
                display_name: userInfo.display_name,
                member_user_ids: memberIds,
              };
            }
          }
        } catch {
          // Silently fail - will show "Contact" as fallback
        }
      }
      return conv;
    }),
  );
  return enriched;
}

export type ConversationsStatus =
  | 'loading'
  | 'grace_period'
  | 'empty'
  | 'loaded'
  | 'error';

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
  applyNewMessage: (message: Message) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => void;
  muteConversation: (id: string) => Promise<void>;
  pinConversation: (id: string) => void;
  markAsUnread: (id: string) => Promise<void>;
  clearManualUnread: (id: string) => Promise<void>;
  reset: () => void;
  loadManuallyUnreadIds: () => Promise<void>;
  _startGracePeriod: () => void;
  _cancelGracePeriod: () => void;
  _setConversations: (conversations: Conversation[], fromRefresh?: boolean) => void;
}

export const useConversationsStore = create<ConversationsState & ConversationsActions>((set, get) => ({
  conversations: [],
  status: 'loading',
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
      status: 'loading',
      error: null,
      manuallyUnreadIds: new Set<string>(),
      _gracePeriodTimer: null,
    });
  },

  _startGracePeriod: () => {
    const { _gracePeriodTimer } = get();
    if (_gracePeriodTimer) return;
    const timer = setTimeout(() => {
      set({ status: 'empty', _gracePeriodTimer: null });
    }, EMPTY_STATE_GRACE_PERIOD_MS);
    set({ status: 'grace_period', _gracePeriodTimer: timer });
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
      set({ conversations, status: 'loaded', error: null });
    } else if (fromRefresh) {
      _cancelGracePeriod();
      set({ conversations: [], status: 'empty', error: null });
    } else {
      set({ conversations: [] });
      _startGracePeriod();
    }
  },

  fetchConversations: async () => {
    const { _setConversations, _startGracePeriod } = get();
    set({ status: 'loading', error: null });

    try {
      // Show cached data immediately while fetching
      const cached = await cacheService.getConversations();
      if (cached && cached.length > 0) {
        set({ conversations: cached, status: 'loaded' });
      }

      const data = await messagingAPI.getConversations();
      const userId = await getCurrentUserId();
      const enriched = userId ? await enrichWithDisplayNames(data, userId) : data;
      await cacheService.saveConversations(enriched);
      _setConversations(enriched);
    } catch (err) {
      console.error('[conversationsStore] fetchConversations error:', err);
      // If we already have cached data shown, stay on it but start grace period
      // so skeletons don't flash forever if cache was empty
      const { conversations } = get();
      if (conversations.length === 0) {
        _startGracePeriod();
      }
      set({ error: 'Failed to load conversations' });
    }
  },

  refreshConversations: async () => {
    const { _setConversations } = get();
    try {
      const data = await messagingAPI.getConversations();
      const userId = await getCurrentUserId();
      const enriched = userId ? await enrichWithDisplayNames(data, userId) : data;
      await cacheService.saveConversations(enriched);
      _setConversations(enriched, true);
    } catch (err) {
      console.error('[conversationsStore] refreshConversations error:', err);
      set({ error: 'Failed to refresh conversations' });
    }
  },

  applyConversationUpdate: (conversation) => {
    const { conversations, _cancelGracePeriod } = get();
    const index = conversations.findIndex(c => c.id === conversation.id);
    let next: Conversation[];
    if (index === -1) {
      next = [conversation, ...conversations];
    } else {
      next = [...conversations];
      next[index] = conversation;
    }
    if (next.length > 0) {
      _cancelGracePeriod();
      set({ conversations: next, status: 'loaded' });
    }
  },

  applyNewMessage: async (message) => {
    const { conversations, _cancelGracePeriod } = get();
    const index = conversations.findIndex(conv => conv.id === message.conversation_id);

    if (index === -1) {
      // Bug C fix: conversation not in the list — fetch it from the API and prepend
      try {
        const fetched = await messagingAPI.getConversation(message.conversation_id);
        if (fetched) {
          const newConv: Conversation = {
            ...fetched,
            last_message: message,
            updated_at: message.sent_at,
            unread_count: 1,
          };
          _cancelGracePeriod();
          set({ conversations: [newConv, ...get().conversations], status: 'loaded' });
        }
      } catch (err) {
        console.error('[conversationsStore] applyNewMessage: failed to fetch unknown conversation', err);
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
    const next = conversations.filter(c => c.id !== id);
    set({ conversations: next, status: next.length === 0 ? 'empty' : 'loaded' });
    try {
      await messagingAPI.deleteConversation(id);
    } catch (err) {
      // Rollback on failure
      set({ conversations, status: 'loaded' });
      throw err;
    }
  },

  archiveConversation: (id) => {
    const { conversations } = get();
    set({
      conversations: conversations.map(c =>
        c.id === id ? { ...c, is_archived: !c.is_archived } : c
      ),
    });
  },

  muteConversation: async (id) => {
    const { conversations } = get();
    const conversation = conversations.find(c => c.id === id);
    const wasMuted = conversation?.is_muted ?? false;

    // Optimistic update
    set({
      conversations: conversations.map(c =>
        c.id === id ? { ...c, is_muted: !c.is_muted, updated_at: new Date().toISOString() } : c
      ),
    });

    try {
      if (wasMuted) {
        await NotificationService.unmuteConversation(id);
      } else {
        await NotificationService.muteConversation(id);
      }
    } catch (err) {
      console.error('[conversationsStore] muteConversation error:', err);
      // Rollback on failure
      set({ conversations });
    }
  },

  pinConversation: (id) => {
    const { conversations } = get();
    set({
      conversations: conversations.map(c =>
        c.id === id ? { ...c, is_pinned: !c.is_pinned } : c
      ),
    });
  },

  markAsUnread: async (id) => {
    const { conversations, manuallyUnreadIds } = get();
    const nextIds = new Set(manuallyUnreadIds);
    nextIds.add(id);
    set({
      manuallyUnreadIds: nextIds,
      conversations: conversations.map(c =>
        c.id === id ? { ...c, unread_count: Math.max(c.unread_count || 0, 1) } : c
      ),
    });
    try {
      await AsyncStorage.setItem(MANUALLY_UNREAD_KEY, JSON.stringify([...nextIds]));
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
      await AsyncStorage.setItem(MANUALLY_UNREAD_KEY, JSON.stringify([...nextIds]));
    } catch {
      // Storage write failed — local state is still correct for this session
    }
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
          conversations: conversations.map(c =>
            idSet.has(c.id) ? { ...c, unread_count: Math.max(c.unread_count || 0, 1) } : c
          ),
        });
      }
    } catch {
      // Storage read failed — start with empty set
    }
  },
}));
