import { create } from 'zustand';

interface PresenceState {
  /** Set of user IDs currently online */
  onlineUserIds: Set<string>;
  /** Map of userId -> ISO timestamp of last time they went offline */
  lastSeenAt: Record<string, string>;
}

interface PresenceActions {
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  /** Bulk-set from a presence_state payload (all keys are online) */
  setPresenceState: (userIds: string[]) => void;
  /** Apply a presence_diff payload */
  applyPresenceDiff: (joins: string[], leaves: string[]) => void;
  isOnline: (userId: string) => boolean;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState & PresenceActions>((set, get) => ({
  onlineUserIds: new Set<string>(),
  lastSeenAt: {},

  setUserOnline: (userId) => {
    set((state) => {
      const next = new Set(state.onlineUserIds);
      next.add(userId);
      return { onlineUserIds: next };
    });
  },

  setUserOffline: (userId) => {
    set((state) => {
      const next = new Set(state.onlineUserIds);
      next.delete(userId);
      return {
        onlineUserIds: next,
        lastSeenAt: { ...state.lastSeenAt, [userId]: new Date().toISOString() },
      };
    });
  },

  setPresenceState: (userIds) => {
    set(() => ({
      onlineUserIds: new Set(userIds),
    }));
  },

  applyPresenceDiff: (joins, leaves) => {
    set((state) => {
      const next = new Set(state.onlineUserIds);
      const nextLastSeen = { ...state.lastSeenAt };
      joins.forEach((uid) => next.add(uid));
      leaves.forEach((uid) => {
        next.delete(uid);
        nextLastSeen[uid] = new Date().toISOString();
      });
      return { onlineUserIds: next, lastSeenAt: nextLastSeen };
    });
  },

  isOnline: (userId) => {
    return get().onlineUserIds.has(userId);
  },

  reset: () => {
    set({ onlineUserIds: new Set<string>(), lastSeenAt: {} });
  },
}));
