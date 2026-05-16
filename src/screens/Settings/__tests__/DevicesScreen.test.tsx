/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { fireEvent, render, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    settings: { language: "fr" },
    getLocalizedText: (k: string) => k,
    getThemeColors: () => ({
      primary: "#fff",
      background: { secondary: "#222" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
  }),
}));

const mockListDevices = jest.fn();
const mockRevokeDevice = jest.fn();
jest.mock("../../../services/SecurityService", () => ({
  DeviceManagerService: {
    listDevices: (...a: unknown[]) => mockListDevices(...a),
    revokeDevice: (...a: unknown[]) => mockRevokeDevice(...a),
  },
}));

import { DevicesScreen } from "../DevicesScreen";

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockListDevices.mockResolvedValue([]);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => alertSpy.mockRestore());

describe("DevicesScreen — load", () => {
  it("requests the device list on mount", async () => {
    render(<DevicesScreen />);
    await waitFor(() => expect(mockListDevices).toHaveBeenCalled());
  });

  it("renders the list of devices when loaded", async () => {
    mockListDevices.mockResolvedValue([
      {
        id: "d-1",
        name: "iPhone d'Alice",
        platform: "iOS 18.0",
        last_active: new Date().toISOString(),
        is_current: true,
      },
      {
        id: "d-2",
        name: "Pixel d'Alice",
        platform: "Android 15",
        last_active: new Date().toISOString(),
        is_current: false,
      },
    ]);
    const { findByText } = render(<DevicesScreen />);
    expect(await findByText("iPhone d'Alice")).toBeTruthy();
    expect(await findByText("Pixel d'Alice")).toBeTruthy();
  });
});

describe("DevicesScreen — revoke", () => {
  it("opens a confirmation Alert when the revoke button is pressed on a non-current device", async () => {
    mockListDevices.mockResolvedValue([
      {
        id: "d-2",
        name: "Pixel",
        platform: "Android 15",
        last_active: new Date().toISOString(),
        is_current: false,
      },
    ]);
    const { findByLabelText } = render(<DevicesScreen />);
    const revokeBtn = await findByLabelText("devices.revokeAction");
    fireEvent.press(revokeBtn);
    expect(alertSpy).toHaveBeenCalled();
  });

  it("calls revokeDevice on the chosen device after confirmation", async () => {
    mockListDevices.mockResolvedValue([
      {
        id: "d-2",
        name: "Pixel",
        platform: "Android 15",
        last_active: new Date().toISOString(),
        is_current: false,
      },
    ]);
    mockRevokeDevice.mockResolvedValue(undefined);

    const { findByLabelText } = render(<DevicesScreen />);
    const revokeBtn = await findByLabelText("devices.revokeAction");
    fireEvent.press(revokeBtn);

    const buttons = alertSpy.mock.calls[0][2];
    const confirmBtn = buttons.find(
      (b: { style?: string }) => b.style === "destructive",
    );
    await act(async () => {
      await confirmBtn.onPress();
    });

    expect(mockRevokeDevice).toHaveBeenCalledWith("d-2");
    expect(mockListDevices).toHaveBeenCalledTimes(2); // initial + reload
  });

  it("alerts when revokeDevice throws", async () => {
    mockListDevices.mockResolvedValue([
      {
        id: "d-2",
        name: "Pixel",
        platform: "Android 15",
        last_active: new Date().toISOString(),
        is_current: false,
      },
    ]);
    mockRevokeDevice.mockRejectedValue(new Error("net"));

    const { findByLabelText } = render(<DevicesScreen />);
    fireEvent.press(await findByLabelText("devices.revokeAction"));

    const buttons = alertSpy.mock.calls[0][2];
    await act(async () => {
      await buttons
        .find((b: { style?: string }) => b.style === "destructive")
        .onPress();
    });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "notif.error",
        "devices.revokeError",
      ),
    );
  });
});
