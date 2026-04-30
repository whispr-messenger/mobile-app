import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium", Heavy: "heavy" },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  return {
    Swipeable: React.forwardRef(
      (
        {
          children,
          renderRightActions,
          renderLeftActions,
        }: any,
        _ref: any,
      ) => {
        // Render the children alongside the action panels so all branches are
        // exercised in unit tests.
        const Animated = require("react-native").Animated;
        const progress = new Animated.Value(1);
        const dragX = new Animated.Value(0);
        return React.createElement(
          require("react-native").View,
          {},
          renderRightActions ? renderRightActions(progress, dragX) : null,
          renderLeftActions ? renderLeftActions(progress, dragX) : null,
          children,
        );
      },
    ),
  };
});

jest.mock("../src/components/Chat/ConversationItem", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { __esModule: true, default: () => React.createElement(Text, null, "convoItem") };
});

import { SwipeableConversationItem } from "../src/components/Chat/SwipeableConversationItem";

const conversation = {
  id: "c1",
  display_name: "Alice",
  type: "direct",
} as any;

describe("SwipeableConversationItem", () => {
  it("renders the inner ConversationItem in default mode", () => {
    const { getByText } = render(
      <SwipeableConversationItem conversation={conversation} onPress={() => {}} />,
    );
    expect(getByText("convoItem")).toBeTruthy();
  });

  it("renders the inner ConversationItem in edit mode without action buttons", () => {
    const { getByText, queryByText } = render(
      <SwipeableConversationItem
        conversation={conversation}
        onPress={() => {}}
        editMode
        isSelected
      />,
    );
    expect(getByText("convoItem")).toBeTruthy();
    expect(queryByText("Archiver")).toBeNull();
  });

  it("renders all right actions when handlers are provided", () => {
    const { getByText } = render(
      <SwipeableConversationItem
        conversation={conversation}
        onPress={() => {}}
        onArchive={() => {}}
        onMute={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(getByText("Archiver")).toBeTruthy();
    expect(getByText("Muet")).toBeTruthy();
    expect(getByText("Supprimer")).toBeTruthy();
  });

  it("renders left actions when pin and unread handlers are provided", () => {
    const { getByText } = render(
      <SwipeableConversationItem
        conversation={conversation}
        onPress={() => {}}
        onPin={() => {}}
        onUnread={() => {}}
      />,
    );
    expect(getByText("Épingler")).toBeTruthy();
    expect(getByText("Non lu")).toBeTruthy();
  });

  it("invokes onArchive with the conversation id when archive is pressed", () => {
    const onArchive = jest.fn();
    const { getByText } = render(
      <SwipeableConversationItem
        conversation={conversation}
        onPress={() => {}}
        onArchive={onArchive}
      />,
    );
    fireEvent.press(getByText("Archiver"));
    expect(onArchive).toHaveBeenCalledWith("c1");
  });

  it.each([
    ["Muet", "onMute"],
    ["Supprimer", "onDelete"],
    ["Épingler", "onPin"],
    ["Non lu", "onUnread"],
  ])("invokes %s handler when its action is pressed", (label, handlerName) => {
    const handler = jest.fn();
    const props: any = {
      conversation,
      onPress: () => {},
      [handlerName]: handler,
    };
    const { getByText } = render(<SwipeableConversationItem {...props} />);
    fireEvent.press(getByText(label));
    expect(handler).toHaveBeenCalledWith("c1");
  });
});
