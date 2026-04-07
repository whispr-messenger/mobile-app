import { create } from "zustand";
import { Conversation, Message } from "../types/messaging";
import { messagingAPI } from "../services/messaging/api";
import { cacheService } from "../services/messaging/cache";
import { contactsAPI } from "../services/contacts/api";
import { TokenService } from "../services/TokenService";

const EMPTY_STATE_GRACE_PERIOD_MS = 10_000;

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
  _gracePeriodTimer: ReturnType<typeof setTimeout> | null;
}

interface ConversationsActions {
  fetchConversations: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  applyConversationUpdate: (conversation: Conversation) => void;
  applyNewMessage: (message: Message) => void;
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => void;
  muteConversation: (id: string) => void;
  pinConversation: (id: string) => void;
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
  _gracePeriodTimer: null,

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
      const enriched = await enrichConversations(data);
      await cacheService.saveConversations(enriched);
      _setConversations(enriched);
    } catch (err) {
      const apiError = err as { status?: number };
      if (apiError?.status === 401) {
        set({ conversations: [], status: "empty", error: null });
        return;
      }
      console.error("[conversationsStore] fetchConversations error:", err);
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
      const enriched = await enrichConversations(data);
      await cacheService.saveConversations(enriched);
      _setConversations(enriched, true);
    } catch (err) {
      const apiError = err as { status?: number };
      if (apiError?.status === 401) {
        set({ conversations: [], status: "empty", error: null });
        return;
      }
      console.error("[conversationsStore] refreshConversations error:", err);
      set({ error: "Failed to refresh conversations" });
    }
  },

  applyConversationUpdate: (conversation) => {
    const { conversations, _cancelGracePeriod } = get();
    const index = conversations.findIndex((c) => c.id === conversation.id);
    let next: Conversation[];
    if (index === -1) {
      next = [conversation, ...conversations];
    } else {
      next = [...conversations];
      next[index] = conversation;
    }
    if (next.length > 0) {
      _cancelGracePeriod();
      set({ conversations: next, status: "loaded" });
    }
  },

  applyNewMessage: (message) => {
    const { conversations } = get();
    const next = conversations.map((conv) => {
      if (conv.id !== message.conversation_id) return conv;
      return {
        ...conv,
        last_message: message,
        updated_at: message.sent_at,
        unread_count: (conv.unread_count || 0) + 1,
      };
    });
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

  muteConversation: (id) => {
    const { conversations } = get();
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
  },

  pinConversation: (id) => {
    const { conversations } = get();
    set({
      conversations: conversations.map((c) =>
        c.id === id ? { ...c, is_pinned: !c.is_pinned } : c,
      ),
    });
  },
}));

async function enrichConversations(
  conversations: Conversation[],
): Promise<Conversation[]> {
  const token = await TokenService.getAccessToken();
  const currentUserId = token
    ? TokenService.decodeAccessToken(token)?.sub
    : undefined;

  let contactsByUserId = new Map<string, any>();
  try {
    const contacts = await contactsAPI.getContacts();
    contactsByUserId = new Map(contacts.contacts.map((c) => [c.contact_id, c]));
  } catch {
    contactsByUserId = new Map();
  }

  return Promise.all(
    conversations.map(async (conv) => {
      if (conv.type !== "direct") return conv;
      if (conv.display_name && conv.avatar_url) return conv;

      try {
        const members = await messagingAPI.getConversationMembers(conv.id);
        const other = members.find((m) => m.id && m.id !== currentUserId);
        const otherUserId = other?.id;
        if (!otherUserId) return conv;

        const contact = contactsByUserId.get(otherUserId);
        const display_name =
          conv.display_name ??
          contact?.nickname ??
          contact?.contact_user?.username ??
          contact?.contact_user?.first_name ??
          contact?.contact_user?.phone_number ??
          other.display_name;

        const avatar_url = conv.avatar_url ?? contact?.contact_user?.avatar_url;

        return { ...conv, display_name, avatar_url };
      } catch {
        return conv;
      }
    }),
  );
}
