/**
 * Store Zustand pour l'inbox de notifications (WHISPR-1437).
 * Gere la liste des items, le count non-lus, la pagination cursor-based
 * et les updates temps-reel via WS event "inbox:new".
 */

import { create } from "zustand";
import { inboxApi } from "../services/inboxApi";
import type { InboxItem } from "../types/inbox";

const INBOX_PAGE_SIZE = 20;

interface InboxState {
  items: InboxItem[];
  unread_count: number;
  loading: boolean;
  has_more: boolean;
  next_cursor: string | null;

  hydrate: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  addNew: (item: InboxItem) => void;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  unread_count: 0,
  loading: false,
  has_more: false,
  next_cursor: null,

  async hydrate() {
    if (get().loading) return;
    set({ loading: true });
    try {
      const data = await inboxApi.fetchInbox({ limit: INBOX_PAGE_SIZE });
      set({
        items: data.items,
        unread_count: data.unread_count,
        has_more: data.next_cursor !== null,
        next_cursor: data.next_cursor,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  async loadMore() {
    const { loading, has_more, next_cursor } = get();
    if (loading || !has_more || !next_cursor) return;
    set({ loading: true });
    try {
      const data = await inboxApi.fetchInbox({
        cursor: next_cursor,
        limit: INBOX_PAGE_SIZE,
      });
      set((s) => ({
        items: [...s.items, ...data.items],
        unread_count: data.unread_count,
        has_more: data.next_cursor !== null,
        next_cursor: data.next_cursor,
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  async markAllRead() {
    try {
      await inboxApi.markAllRead();
      set((s) => ({
        unread_count: 0,
        items: s.items.map((item) =>
          item.read_at ? item : { ...item, read_at: new Date().toISOString() },
        ),
      }));
    } catch {
      // silencieux — l'UI reste coherente avec l'etat local
    }
  },

  async markRead(id: string) {
    try {
      await inboxApi.markRead([id]);
      set((s) => {
        const nowRead = new Date().toISOString();
        const wasUnread = s.items.find((i) => i.id === id && !i.read_at);
        return {
          unread_count: wasUnread
            ? Math.max(0, s.unread_count - 1)
            : s.unread_count,
          items: s.items.map((item) =>
            item.id === id ? { ...item, read_at: nowRead } : item,
          ),
        };
      });
    } catch {
      // silencieux
    }
  },

  addNew(item: InboxItem) {
    set((s) => ({
      items: [item, ...s.items],
      unread_count: s.unread_count + 1,
    }));
  },
}));
