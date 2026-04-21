/**
 * Tests for moderation Zustand store
 * Covers: role fetching, data fetching, actions, error handling
 */

// ─── Mocks ───────────────────────────────────────────────────────

const mockGetMyRole = jest.fn();
const mockGetMyReports = jest.fn();
const mockGetMySanctions = jest.fn();
const mockGetMyAppeals = jest.fn();
const mockGetReportQueue = jest.fn();
const mockGetAppealQueue = jest.fn();
const mockGetReportStats = jest.fn();
const mockResolveReport = jest.fn();
const mockReviewAppeal = jest.fn();
const mockCreateAppeal = jest.fn();

jest.mock("expo-file-system", () => ({
  cacheDirectory: "/cache/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: "file:///tmp/thumb.jpg",
    base64: "dGh1bWI=",
    width: 150,
    height: 100,
  }),
  SaveFormat: { JPEG: "jpeg" },
}));

jest.mock("./src/utils/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock("./src/services/moderation/moderationApi", () => ({
  reportsAPI: {
    getMyReports: (...args: any[]) => mockGetMyReports(...args),
    getReportQueue: (...args: any[]) => mockGetReportQueue(...args),
    getReportStats: (...args: any[]) => mockGetReportStats(...args),
    resolveReport: (...args: any[]) => mockResolveReport(...args),
  },
  sanctionsAPI: {
    getMySanctions: (...args: any[]) => mockGetMySanctions(...args),
  },
  appealsAPI: {
    getMyAppeals: (...args: any[]) => mockGetMyAppeals(...args),
    getAppealQueue: (...args: any[]) => mockGetAppealQueue(...args),
    reviewAppeal: (...args: any[]) => mockReviewAppeal(...args),
    createAppeal: (...args: any[]) => mockCreateAppeal(...args),
  },
  rolesAPI: {
    getMyRole: (...args: any[]) => mockGetMyRole(...args),
  },
}));

import { useModerationStore } from "./src/store/moderationStore";
import { act } from "@testing-library/react-native";

// ─── Helpers ─────────────────────────────────────────────────────

beforeEach(() => {
  // Reset store between tests
  useModerationStore.getState().reset();
  jest.clearAllMocks();
});

// ─── fetchMyRole ─────────────────────────────────────────────────

describe("fetchMyRole", () => {
  it("sets role to admin and flags isAdmin + isModerator", async () => {
    mockGetMyRole.mockResolvedValue({ role: "admin" });

    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });

    const state = useModerationStore.getState();
    expect(state.role).toBe("admin");
    expect(state.isAdmin).toBe(true);
    expect(state.isModerator).toBe(true);
  });

  it("sets role to moderator: isAdmin false, isModerator true", async () => {
    mockGetMyRole.mockResolvedValue({ role: "moderator" });

    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });

    const state = useModerationStore.getState();
    expect(state.role).toBe("moderator");
    expect(state.isAdmin).toBe(false);
    expect(state.isModerator).toBe(true);
  });

  it("sets role to user: both flags false", async () => {
    mockGetMyRole.mockResolvedValue({ role: "user" });

    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });

    const state = useModerationStore.getState();
    expect(state.role).toBe("user");
    expect(state.isAdmin).toBe(false);
    expect(state.isModerator).toBe(false);
  });

  it("sets error on failure", async () => {
    mockGetMyRole.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });

    expect(useModerationStore.getState().error).toBe("Network error");
  });
});

// ─── fetchMyReports ──────────────────────────────────────────────

describe("fetchMyReports", () => {
  it("fetches and stores reports", async () => {
    const reports = [
      { id: "r1", status: "pending" },
      { id: "r2", status: "resolved_action" },
    ];
    mockGetMyReports.mockResolvedValue(reports);

    await act(async () => {
      await useModerationStore.getState().fetchMyReports();
    });

    const state = useModerationStore.getState();
    expect(state.myReports).toEqual(reports);
    expect(state.loading).toBe(false);
  });

  it("sets loading during fetch", async () => {
    let resolvePromise: (value: any) => void;
    mockGetMyReports.mockReturnValue(
      new Promise((r) => {
        resolvePromise = r;
      }),
    );

    const promise = act(async () => {
      useModerationStore.getState().fetchMyReports();
    });

    // loading should be true while fetching
    expect(useModerationStore.getState().loading).toBe(true);

    await act(async () => {
      resolvePromise!([]);
    });
    await promise;
  });

  it("sets error on failure", async () => {
    mockGetMyReports.mockRejectedValue(new Error("Fetch failed"));

    await act(async () => {
      await useModerationStore.getState().fetchMyReports();
    });

    const state = useModerationStore.getState();
    expect(state.error).toBe("Fetch failed");
    expect(state.loading).toBe(false);
  });
});

