import React from "react";
import { render } from "@testing-library/react-native";
import { TermsOfUseScreen } from "./src/screens/Settings/TermsOfUseScreen";

const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: {
        gradient: ["#000", "#111"],
        primary: "#000",
        secondary: "#111",
        tertiary: "#222",
      },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#555" },
      primary: "#6200ee",
      secondary: "#444",
    }),
    getFontSize: () => 16,
    getLocalizedText: (key: string) => key,
  }),
}));

describe("TermsOfUseScreen", () => {
  it("renders without crashing and shows the main sections", () => {
    const { getByText } = render(<TermsOfUseScreen />);
    expect(getByText("about.termsOfUse")).toBeTruthy();
    expect(getByText("ACCEPTATION")).toBeTruthy();
    expect(getByText("COMPORTEMENT ATTENDU")).toBeTruthy();
  });
});
