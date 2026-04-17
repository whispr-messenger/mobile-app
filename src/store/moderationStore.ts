import { create } from "zustand";
import type {
  Report,
  UserSanction,
  Appeal,
  ReportStats,
  UserRole,
} from "../types/moderation";
import {
  reportsAPI,
  sanctionsAPI,
  appealsAPI,
  rolesAPI,
} from "../services/moderation/moderationApi";

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

  reset: () => set(initialState),
}));
