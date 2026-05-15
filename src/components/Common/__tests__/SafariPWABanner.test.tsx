/**
 * Tests pour SafariPWABanner (WHISPR-1437).
 *
 * La detection Safari iOS repose sur Platform.OS + navigator.userAgent.
 */
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./src/theme/colors", () => ({
  colors: {
    text: { light: "#fff" },
    primary: { main: "#fe7a5c" },
    ui: { error: "#f00" },
  },
  withOpacity: (color: string, _opacity: number) => color,
}));

// User-Agent strings de reference
const SAFARI_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/116.0.5845.177 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";

function setUA(ua: string) {
  Object.defineProperty(global.navigator, "userAgent", {
    value: ua,
    configurable: true,
    writable: true,
  });
}

// Force Platform.OS = 'web' une fois pour tous les tests de ce fichier
const originalOS = Platform.OS;
beforeAll(() => {
  Object.defineProperty(Platform, "OS", {
    get: () => "web",
    configurable: true,
  });
});
afterAll(() => {
  Object.defineProperty(Platform, "OS", {
    get: () => originalOS,
    configurable: true,
  });
});

import { SafariPWABanner } from "./src/components/Common/SafariPWABanner";

// Acces aux mocks via requireMock (evite le probleme de hoisting des jest.fn())
function getStorageMocks() {
  const mod = jest.requireMock("@react-native-async-storage/async-storage") as {
    default: { getItem: jest.Mock; setItem: jest.Mock };
  };
  return { mockGetItem: mod.default.getItem, mockSetItem: mod.default.setItem };
}

describe("SafariPWABanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows banner on Safari iOS when not dismissed", async () => {
    const { mockGetItem } = getStorageMocks();
    setUA(SAFARI_IOS_UA);
    mockGetItem.mockResolvedValue(null);

    const { queryByText } = render(<SafariPWABanner />);
    await waitFor(() => expect(queryByText("Installer")).toBeTruthy(), {
      timeout: 3000,
    });
  });

  it("does NOT show banner on Chrome iOS", async () => {
    const { mockGetItem } = getStorageMocks();
    setUA(CHROME_IOS_UA);
    mockGetItem.mockResolvedValue(null);

    const { queryByText } = render(<SafariPWABanner />);
    await waitFor(() => expect(queryByText("Installer")).toBeNull());
  });

  it("does NOT show banner on desktop", async () => {
    const { mockGetItem } = getStorageMocks();
    setUA(DESKTOP_UA);
    mockGetItem.mockResolvedValue(null);

    const { queryByText } = render(<SafariPWABanner />);
    await waitFor(() => expect(queryByText("Installer")).toBeNull());
  });

  it("does NOT show banner when dismissed within 7 days", async () => {
    const { mockGetItem } = getStorageMocks();
    setUA(SAFARI_IOS_UA);
    // dismissed 1 hour ago
    mockGetItem.mockResolvedValue(String(Date.now() - 60 * 60 * 1000));

    const { queryByText } = render(<SafariPWABanner />);
    await waitFor(() => expect(queryByText("Installer")).toBeNull());
  });

  it("shows banner when TTL expired (> 7 days)", async () => {
    const { mockGetItem } = getStorageMocks();
    setUA(SAFARI_IOS_UA);
    // dismissed 8 jours ago
    mockGetItem.mockResolvedValue(String(Date.now() - 8 * 24 * 60 * 60 * 1000));

    const { queryByText } = render(<SafariPWABanner />);
    await waitFor(() => expect(queryByText("Installer")).toBeTruthy(), {
      timeout: 3000,
    });
  });

  it("persists dismissal timestamp when banner dismissed", async () => {
    const { mockGetItem, mockSetItem } = getStorageMocks();
    setUA(SAFARI_IOS_UA);
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);

    const { queryByText, getByLabelText } = render(<SafariPWABanner />);
    // Banner doit etre visible sur Safari iOS sans dismiss precedent
    await waitFor(() => expect(queryByText("Installer")).toBeTruthy(), {
      timeout: 3000,
    });

    // Presser le bouton dismiss via son accessibilityLabel
    const dismissBtn = getByLabelText("Fermer le banner");
    fireEvent.press(dismissBtn);

    // Apres dismiss, le banner disparait
    await waitFor(() => expect(queryByText("Installer")).toBeNull(), {
      timeout: 2000,
    });

    // setItem doit avoir ete appele pour persister le timestamp
    expect(mockSetItem).toHaveBeenCalledWith(
      "@whispr/dismissed_pwa_install",
      expect.any(String),
    );
  });
});
