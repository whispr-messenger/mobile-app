import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { primary: "#000", secondary: "#222", tertiary: "#333" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

jest.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ userId: "me" }),
}));

jest.mock("../src/store/presenceStore", () => ({
  usePresenceStore: (sel: any) => sel({ onlineUserIds: new Set(["other"]) }),
}));

const mockSetGroupAvatars = jest.fn();
const mockApplyConversationUpdate = jest.fn();
jest.mock("../src/store/conversationsStore", () => ({
  useConversationsStore: (sel: any) =>
    sel({
      groupAvatars: {},
      setGroupAvatars: mockSetGroupAvatars,
      applyConversationUpdate: mockApplyConversationUpdate,
    }),
}));

jest.mock("../src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));

const mockGetConversation = jest.fn().mockResolvedValue(null);
const mockGetConversationMembers = jest.fn().mockResolvedValue([]);
const mockGetUserInfo = jest.fn().mockResolvedValue(null);
jest.mock("../src/services/messaging/api", () => ({
  messagingAPI: {
    getConversation: (...args: any[]) => mockGetConversation(...args),
    getConversationMembers: (...args: any[]) => mockGetConversationMembers(...args),
    // Group rendering now resolves the last sender's display name lazily.
    getUserInfo: (...args: any[]) => mockGetUserInfo(...args),
  },
}));

jest.mock("../src/utils", () => ({
  getConversationDisplayName: (c: any) => c.display_name || "Conversation",
}));

import { ConversationItem } from "../src/components/Chat/ConversationItem";

const directConvo: any = {
  id: "c-direct",
  type: "direct",
  display_name: "Alice",
  member_user_ids: ["me", "other"],
  is_active: true,
  last_message: { content: "Hey", sent_at: new Date(Date.now() - 30 * 60_000).toISOString() },
  updated_at: new Date().toISOString(),
};

const groupConvo: any = {
  id: "c-group",
  type: "group",
  display_name: "Team",
  member_user_ids: ["me", "u1", "u2"],
  is_active: true,
  metadata: {},
  last_message: { content: "Welcome", sent_at: new Date().toISOString() },
};

describe("ConversationItem", () => {
  beforeEach(() => {
    mockSetGroupAvatars.mockClear();
    mockApplyConversationUpdate.mockClear();
    mockGetConversation.mockClear();
    mockGetConversationMembers.mockClear();
  });

  it("renders the display name and last message preview", () => {
    const { getByText } = render(
      <ConversationItem conversation={directConvo} onPress={() => {}} />,
    );
    expect(getByText("Alice")).toBeTruthy();
  });

  it("calls onPress with the conversation id when tapped", () => {
    const onPress = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ConversationItem conversation={directConvo} onPress={onPress} />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(ts[0]);
    expect(onPress).toHaveBeenCalledWith("c-direct");
  });

  it("renders for a group conversation", () => {
    const { getByText } = render(
      <ConversationItem conversation={groupConvo} onPress={() => {}} />,
    );
    expect(getByText("Team")).toBeTruthy();
  });
});
