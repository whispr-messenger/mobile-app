import React from "react";
import { render, act } from "@testing-library/react-native";

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { primary: "#000", secondary: "#222" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
      success: "#21C004",
      error: "#FF3B30",
      warning: "#FF9500",
      info: "#9692AC",
      secondary: "#9692AC",
    }),
    getFontSize: () => 16,
  }),
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

import Toast from "../src/components/Toast/Toast";

describe("Toast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders nothing when not visible", () => {
    const { toJSON } = render(
      <Toast visible={false} message="hi" onHide={() => {}} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the message when visible", () => {
    const { getByText } = render(
      <Toast visible={true} message="Bonjour" onHide={() => {}} />,
    );
    expect(getByText("Bonjour")).toBeTruthy();
  });

  it.each(["success", "error", "warning", "info"] as const)(
    "renders the %s variant",
    (type) => {
      const { getByText } = render(
        <Toast visible={true} message="msg" type={type} onHide={() => {}} />,
      );
      expect(getByText("msg")).toBeTruthy();
    },
  );

  it("triggers onHide after the duration when timers run", () => {
    const onHide = jest.fn();
    render(
      <Toast visible={true} message="x" duration={50} onHide={onHide} />,
    );
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onHide).toHaveBeenCalled();
  });
});
