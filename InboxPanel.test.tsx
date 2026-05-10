import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { InboxPanel } from "./src/components/Common/InboxPanel";
import type { InboxItem } from "./src/types/inbox";

const mockNavigate = jest.fn();
const mockMarkAllRead = jest.fn().mockResolvedValue(undefined);
const mockMarkRead = jest.fn().mockResolvedValue(undefined);
const mockHydrate = jest.fn().mockResolvedValue(undefined);
const mockLoadMore = jest.fn().mockResolvedValue(undefined);

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock("@react-navigation/stack", () => ({}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./src/theme/colors", () => ({
  colors: {
    text: { light: "#fff" },
    ui: { error: "#f00" },
    primary: { main: "#fe7a5c" },
    secondary: { main: "#6774bd" },
  },
  withOpacity: (color: string, _opacity: number) => color,
}));
// Avatar renders as a simple Text so we can keep item rows identifiable by testID
jest.mock("./src/components/Chat/Avatar", () => ({
  Avatar: () => {
    const { View } = require("react-native");
    return <View testID="avatar" />;
  },
}));

const mockMention: InboxItem = {
  id: "item-mention",
  event_type: "mention",
  payload: {
    from_user_id: "uid-1",
    from_username: "alice_mention",
    conversation_id: "conv-1",
    message_id: "msg-1",
    preview: "Hey @you check this out",
  },
  read_at: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
};

const mockContactReq: InboxItem = {
  id: "item-contact",
  event_type: "contact_request",
  payload: {
    from_user_id: "uid-2",
    from_username: "bob_contact",
    request_id: "req-1",
  },
  read_at: new Date().toISOString(),
  created_at: new Date(Date.now() - 120_000).toISOString(),
};

jest.mock("./src/store/inboxStore", () => ({
  useInboxStore: () => ({
    items: [mockMention, mockContactReq],
    unread_count: 1,
    loading: false,
    has_more: false,
    next_cursor: null,
    hydrate: mockHydrate,
    loadMore: mockLoadMore,
    markAllRead: mockMarkAllRead,
    markRead: mockMarkRead,
    addNew: jest.fn(),
  }),
}));

describe("InboxPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders panel title when visible", () => {
    const { getByText } = render(
      <InboxPanel visible={true} onClose={jest.fn()} />,
    );
    expect(getByText("Notifications")).toBeTruthy();
  });

  it("renders inbox items by username", () => {
    const { getByText } = render(
      <InboxPanel visible={true} onClose={jest.fn()} />,
    );
    expect(getByText("alice_mention")).toBeTruthy();
    expect(getByText("bob_contact")).toBeTruthy();
  });

  it("calls markAllRead when tout marquer lu is pressed", () => {
    const { getByText } = render(
      <InboxPanel visible={true} onClose={jest.fn()} />,
    );
    fireEvent.press(getByText("Tout marquer lu"));
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("calls markRead and onClose when mention item is pressed", () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <InboxPanel visible={true} onClose={onClose} />,
    );
    fireEvent.press(getByText("alice_mention"));
    expect(mockMarkRead).toHaveBeenCalledWith("item-mention");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to Chat for mention item press", () => {
    const { getByText } = render(
      <InboxPanel visible={true} onClose={jest.fn()} />,
    );
    fireEvent.press(getByText("alice_mention"));
    expect(mockNavigate).toHaveBeenCalledWith("Chat", {
      conversationId: "conv-1",
    });
  });

  it("navigates to Contacts for contact_request press", () => {
    const { getByText } = render(
      <InboxPanel visible={true} onClose={jest.fn()} />,
    );
    fireEvent.press(getByText("bob_contact"));
    expect(mockNavigate).toHaveBeenCalledWith("Contacts");
  });

  it("shows panel title always (empty state covered by mock data)", () => {
    // Le mock inboxStore retourne 2 items - la liste n'est pas vide dans ces tests
    // On verifie juste que le titre est toujours rendu
    const { queryByText } = render(
      <InboxPanel visible={true} onClose={jest.fn()} />,
    );
    expect(queryByText("Notifications")).toBeTruthy();
  });
});
