import React from "react";
import { render } from "@testing-library/react-native";
import { TermsOfUseScreen } from "../TermsOfUseScreen";

const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-webview", () => ({
  WebView: () => null,
}));
jest.mock("../../../utils/legalDocumentUrl", () => ({
  getLegalDocumentUrl: () => "https://example.test/legal/terms.html",
}));
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

describe("TermsOfUseScreen", () => {
  it("renders header for terms of use", () => {
    const { getByText } = render(<TermsOfUseScreen />);
    expect(getByText("about.termsOfUse")).toBeTruthy();
  });
});
