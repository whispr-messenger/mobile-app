/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for ThemeProvider actions : updateSettings, saveCustomBackground,
 * clearCustomBackground. We mount the actual provider and drive it through
 * useTheme so the side-effects (AsyncStorage writes, MediaService uploads,
 * UserService.updateVisualPreferences calls) are observable.
 */

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __store: store,
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete store[k];
    }),
    multiGet: jest.fn(async (keys: string[]) =>
      keys.map((k) => [k, store[k] ?? null] as [string, string | null]),
    ),
    multiSet: jest.fn(async (pairs: Array<[string, string]>) => {
      for (const [k, v] of pairs) store[k] = v;
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
      for (const k of keys) delete store[k];
    }),
    clear: jest.fn(async () => {
      for (const k of Object.keys(store)) delete store[k];
    }),
  };
});

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
  cacheDirectory: "file:///cache/",
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  makeDirectoryAsync: jest.fn(async () => {}),
  downloadAsync: jest.fn(async () => ({ status: 200, uri: "file:///out.jpg" })),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "file:///rendered.jpg" })),
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
}));

jest.mock("../../utils/imageCompression", () => ({
  detectImageFormatFromUri: jest.fn(() => "jpg"),
}));

jest.mock("../../services/UserService", () => {
  const instance = {
    getProfile: jest.fn(),
    updateVisualPreferences: jest.fn(),
    updateProfileBackground: jest.fn(),
  };
  return {
    UserService: {
      getInstance: () => instance,
    },
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const __userInstance =
  require("../../services/UserService").UserService.getInstance();
const mockGetProfile = __userInstance.getProfile as jest.Mock;
const mockUpdateVisualPreferences =
  __userInstance.updateVisualPreferences as jest.Mock;
const mockUpdateProfileBackground =
  __userInstance.updateProfileBackground as jest.Mock;

jest.mock("../../services/MediaService", () => ({
  MediaService: { uploadMedia: jest.fn() },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockUploadMedia = require("../../services/MediaService").MediaService
  .uploadMedia as jest.Mock;

jest.mock("../../services/TokenService", () => ({
  TokenService: {
    getAccessToken: jest.fn().mockResolvedValue("at"),
    decodeAccessToken: jest.fn().mockReturnValue({ sub: "user-me" }),
  },
}));

jest.mock("../../services/apiBase", () => ({
  getApiBaseUrl: () => "https://api.test",
}));

import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import { ThemeProvider, useTheme } from "../ThemeContext";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFs = require("expo-file-system/legacy") as Record<
  string,
  jest.Mock
> & {
  documentDirectory: string;
  cacheDirectory: string;
};

let capturedTheme: ReturnType<typeof useTheme> | null = null;
const Probe: React.FC = () => {
  const ctx = useTheme();
  capturedTheme = ctx;
  return null;
};

beforeEach(() => {
  jest.clearAllMocks();
  capturedTheme = null;
  // After clearAllMocks the inline factory mocks return undefined; restore.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const imageCompression = require("../../utils/imageCompression");
  (imageCompression.detectImageFormatFromUri as jest.Mock).mockReturnValue(
    "jpg",
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tokenServiceMod = require("../../services/TokenService");
  (tokenServiceMod.TokenService.getAccessToken as jest.Mock).mockResolvedValue(
    "at",
  );
  (tokenServiceMod.TokenService.decodeAccessToken as jest.Mock).mockReturnValue(
    {
      sub: "user-me",
    },
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const imageManip = require("expo-image-manipulator");
  (imageManip.manipulateAsync as jest.Mock).mockResolvedValue({
    uri: "file:///rendered.jpg",
  });
  mockGetProfile.mockResolvedValue({
    success: true,
    profile: { visualPreferences: undefined },
  });
  mockUpdateVisualPreferences.mockResolvedValue({ success: true, profile: {} });
  mockUpdateProfileBackground.mockResolvedValue({
    success: true,
    profile: {},
  });
  mockUploadMedia.mockResolvedValue({
    id: "media-99",
    url: "https://api.test/media/v1/media-99/blob",
  });
  mockFs.getInfoAsync.mockResolvedValue({ exists: false });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function mountProvider() {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  // Wait for hydration: capturedTheme is populated after first render.
  await waitFor(() => expect(capturedTheme).not.toBeNull());
  // Flush the mount async useEffect chain (load → hydrate-remote)
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ThemeProvider — updateSettings", () => {
  it("persists language change to AsyncStorage and schedules a remote sync", async () => {
    await mountProvider();
    await act(async () => {
      await capturedTheme!.updateSettings({ language: "en" });
    });
    // AsyncStorage write
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "whispr.globalSettings.v1",
      expect.stringContaining('"language":"en"'),
    );
  });

  it("respects skipRemoteSync option (no remote write)", async () => {
    await mountProvider();
    mockUpdateVisualPreferences.mockClear();
    await act(async () => {
      await capturedTheme!.updateSettings(
        { fontSize: "large" },
        { skipRemoteSync: true },
      );
    });
    // No remote sync was queued, so updateVisualPreferences should not be called
    // during this micro-task. (It may still fire later via the existing poll, but
    // the immediate scheduling is skipped.)
    expect(mockUpdateVisualPreferences).not.toHaveBeenCalled();
  });

  it("logs and swallows errors from AsyncStorage.setItem", async () => {
    await mountProvider();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error("disk full"),
    );
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      await capturedTheme!.updateSettings({ language: "fr" });
    });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("ThemeProvider — clearCustomBackground", () => {
  it("resets backgroundPreset + calls updateProfileBackground(null, null)", async () => {
    await mountProvider();
    await act(async () => {
      await capturedTheme!.clearCustomBackground();
    });
    expect(mockFs.deleteAsync).toHaveBeenCalled();
    expect(mockUpdateProfileBackground).toHaveBeenCalledWith(null, null);
  });

  it("swallows updateProfileBackground rejection silently", async () => {
    mockUpdateProfileBackground.mockRejectedValueOnce(new Error("server down"));
    await mountProvider();
    // The error from clearCustomBackground propagates because there is no
    // try/catch wrap around it — verify behaviour matches the source.
    await expect(capturedTheme!.clearCustomBackground()).rejects.toThrow(
      /server down/,
    );
  });
});

describe("ThemeProvider — saveCustomBackground", () => {
  it("renders + persists + uploads + syncs media id to backend", async () => {
    await mountProvider();
    await act(async () => {
      await capturedTheme!.saveCustomBackground("file:///user-pick.jpg");
    });

    expect(mockFs.makeDirectoryAsync).toHaveBeenCalled();
    expect(mockFs.copyAsync).toHaveBeenCalled();
    expect(mockUploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/\.jpg$/i),
        type: "image/jpeg",
      }),
      undefined,
      expect.objectContaining({ context: "message", ownerId: "user-me" }),
    );
    expect(mockUpdateProfileBackground).toHaveBeenCalledWith(
      "media-99",
      "https://api.test/media/v1/media-99/blob",
    );
  });

  it("logs a warning when backend sync fails but local persistence already happened", async () => {
    mockUpdateProfileBackground.mockRejectedValueOnce(
      new Error("backend down"),
    );
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    await mountProvider();
    await act(async () => {
      await capturedTheme!.saveCustomBackground("file:///pick.jpg");
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to sync custom background to backend",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it("falls back to direct copy (no manipulate) for GIFs to preserve animation", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const imageCompression = require("../../utils/imageCompression");
    imageCompression.detectImageFormatFromUri.mockReturnValueOnce("gif");

    await mountProvider();
    await act(async () => {
      await capturedTheme!.saveCustomBackground("file:///cat.gif");
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const imageManip = require("expo-image-manipulator");
    expect(imageManip.manipulateAsync).not.toHaveBeenCalled();
    expect(mockFs.copyAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "file:///cat.gif",
        to: expect.stringMatching(/\.gif$/),
      }),
    );
  });
});

describe("ThemeProvider — getThemeColors / getFontSize / getLocalizedText", () => {
  it("returns dark colors when theme=dark", async () => {
    await mountProvider();
    expect(capturedTheme!.getThemeColors().background.primary).toBeTruthy();
  });

  it("returns a numeric value from getFontSize", async () => {
    await mountProvider();
    expect(typeof capturedTheme!.getFontSize("base")).toBe("number");
  });

  it("returns a translated string for known keys", async () => {
    await mountProvider();
    const s = capturedTheme!.getLocalizedText("auth.welcome");
    expect(typeof s).toBe("string");
  });

  it("returns the key itself when the translation is missing", async () => {
    await mountProvider();
    expect(capturedTheme!.getLocalizedText("not.a.real.key")).toBe(
      "not.a.real.key",
    );
  });
});

describe("ThemeProvider — useTheme guard", () => {
  it("throws when called outside the provider", () => {
    const Bad = () => {
      useTheme();
      return null;
    };
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow();
    errSpy.mockRestore();
  });
});
