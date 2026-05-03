/**
 * Pure-function test for the auto-theme resolution (WHISPR-1072).
 * We exercise the exported `resolveThemeColors` helper directly so this
 * suite stays runtime-free — no RN renderer, no native modules.
 */

import {
  buildVisualPreferencesPayload,
  resolveThemeColors,
  shouldApplyRemoteVisualPreferences,
  shouldSyncVisualPreferences,
  type GlobalSettings,
} from "./src/context/ThemeContext";

const LIGHT_BG = "#FFFFFF";
const DARK_BG = "#0B1124";
const baseSettings: GlobalSettings = {
  theme: "dark",
  language: "fr",
  fontSize: "medium",
  backgroundPreset: "whispr",
  customBackgroundUri: null,
  customBackgroundVersion: 0,
  customBackgroundRemoteMediaId: null,
  customBackgroundRemoteUrl: null,
  remoteSyncUpdatedAt: null,
};

describe("resolveThemeColors (WHISPR-1072)", () => {
  it("returns light colors when the user explicitly picked 'light'", () => {
    expect(resolveThemeColors("light", "dark").background.primary).toBe(LIGHT_BG);
    expect(resolveThemeColors("light", "light").background.primary).toBe(LIGHT_BG);
    expect(resolveThemeColors("light", null).background.primary).toBe(LIGHT_BG);
  });

  it("returns dark colors when the user explicitly picked 'dark'", () => {
    expect(resolveThemeColors("dark", "dark").background.primary).toBe(DARK_BG);
    expect(resolveThemeColors("dark", "light").background.primary).toBe(DARK_BG);
    expect(resolveThemeColors("dark", null).background.primary).toBe(DARK_BG);
  });

  describe("'auto' follows the OS color scheme", () => {
    it("picks light colors when the OS reports light", () => {
      expect(resolveThemeColors("auto", "light").background.primary).toBe(LIGHT_BG);
    });

    it("picks dark colors when the OS reports dark", () => {
      expect(resolveThemeColors("auto", "dark").background.primary).toBe(DARK_BG);
    });

    it("falls back to dark when the OS cannot report a preference", () => {
      expect(resolveThemeColors("auto", null).background.primary).toBe(DARK_BG);
      expect(resolveThemeColors("auto", undefined).background.primary).toBe(DARK_BG);
    });
  });
});

describe("visual preference helpers", () => {
  it("drops remote background media when the active preset is not custom", () => {
    expect(
      buildVisualPreferencesPayload({
        ...baseSettings,
        backgroundPreset: "whispr",
        customBackgroundRemoteMediaId: "media-1",
        customBackgroundRemoteUrl: "https://cdn/bg.jpg",
      }),
    ).toEqual(
      expect.objectContaining({
        backgroundPreset: "whispr",
        backgroundMediaId: null,
        backgroundMediaUrl: null,
      }),
    );
  });

  it("does not schedule a remote sync for a custom background that is still local only", () => {
    expect(
      shouldSyncVisualPreferences(
        {
          ...baseSettings,
          backgroundPreset: "custom",
          customBackgroundUri: "file:///bg.jpg",
        },
        { backgroundPreset: "custom" },
      ),
    ).toBe(false);
  });

  it("applies remote preferences when the backend snapshot is newer", () => {
    expect(
      shouldApplyRemoteVisualPreferences(baseSettings, {
        theme: "light",
        updatedAt: "2026-05-03T10:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("keeps local preferences when they are newer than the backend snapshot", () => {
    expect(
      shouldApplyRemoteVisualPreferences(
        {
          ...baseSettings,
          theme: "light",
          remoteSyncUpdatedAt: "2026-05-03T10:00:00.000Z",
        },
        {
          theme: "dark",
          updatedAt: "2026-05-03T09:59:00.000Z",
        },
      ),
    ).toBe(false);
  });
});
