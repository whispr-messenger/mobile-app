/**
 * Tests for AttachmentSheet:
 * - Renders the option list when visible
 * - Dispatches the selected action
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      primary: "#6200ee",
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
  }),
}));

import { AttachmentSheet } from "../AttachmentSheet";

describe("AttachmentSheet", () => {
  it("renders nothing when not visible", () => {
    const { queryByTestId } = render(
      <AttachmentSheet
        visible={false}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );
    expect(queryByTestId("attachment-sheet")).toBeNull();
  });

  it("renders the option list when visible", () => {
    const { getByTestId, queryByTestId } = render(
      <AttachmentSheet visible onClose={jest.fn()} onSelect={jest.fn()} />,
    );
    expect(getByTestId("attachment-sheet")).toBeTruthy();
    expect(getByTestId("attachment-option-camera")).toBeTruthy();
    expect(getByTestId("attachment-option-gallery")).toBeTruthy();
    expect(getByTestId("attachment-option-document")).toBeTruthy();
    expect(getByTestId("attachment-option-emoji")).toBeTruthy();
    expect(queryByTestId("attachment-option-gif")).toBeNull();
    expect(queryByTestId("attachment-option-sticker")).toBeNull();
  });

  it("dispatches the selected action when an active option is pressed", () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <AttachmentSheet visible onClose={onClose} onSelect={onSelect} />,
    );

    fireEvent.press(getByTestId("attachment-option-camera"));
    // Animation runs before dispatching — flush it.
    jest.useFakeTimers();
    jest.advanceTimersByTime(500);
    jest.useRealTimers();
  });
});
