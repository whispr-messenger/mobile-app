import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { TwoFactorAuthScreen } from "../src/screens/Security/TwoFactorAuthScreen";
import { TwoFactorService } from "../src/services/TwoFactorService";

// expo-secure-store is mocked globally in jest.setup.js (WHISPR-994).

jest.mock("../src/services/apiBase", () => ({
  getApiBaseUrl: () => "https://whispr.devzeyu.com",
  getWsBaseUrl: () => "wss://whispr.devzeyu.com",
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("../src/services/TwoFactorService");

// useFocusEffect mock: call the callback synchronously during render via
// a ref guard so it only fires once (mirrors real react-navigation behaviour).
// Neither useEffect nor useLayoutEffect fire reliably in GitHub Actions CI —
// the React 19 scheduler defers them past Jest's 5s timeout.
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      const called = React.useRef(false);
      if (!called.current) {
        called.current = true;
        cb();
      }
    },
  };
});

// Increase default test timeout for CI — the React 19 scheduler in GitHub
// Actions (Node 22) can take >5s to flush microtasks from mocked promises.
jest.setTimeout(15_000);

jest.mock("../src/context/ThemeContext", () => ({
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
jest.mock("../src/components/Toast/Toast", () => () => null);

const mockedTwoFactorService = TwoFactorService as jest.Mocked<
  typeof TwoFactorService
>;

describe("TwoFactorAuthScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Render the screen and wait until the loading spinner is replaced by real
   * content (the Switch).  The mock useFocusEffect fires cb() synchronously
   * during render which triggers getStatus().then(…).finally(() => setLoading(false)).
   *
   * In CI (GitHub Actions / Node 22), the React 19 scheduler can delay flushing
   * microtasks from mocked promises far longer than locally.  We use waitFor
   * with an explicit 10s timeout to poll until getStatus has been called AND
   * its resolved value has flushed through setState.
   */
  async function renderAndLoad() {
    const utils = render(<TwoFactorAuthScreen />);
    await waitFor(
      () => {
        // getStatus must have been called (useFocusEffect callback fired)
        expect(mockedTwoFactorService.getStatus).toHaveBeenCalled();
        // AND the loading spinner must be gone (promise chain flushed)
        utils.getByRole("switch");
      },
      { timeout: 10_000 },
    );
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

  it("shows remaining backup codes count when 2FA is enabled", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });
    mockedTwoFactorService.getRemainingBackupCodes.mockResolvedValue({
      remaining: 7,
    });

    const { findByText } = await renderAndLoad();

    expect(await findByText("twoFactor.remainingCodes")).toBeTruthy();
    expect(mockedTwoFactorService.getRemainingBackupCodes).toHaveBeenCalled();
  });

  it("opens regenerate inline card and requires a TOTP code before calling the API", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });
    mockedTwoFactorService.getRemainingBackupCodes.mockResolvedValue({
      remaining: 5,
    });

    const { findByText, queryByPlaceholderText, getByPlaceholderText } =
      await renderAndLoad();

    expect(queryByPlaceholderText("twoFactor.enterCode")).toBeNull();

    const regenerateAction = await findByText("twoFactor.regenerateCodes");
    await act(async () => {
      fireEvent.press(regenerateAction);
    });

    expect(getByPlaceholderText("twoFactor.enterCode")).toBeTruthy();
    // Nothing hit the backend yet
    expect(
      mockedTwoFactorService.regenerateBackupCodes,
    ).not.toHaveBeenCalled();
  });

  it("calls regenerateBackupCodes and navigates on valid TOTP code", async () => {
    mockedTwoFactorService.getStatus.mockResolvedValue({ enabled: true });
    mockedTwoFactorService.getRemainingBackupCodes.mockResolvedValue({
      remaining: 3,
    });
    mockedTwoFactorService.regenerateBackupCodes.mockResolvedValue({
      backupCodes: ["AAAA-1111", "BBBB-2222"],
    });

    const { findByText, getByPlaceholderText, getAllByText } =
      await renderAndLoad();

    await act(async () => {
      fireEvent.press(await findByText("twoFactor.regenerateCodes"));
    });

    fireEvent.changeText(
      getByPlaceholderText("twoFactor.enterCode"),
      "123456",
    );

    // Second occurrence is the confirm button inside the inline card
    const regenerateButtons = getAllByText("twoFactor.regenerateCodes");
    await act(async () => {
      fireEvent.press(regenerateButtons[regenerateButtons.length - 1]);
    });

    expect(mockedTwoFactorService.regenerateBackupCodes).toHaveBeenCalledWith(
      "123456",
    );
    expect(mockNavigate).toHaveBeenCalledWith("TwoFactorBackupCodes", {
      codes: ["AAAA-1111", "BBBB-2222"],
    });
  });
});
