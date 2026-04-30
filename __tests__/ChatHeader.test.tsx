/**
 * Tests for ChatHeader — specifically the back-button behaviour on web,
 * where deep-linking or a page refresh can leave the navigation stack
 * without a previous entry, making `navigation.goBack()` a no-op.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    canGoBack: mockCanGoBack,
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ testID }: any) => null,
}));

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa" },
    }),
  }),
}));

jest.mock("../src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));

import { ChatHeader } from "../src/screens/Chat/ChatHeader";

describe("ChatHeader back button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls navigation.goBack() when history is available", () => {
    mockCanGoBack.mockReturnValue(true);

    const { UNSAFE_getAllByType } = render(
      <ChatHeader conversationName="Alice" conversationType="direct" />,
    );

    // The back TouchableOpacity is the first touchable in the header
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[0]);

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates to ConversationsList when there is no history (web refresh / deep-link)", () => {
    mockCanGoBack.mockReturnValue(false);

    const { UNSAFE_getAllByType } = render(
      <ChatHeader conversationName="Alice" conversationType="direct" />,
    );

    const TouchableOpacity = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[0]);

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("ConversationsList");
  });
});
