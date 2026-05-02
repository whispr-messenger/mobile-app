/**
 * Tests for conversations Zustand store — groupAvatars cache.
 * Covers the migration from the module-level Map to persistent store state.
 */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/services/messaging/api", () => ({
  messagingAPI: {
    getConversations: jest.fn().mockResolvedValue([]),
    getConversation: jest.fn().mockResolvedValue(null),
    getConversationMembers: jest.fn().mockResolvedValue([]),
    getUserInfo: jest.fn().mockResolvedValue(null),
    deleteConversation: jest.fn().mockResolvedValue(undefined),
    archiveConversation: jest.fn().mockResolvedValue(undefined),
    unarchiveConversation: jest.fn().mockResolvedValue(undefined),
    getArchivedConversations: jest.fn().mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        limit: 50,
        offset: 0,
        has_more: false,
        user_id: "",
      },
    }),
  },
}));

jest.mock("../src/services/messaging/cache", () => ({
  cacheService: {
    getConversations: jest.fn().mockResolvedValue(null),
    saveConversations: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../src/services/TokenService", () => ({
  TokenService: {
    getAccessToken: jest.fn().mockResolvedValue(null),
    decodeAccessToken: jest.fn().mockReturnValue(null),
  },
}));

jest.mock("../src/services/NotificationService", () => ({
  NotificationService: {
    muteConversation: jest.fn().mockResolvedValue(undefined),
    unmuteConversation: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../src/utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { useConversationsStore } from "../src/store/conversationsStore";
import { act } from "@testing-library/react-native";

beforeEach(() => {
  useConversationsStore.getState().reset();
});

describe("conversationsStore — groupAvatars", () => {
  it("starts with an empty groupAvatars record", () => {
    expect(useConversationsStore.getState().groupAvatars).toEqual({});
  });

  it("setGroupAvatars stores avatars under the conversation id", () => {
    const avatars = [
      { uri: "https://cdn/a.png", name: "Alice" },
      { uri: undefined, name: "Bob" },
    ];

    act(() => {
      useConversationsStore.getState().setGroupAvatars("conv-1", avatars);
    });

    expect(useConversationsStore.getState().groupAvatars).toEqual({
      "conv-1": avatars,
    });
  });

  it("setGroupAvatars preserves entries for other conversations", () => {
    act(() => {
      useConversationsStore
        .getState()
        .setGroupAvatars("conv-1", [{ name: "Alice" }]);
      useConversationsStore
        .getState()
        .setGroupAvatars("conv-2", [{ name: "Bob" }]);
    });

    const { groupAvatars } = useConversationsStore.getState();
    expect(groupAvatars["conv-1"]).toEqual([{ name: "Alice" }]);
    expect(groupAvatars["conv-2"]).toEqual([{ name: "Bob" }]);
  });

  it("setGroupAvatars overwrites the entry for the same conversation id", () => {
    act(() => {
      useConversationsStore
        .getState()
        .setGroupAvatars("conv-1", [{ name: "Alice" }]);
      useConversationsStore
        .getState()
        .setGroupAvatars("conv-1", [{ name: "Alice updated" }]);
    });

    expect(useConversationsStore.getState().groupAvatars["conv-1"]).toEqual([
      { name: "Alice updated" },
    ]);
  });

  it("setGroupAvatars accepts an empty array as a cached 'no avatars' result", () => {
    act(() => {
      useConversationsStore.getState().setGroupAvatars("conv-1", []);
    });

    const { groupAvatars } = useConversationsStore.getState();
    expect("conv-1" in groupAvatars).toBe(true);
    expect(groupAvatars["conv-1"]).toEqual([]);
  });

  it("reset() clears the groupAvatars record", () => {
    act(() => {
      useConversationsStore
        .getState()
        .setGroupAvatars("conv-1", [{ name: "Alice" }]);
    });
    expect(
      useConversationsStore.getState().groupAvatars["conv-1"],
    ).toBeDefined();

    act(() => {
      useConversationsStore.getState().reset();
    });

    expect(useConversationsStore.getState().groupAvatars).toEqual({});
  });
});

describe("conversationsStore — applyNewMessage unread_count (WHISPR-1050)", () => {
  // Minimal Conversation shape that satisfies the store
  function seed(convId: string, unread = 0) {
    const conv = {
      id: convId,
      type: "direct",
      display_name: "Alice",
      avatar_url: null,
      member_user_ids: ["other", "me"],
      last_message: null,
      unread_count: unread,
      is_pinned: false,
      is_muted: false,
      is_active: true,
      is_archived: false,
      updated_at: "2026-04-20T00:00:00Z",
    } as unknown as Parameters<
      ReturnType<
        typeof useConversationsStore.getState
      >["applyConversationSummaries"]
    >[0][number];
    act(() => {
      useConversationsStore.getState().applyConversationSummaries([conv]);
    });
  }

  function msg(conversationId: string, senderId: string, id = "m1") {
    return {
      id,
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: "text",
      content: "hi",
      metadata: {},
      client_random: 1,
      sent_at: "2026-04-21T10:00:00Z",
      is_deleted: false,
    } as unknown as Parameters<
      ReturnType<typeof useConversationsStore.getState>["applyNewMessage"]
    >[0];
  }

  it("increments unread_count when the message is from someone else", async () => {
    seed("c1", 2);

    await act(async () => {
      await useConversationsStore
        .getState()
        .applyNewMessage(msg("c1", "other"), "me");
    });

    const conv = useConversationsStore
      .getState()
      .conversations.find((c) => c.id === "c1");
    expect(conv?.unread_count).toBe(3);
  });

  it("does NOT increment unread_count when the message is our own echo", async () => {
    seed("c1", 2);

    await act(async () => {
      await useConversationsStore
        .getState()
        .applyNewMessage(msg("c1", "me"), "me");
    });

    const conv = useConversationsStore
      .getState()
      .conversations.find((c) => c.id === "c1");
    expect(conv?.unread_count).toBe(2);
    // Last message still updated (bubble preview refresh)
    expect(conv?.last_message?.sender_id).toBe("me");
  });

  it("falls back to legacy +1 behaviour when no currentUserId is provided", async () => {
    seed("c1", 0);

    await act(async () => {
      await useConversationsStore.getState().applyNewMessage(msg("c1", "me"));
    });

    const conv = useConversationsStore
      .getState()
      .conversations.find((c) => c.id === "c1");
    expect(conv?.unread_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Helpers shared across the rest of the suite
// ---------------------------------------------------------------------------

import { messagingAPI } from "../src/services/messaging/api";
import { cacheService } from "../src/services/messaging/cache";
import { TokenService } from "../src/services/TokenService";
import { NotificationService } from "../src/services/NotificationService";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockedMessagingAPI = messagingAPI as any;
const mockedCacheService = cacheService as any;
const mockedTokenService = TokenService as any;
const mockedNotification = NotificationService as any;
const mockedAsyncStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

const makeConv = (id: string, overrides: Record<string, unknown> = {}) =>
  ({
    id,
    type: "direct",
    display_name: `Conv ${id}`,
    avatar_url: null,
    member_user_ids: ["other", "me"],
    last_message: null,
    unread_count: 0,
    is_pinned: false,
    is_muted: false,
    is_active: true,
    is_archived: false,
    updated_at: "2026-04-20T00:00:00Z",
    ...overrides,
  }) as any;

// Reset all module-level mocks between tests to avoid cross-test pollution.
beforeEach(() => {
  [
    mockedMessagingAPI.getConversations,
    mockedMessagingAPI.getConversation,
    mockedMessagingAPI.getUserInfo,
    mockedMessagingAPI.deleteConversation,
    mockedMessagingAPI.archiveConversation,
    mockedMessagingAPI.unarchiveConversation,
    mockedMessagingAPI.getArchivedConversations,
    mockedCacheService.getConversations,
    mockedCacheService.saveConversations,
    mockedTokenService.getAccessToken,
    mockedTokenService.decodeAccessToken,
    mockedNotification.muteConversation,
    mockedNotification.unmuteConversation,
    mockedAsyncStorage.getItem,
    mockedAsyncStorage.setItem,
    mockedAsyncStorage.removeItem,
  ].forEach((fn) => fn?.mockReset?.());

  // Defaults that keep enrichment quiet
  mockedTokenService.getAccessToken.mockResolvedValue(null);
  mockedTokenService.decodeAccessToken.mockReturnValue(null);
  mockedCacheService.getConversations.mockResolvedValue(null);
  mockedCacheService.saveConversations.mockResolvedValue(undefined);
  mockedMessagingAPI.getConversations.mockResolvedValue([]);
  mockedMessagingAPI.getConversation.mockResolvedValue(null);
  mockedMessagingAPI.getUserInfo.mockResolvedValue(null);
  mockedMessagingAPI.deleteConversation.mockResolvedValue(undefined);
  mockedMessagingAPI.archiveConversation.mockResolvedValue(undefined);
  mockedMessagingAPI.unarchiveConversation.mockResolvedValue(undefined);
  mockedMessagingAPI.getArchivedConversations.mockResolvedValue({
    data: [],
    meta: { count: 0, limit: 50, offset: 0, has_more: false, user_id: "" },
  });
  mockedAsyncStorage.getItem.mockResolvedValue(null);
  mockedAsyncStorage.setItem.mockResolvedValue(undefined);
  mockedAsyncStorage.removeItem.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// fetchConversations / refreshConversations
// ---------------------------------------------------------------------------

describe("conversationsStore — fetchConversations", () => {
  it("shows cached data immediately and then replaces it with the API result", async () => {
    const cached = [makeConv("c-cached")];
    const fresh = [makeConv("c-fresh")];
    mockedCacheService.getConversations.mockResolvedValueOnce(cached);
    mockedMessagingAPI.getConversations.mockResolvedValueOnce(fresh);

    await act(async () => {
      await useConversationsStore.getState().fetchConversations();
    });

    expect(mockedCacheService.saveConversations).toHaveBeenCalledWith(fresh);
    expect(useConversationsStore.getState().conversations).toEqual(fresh);
    expect(useConversationsStore.getState().status).toBe("loaded");
  });

  it("sets status=loading before the fetch and then loaded", async () => {
    mockedMessagingAPI.getConversations.mockResolvedValueOnce([
      makeConv("c-1"),
    ]);

    await act(async () => {
      await useConversationsStore.getState().fetchConversations();
    });

    expect(useConversationsStore.getState().status).toBe("loaded");
    expect(useConversationsStore.getState().error).toBeNull();
  });

  it("on error with no cached data starts the grace period", async () => {
    jest.useFakeTimers();
    mockedCacheService.getConversations.mockResolvedValueOnce(null);
    mockedMessagingAPI.getConversations.mockRejectedValueOnce(
      new Error("boom"),
    );

    await act(async () => {
      await useConversationsStore.getState().fetchConversations();
    });

    expect(useConversationsStore.getState().status).toBe("grace_period");
    expect(useConversationsStore.getState().error).toBe(
      "Failed to load conversations",
    );

    jest.useRealTimers();
  });

  it("on error with existing cached data keeps the cache visible", async () => {
    const cached = [makeConv("c-cached")];
    mockedCacheService.getConversations.mockResolvedValueOnce(cached);
    mockedMessagingAPI.getConversations.mockRejectedValueOnce(
      new Error("boom"),
    );

    await act(async () => {
      await useConversationsStore.getState().fetchConversations();
    });

    expect(useConversationsStore.getState().conversations).toEqual(cached);
    expect(useConversationsStore.getState().error).toBe(
      "Failed to load conversations",
    );
  });
});

describe("conversationsStore — refreshConversations", () => {
  it("replaces the list with the latest API response", async () => {
    const fresh = [makeConv("c-new")];
    mockedMessagingAPI.getConversations.mockResolvedValueOnce(fresh);

    await act(async () => {
      await useConversationsStore.getState().refreshConversations();
    });

    expect(useConversationsStore.getState().conversations).toEqual(fresh);
    expect(mockedCacheService.saveConversations).toHaveBeenCalledWith(fresh);
  });

  it("sets status=empty when the refresh returns an empty list", async () => {
    mockedMessagingAPI.getConversations.mockResolvedValueOnce([]);

    await act(async () => {
      await useConversationsStore.getState().refreshConversations();
    });

    expect(useConversationsStore.getState().status).toBe("empty");
  });

  it("records an error message on network failure without clearing the list", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-keep")]);
    });
    mockedMessagingAPI.getConversations.mockRejectedValueOnce(
      new Error("boom"),
    );

    await act(async () => {
      await useConversationsStore.getState().refreshConversations();
    });

    expect(useConversationsStore.getState().error).toBe(
      "Failed to refresh conversations",
    );
    expect(useConversationsStore.getState().conversations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// applyConversationUpdate
// ---------------------------------------------------------------------------

describe("conversationsStore — applyConversationUpdate", () => {
  it("prepends a brand new conversation", () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
      useConversationsStore
        .getState()
        .applyConversationUpdate(makeConv("c-new"));
    });

    const ids = useConversationsStore.getState().conversations.map((c) => c.id);
    expect(ids[0]).toBe("c-new");
  });

  it("merges into an existing conversation and preserves the display_name", () => {
    act(() => {
      // Seed via applyConversationUpdate to keep the display_name
      useConversationsStore
        .getState()
        .applyConversationUpdate(
          makeConv("c-1", { display_name: "Original Name" }),
        );
      // Update without a display_name — must keep the original
      useConversationsStore
        .getState()
        .applyConversationUpdate(makeConv("c-1", { display_name: undefined }));
    });

    const conv = useConversationsStore
      .getState()
      .conversations.find((c) => c.id === "c-1");
    expect(conv?.display_name).toBe("Original Name");
  });
});

// ---------------------------------------------------------------------------
// applyConversationSummaries
// ---------------------------------------------------------------------------

describe("conversationsStore — applyConversationSummaries", () => {
  it("normalises camelCase WS keys into snake_case state", () => {
    act(() => {
      useConversationsStore.getState().applyConversationSummaries([
        {
          id: "c-ws",
          type: "direct",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          isActive: true,
          isPinned: true,
          isMuted: true,
          isArchived: false,
          unreadCount: 5,
          memberUserIds: ["a", "b"],
        } as any,
      ]);
    });

    const conv = useConversationsStore
      .getState()
      .conversations.find((c) => c.id === "c-ws");
    expect(conv).toMatchObject({
      id: "c-ws",
      is_pinned: true,
      is_muted: true,
      is_archived: false,
      unread_count: 5,
      member_user_ids: ["a", "b"],
    });
  });

  it("preserves local enrichments when a summary lacks them", () => {
    act(() => {
      // Seed via applyConversationUpdate so display_name and avatar_url stick.
      useConversationsStore.getState().applyConversationUpdate(
        makeConv("c-1", {
          display_name: "Enriched",
          avatar_url: "https://cdn/x.png",
        }),
      );
      // Now receive a fresh WS summary without display_name / avatar_url
      useConversationsStore.getState().applyConversationSummaries([
        {
          id: "c-1",
          type: "direct",
          created_at: "2026-01-01",
          updated_at: "2026-02-01",
          is_active: true,
        } as any,
      ]);
    });

    const conv = useConversationsStore
      .getState()
      .conversations.find((c) => c.id === "c-1");
    expect(conv?.display_name).toBe("Enriched");
    expect(conv?.avatar_url).toBe("https://cdn/x.png");
  });
});

// ---------------------------------------------------------------------------
// deleteConversation
// ---------------------------------------------------------------------------

describe("conversationsStore — deleteConversation", () => {
  it("removes the conversation optimistically and reaches status=empty", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });

    await act(async () => {
      await useConversationsStore.getState().deleteConversation("c-1");
    });

    expect(useConversationsStore.getState().conversations).toHaveLength(0);
    expect(useConversationsStore.getState().status).toBe("empty");
    expect(mockedMessagingAPI.deleteConversation).toHaveBeenCalledWith("c-1");
  });

  it("rolls back when the API call fails", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1"), makeConv("c-2")]);
    });
    mockedMessagingAPI.deleteConversation.mockRejectedValueOnce(
      new Error("boom"),
    );

    await expect(
      useConversationsStore.getState().deleteConversation("c-1"),
    ).rejects.toThrow("boom");

    expect(useConversationsStore.getState().conversations).toHaveLength(2);
    expect(useConversationsStore.getState().status).toBe("loaded");
  });
});

// ---------------------------------------------------------------------------
// removeConversationLocal
// ---------------------------------------------------------------------------

describe("conversationsStore — removeConversationLocal", () => {
  it("removes the conversation and cleans up groupAvatars and manuallyUnreadIds", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1"), makeConv("c-2")]);
      useConversationsStore.getState().setGroupAvatars("c-1", [{ name: "A" }]);
    });
    await act(async () => {
      await useConversationsStore.getState().markAsUnread("c-1");
    });

    act(() => {
      useConversationsStore.getState().removeConversationLocal("c-1");
    });

    const state = useConversationsStore.getState();
    expect(state.conversations.map((c) => c.id)).toEqual(["c-2"]);
    expect(state.groupAvatars["c-1"]).toBeUndefined();
    expect(state.manuallyUnreadIds.has("c-1")).toBe(false);
    expect(mockedCacheService.saveConversations).toHaveBeenCalled();
  });

  it("sets status=empty when removing the last conversation", () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-only")]);
      useConversationsStore.getState().removeConversationLocal("c-only");
    });

    expect(useConversationsStore.getState().status).toBe("empty");
  });
});

