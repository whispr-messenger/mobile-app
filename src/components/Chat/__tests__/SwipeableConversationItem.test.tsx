/**
 * Tests for SwipeableConversationItem.
 *
 * Couvre :
 * - rendering with various callback combinations
 * - editMode shortcut (renders bare ConversationItem)
 * - onPress dispatch + swipe-state guard
 * - left/right actions render only the buttons whose callbacks were passed
 * - action buttons invoke their callbacks
 */

import React from "react";
import { Animated } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

// Replace the inner ConversationItem with a lightweight stub that exposes
// a testID we can drive via fireEvent.press.
jest.mock("../ConversationItem", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TouchableOpacity, Text } = require("react-native");
  const Stub = ({
    conversation,
    onPress,
    isSelected,
    editMode,
  }: {
    conversation: { id: string };
    onPress: (id: string) => void;
    isSelected?: boolean;
    editMode?: boolean;
  }) => (
    <TouchableOpacity
      testID={`conv-${conversation.id}`}
      onPress={() => onPress(conversation.id)}
    >
      <Text>{`conv-${conversation.id}|selected=${!!isSelected}|edit=${!!editMode}`}</Text>
    </TouchableOpacity>
  );
  return { __esModule: true, default: Stub };
});

// Expose swipe lifecycle hooks + the action renderers via globalThis so tests
// can drive the component's internal state from outside the React tree.
jest.mock("react-native-gesture-handler", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  const Swipeable = React.forwardRef(
    (
      props: Record<string, unknown> & {
        children?: React.ReactNode;
        renderRightActions?: (p: unknown, d: unknown) => React.ReactNode;
        renderLeftActions?: (p: unknown, d: unknown) => React.ReactNode;
        onSwipeableOpenStartDrag?: () => void;
        onSwipeableWillOpen?: () => void;
        onSwipeableClose?: () => void;
      },
      _ref: unknown,
    ) => {
      const fakeAnim: unknown = { interpolate: () => fakeAnim };
      (globalThis as Record<string, unknown>).__lastSwipeProps = props;
      return (
        <View testID="swipeable">
          <View testID="right-actions">
            {props.renderRightActions?.(fakeAnim, fakeAnim)}
          </View>
          <View testID="left-actions">
            {props.renderLeftActions?.(fakeAnim, fakeAnim)}
          </View>
          {props.children}
        </View>
      );
    },
  );
  Swipeable.displayName = "Swipeable";
  return { Swipeable };
});

function getSwipeProps() {
  return (
    globalThis as {
      __lastSwipeProps?: {
        onSwipeableOpenStartDrag?: () => void;
        onSwipeableWillOpen?: () => void;
        onSwipeableClose?: () => void;
      };
    }
  ).__lastSwipeProps;
}

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium", Heavy: "Heavy" },
}));

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Noop: React.FC<Record<string, unknown>> = (props) =>
    React.createElement("Icon", props);
  return new Proxy({ __esModule: true, default: Noop }, { get: () => Noop });
});

// Zustand store: factory must inline (babel hoist). Expose the Set via a
// global so we can mutate it from tests.
jest.mock("../../../store/conversationsStore", () => {
  const mockManuallyUnreadIds = new Set<string>();
  (
    globalThis as { __mockManuallyUnreadIds?: Set<string> }
  ).__mockManuallyUnreadIds = mockManuallyUnreadIds;
  return {
    useConversationsStore: (
      selector: (state: { manuallyUnreadIds: Set<string> }) => unknown,
    ) => selector({ manuallyUnreadIds: mockManuallyUnreadIds }),
  };
});
const manuallyUnreadIds = (
  globalThis as { __mockManuallyUnreadIds: Set<string> }
).__mockManuallyUnreadIds;

import { SwipeableConversationItem } from "../SwipeableConversationItem";

beforeEach(() => {
  jest.clearAllMocks();
  manuallyUnreadIds.clear();
});

const conv = {
  id: "c-1",
  unread_count: 0,
} as unknown as import("../../../types/messaging").Conversation;

