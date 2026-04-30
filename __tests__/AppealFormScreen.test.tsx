import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockCreateAppeal = jest.fn().mockResolvedValue(undefined);
const mockSanctionRef: { current: any } = {
  current: {
    id: "s1",
    type: "warning",
    reason: "Spam",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  },
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, replace: mockReplace }),
  useRoute: () => ({ params: { sanction: mockSanctionRef.current } }),
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

jest.mock("../src/store/moderationStore", () => ({
  useModerationStore: () => ({ createAppeal: mockCreateAppeal }),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest
    .fn()
    .mockResolvedValue({ canceled: true, assets: [] }),
  MediaTypeOptions: { Images: "Images" },
}));

import { Alert } from "react-native";
import { AppealFormScreen } from "../src/screens/Moderation/AppealFormScreen";

const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

describe("AppealFormScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockReplace.mockClear();
    mockCreateAppeal.mockClear();
    alertSpy.mockClear();
    mockSanctionRef.current = {
      id: "s1",
      type: "warning",
      reason: "Spam",
      createdAt: new Date().toISOString(),
      expiresAt: null,
    };
  });

  it("renders the title and the sanction label/reason", () => {
    const { getByText } = render(<AppealFormScreen />);
    expect(getByText("Contester la décision")).toBeTruthy();
    expect(getByText("Avertissement")).toBeTruthy();
    expect(getByText("Spam")).toBeTruthy();
  });

  it("uses the sanction-type fallback label for unknown types", () => {
    mockSanctionRef.current = {
      ...mockSanctionRef.current,
      type: "weird",
    };
    const { getByText } = render(<AppealFormScreen />);
    expect(getByText("weird")).toBeTruthy();
  });

  it("renders 'Suspension temporaire' for temp_ban", () => {
    mockSanctionRef.current = { ...mockSanctionRef.current, type: "temp_ban" };
    const { getByText } = render(<AppealFormScreen />);
    expect(getByText("Suspension temporaire")).toBeTruthy();
  });

  it("calls navigation.goBack when back button pressed", () => {
    const { UNSAFE_getAllByType } = render(<AppealFormScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