// ─── fetchMySanctions ────────────────────────────────────────────

describe("fetchMySanctions", () => {
  it("fetches and stores sanctions", async () => {
    const sanctions = [{ id: "s1", type: "warning", active: true }];
    mockGetMySanctions.mockResolvedValue(sanctions);

    await act(async () => {
      await useModerationStore.getState().fetchMySanctions();
    });

    expect(useModerationStore.getState().mySanctions).toEqual(sanctions);
  });
});

// ─── fetchMyAppeals ──────────────────────────────────────────────

describe("fetchMyAppeals", () => {
  it("fetches and stores appeals", async () => {
    const appeals = [{ id: "a1", status: "pending" }];
    mockGetMyAppeals.mockResolvedValue(appeals);

    await act(async () => {
      await useModerationStore.getState().fetchMyAppeals();
    });

    expect(useModerationStore.getState().myAppeals).toEqual(appeals);
  });
});

// ─── Admin queues ────────────────────────────────────────────────

describe("fetchReportQueue", () => {
  it("fetches report queue", async () => {
    const queue = [{ id: "r1", status: "pending" }];
    mockGetReportQueue.mockResolvedValue(queue);

    await act(async () => {
      await useModerationStore.getState().fetchReportQueue();
    });

    expect(useModerationStore.getState().reportQueue).toEqual(queue);
  });
});

describe("fetchAppealQueue", () => {
  it("fetches appeal queue", async () => {
    const queue = [{ id: "a1", status: "pending" }];
    mockGetAppealQueue.mockResolvedValue(queue);

    await act(async () => {
      await useModerationStore.getState().fetchAppealQueue();
    });

    expect(useModerationStore.getState().appealQueue).toEqual(queue);
  });
});

describe("fetchStats", () => {
  it("fetches and stores stats", async () => {
    const stats = {
      pending: 5,
      under_review: 2,
      resolved_today: 10,
      by_category: { spam: 3, offensive: 2 },
    };
    mockGetReportStats.mockResolvedValue(stats);

    await act(async () => {
      await useModerationStore.getState().fetchStats();
    });

    expect(useModerationStore.getState().stats).toEqual(stats);
  });
});

// ─── resolveReport ───────────────────────────────────────────────

describe("resolveReport", () => {
  it("calls API and refreshes queue + stats", async () => {
    mockResolveReport.mockResolvedValue({});
    mockGetReportQueue.mockResolvedValue([]);
    mockGetReportStats.mockResolvedValue({ pending: 0 });

    await act(async () => {
      await useModerationStore
        .getState()
        .resolveReport("r1", "warn", "Final warning");
    });

    expect(mockResolveReport).toHaveBeenCalledWith(
      "r1",
      "warn",
      "Final warning",
    );
    // Should trigger refresh of queue and stats
    expect(mockGetReportQueue).toHaveBeenCalled();
    expect(mockGetReportStats).toHaveBeenCalled();
  });

  it("sets error on failure", async () => {
    mockResolveReport.mockRejectedValue(new Error("Resolve failed"));

    await act(async () => {
      await useModerationStore.getState().resolveReport("r1", "warn");
    });

    expect(useModerationStore.getState().error).toBe("Resolve failed");
  });
});

// ─── reviewAppeal ────────────────────────────────────────────────

describe("reviewAppeal", () => {
  it("calls API and refreshes appeal queue", async () => {
    mockReviewAppeal.mockResolvedValue({});
    mockGetAppealQueue.mockResolvedValue([]);

    await act(async () => {
      await useModerationStore
        .getState()
        .reviewAppeal("a1", "accepted", "Valid");
    });

    expect(mockReviewAppeal).toHaveBeenCalledWith("a1", "accepted", "Valid");
    expect(mockGetAppealQueue).toHaveBeenCalled();
  });
});

// ─── createAppeal ────────────────────────────────────────────────

describe("createAppeal", () => {
  it("calls API and refreshes appeals + sanctions", async () => {
    mockCreateAppeal.mockResolvedValue({});
    mockGetMyAppeals.mockResolvedValue([]);
    mockGetMySanctions.mockResolvedValue([]);

    await act(async () => {
      await useModerationStore
        .getState()
        .createAppeal("s1", "Unfair ban", { screenshot: "url" });
    });

    expect(mockCreateAppeal).toHaveBeenCalledWith({
      sanctionId: "s1",
      reason: "Unfair ban",
      evidence: { screenshot: "url" },
    });
    expect(mockGetMyAppeals).toHaveBeenCalled();
    expect(mockGetMySanctions).toHaveBeenCalled();
  });
});

// ─── reset ───────────────────────────────────────────────────────

