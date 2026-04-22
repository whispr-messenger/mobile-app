/**
 * Pure-function test for the auto-theme resolution (WHISPR-1072).
 * We exercise the exported `resolveThemeColors` helper directly so this
 * suite stays runtime-free — no RN renderer, no native modules.
 */

import { resolveThemeColors } from "./src/context/ThemeContext";

const LIGHT_BG = "#FFFFFF";
const DARK_BG = "#0B1124";

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
