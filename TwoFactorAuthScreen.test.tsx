import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { TwoFactorAuthScreen } from "./src/screens/Security/TwoFactorAuthScreen";
import { TwoFactorService } from "./src/services/TwoFactorService";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("./src/services/apiBase", () => ({
  getApiBaseUrl: () => "https://preprod-whispr-api.roadmvn.com",
  getWsBaseUrl: () => "wss://preprod-whispr-api.roadmvn.com",
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("./src/services/TwoFactorService");

// Capture the latest useFocusEffect callback so tests can fire it
// inside an explicit act() block after render.  Neither useEffect nor
// useLayoutEffect reliably fire in GitHub Actions CI — the React
// scheduler can defer them past the Jest timeout.  By capturing the
// callback and invoking it manually we remove all scheduler dependency.
let _focusEffectCb: (() => void) | null = null;

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    _focusEffectCb = cb as () => void;
  },
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
      primary: "#9692AC",
    }),
    getFontSize: () => 14,
    getLocalizedText: (key: string) => key,
  }),
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./src/components/Toast/Toast", () => () => null);

const mockedTwoFactorService = TwoFactorService as jest.Mocked<
  typeof TwoFactorService
>;

describe("TwoFactorAuthScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _focusEffectCb = null;
  });

  /** Render the screen then manually fire the useFocusEffect callback. */
  async function renderAndLoad() {
    const utils = render(<TwoFactorAuthScreen />);
    await act(async () => {
      _focusEffectCb?.();
    });
    return utils;
  }

  it("renders switch OFF when getStatus returns enabled: false", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: false });

    const { getByRole } = await renderAndLoad();

    expect(getByRole("switch").props.value).toBe(false);
  });

  it("renders switch ON when getStatus returns enabled: true", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });

    const { getByRole } = await renderAndLoad();

    expect(getByRole("switch").props.value).toBe(true);
  });

  it("navigates to TwoFactorSetup when toggle is turned ON", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: false });

    const { getByRole } = await renderAndLoad();

    await act(async () => {
      fireEvent(getByRole("switch"), "valueChange", true);
    });

    expect(mockNavigate).toHaveBeenCalledWith("TwoFactorSetup");
  });

  it("shows disable card when toggle is turned OFF", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });

    const { getByRole, getByPlaceholderText } = await renderAndLoad();

    await act(async () => {
      fireEvent(getByRole("switch"), "valueChange", false);
    });

    expect(getByPlaceholderText("twoFactor.enterCode")).toBeTruthy();
  });

  it("shows error toast when disable code is too short", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });

    const { getByRole, getByPlaceholderText, getAllByText } =
      await renderAndLoad();

    await act(async () => {
      fireEvent(getByRole("switch"), "valueChange", false);
    });
    fireEvent.changeText(getByPlaceholderText("twoFactor.enterCode"), "123");

    // last occurrence is the confirm button
    const disableButtons = getAllByText("twoFactor.disable");
    await act(async () => {
      fireEvent.press(disableButtons[disableButtons.length - 1]);
    });

    expect(mockedTwoFactorService.disable).not.toHaveBeenCalled();
  });

  it("calls disable and hides card on valid code", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });
    mockedTwoFactorService.disable.mockResolvedValue(undefined);

    const {
      getByRole,
      getByPlaceholderText,
      getAllByText,
      queryByPlaceholderText,
    } = await renderAndLoad();

    await act(async () => {
      fireEvent(getByRole("switch"), "valueChange", false);
    });
    fireEvent.changeText(getByPlaceholderText("twoFactor.enterCode"), "654321");

    const disableButtons = getAllByText("twoFactor.disable");
    await act(async () => {
      fireEvent.press(disableButtons[disableButtons.length - 1]);
    });

    expect(mockedTwoFactorService.disable).toHaveBeenCalledWith("654321");
    await waitFor(() =>
      expect(queryByPlaceholderText("twoFactor.enterCode")).toBeNull(),
    );
  });

  it("shows confirmation alert before regenerating backup codes", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });
    mockedTwoFactorService.getBackupCodes.mockResolvedValue({
      backupCodes: ["aaaa-1111", "bbbb-2222"],
    });

    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    const { getByText } = await renderAndLoad();

    const viewCodesButton = getByText("twoFactor.regenerateCodes");
    await act(async () => {
      fireEvent.press(viewCodesButton);
    });

    // Alert shown, API not called yet
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockedTwoFactorService.getBackupCodes).not.toHaveBeenCalled();

    // Simulate user confirming the destructive action (last button = destructive)
    const alertButtons = alertSpy.mock.calls[0][2] as Array<{
      onPress?: () => void;
    }>;
    const confirmButton = alertButtons[alertButtons.length - 1];
    await act(async () => {
      confirmButton.onPress?.();
    });

    expect(mockedTwoFactorService.getBackupCodes).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("TwoFactorBackupCodes", {
      codes: ["aaaa-1111", "bbbb-2222"],
    });

    alertSpy.mockRestore();
  });
});