describe("reset", () => {
  it("resets all state to initial values", async () => {
    // Set some state first
    mockGetMyRole.mockResolvedValue({ role: "admin" });
    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });
    expect(useModerationStore.getState().isAdmin).toBe(true);

    // Reset
    act(() => {
      useModerationStore.getState().reset();
    });

    const state = useModerationStore.getState();
    expect(state.role).toBe("user");
    expect(state.isAdmin).toBe(false);
    expect(state.isModerator).toBe(false);
    expect(state.myReports).toEqual([]);
    expect(state.mySanctions).toEqual([]);
    expect(state.myAppeals).toEqual([]);
    expect(state.reportQueue).toEqual([]);
    expect(state.appealQueue).toEqual([]);
    expect(state.stats).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});

// ─── handleAppealDecision ───────────────────────────────────────

describe("handleAppealDecision", () => {
  it("updates pending appeal status to approved", () => {
    // Seed a pending appeal
    useModerationStore.setState({
      pendingAppeals: {
        "msg-1": {
          appealId: "a-1",
          status: "pending",
          localUri: "/cache/img.jpg",
        },
      },
    });

    act(() => {
      useModerationStore.getState().handleAppealDecision({
        messageTempId: "msg-1",
        decision: "approved",
      });
    });

    expect(useModerationStore.getState().pendingAppeals["msg-1"].status).toBe(
      "approved",
    );
  });

  it("updates pending appeal status to rejected", () => {
    useModerationStore.setState({
      pendingAppeals: {
        "msg-1": {
          appealId: "a-1",
          status: "pending",
          localUri: "/cache/img.jpg",
        },
      },
    });

    act(() => {
      useModerationStore.getState().handleAppealDecision({
        messageTempId: "msg-1",
        decision: "rejected",
      });
    });

    expect(useModerationStore.getState().pendingAppeals["msg-1"].status).toBe(
      "rejected",
    );
  });

  it("does nothing when messageTempId is not found", () => {
    useModerationStore.setState({ pendingAppeals: {} });

    act(() => {
      useModerationStore.getState().handleAppealDecision({
        messageTempId: "missing",
        decision: "approved",
      });
    });

    expect(useModerationStore.getState().pendingAppeals).toEqual({});
  });
});

// ─── cleanupAppeal ──────────────────────────────────────────────

describe("cleanupAppeal", () => {
  it("removes appeal from pendingAppeals and deletes local file", async () => {
    const { deleteAsync } = require("expo-file-system");
    useModerationStore.setState({
      pendingAppeals: {
        "msg-1": {
          appealId: "a-1",
          status: "approved",
          localUri: "/cache/img.jpg",
        },
      },
    });

    await act(async () => {
      await useModerationStore.getState().cleanupAppeal("msg-1");
    });

    expect(deleteAsync).toHaveBeenCalledWith("/cache/img.jpg", {
      idempotent: true,
    });
    expect(
      useModerationStore.getState().pendingAppeals["msg-1"],
    ).toBeUndefined();
  });

  it("removes appeal even when localUri is absent", async () => {
    useModerationStore.setState({
      pendingAppeals: {
        "msg-2": { appealId: "a-2", status: "pending", localUri: "" },
      },
    });

    await act(async () => {
      await useModerationStore.getState().cleanupAppeal("msg-2");
    });

    expect(
      useModerationStore.getState().pendingAppeals["msg-2"],
    ).toBeUndefined();
  });
});

// ─── createBlockedImageAppeal ───────────────────────────────────

describe("createBlockedImageAppeal", () => {
  it("creates appeal and stores pending entry", async () => {
    mockCreateAppeal.mockResolvedValue({ id: "appeal-42" });

    await act(async () => {
      await useModerationStore.getState().createBlockedImageAppeal({
        imageUri: "file:///photos/test.jpg",
        reason: "This image is perfectly fine",
        conversationId: "conv-1",
        recipientId: "user-2",
        messageTempId: "temp-123",
        blockReason: "nudity",
        scores: { nudity: 0.9 },
      });
    });

    const pending = useModerationStore.getState().pendingAppeals["temp-123"];
    expect(pending).toBeDefined();
    expect(pending.appealId).toBe("appeal-42");
    expect(pending.status).toBe("pending");
    expect(mockCreateAppeal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "blocked_image",
        reason: "This image is perfectly fine",
      }),
    );
  });

  it("sets error and rethrows on API failure", async () => {
    mockCreateAppeal.mockRejectedValue(new Error("Server error"));

    let caught: Error | undefined;
    await act(async () => {
      try {
        await useModerationStore.getState().createBlockedImageAppeal({
          imageUri: "file:///photos/test.jpg",
          reason: "Legit image",
          conversationId: "conv-1",
          messageTempId: "temp-456",
        });
      } catch (e) {
        caught = e as Error;
      }
    });

    expect(caught?.message).toBe("Server error");
    expect(useModerationStore.getState().error).toBe("Server error");
  });
});
