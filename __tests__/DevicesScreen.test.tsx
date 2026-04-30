import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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
    }),
    getLocalizedText: (k: string) => k,
    settings: { language: "fr" },
  }),
}));

const mockListDevices = jest.fn();
const mockRevokeDevice = jest.fn();
jest.mock("../src/services/SecurityService", () => ({
  DeviceManagerService: {
    listDevices: () => mockListDevices(),
    revokeDevice: (id: string) => mockRevokeDevice(id),
  },
}));

import { Alert } from "react-native";
import { DevicesScreen } from "../src/screens/Settings/DevicesScreen";

const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

describe("DevicesScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockListDevices.mockReset();
    mockRevokeDevice.mockReset();
    alertSpy.mockClear();
  });

  it("renders the empty state when no devices are returned", async () => {
    mockListDevices.mockResolvedValueOnce([]);
    const { getByText } = render(<DevicesScreen />);
    await waitFor(() => expect(getByText("devices.empty")).toBeTruthy());
  });

  it("renders devices in the list", async () => {
    mockListDevices.mockResolvedValueOnce([
      {
        id: "1",
        name: "iPhone Pro",
        platform: "iOS 17",
        last_active: new Date(Date.now() - 5 * 60_000).toISOString(),
        is_current: true,
      },
      {
        id: "2",
        name: "Pixel 8",
        platform: "Android 14",
        last_active: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
        is_current: false,
      },
    ]);
    const { getByText } = render(<DevicesScreen />);
    await waitFor(() => expect(getByText("iPhone Pro")).toBeTruthy());
    expect(getByText("Pixel 8")).toBeTruthy();
  });

  it("opens the revoke confirmation when the revoke button is tapped", async () => {
    mockListDevices.mockResolvedValueOnce([
      {
        id: "2",
        name: "Pixel 8",
        platform: "Android 14",
        last_active: new Date().toISOString(),
        is_current: false,
      },
    ]);
    const { findByText, UNSAFE_getAllByType } = render(<DevicesScreen />);
    await findByText("Pixel 8");
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    // [back, revoke]
    fireEvent.press(ts[1]);
    expect(alertSpy).toHaveBeenCalled();
  });

  it("calls revokeDevice when the user confirms", async () => {
    mockListDevices.mockResolvedValueOnce([
      {
        id: "2",
        name: "Pixel 8",
        platform: "Android 14",
        last_active: new Date().toISOString(),
        is_current: false,
      },
    ]);
    mockRevokeDevice.mockResolvedValueOnce(undefined);
    mockListDevices.mockResolvedValueOnce([]);

    const { findByText, UNSAFE_getAllByType } = render(<DevicesScreen />);
    await findByText("Pixel 8");
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(ts[1]);

    // Invoke the destructive action handler
    const buttons = alertSpy.mock.calls[0][2] as any[];
    const confirmBtn = buttons?.find((b) => b.style === "destructive");
    await act(async () => {
      confirmBtn?.onPress?.();
    });
    expect(mockRevokeDevice).toHaveBeenCalledWith("2");
  });

  it("calls goBack when the back button is pressed", async () => {
    mockListDevices.mockResolvedValueOnce([]);
    const { findByText, UNSAFE_getAllByType } = render(<DevicesScreen />);
    await findByText("devices.empty");
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("does not allow revoking the current device (no revoke button)", async () => {
    mockListDevices.mockResolvedValueOnce([
      {
        id: "1",
        name: "Self",
        platform: "iOS",
        last_active: new Date().toISOString(),
        is_current: true,
      },
    ]);
    const { findByText, UNSAFE_getAllByType } = render(<DevicesScreen />);
    await findByText("Self");
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    // Only [back] should be present
    expect(ts.length).toBe(1);
  });
});
