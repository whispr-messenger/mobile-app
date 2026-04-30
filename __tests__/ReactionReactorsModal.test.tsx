import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
    getFontSize: () => 16,
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));

import { ReactionReactorsModal } from "../src/components/Chat/ReactionReactorsModal";

const reactors = [
  { id: "r1", user_id: "u1", emoji: "❤️" } as any,
  { id: "r2", user_id: "u2", emoji: "❤️" } as any,
  // Same user, dedup expected
  { id: "r3", user_id: "u1", emoji: "❤️" } as any,
];

const resolveName = (uid: string) => `User ${uid}`;

describe("ReactionReactorsModal", () => {
  it("renders the emoji and the participant count", () => {
    const { getByText } = render(
      <ReactionReactorsModal
        visible={true}
        emoji="❤️"
        reactors={reactors}
        resolveName={resolveName}
        onClose={() => {}}
      />,
    );
    expect(getByText("❤️")).toBeTruthy();
    // dedup leaves 2 unique users → "2 participants"
    expect(getByText("2 participants")).toBeTruthy();
    expect(getByText("User u1")).toBeTruthy();
    expect(getByText("User u2")).toBeTruthy();
  });

  it("uses singular form when there is exactly one participant", () => {
    const { getByText } = render(
      <ReactionReactorsModal
        visible={true}
        emoji="🎉"
        reactors={[{ id: "r1", user_id: "u1", emoji: "🎉" } as any]}
        resolveName={resolveName}
        onClose={() => {}}
      />,
    );
    expect(getByText("1 participant")).toBeTruthy();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ReactionReactorsModal
        visible={true}
        emoji="🎉"
        reactors={reactors}
        resolveName={resolveName}
        onClose={onClose}
      />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    // ts: [backdrop, closeBtn]. Press the closeBtn (last one).
    fireEvent.press(ts[ts.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is pressed", () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ReactionReactorsModal
        visible={true}
        emoji="🎉"
        reactors={reactors}
        resolveName={resolveName}
        onClose={onClose}
      />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
