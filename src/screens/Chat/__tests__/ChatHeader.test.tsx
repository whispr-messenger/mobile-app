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

jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return {
    BlurView: ({ children, style }: any) => (
      <View style={style}>{children}</View>
    ),
  };
});

jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa" },
    }),
  }),
}));

jest.mock("./src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));

import { ChatHeader } from "./src/screens/Chat/ChatHeader";

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

  it("opens a menu offering audio and video when calls are available", () => {
    mockCanGoBack.mockReturnValue(true);
    const onAudio = jest.fn();
    const onVideo = jest.fn();

    const { UNSAFE_getAllByType, queryByLabelText } = render(
      <ChatHeader
        conversationName="Alice"
        conversationType="direct"
        onAudioCallPress={onAudio}
        onVideoCallPress={onVideo}
        callsAvailable
      />,
    );

    const TouchableOpacity = require("react-native").TouchableOpacity;
    // touchables[0] = back, [1] = title area, [2] = call button
    const callButton = UNSAFE_getAllByType(TouchableOpacity)[2];
    fireEvent.press(callButton);

    // Tapping the call button should not fire either handler directly —
    // it should reveal the menu items so the user can pick.
    expect(onAudio).not.toHaveBeenCalled();
    expect(onVideo).not.toHaveBeenCalled();

    fireEvent.press(queryByLabelText("Appel audio")!);
    expect(onAudio).toHaveBeenCalledTimes(1);
  });

  it("fires the fallback handler directly when calls are unavailable (so the parent can show a toast) without opening the menu", () => {
    mockCanGoBack.mockReturnValue(true);
    const onAudio = jest.fn();
    const onVideo = jest.fn();

    const { UNSAFE_getAllByType, queryByLabelText } = render(
      <ChatHeader
        conversationName="Alice"
        conversationType="direct"
        onAudioCallPress={onAudio}
        onVideoCallPress={onVideo}
        callsAvailable={false}
      />,
    );

    const TouchableOpacity = require("react-native").TouchableOpacity;
    const callButton = UNSAFE_getAllByType(TouchableOpacity)[2];
    fireEvent.press(callButton);

    // The button stays clickable but bypasses the menu and triggers the
    // video handler so the parent can surface the unavailable-toast.
    expect(onVideo).toHaveBeenCalledTimes(1);
    expect(onAudio).not.toHaveBeenCalled();
    expect(queryByLabelText("Appel audio")).toBeNull();

    const callStyle = Array.isArray(callButton.props.style)
      ? Object.assign({}, ...callButton.props.style.filter(Boolean))
      : callButton.props.style;
    expect(callStyle.opacity).toBe(0.4);
  });
});