// ---------------------------------------------------------------------------
// archiveConversation / pinConversation
// ---------------------------------------------------------------------------

describe("conversationsStore — archiveConversation", () => {
  it("flags is_archived optimistically and calls the API", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });

    await act(async () => {
      await useConversationsStore.getState().archiveConversation("c-1");
    });

    expect(mockedMessagingAPI.archiveConversation).toHaveBeenCalledWith("c-1");
    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.is_archived,
    ).toBe(true);
  });

  it("accepts the optimistic state on 422 (already archived)", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });
    const err: Error & { status?: number } = new Error("already archived");
    err.status = 422;
    mockedMessagingAPI.archiveConversation.mockRejectedValueOnce(err);

    await act(async () => {
      await useConversationsStore.getState().archiveConversation("c-1");
    });

    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.is_archived,
    ).toBe(true);
  });

  it("removes the conversation locally on 404 (not found / soft-deleted)", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1"), makeConv("c-2")]);
    });
    const err: Error & { status?: number } = new Error("not found");
    err.status = 404;
    mockedMessagingAPI.archiveConversation.mockRejectedValueOnce(err);

    await expect(
      useConversationsStore.getState().archiveConversation("c-1"),
    ).rejects.toThrow();

    expect(
      useConversationsStore.getState().conversations.map((c) => c.id),
    ).toEqual(["c-2"]);
  });

  it("rolls back on a generic API failure", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });
    mockedMessagingAPI.archiveConversation.mockRejectedValueOnce(
      new Error("boom"),
    );

    await expect(
      useConversationsStore.getState().archiveConversation("c-1"),
    ).rejects.toThrow("boom");

    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.is_archived,
    ).toBe(false);
  });
});

