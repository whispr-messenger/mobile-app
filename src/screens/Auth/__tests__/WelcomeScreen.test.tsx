import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { WelcomeScreen } from "../WelcomeScreen";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: {
        gradient: ["#000", "#111"],
        primary: "#000",
        secondary: "#111",
      },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#555" },
      primary: "#6200ee",
    }),
    getFontSize: () => 16,
    getLocalizedText: (key: string) => key,
    theme: "dark",
    language: "fr",
    settings: { language: "fr", theme: "dark", fontSize: "medium" },
    updateSettings: jest.fn(),
  }),
}));
jest.mock("../../../components", () => ({
  Button: ({ title, onPress }: any) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={onPress}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
  Logo: () => null,
}));
jest.mock("../../../theme", () => ({
  colors: { text: { light: "#fff" }, primary: { main: "#6200ee" } },
  spacing: { xl: 24, xs: 4, md: 16, massive: 48 },
  typography: { fontSize: { xxxl: 32, md: 16 } },
}));

describe("WelcomeScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders login and register buttons", () => {
    const { getByText } = render(<WelcomeScreen />);
    expect(getByText("auth.seConnecter")).toBeTruthy();
    expect(getByText("auth.creerCompte")).toBeTruthy();
  });

  it("navigates to PhoneInput with mode=login on login press", () => {
    const { getByText } = render(<WelcomeScreen />);
    fireEvent.press(getByText("auth.seConnecter"));
    expect(mockNavigate).toHaveBeenCalledWith("PhoneInput", { mode: "login" });
  });

  it("navigates to PhoneInput with mode=register on register press", () => {
    const { getByText } = render(<WelcomeScreen />);
    fireEvent.press(getByText("auth.creerCompte"));
    expect(mockNavigate).toHaveBeenCalledWith("PhoneInput", {
      mode: "register",
    });
  });
});
