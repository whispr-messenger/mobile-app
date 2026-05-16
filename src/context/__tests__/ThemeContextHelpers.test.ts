/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ThemeContext exposes several pure helpers used both by the provider and
 * by sync logic elsewhere in the app. Testing them directly is the
 * cheapest way to lift coverage on this 1 840-line module without
 * mounting the full provider (which requires AsyncStorage, FileSystem,
 * UserService, AppState …).
 */

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/tmp/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  cacheDirectory: "/tmp/",
}));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
}));
jest.mock("../../utils/imageCompression", () => ({
  detectImageFormatFromUri: jest.fn(() => "jpg"),
}));
jest.mock("../../services/TokenService", () => ({
  TokenService: { getAccessToken: jest.fn().mockResolvedValue("at") },
}));
jest.mock("../../services/MediaService", () => ({
  MediaService: { uploadMedia: jest.fn() },
}));
jest.mock("../../services/UserService", () => ({
  UserService: { getInstance: () => ({ getProfile: jest.fn() }) },
}));
jest.mock("../../services/apiBase", () => ({
  getApiBaseUrl: () => "https://api.test",
}));

import {
  BACKGROUND_PRESET_GRADIENTS,
  buildVisualPreferencesPayload,
  extractProfileVisualPreferences,
  resolveThemeColors,
  shouldApplyRemoteVisualPreferences,
  shouldSyncVisualPreferences,
  type GlobalSettings,
} from "../ThemeContext";

const settings = (overrides: Partial<GlobalSettings> = {}): GlobalSettings => ({
  theme: "dark",
  language: "fr",
  fontSize: "medium",
  backgroundPreset: "whispr",
  customBackgroundUri: null,
  customBackgroundVersion: 0,
  customBackgroundRemoteMediaId: null,
  customBackgroundRemoteUrl: null,
  remoteSyncUpdatedAt: null,
  ...overrides,
});

describe("resolveThemeColors", () => {
  it("returns the explicit theme bundle when theme is light or dark", () => {
    const light = resolveThemeColors("light", "dark");
    const dark = resolveThemeColors("dark", "light");
    expect(light.background.primary).not.toBe(dark.background.primary);
  });

  it("respects the OS color scheme when theme is 'auto'", () => {
    const lightAuto = resolveThemeColors("auto", "light");
    const darkAuto = resolveThemeColors("auto", "dark");
    expect(lightAuto.background.primary).not.toBe(darkAuto.background.primary);
  });

  it("defaults to dark when the OS color scheme is null/undefined", () => {
    expect(resolveThemeColors("auto", null)).toEqual(
      resolveThemeColors("dark", null),
    );
    expect(resolveThemeColors("auto", undefined)).toEqual(
      resolveThemeColors("dark", null),
    );
  });
});

describe("BACKGROUND_PRESET_GRADIENTS", () => {
  it("ships a gradient for every named preset", () => {
    expect(BACKGROUND_PRESET_GRADIENTS.whispr.length).toBeGreaterThan(0);
    expect(BACKGROUND_PRESET_GRADIENTS.midnight.length).toBeGreaterThan(0);
    expect(BACKGROUND_PRESET_GRADIENTS.sunset.length).toBeGreaterThan(0);
    expect(BACKGROUND_PRESET_GRADIENTS.aurora.length).toBeGreaterThan(0);
  });
});

describe("shouldSyncVisualPreferences", () => {
  it("returns false when no visual field is being touched", () => {
    expect(
      shouldSyncVisualPreferences(settings(), { remoteSyncUpdatedAt: "x" }),
    ).toBe(false);
  });

  it("returns true on a theme change", () => {
    expect(shouldSyncVisualPreferences(settings(), { theme: "light" })).toBe(
      true,
    );
  });

  it("returns true on language/fontSize/backgroundPreset changes", () => {
    expect(shouldSyncVisualPreferences(settings(), { language: "en" })).toBe(
      true,
    );
    expect(shouldSyncVisualPreferences(settings(), { fontSize: "large" })).toBe(
      true,
    );
    expect(
      shouldSyncVisualPreferences(settings(), { backgroundPreset: "sunset" }),
    ).toBe(true);
  });

  it("returns false when current background is custom and has no remote yet", () => {
    expect(
      shouldSyncVisualPreferences(settings({ backgroundPreset: "custom" }), {
        theme: "light",
      }),
    ).toBe(false);
  });

  it("returns true when current background is custom AND has remote linkage", () => {
    expect(
      shouldSyncVisualPreferences(
        settings({
          backgroundPreset: "custom",
          customBackgroundRemoteMediaId: "m-1",
        }),
        { theme: "light" },
      ),
    ).toBe(true);
  });
});

