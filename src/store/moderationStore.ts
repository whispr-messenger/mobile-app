import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

// expo-file-system v55 types don't fully match the runtime API — alias to avoid
// scattering `as any` across every call site.
const FS = FileSystem as any;
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
  /**
   * Native file URI (file://…/blocked-appeals/<tempId>.jpg) or a blob/http URL.
   * Survives process restarts on native because the file lives in
   * FileSystem.cacheDirectory. On web, blob: URIs are revoked at logout/reload.
   */
  localUri: string;
  /**
   * Full-size base64 data URI (web only). Persists in AsyncStorage so the image
   * can be re-submitted after the user logs out and back in. Capped at ~5MB
   * (post-resize) to keep AsyncStorage responsive.
   */
  localDataUri?: string;
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

export const useModerationStore = create<ModerationState>()(
  persist(
    (set, get) => ({
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
        const cacheDir = FS.cacheDirectory as string | undefined;
        let localPath = imageUri;

        try {
          if (cacheDir) {
            const dir = `${cacheDir}blocked-appeals`;
            try {
              const info = await FS.getInfoAsync(dir);
              if (!info.exists) {
                await FS.makeDirectoryAsync(dir, {
                  intermediates: true,
                });
              }
            } catch {
              try {
                await FS.makeDirectoryAsync(dir, {
                  intermediates: true,
                });
              } catch {
                /* ignore */
              }
            }

            const ext = imageUri.split(".").pop()?.split("?")[0] || "jpg";
            localPath = `${dir}/${messageTempId}.${ext}`;
            try {
              await FS.copyAsync({
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

          // Shrink aggressively (150px @ q=0.3) so the base64 payload stays
          // comfortably under the backend body-size limit even for complex
          // scenes. Previous 200px @ q=0.5 could exceed 100KB → 413 at the edge.
          const manipulated = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ resize: { width: 150 } }],
            {
              compress: 0.3,
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

          // On web, blob: URIs are revoked at logout/reload, so we need a
          // self-contained copy of the original image. Build a full-size
          // base64 data URI (resized to a max of 1280px so we stay under a
          // sensible AsyncStorage budget) that survives the session.
          let localDataUri: string | undefined;
          if (Platform.OS === "web") {
            try {
              const fullsize = await ImageManipulator.manipulateAsync(
                imageUri,
                [{ resize: { width: 1280 } }],
                {
                  compress: 0.8,
                  format: ImageManipulator.SaveFormat.JPEG,
                  base64: true,
                },
              );
              if (fullsize.base64) {
                const dataUri = `data:image/jpeg;base64,${fullsize.base64}`;
                // Cap at ~5MB of base64 text to avoid choking AsyncStorage /
                // IndexedDB. Above that threshold we give up on auto-retry
                // and rely on the rejected message label.
                if (dataUri.length <= 5 * 1024 * 1024) {
                  localDataUri = dataUri;
                } else {
                  logger.warn(
                    "moderation",
                    "image too large for web persistence, skipping auto-retry payload",
                    { size: dataUri.length },
                  );
                }
              }
            } catch (err) {
              logger.warn(
                "moderation",
                "failed to build web-safe data URI for appeal",
                err,
              );
            }
          }

          set((state) => ({
            pendingAppeals: {
              ...state.pendingAppeals,
              [messageTempId]: {
                appealId: appeal.id,
                status: "pending",
                localUri: localPath,
                ...(localDataUri ? { localDataUri } : {}),
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
        if (entry?.localUri) {
          try {
            await FS.deleteAsync(entry.localUri, { idempotent: true });
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

      // NOTE: reset intentionally preserves `pendingAppeals` so that the mapping
      // messageTempId -> {appealId, status, localUri} survives logout. The image
      // itself lives on disk under FileSystem.cacheDirectory/blocked-appeals/ and
      // must stay reachable so the auto-resend flow can retrieve it after the
      // admin approves the appeal (WHISPR-1133).
      reset: () =>
        set((state) => ({
          ...initialState,
          pendingAppeals: state.pendingAppeals,
        })),
    }),
    {
      name: "moderation-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the pendingAppeals mapping — everything else is fetched
      // fresh from the server on session start.
      partialize: (state) => ({ pendingAppeals: state.pendingAppeals }),
    },
  ),
);

/**
 * Single source of truth for "is the logged-in user admin or moderator?"
 * Callers should prefer this selector over reading `isAdmin`/`isModerator`
 * separately so the authorisation check stays consistent between the
 * visibility gate (SettingsScreen button) and the screen-level AdminGate
 * (WHISPR-1075).
 *
 * Note: this is a CLIENT-side UX gate only. Actual authorisation is enforced
 * server-side — the admin endpoints on user-service sit behind RolesGuard
 * (WHISPR-1027) and will 403 any request that doesn't carry an admin/moderator
 * role, regardless of what the client believes its role is.
 */
export const useIsStaff = () =>
  useModerationStore((state) => state.isAdmin || state.isModerator);