describe("conversationsStore — unarchiveConversation", () => {
  it("removes the entry from archived.items optimistically and calls the API", async () => {
    act(() => {
      // Seed archived list
      useConversationsStore.setState({
        archived: {
          items: [makeConv("c-1", { is_archived: true })],
          status: "loaded",
          error: null,
          offset: 1,
          hasMore: false,
          loadingMore: false,
        },
      });
    });

    await act(async () => {
      await useConversationsStore.getState().unarchiveConversation("c-1");
    });

    expect(mockedMessagingAPI.unarchiveConversation).toHaveBeenCalledWith(
      "c-1",
    );
    expect(useConversationsStore.getState().archived.items).toHaveLength(0);
    // The conversation is restored to the main list with is_archived=false
    const main = useConversationsStore
      .getState()
      .conversations.find((c) => c.id === "c-1");
    expect(main?.is_archived).toBe(false);
  });

  it("rolls back archived items on a generic failure", async () => {
    const archivedItem = makeConv("c-1", { is_archived: true });
    act(() => {
      useConversationsStore.setState({
        archived: {
          items: [archivedItem],
          status: "loaded",
          error: null,
          offset: 1,
          hasMore: false,
          loadingMore: false,
        },
      });
    });
    mockedMessagingAPI.unarchiveConversation.mockRejectedValueOnce(
      new Error("boom"),
    );

    await expect(
      useConversationsStore.getState().unarchiveConversation("c-1"),
    ).rejects.toThrow("boom");

    expect(useConversationsStore.getState().archived.items).toHaveLength(1);
  });

  it("accepts the optimistic state on 422 (already unarchived)", async () => {
    act(() => {
      useConversationsStore.setState({
        archived: {
          items: [makeConv("c-1", { is_archived: true })],
          status: "loaded",
          error: null,
          offset: 1,
          hasMore: false,
          loadingMore: false,
        },
      });
    });
    const err: Error & { status?: number } = new Error("not archived");
    err.status = 422;
    mockedMessagingAPI.unarchiveConversation.mockRejectedValueOnce(err);

    await act(async () => {
      await useConversationsStore.getState().unarchiveConversation("c-1");
    });

    expect(useConversationsStore.getState().archived.items).toHaveLength(0);
  });
});

