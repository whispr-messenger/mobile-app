import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockRouteParamsRef: { current: any } = { current: { sanction: null } };

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParamsRef.current }),
  useFocusEffect: (cb: () => () => void) => {
    const cleanup = cb();
    if (typeof cleanup === "function") cleanup();
  },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { primary: "#000", secondary: "#222", tertiary: "#333" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

import { SanctionNoticeScreen } from "../src/screens/Moderation/SanctionNoticeScreen";

describe("SanctionNoticeScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
  });

  it("renders Avertissement title for warning", () => {
    mockRouteParamsRef.current = {
      sanction: {
        type: "warning",
        reason: "Spam",
        createdAt: new Date().toISOString(),
        expiresAt: null,
      },
    };
    const { getByText } = render(<SanctionNoticeScreen />);
    expect(getByText("Avertissement")).toBeTruthy();
    expect(getByText("Spam")).toBeTruthy();
  });

  it("renders 'Suspension temporaire' for temp_ban", () => {
    mockRouteParamsRef.current = {
      sanction: {
        type: "temp_ban",
        reason: "Harcèlement",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
      },
    };
    const { getByText } = render(<SanctionNoticeScreen />);
    expect(getByText("Suspension temporaire")).toBeTruthy();
    expect(getByText(/Expire dans/)).toBeTruthy();
  });

  it("renders 'Bannissement permanent' for perm_ban", () => {
    mockRouteParamsRef.current = {
      sanction: {
        type: "perm_ban",
        reason: "TOS",
        createdAt: new Date().toISOString(),
        expiresAt: null,
      },
    };
    const { getByText } = render(<SanctionNoticeScreen />);
    expect(getByText("Bannissement permanent")).toBeTruthy();
  });

  it("shows 'Expiré' when expiresAt is in the past", () => {
    mockRouteParamsRef.current = {
      sanction: {
        type: "temp_ban",
        reason: "x",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      },
    };
    const { getByText } = render(<SanctionNoticeScreen />);
    expect(getByText("Expiré")).toBeTruthy();
  });

  it("falls back to warning config for unknown sanction types", () => {
    mockRouteParamsRef.current = {
      sanction: {
        type: "totally-unknown",
        reason: "x",
        createdAt: new Date().toISOString(),
        expiresAt: null,
      },
    };
    const { getByText } = render(<SanctionNoticeScreen />);
    expect(getByText("Avertissement")).toBeTruthy();
  });
});
