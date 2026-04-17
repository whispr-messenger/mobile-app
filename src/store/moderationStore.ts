import { create } from "zustand";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import type {
  Report,
  UserSanction,
  Appeal,
  AppealEvidence,
  ReportStats,
  UserRole,
} from "../types/moderation";
import {
  reportsAPI,
  sanctionsAPI,
  appealsAPI,
  rolesAPI,
} from "../services/moderation/moderationApi";
import { logger } from "../utils/logger";

export interface PendingBlockedImageAppeal {
  appealId: string;
  status: "pending" | "approved" | "rejected";
  localUri: string;
}

interface ModerationState {
  // Role
  role: UserRole;
  isAdmin: boolean;
  isModerator: boolean;

  // My data
  myReports: Report[];
  mySanctions: UserSanction[];
  myAppeals: Appeal[];

  // Admin queues
  reportQueue: Report[];
  appealQueue: Appeal[];
  stats: ReportStats | null;

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  fetchMyRole: () => Promise<void>;
  fetchMyReports: () => Promise<void>;
  fetchMySanctions: () => Promise<void>;
  fetchMyAppeals: () => Promise<void>;
  fetchReportQueue: () => Promise<void>;
  fetchAppealQueue: () => Promise<void>;
  fetchStats: () => Promise<void>;
  resolveReport: (id: string, action: string, notes?: string) => Promise<void>;
  reviewAppeal: (
    id: string,
    status: "accepted" | "rejected",
    notes?: string,
  ) => Promise<void>;
  createAppeal: (
    sanctionId: string,
    reason: string,
    evidence?: Record<string, any>,
  ) => Promise<void>;

  // Blocked image appeals
  pendingAppeals: Record<string, PendingBlockedImageAppeal>;
  createBlockedImageAppeal: (params: {
    imageUri: string;
    reason: string;
    conversationId: string;
    recipientId?: string;
    messageTempId: string;
    blockReason?: string;
    scores?: Record<string, number>;
  }) => Promise<void>;
  cleanupAppeal: (messageTempId: string) => Promise<void>;
  handleAppealDecision: (params: {
    messageTempId: string;
    decision: "approved" | "rejected";
    conversationId?: string;
  }) => void;

  reset: () => void;
}

const initialState = {
  role: "user" as UserRole,
  isAdmin: false,
  isModerator: false,
  myReports: [] as Report[],
  mySanctions: [] as UserSanction[],
  myAppeals: [] as Appeal[],
  reportQueue: [] as Report[],
  appealQueue: [] as Appeal[],
  stats: null as ReportStats | null,
  loading: false,
  error: null as string | null,
  pendingAppeals: {} as Record<string, PendingBlockedImageAppeal>,
};

export const useModerationStore = create<ModerationState>((set, get) => ({
  ...initialState,

  fetchMyRole: async () => {
    try {
      const { role } = await rolesAPI.getMyRole();
      set({
        role,
        isAdmin: role === "admin",
        isModerator: role === "moderator" || role === "admin",
      });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  fetchMyReports: async () => {
    set({ loading: true });
    try {
      const myReports = await reportsAPI.getMyReports();
      set({ myReports, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchMySanctions: async () => {
    set({ loading: true });
    try {
      const mySanctions = await sanctionsAPI.getMySanctions();
      set({ mySanctions, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchMyAppeals: async () => {
    set({ loading: true });
    try {
      const myAppeals = await appealsAPI.getMyAppeals();
      set({ myAppeals, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchReportQueue: async () => {
    set({ loading: true });
    try {
      const reportQueue = await reportsAPI.getReportQueue();
      set({ reportQueue, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchAppealQueue: async () => {
    set({ loading: true });
    try {
      const appealQueue = await appealsAPI.getAppealQueue();
      set({ appealQueue, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await reportsAPI.getReportStats();
      set({ stats });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  resolveReport: async (id, action, notes) => {
    try {
      await reportsAPI.resolveReport(id, action, notes);
      get().fetchReportQueue();
      get().fetchStats();
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  reviewAppeal: async (id, status, notes) => {
    try {
      await appealsAPI.reviewAppeal(id, status, notes);
      get().fetchAppealQueue();
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  createAppeal: async (sanctionId, reason, evidence) => {
    try {
      await appealsAPI.createAppeal({ sanctionId, reason, evidence });
      get().fetchMyAppeals();
      get().fetchMySanctions();
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  createBlockedImageAppeal: async ({
    imageUri,
    reason,
    conversationId,
    recipientId,
    messageTempId,
    blockReason,
    scores,
  }) => {
    const cacheDir = (FileSystem as any).cacheDirectory as string | undefined;
    let localPath = imageUri;

    try {
      if (cacheDir) {
        const dir = `${cacheDir}blocked-appeals`;
        try {
          const info = await (FileSystem as any).getInfoAsync(dir);
          if (!info.exists) {
            await (FileSystem as any).makeDirectoryAsync(dir, {
              intermediates: true,
            });
          }
        } catch {
          try {
            await (FileSystem as any).makeDirectoryAsync(dir, {
              intermediates: true,
            });
          } catch {
            /* ignore */
          }
        }

        const ext = imageUri.split(".").pop()?.split("?")[0] || "jpg";
        localPath = `${dir}/${messageTempId}.${ext}`;
        try {
          await (FileSystem as any).copyAsync({
            from: imageUri,
            to: localPath,
          });
        } catch (err) {
          logger.warn(
            "moderation",
            "copyAsync failed — keeping original URI",
            err,
          );
          localPath = imageUri;
        }
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 200 } }],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      const evidence: AppealEvidence = {
        thumbnailBase64: manipulated.base64,
        blockReason,
        scores,
        conversationId,
        recipientId,
        messageTempId,
      };

      const appeal = await appealsAPI.createAppeal({
        type: "blocked_image",
        sanctionId: null,
        reason,
        evidence,
      });

      set((state) => ({
        pendingAppeals: {
          ...state.pendingAppeals,
          [messageTempId]: {
            appealId: appeal.id,
            status: "pending",
            localUri: localPath,
          },
        },
      }));
    } catch (e: any) {
      logger.error("moderation", "createBlockedImageAppeal failed", e);
      set({ error: e.message });
      throw e;
    }
  },

  cleanupAppeal: async (messageTempId) => {
    const entry = get().pendingAppeals[messageTempId];
    if (entry?.localUri && entry.localUri.startsWith("file://") === false) {
      // relative cache path — try to delete
      try {
        await (FileSystem as any).deleteAsync(entry.localUri, {
          idempotent: true,
        });
      } catch {
        /* ignore */
      }
    } else if (entry?.localUri) {
      try {
        await (FileSystem as any).deleteAsync(entry.localUri, {
          idempotent: true,
        });
      } catch {
        /* ignore */
      }
    }
    set((state) => {
      const next = { ...state.pendingAppeals };
      delete next[messageTempId];
      return { pendingAppeals: next };
    });
  },

  handleAppealDecision: ({ messageTempId, decision }) => {
    set((state) => {
      const current = state.pendingAppeals[messageTempId];
      if (!current) return state;
      return {
        pendingAppeals: {
          ...state.pendingAppeals,
          [messageTempId]: { ...current, status: decision },
        },
      };
    });
  },

  reset: () => set(initialState),
}));