describe("conversationsStore — applyArchiveBroadcast", () => {
  it("flags is_archived=true on a known main-list conversation", () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
      useConversationsStore.getState().applyArchiveBroadcast("c-1", true);
    });

    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.is_archived,
    ).toBe(true);
  });

  it("restores an archived item to the main list on archived=false", () => {
    const archivedItem = makeConv("c-1", { is_archived: true });
    act(() => {
      useConversationsStore.setState({
        archived: {
          items: [archivedItem],
          status: "loaded",
          error: null,
          offset: 1,
          hasMore: false,
          loadingMore: false,
        },
      });
      useConversationsStore.getState().applyArchiveBroadcast("c-1", false);
    });

    const state = useConversationsStore.getState();
    expect(state.archived.items).toHaveLength(0);
    expect(state.conversations.find((c) => c.id === "c-1")?.is_archived).toBe(
      false,
    );
  });

  it("inserts into archived.items when the broadcast says archived=true and the list was already loaded", () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
      useConversationsStore.setState({
        archived: {
          items: [],
          status: "loaded",
          error: null,
          offset: 0,
          hasMore: false,
          loadingMore: false,
        },
      });
      useConversationsStore.getState().applyArchiveBroadcast("c-1", true);
    });

    expect(
      useConversationsStore.getState().archived.items.map((c) => c.id),
    ).toEqual(["c-1"]);
  });
});

