import React from "react";
import { Platform, StyleSheet } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { SettingsScreen } from "./src/screens/Settings/SettingsScreen";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue(undefined);

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: mockReset,
  }),
  useRoute: () => ({ params: {} }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
// Use inline mock instead of require() to avoid circular dependency
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
  clear: jest.fn().mockResolvedValue(null),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(null),
  multiRemove: jest.fn().mockResolvedValue(null),
}));
jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    settings: { theme: "dark", language: "fr", fontSize: "medium" },
    updateSettings: jest.fn().mockResolvedValue(undefined),
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
  }),
}));
jest.mock("./src/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    userId: "user1",
    deviceId: "dev1",
    signIn: jest.fn(),
    signOut: mockSignOut,
  }),
}));
jest.mock("./src/services/UserService", () => ({
  UserService: {
    getInstance: () => ({
      getPrivacySettings: jest.fn().mockResolvedValue({ success: false }),
      updatePrivacySettings: jest.fn().mockResolvedValue({ success: true }),
    }),
  },
}));
jest.mock("./src/services/NotificationService", () => ({
  NotificationService: {
    getSettings: jest.fn().mockRejectedValue(new Error("not found")),
    updateSettings: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock("./src/services/moderation", () => ({
  DEFAULT_MODERATION_MODEL: "v2",
  getModerationModelVersion: jest.fn().mockResolvedValue("v2"),
  setModerationModelVersion: jest.fn().mockResolvedValue(undefined),
}));

describe("SettingsScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not render the in-screen header (back button + title)", async () => {
    const { queryByText, queryByLabelText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(queryByText("settings.privacy")).toBeTruthy();
    });
    expect(queryByText("settings.title")).toBeNull();
    expect(queryByLabelText("Retour")).toBeNull();
  });

  it("renders privacy section", async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText("settings.privacy")).toBeTruthy();
    });
  });

  it("renders notifications section", async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText("settings.notifications")).toBeTruthy();
    });
  });

  it("renders security section", async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText("settings.security")).toBeTruthy();
    });
  });

  it("renders logout option", async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText("settings.logout")).toBeTruthy();
    });
  });

  it("absolute-positions the ScrollView on web so the page actually scrolls (WHISPR-1202)", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    try {
      const { getByTestId } = render(<SettingsScreen />);
      const scroll = await waitFor(() => getByTestId("settings-scroll"));
      const flat = StyleSheet.flatten(scroll.props.style);
      expect(flat.position).toBe("absolute");
      expect(flat.top).toBe(0);
      expect(flat.bottom).toBe(0);
      expect(flat.left).toBe(0);
      expect(flat.right).toBe(0);
      expect(flat.overflowY).toBe("auto");
    } finally {
      Object.defineProperty(Platform, "OS", {
        value: originalOS,
        configurable: true,
      });
    }
  });

  it("absolute-positions the ScrollView on web so the page actually scrolls (WHISPR-1202)", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    try {
      const { getByTestId } = render(<SettingsScreen />);
      const scroll = await waitFor(() => getByTestId("settings-scroll"));
      const flat = StyleSheet.flatten(scroll.props.style);
      expect(flat.position).toBe("absolute");
      expect(flat.top).toBe(0);
      expect(flat.bottom).toBe(0);
      expect(flat.left).toBe(0);
      expect(flat.right).toBe(0);
      expect(flat.overflowY).toBe("auto");
    } finally {
      Object.defineProperty(Platform, "OS", {
        value: originalOS,
        configurable: true,
      });
    }
  });
});
