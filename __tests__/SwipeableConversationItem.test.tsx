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
          onSwipeableOpenStartDrag,
        }: any,
        _ref: any,
      ) => {
        // The real component gates renderRight/Left on an internal `isSwiping`
        // flag flipped by onSwipeableOpenStartDrag. Trigger it synchronously so
        // the action panels render in tests.
        const [primed, setPrimed] = React.useState(false);
        React.useLayoutEffect(() => {
          onSwipeableOpenStartDrag?.();
          setPrimed(true);
        }, []);
        if (!primed) {
          return React.createElement(require("react-native").View, {}, children);
        }
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
    const { getByLabelText } = render(
      <SwipeableConversationItem
        conversation={conversation}
        onPress={() => {}}
        onArchive={() => {}}
        onMute={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(getByLabelText("Archiver")).toBeTruthy();
    expect(getByLabelText("Muet")).toBeTruthy();
    expect(getByLabelText("Supprimer")).toBeTruthy();
  });

  it("renders left actions when pin and unread handlers are provided", () => {
    const { getByLabelText } = render(
      <SwipeableConversationItem
        conversation={conversation}
        onPress={() => {}}
        onPin={() => {}}
        onToggleRead={() => {}}
      />,
    );
    expect(getByLabelText("Épingler")).toBeTruthy();
    expect(getByLabelText("Non lu")).toBeTruthy();
  });

  it("invokes onArchive with the conversation id when archive is pressed", () => {
    const onArchive = jest.fn();
    const { getByLabelText } = render(
      <SwipeableConversationItem
        conversation={conversation}
        onPress={() => {}}
        onArchive={onArchive}
      />,
    );
    fireEvent.press(getByLabelText("Archiver"));
    expect(onArchive).toHaveBeenCalledWith("c1");
  });

  it.each([
    ["Muet", "onMute"],
    ["Supprimer", "onDelete"],
    ["Épingler", "onPin"],
    ["Non lu", "onToggleRead"],
  ])("invokes %s handler when its action is pressed", (label, handlerName) => {
    const handler = jest.fn();
    const props: any = {
      conversation,
      onPress: () => {},
      [handlerName]: handler,
    };
    const { getByLabelText } = render(<SwipeableConversationItem {...props} />);
    fireEvent.press(getByLabelText(label));
    // onToggleRead receives (id, isUnread); other handlers receive (id).
    if (handlerName === "onToggleRead") {
      expect(handler).toHaveBeenCalledWith("c1", expect.any(Boolean));
    } else {
      expect(handler).toHaveBeenCalledWith("c1");
    }
  });
});