describe("buildVisualPreferencesPayload", () => {
  it("emits the basic fields and null remote IDs for non-custom presets", () => {
    const payload = buildVisualPreferencesPayload(settings());
    expect(payload).toEqual({
      theme: "dark",
      language: "fr",
      fontSize: "medium",
      backgroundPreset: "whispr",
      backgroundMediaId: null,
      backgroundMediaUrl: null,
      updatedAt: null,
    });
  });

  it("forwards the remote media IDs when the preset is custom AND has remote linkage", () => {
    const payload = buildVisualPreferencesPayload(
      settings({
        backgroundPreset: "custom",
        customBackgroundRemoteMediaId: "m-1",
        customBackgroundRemoteUrl: "https://cdn/bg.jpg",
        remoteSyncUpdatedAt: "2026-01-01T00:00:00Z",
      }),
    );
    expect(payload.backgroundMediaId).toBe("m-1");
    expect(payload.backgroundMediaUrl).toBe("https://cdn/bg.jpg");
    expect(payload.updatedAt).toBe("2026-01-01T00:00:00Z");
  });
});

describe("extractProfileVisualPreferences", () => {
  it("returns null for a missing profile", () => {
    expect(extractProfileVisualPreferences(null)).toBeNull();
    expect(extractProfileVisualPreferences(undefined)).toBeNull();
  });

  it("returns the nested visualPreferences object when present", () => {
    const result = extractProfileVisualPreferences({
      visualPreferences: {
        theme: "light",
        language: "en",
        fontSize: "large",
        backgroundPreset: "sunset",
        backgroundMediaId: "m-1",
        backgroundMediaUrl: "https://cdn/x.jpg",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    } as any);
    expect(result?.theme).toBe("light");
    expect(result?.backgroundMediaId).toBe("m-1");
  });

  it("falls back to legacy top-level backgroundMediaId/Url when visualPreferences is absent", () => {
    const result = extractProfileVisualPreferences({
      backgroundMediaId: "legacy",
      backgroundMediaUrl: "https://cdn/legacy.jpg",
      updatedAt: "2026-01-01T00:00:00Z",
    } as any);
    expect(result?.backgroundPreset).toBe("custom");
    expect(result?.backgroundMediaId).toBe("legacy");
  });

  it("returns null when neither visualPreferences nor legacy media fields exist", () => {
    expect(extractProfileVisualPreferences({} as any)).toBeNull();
  });
});

describe("shouldApplyRemoteVisualPreferences", () => {
  it("returns false when remote is null/undefined", () => {
    expect(shouldApplyRemoteVisualPreferences(settings(), null)).toBe(false);
    expect(shouldApplyRemoteVisualPreferences(settings(), undefined)).toBe(
      false,
    );
  });

  it("returns true when remote is newer than the local sync stamp", () => {
    expect(
      shouldApplyRemoteVisualPreferences(
        settings({ remoteSyncUpdatedAt: "2026-01-01T00:00:00Z" }),
        { theme: "light", updatedAt: "2026-06-01T00:00:00Z" },
      ),
    ).toBe(true);
  });

  it("returns false when remote is older than the local sync stamp", () => {
    expect(
      shouldApplyRemoteVisualPreferences(
        settings({ remoteSyncUpdatedAt: "2026-06-01T00:00:00Z" }),
        { theme: "light", updatedAt: "2026-01-01T00:00:00Z" },
      ),
    ).toBe(false);
  });

  it("returns true on first sync (no local stamp) when remote ships any visual field", () => {
    expect(
      shouldApplyRemoteVisualPreferences(settings(), { theme: "light" }),
    ).toBe(true);
  });

  it("returns false on first sync when remote payload is empty", () => {
    expect(shouldApplyRemoteVisualPreferences(settings(), {})).toBe(false);
  });
});
