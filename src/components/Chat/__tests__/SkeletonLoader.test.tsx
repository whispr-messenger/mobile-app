import React from "react";
import { render } from "@testing-library/react-native";
import {
  ConversationSkeleton,
  ContactItemSkeleton,
  MessageBubbleSkeleton,
  InboxItemSkeleton,
} from "./src/components/Chat/SkeletonLoader";

// react-native-reanimated : stub minimal pour les tests
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (cb: any) => ({}),
    withRepeat: (v: any) => v,
    withTiming: (v: any) => v,
    Easing: { inOut: () => null, ease: null },
  };
});

describe("ConversationSkeleton", () => {
  it("se monte sans erreur", () => {
    const { toJSON } = render(<ConversationSkeleton />);
    expect(toJSON()).not.toBeNull();
  });
});

describe("ContactItemSkeleton", () => {
  it("se monte sans erreur", () => {
    const { toJSON } = render(<ContactItemSkeleton />);
    expect(toJSON()).not.toBeNull();
  });
});

describe("MessageBubbleSkeleton", () => {
  it("se monte sans erreur avec align left par defaut", () => {
    const { toJSON } = render(<MessageBubbleSkeleton />);
    expect(toJSON()).not.toBeNull();
  });

  it("se monte sans erreur avec align right", () => {
    const { toJSON } = render(<MessageBubbleSkeleton align="right" />);
    expect(toJSON()).not.toBeNull();
  });
});

describe("InboxItemSkeleton", () => {
  it("se monte sans erreur", () => {
    const { toJSON } = render(<InboxItemSkeleton />);
    expect(toJSON()).not.toBeNull();
  });
});
