/**
 * Lightweight contract test for the deep linking config (WHISPR-1073).
 * We don't exercise Navigation's URL parser end-to-end (that would require
 * mounting the full NavigationContainer + AuthNavigator). Instead we assert
 * the shape Navigation relies on, so future edits to this file can't silently
 * drop a screen or change a URL path.
 */

import { DEEP_LINK_PREFIXES, linkingConfig } from "../linkingConfig";

describe("linkingConfig", () => {
  it("exposes the whispr:// scheme", () => {
    expect(DEEP_LINK_PREFIXES).toEqual(["whispr://"]);
    expect(linkingConfig.prefixes).toEqual(["whispr://"]);
  });

  it("maps conversation, group and profile URLs to their screens", () => {
    expect(linkingConfig.config?.screens).toMatchObject({
      Chat: "conversation/:conversationId",
      GroupDetails: "group/:groupId",
      UserProfile: "profile/:userId",
    });
  });

  it("keeps URL paths stable (any rename is a breaking change for existing share-sheet links)", () => {
    const screens = linkingConfig.config?.screens as Record<string, any>;
    expect(screens.Chat).toMatch(/^conversation\/:conversationId$/);
    expect(screens.GroupDetails).toMatch(/^group\/:groupId$/);
    expect(screens.UserProfile).toMatch(/^profile\/:userId$/);
  });

  it("maps the Settings screen and its capitalised alias (WHISPR-1115)", () => {
    const screens = linkingConfig.config?.screens as Record<string, any>;
    expect(screens.Settings).toBeDefined();
    expect(screens.Settings.path).toBe("settings");
    expect(screens.Settings.alias).toContain("Settings");
  });
});