describe("conversationsStore — fetchArchivedConversations / loadMoreArchivedConversations", () => {
  it("loads the first page and stores has_more / offset", async () => {
    mockedMessagingAPI.getArchivedConversations.mockResolvedValueOnce({
      data: [makeConv("c-a"), makeConv("c-b")],
      meta: {
        count: 2,
        limit: 50,
        offset: 0,
        has_more: false,
        user_id: "u-1",
      },
    });

    await act(async () => {
      await useConversationsStore.getState().fetchArchivedConversations();
    });

    const { archived } = useConversationsStore.getState();
    expect(archived.status).toBe("loaded");
    expect(archived.items.map((c) => c.id)).toEqual(["c-a", "c-b"]);
    expect(archived.hasMore).toBe(false);
    expect(archived.offset).toBe(2);
    expect(archived.items.every((c) => c.is_archived === true)).toBe(true);
  });

  it("preserves last_message and unread_count returned by the backend (WHISPR-1263)", async () => {
    const lastMessage = {
      id: "m-1",
      conversation_id: "c-a",
      sender_id: "other",
      content: "hello from archived",
      sent_at: "2026-04-25T10:00:00Z",
    } as unknown as Record<string, unknown>;

    mockedMessagingAPI.getArchivedConversations.mockResolvedValueOnce({
      data: [
        makeConv("c-a", { last_message: lastMessage, unread_count: 3 }),
        makeConv("c-b", { last_message: null, unread_count: 0 }),
      ],
      meta: {
        count: 2,
        limit: 50,
        offset: 0,
        has_more: false,
        user_id: "u-1",
      },
    });

    await act(async () => {
      await useConversationsStore.getState().fetchArchivedConversations();
    });

    const { archived } = useConversationsStore.getState();
    const first = archived.items.find((c) => c.id === "c-a");
    const second = archived.items.find((c) => c.id === "c-b");
    expect(first?.last_message).toEqual(lastMessage);
    expect(first?.unread_count).toBe(3);
    expect(second?.last_message).toBeNull();
    expect(second?.unread_count).toBe(0);
  });

  it("sets status=error when the API call rejects", async () => {
    mockedMessagingAPI.getArchivedConversations.mockRejectedValueOnce(
      new Error("network down"),
    );

    await act(async () => {
      await useConversationsStore.getState().fetchArchivedConversations();
    });

    expect(useConversationsStore.getState().archived.status).toBe("error");
  });

  it("loadMoreArchivedConversations appends the next page and dedupes by id", async () => {
    mockedMessagingAPI.getArchivedConversations
      .mockResolvedValueOnce({
        data: [makeConv("c-a"), makeConv("c-b")],
        meta: {
          count: 4,
          limit: 50,
          offset: 0,
          has_more: true,
          user_id: "u-1",
        },
      })
      .mockResolvedValueOnce({
        data: [makeConv("c-b"), makeConv("c-c")],
        meta: {
          count: 4,
          limit: 50,
          offset: 2,
          has_more: false,
          user_id: "u-1",
        },
      });

    await act(async () => {
      await useConversationsStore.getState().fetchArchivedConversations();
    });
    await act(async () => {
      await useConversationsStore.getState().loadMoreArchivedConversations();
    });

    const { archived } = useConversationsStore.getState();
    expect(archived.items.map((c) => c.id)).toEqual(["c-a", "c-b", "c-c"]);
    expect(archived.hasMore).toBe(false);
  });

  it("loadMoreArchivedConversations is a no-op when hasMore=false", async () => {
    mockedMessagingAPI.getArchivedConversations.mockResolvedValueOnce({
      data: [makeConv("c-a")],
      meta: {
        count: 1,
        limit: 50,
        offset: 0,
        has_more: false,
        user_id: "u-1",
      },
    });
    await act(async () => {
      await useConversationsStore.getState().fetchArchivedConversations();
    });
    mockedMessagingAPI.getArchivedConversations.mockClear();

    await act(async () => {
      await useConversationsStore.getState().loadMoreArchivedConversations();
    });

    expect(mockedMessagingAPI.getArchivedConversations).not.toHaveBeenCalled();
  });
});

