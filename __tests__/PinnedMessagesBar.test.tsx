import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa" },
    }),
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

import { PinnedMessagesBar } from "../src/components/Chat/PinnedMessagesBar";

describe("PinnedMessagesBar", () => {
  const baseMessage = {
    id: "p1",
    messageId: "m1",
    message: { id: "m1", content: "Hello world" },
  } as any;

  it("returns null when there are no pinned messages", () => {
    const { toJSON } = render(
      <PinnedMessagesBar
        pinnedMessages={[]}
        onMessagePress={() => {}}
        onClose={() => {}}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the count and a preview of each pinned message", () => {
    const { getByText } = render(
      <PinnedMessagesBar
        pinnedMessages={[baseMessage]}
        onMessagePress={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByText("Messages épinglés (1)")).toBeTruthy();
    expect(getByText("Hello world")).toBeTruthy();
  });

  it("renders fallback text when message content is missing", () => {
    const { getByText } = render(
      <PinnedMessagesBar
        pinnedMessages={[{ id: "p1", messageId: "m1", message: undefined } as any]}
        onMessagePress={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByText("[Message supprimé]")).toBeTruthy();
  });

  it("invokes onMessagePress with the message id when pressed", () => {
    const onMessagePress = jest.fn();
    const { getByText } = render(
      <PinnedMessagesBar
        pinnedMessages={[baseMessage]}
        onMessagePress={onMessagePress}
        onClose={() => {}}
      />,
    );
    fireEvent.press(getByText("Hello world"));
    expect(onMessagePress).toHaveBeenCalledWith("m1");
  });

  it("does not invoke onMessagePress when there is no message id", () => {
    const onMessagePress = jest.fn();
    const { getByText } = render(
      <PinnedMessagesBar
        pinnedMessages={[
          { id: "p1", messageId: undefined, message: { content: "x" } } as any,
        ]}
        onMessagePress={onMessagePress}
        onClose={() => {}}
      />,
    );
    fireEvent.press(getByText("x"));
    expect(onMessagePress).not.toHaveBeenCalled();
  });

  it("invokes onClose when the close button is pressed", () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <PinnedMessagesBar
        pinnedMessages={[baseMessage]}
        onMessagePress={() => {}}
        onClose={onClose}
      />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    // First touchable is the close button (header).
    fireEvent.press(touchables[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
