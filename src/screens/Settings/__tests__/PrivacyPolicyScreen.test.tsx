import React from "react";
import { render } from "@testing-library/react-native";
import { PrivacyPolicyScreen } from "../PrivacyPolicyScreen";

const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../context/ThemeContext", () => ({
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

describe("PrivacyPolicyScreen", () => {
  it("renders without crashing and shows the main sections", () => {
    const { getByText } = render(<PrivacyPolicyScreen />);
    expect(getByText("about.privacyPolicy")).toBeTruthy();
    expect(getByText("DONNEES COLLECTEES")).toBeTruthy();
    expect(getByText("VOS DROITS RGPD")).toBeTruthy();
  });
});