describe("conversationsStore — pinConversation", () => {
  it("toggles is_pinned", () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
      useConversationsStore.getState().pinConversation("c-1");
    });

    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.is_pinned,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// muteConversation
// ---------------------------------------------------------------------------

describe("conversationsStore — muteConversation", () => {
  it("mutes and calls NotificationService.muteConversation on success", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });

    await act(async () => {
      await useConversationsStore.getState().muteConversation("c-1");
    });

    expect(mockedNotification.muteConversation).toHaveBeenCalledWith("c-1");
    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.is_muted,
    ).toBe(true);
  });

  it("unmutes a previously-muted conversation", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1", { is_muted: true })]);
    });

    await act(async () => {
      await useConversationsStore.getState().muteConversation("c-1");
    });

    expect(mockedNotification.unmuteConversation).toHaveBeenCalledWith("c-1");
    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.is_muted,
    ).toBe(false);
  });

  it("rolls back the optimistic update on failure", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });
    mockedNotification.muteConversation.mockRejectedValueOnce(
      new Error("fail"),
    );

    await act(async () => {
      await useConversationsStore.getState().muteConversation("c-1");
    });

    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.is_muted,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markAsUnread / clearManualUnread / resetUnreadCount
// ---------------------------------------------------------------------------

describe("conversationsStore — markAsUnread", () => {
  it("adds the id to manuallyUnreadIds and persists it", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });

    await act(async () => {
      await useConversationsStore.getState().markAsUnread("c-1");
    });

    expect(useConversationsStore.getState().manuallyUnreadIds.has("c-1")).toBe(
      true,
    );
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      "@whispr/manually_unread_ids",
      JSON.stringify(["c-1"]),
    );
    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.unread_count,
    ).toBeGreaterThanOrEqual(1);
  });

  it("keeps local state correct even when AsyncStorage fails", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });
    mockedAsyncStorage.setItem.mockRejectedValueOnce(new Error("disk full"));

    await act(async () => {
      await useConversationsStore.getState().markAsUnread("c-1");
    });

    expect(useConversationsStore.getState().manuallyUnreadIds.has("c-1")).toBe(
      true,
    );
  });
});

