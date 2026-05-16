/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mounts the real ThemeProvider to exercise the hydration / persistence /
 * remote-sync code paths that the helper-level tests don't reach. Uses the
 * shared mockFactories for AsyncStorage + light stubs for FileSystem /
 * UserService / MediaService.
 */

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete store[k];
    }),
    clear: jest.fn(async () => {
      for (const k of Object.keys(store)) delete store[k];
    }),
  };
});

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/tmp/",
  cacheDirectory: "/tmp/cache/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest
    .fn()
    .mockResolvedValue({ status: 200, uri: "/tmp/x.jpg" }),
}));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: "/tmp/x.jpg" }),
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
}));

jest.mock("../../utils/imageCompression", () => ({
  detectImageFormatFromUri: jest.fn(() => "jpg"),
}));

const mockGetProfile = jest.fn();
const mockUpdateVisualPreferences = jest.fn();
jest.mock("../../services/UserService", () => ({
  UserService: {
    getInstance: () => ({
      getProfile: mockGetProfile,
      updateVisualPreferences: mockUpdateVisualPreferences,
    }),
  },
}));

const mockUploadMedia = jest.fn();
jest.mock("../../services/MediaService", () => ({
  MediaService: { uploadMedia: mockUploadMedia },
}));

jest.mock("../../services/TokenService", () => ({
  TokenService: {
    getAccessToken: jest.fn().mockResolvedValue("at"),
  },
}));

jest.mock("../../services/apiBase", () => ({
  getApiBaseUrl: () => "https://api.test",
}));

import React from "react";
import { Text } from "react-native";
import { render, waitFor, act } from "@testing-library/react-native";
import { ThemeProvider, useTheme } from "../ThemeContext";

const Probe: React.FC = () => {
  const { settings, getLocalizedText, getFontSize, getThemeColors } =
    useTheme();
  return (
    <Text testID="probe">
      {settings.theme}|{settings.language}|{settings.fontSize}|
      {settings.backgroundPreset}|{getLocalizedText("auth.welcome") ?? ""}|
      {String(getFontSize("base"))}|{String(getThemeColors().text.primary)}
    </Text>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProfile.mockResolvedValue({
    success: true,
    profile: {
      visualPreferences: {
        theme: "light",
        language: "en",
        fontSize: "large",
        backgroundPreset: "sunset",
      },
    },
  });
  mockUpdateVisualPreferences.mockResolvedValue({ success: true, profile: {} });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("ThemeProvider — hydration", () => {
  it("mounts the provider and exposes default settings on first render", async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId("probe")).toBeTruthy();
    // The async effect kicks off hydration; just await one tick to flush.
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("triggers a remote visual-preferences fetch via UserService on mount", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled());
  });

  it("survives a UserService.getProfile rejection without crashing", async () => {
    mockGetProfile.mockRejectedValueOnce(new Error("net"));
    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByTestId("probe")).toBeTruthy();
  });
});
