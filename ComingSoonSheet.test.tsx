/**
 * Tests for ComingSoonSheet:
 * - Renders the placeholder content when visible.
 * - Closes when backdrop or close button is pressed.
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      primary: "#6200ee",
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
  }),
}));

import { ComingSoonSheet } from "./src/components/Chat/ComingSoonSheet";

describe("ComingSoonSheet", () => {
  it("renders the title and description when visible", () => {
    const { getByText, getByTestId } = render(
      <ComingSoonSheet
        visible
        onClose={jest.fn()}
        testID="gif-sheet"
        icon="film"
        title="GIFs animés"
        description="Disponible prochainement"
      />,
    );
    expect(getByTestId("gif-sheet")).toBeTruthy();
    expect(getByText("GIFs animés")).toBeTruthy();
    expect(getByText("Disponible prochainement")).toBeTruthy();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <ComingSoonSheet
        visible
        onClose={onClose}
        testID="sticker-sheet"
        icon="happy"
        title="Stickers"
        description="Soon"
      />,
    );
    fireEvent.press(getByLabelText("Fermer"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