describe("conversationsStore — clearManualUnread", () => {
  it("removes the id from manuallyUnreadIds and persists the result", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1")]);
    });
    await act(async () => {
      await useConversationsStore.getState().markAsUnread("c-1");
    });
    mockedAsyncStorage.setItem.mockClear();

    await act(async () => {
      await useConversationsStore.getState().clearManualUnread("c-1");
    });

    expect(useConversationsStore.getState().manuallyUnreadIds.has("c-1")).toBe(
      false,
    );
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      "@whispr/manually_unread_ids",
      JSON.stringify([]),
    );
  });

  it("is a no-op when the id is not in the set", async () => {
    mockedAsyncStorage.setItem.mockClear();

    await act(async () => {
      await useConversationsStore.getState().clearManualUnread("c-unknown");
    });

    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe("conversationsStore — resetUnreadCount", () => {
  it("sets unread_count to 0", () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1", { unread_count: 3 })]);
      useConversationsStore.getState().resetUnreadCount("c-1");
    });

    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.unread_count,
    ).toBe(0);
  });

  it("is a no-op when the conversation is unknown", () => {
    act(() => {
      useConversationsStore.getState().resetUnreadCount("missing");
    });
    // No throw, state unchanged
    expect(useConversationsStore.getState().conversations).toEqual([]);
  });

  it("is a no-op when the conversation is already read", () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([makeConv("c-1", { unread_count: 0 })]);
      useConversationsStore.getState().resetUnreadCount("c-1");
    });

    expect(
      useConversationsStore.getState().conversations.find((c) => c.id === "c-1")
        ?.unread_count,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// loadManuallyUnreadIds
// ---------------------------------------------------------------------------

describe("conversationsStore — loadManuallyUnreadIds", () => {
  it("hydrates the Set from AsyncStorage and bumps unread_count for matching conversations", async () => {
    act(() => {
      useConversationsStore
        .getState()
        .applyConversationSummaries([
          makeConv("c-1"),
          makeConv("c-2", { unread_count: 0 }),
        ]);
    });
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(["c-2"]));

    await act(async () => {
      await useConversationsStore.getState().loadManuallyUnreadIds();
    });

    const state = useConversationsStore.getState();
    expect(state.manuallyUnreadIds.has("c-2")).toBe(true);
    expect(
      state.conversations.find((c) => c.id === "c-2")?.unread_count,
    ).toBeGreaterThanOrEqual(1);
  });

  it("tolerates corrupted storage JSON", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce("{not json");

    await expect(
      useConversationsStore.getState().loadManuallyUnreadIds(),
    ).resolves.toBeUndefined();
    expect(useConversationsStore.getState().manuallyUnreadIds.size).toBe(0);
  });

  it("does nothing when there is no stored value", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

    await act(async () => {
      await useConversationsStore.getState().loadManuallyUnreadIds();
    });
    expect(useConversationsStore.getState().manuallyUnreadIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// reset + grace period timers
// ---------------------------------------------------------------------------

describe("conversationsStore — grace period & reset", () => {
  it("transitions to status=empty after the grace period timeout", async () => {
    jest.useFakeTimers();
    mockedCacheService.getConversations.mockResolvedValueOnce(null);
    mockedMessagingAPI.getConversations.mockResolvedValueOnce([]);

    await act(async () => {
      await useConversationsStore.getState().fetchConversations();
    });

    expect(useConversationsStore.getState().status).toBe("grace_period");

    await act(async () => {
      jest.advanceTimersByTime(2_500);
    });

    expect(useConversationsStore.getState().status).toBe("empty");
    jest.useRealTimers();
  });

  it("reset clears the grace period timer", () => {
    jest.useFakeTimers();
    act(() => {
      useConversationsStore.getState()._startGracePeriod();
    });
    expect(useConversationsStore.getState()._gracePeriodTimer).not.toBeNull();

    act(() => {
      useConversationsStore.getState().reset();
    });

    expect(useConversationsStore.getState()._gracePeriodTimer).toBeNull();
    expect(useConversationsStore.getState().status).toBe("loading");
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// applyNewMessage — archived conversations
// ---------------------------------------------------------------------------

describe("conversationsStore — applyNewMessage on archived conversations", () => {
  function archivedMsg(conversationId: string, senderId: string, id = "m1") {
    return {
      id,
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: "text",
      content: "hi",
      metadata: {},
      client_random: 1,
      sent_at: "2026-04-21T10:00:00Z",
      is_deleted: false,
    } as unknown as Parameters<
      ReturnType<typeof useConversationsStore.getState>["applyNewMessage"]
    >[0];
  }

  it("increments unread_count on an archived conversation already in archived.items without surfacing it to the main list", async () => {
    act(() => {
      useConversationsStore.setState({
        archived: {
          items: [makeConv("c-arch", { is_archived: true, unread_count: 1 })],
          status: "loaded",
          error: null,
          offset: 1,
          hasMore: false,
          loadingMore: false,
        },
      });
    });

    await act(async () => {
      await useConversationsStore
        .getState()
        .applyNewMessage(archivedMsg("c-arch", "other"), "me");
    });

    const state = useConversationsStore.getState();
    expect(state.archived.items[0].unread_count).toBe(2);
    expect(state.conversations.find((c) => c.id === "c-arch")).toBeUndefined();
  });

  it("does not bump unread on an own-echo to an archived conversation", async () => {
    act(() => {
      useConversationsStore.setState({
        archived: {
          items: [makeConv("c-arch", { is_archived: true, unread_count: 3 })],
          status: "loaded",
          error: null,
          offset: 1,
          hasMore: false,
          loadingMore: false,
        },
      });
    });

    await act(async () => {
      await useConversationsStore
        .getState()
        .applyNewMessage(archivedMsg("c-arch", "me"), "me");
    });

    expect(
      useConversationsStore.getState().archived.items[0].unread_count,
    ).toBe(3);
  });

  it("inserts a fetched archived-from-the-server conversation into archived.items, not into the main list", async () => {
    act(() => {
      // archived list is loaded but empty
      useConversationsStore.setState({
        archived: {
          items: [],
          status: "loaded",
          error: null,
          offset: 0,
          hasMore: false,
          loadingMore: false,
        },
      });
    });
    mockedMessagingAPI.getConversation.mockResolvedValueOnce(
      makeConv("c-new", { is_archived: true }),
    );

    await act(async () => {
      await useConversationsStore
        .getState()
        .applyNewMessage(archivedMsg("c-new", "other"), "me");
    });

    const state = useConversationsStore.getState();
    expect(state.archived.items.map((c) => c.id)).toEqual(["c-new"]);
    expect(state.conversations.find((c) => c.id === "c-new")).toBeUndefined();
  });

  it("does not silently drop a fetched archived conversation when the archived list has not been loaded yet", async () => {
    // archived.status = "idle" (default after reset) — we don't insert because
    // the badge would be inconsistent. The conv is simply ignored until the
    // user opens the archived screen.
    mockedMessagingAPI.getConversation.mockResolvedValueOnce(
      makeConv("c-new", { is_archived: true }),
    );

    await act(async () => {
      await useConversationsStore
        .getState()
        .applyNewMessage(archivedMsg("c-new", "other"), "me");
    });

    const state = useConversationsStore.getState();
    expect(state.archived.items).toHaveLength(0);
    expect(state.conversations.find((c) => c.id === "c-new")).toBeUndefined();
  });
});
