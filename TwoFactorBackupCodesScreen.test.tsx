import React from "react";
import { render } from "@testing-library/react-native";
import { TwoFactorBackupCodesScreen } from "./src/screens/Security/TwoFactorBackupCodesScreen";

const mockGoBack = jest.fn();
const mockAddListener = jest.fn().mockReturnValue(() => {});

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
    addListener: mockAddListener,
  }),
  useRoute: () => ({
    params: { codes: ["aaaa-1111", "bbbb-2222", "cccc-3333"] },
  }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("./src/context/ThemeContext", () => ({
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
  }),
}));
jest.mock("./src/components/Toast/Toast", () => () => null);
jest.mock("./src/utils/clipboard", () => ({
  copyToClipboard: jest.fn(),
}));

describe("TwoFactorBackupCodesScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders without crashing", () => {
    const { toJSON } = render(<TwoFactorBackupCodesScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders backup codes", () => {
    const { getByText } = render(<TwoFactorBackupCodesScreen />);
    expect(getByText("aaaa-1111")).toBeTruthy();
    expect(getByText("bbbb-2222")).toBeTruthy();
  });
});
