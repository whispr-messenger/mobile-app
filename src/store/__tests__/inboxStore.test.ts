/* eslint-disable @typescript-eslint/no-explicit-any */

import type { InboxItem } from "./src/types/inbox";

jest.mock("./src/services/inboxApi", () => ({
  inboxApi: {
    fetchInbox: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    executionEnvironment: "standalone",
    appOwnership: "standalone",
    expoConfig: { extra: { apiBaseUrl: "https://test.example.com" } },
  },
}));

import { useInboxStore } from "./src/store/inboxStore";
import { inboxApi } from "./src/services/inboxApi";

const mockInboxApi = inboxApi as {
  fetchInbox: jest.Mock;
  markRead: jest.Mock;
  markAllRead: jest.Mock;
};

const mockItem: InboxItem = {
  id: "item-1",
  event_type: "mention",
  payload: {
    from_user_id: "uid-1",
    from_username: "alice",
    conversation_id: "conv-1",
    message_id: "msg-1",
    preview: "hello",
  },
  read_at: null,
  created_at: new Date().toISOString(),
};

describe("useInboxStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useInboxStore.setState({
      items: [],
      unread_count: 0,
      loading: false,
      has_more: false,
      next_cursor: null,
    });
  });

  it("hydrate populates items and unread_count from API", async () => {
    mockInboxApi.fetchInbox.mockResolvedValue({
      items: [mockItem],
      next_cursor: null,
      unread_count: 1,
    });

    await useInboxStore.getState().hydrate();

    const state = useInboxStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.unread_count).toBe(1);
    expect(state.loading).toBe(false);
  });

  it("addNew prepends item and increments unread_count", () => {
    useInboxStore.setState({ items: [], unread_count: 0 });
    useInboxStore.getState().addNew(mockItem);

    const state = useInboxStore.getState();
    expect(state.items[0].id).toBe("item-1");
    expect(state.unread_count).toBe(1);
  });

  it("markAllRead sets unread_count to 0 and marks all items read", async () => {
    mockInboxApi.markAllRead.mockResolvedValue({ marked: 1 });
    useInboxStore.setState({ items: [{ ...mockItem }], unread_count: 1 });

    await useInboxStore.getState().markAllRead();

    const state = useInboxStore.getState();
    expect(state.unread_count).toBe(0);
    expect(state.items[0].read_at).not.toBeNull();
  });

  it("markRead marks single item read and decrements unread_count", async () => {
    mockInboxApi.markRead.mockResolvedValue({ marked: 1 });
    useInboxStore.setState({ items: [{ ...mockItem }], unread_count: 1 });

    await useInboxStore.getState().markRead("item-1");

    const state = useInboxStore.getState();
    expect(state.unread_count).toBe(0);
    expect(state.items[0].read_at).not.toBeNull();
  });
});