describe("SwipeableConversationItem — edit mode", () => {
  it("renders the bare ConversationItem when editMode is set", () => {
    const onPress = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <SwipeableConversationItem
        conversation={conv}
        onPress={onPress}
        editMode
        isSelected
      />,
    );
    expect(getByTestId("conv-c-1")).toBeTruthy();
    expect(queryByTestId("swipeable")).toBeNull();
  });
});

describe("SwipeableConversationItem — normal rendering", () => {
  it("renders inside Swipeable with the conversation child", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SwipeableConversationItem conversation={conv} onPress={onPress} />,
    );
    expect(getByTestId("swipeable")).toBeTruthy();
    expect(getByTestId("conv-c-1")).toBeTruthy();
  });

  it("dispatches onPress when not swiping", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SwipeableConversationItem conversation={conv} onPress={onPress} />,
    );
    fireEvent.press(getByTestId("conv-c-1"));
    expect(onPress).toHaveBeenCalledWith("c-1");
  });
});

describe("SwipeableConversationItem — actions", () => {
  function findTouchablesUnder(
    tree: ReturnType<typeof render>,
    testId: string,
  ): Array<{ props: { onPress?: () => void } }> {
    const root = tree.getByTestId(testId);
    const out: Array<{ props: { onPress?: () => void } }> = [];
    const visit = (node: {
      props?: { onPress?: () => void };
      children?: unknown[] | unknown;
    }) => {
      if (node.props && typeof node.props.onPress === "function") {
        out.push(node as { props: { onPress?: () => void } });
      }
      const children = node.children;
      if (Array.isArray(children)) {
        for (const c of children) visit(c as Parameters<typeof visit>[0]);
      } else if (children && typeof children === "object") {
        visit(children as Parameters<typeof visit>[0]);
      }
    };
    visit(root as Parameters<typeof visit>[0]);
    return out;
  }

  it("right-actions render and dispatch their callbacks while swiping", () => {
    const onDelete = jest.fn();
    const onArchive = jest.fn();
    const onMute = jest.fn();
    const tree = render(
      <SwipeableConversationItem
        conversation={conv}
        onPress={jest.fn()}
        onDelete={onDelete}
        onArchive={onArchive}
        onMute={onMute}
      />,
    );
    act(() => {
      getSwipeProps()?.onSwipeableOpenStartDrag?.();
    });
    act(() => {
      getSwipeProps()?.onSwipeableWillOpen?.();
    });
    const touchables = findTouchablesUnder(tree, "right-actions");
    for (const t of touchables) {
      (t as unknown as { props: { onPress: () => void } }).props.onPress();
    }
    expect(onArchive).toHaveBeenCalledWith("c-1");
    expect(onMute).toHaveBeenCalledWith("c-1");
    expect(onDelete).toHaveBeenCalledWith("c-1");

    act(() => {
      getSwipeProps()?.onSwipeableClose?.();
    });
  });

  it("left-actions render pin + toggleRead and dispatch callbacks while swiping", () => {
    const onPin = jest.fn();
    const onToggleRead = jest.fn();
    manuallyUnreadIds.add("c-1");
    const tree = render(
      <SwipeableConversationItem
        conversation={conv}
        onPress={jest.fn()}
        onPin={onPin}
        onToggleRead={onToggleRead}
      />,
    );
    act(() => {
      getSwipeProps()?.onSwipeableOpenStartDrag?.();
    });
    const touchables = findTouchablesUnder(tree, "left-actions");
    for (const t of touchables) {
      (t as unknown as { props: { onPress: () => void } }).props.onPress();
    }
    expect(onPin).toHaveBeenCalledWith("c-1");
    expect(onToggleRead).toHaveBeenCalledWith("c-1", true);
  });

  it("closes the swipe and skips onPress when tapped while swiping", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SwipeableConversationItem
        conversation={conv}
        onPress={onPress}
        onDelete={jest.fn()}
      />,
    );
    act(() => {
      getSwipeProps()?.onSwipeableOpenStartDrag?.();
    });
    fireEvent.press(getByTestId("conv-c-1"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
