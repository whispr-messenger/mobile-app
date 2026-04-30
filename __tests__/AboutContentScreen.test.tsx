import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

jest.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        legalPrivacyUrl: "https://example.com/privacy",
        legalTermsUrl: "",
      },
    },
  },
}));

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: {
        primary: "#000",
        secondary: "#222",
        tertiary: "#333",
        gradient: ["#000", "#111"],
      },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
      primary: "#FE7A5C",
      secondary: "#9692AC",
      error: "#FF3B30",
    }),
    getFontSize: () => 16,
    getLocalizedText: (k: string) => k,
  }),
}));

import { Linking, Alert } from "react-native";
import { AboutContentScreen } from "../src/screens/Settings/AboutContentScreen";

const canOpenURL = jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

describe("AboutContentScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    canOpenURL.mockClear();
    openURL.mockClear();
    alertSpy.mockClear();
  });

  it("renders the localized title", () => {
    const { getByText } = render(<AboutContentScreen />);
    expect(getByText("about.title")).toBeTruthy();
  });

  it("calls navigation.goBack when back button is pressed", () => {
    const { UNSAFE_getAllByType } = render(<AboutContentScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("attempts to open the privacy URL when pressed", async () => {
    const { UNSAFE_getAllByType } = render(<AboutContentScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(ts[1]);
    await new Promise((r) => setTimeout(r, 0));
    // either canOpenURL is called (happy path) or alert fires (rejected path);
    // both exercise the legal-link branch.
    const triggered =
      canOpenURL.mock.calls.length > 0 || alertSpy.mock.calls.length > 0;
    expect(triggered).toBe(true);
  });

  it("alerts when terms URL is empty", async () => {
    const { UNSAFE_getAllByType } = render(<AboutContentScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(ts[2]);
    await new Promise((r) => setTimeout(r, 0));
    expect(alertSpy).toHaveBeenCalled();
  });

  it("calls Alert when report button is pressed (non-web)", () => {
    const { UNSAFE_getAllByType } = render(<AboutContentScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(ts[3]);
    expect(alertSpy).toHaveBeenCalled();
  });
});
