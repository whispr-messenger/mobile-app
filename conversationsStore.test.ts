/**
 * Tests for conversations Zustand store — groupAvatars cache.
 * Covers the migration from the module-level Map to persistent store state.
 */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("./src/services/messaging/api", () => ({
  messagingAPI: {
    getConversations: jest.fn().mockResolvedValue([]),
    getConversation: jest.fn().mockResolvedValue(null),
    getConversationMembers: jest.fn().mockResolvedValue([]),
    getUserInfo: jest.fn().mockResolvedValue(null),
    deleteConversation: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("./src/services/messaging/cache", () => ({
  cacheService: {
    getConversations: jest.fn().mockResolvedValue(null),
    saveConversations: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("./src/services/TokenService", () => ({
  TokenService: {
    getAccessToken: jest.fn().mockResolvedValue(null),
    decodeAccessToken: jest.fn().mockReturnValue(null),
  },
}));

jest.mock("./src/services/NotificationService", () => ({
  NotificationService: {
    muteConversation: jest.fn().mockResolvedValue(undefined),
    unmuteConversation: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("./src/utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { useConversationsStore } from "./src/store/conversationsStore";
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
    expect(useConversationsStore.getState().groupAvatars["conv-1"]).toBeDefined();

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
      ReturnType<typeof useConversationsStore.getState>["applyConversationSummaries"]
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
