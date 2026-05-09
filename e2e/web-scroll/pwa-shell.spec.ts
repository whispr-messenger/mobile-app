import { test, expect } from "@playwright/test";

// Verifie que la coquille PWA rendue dans chaque viewport ne deborde
// pas horizontalement (cause typique de regressions layout vues sur
// preprod : flexDirection 'row' avec width fixe au lieu de flex:1).
//
// Ces assertions sont volontairement legeres : on ne se logge pas et
// on n'interagit pas avec les ecrans authentifies. Les tests scroll
// deep par screen (ConversationsList, Contacts, MyProfile, ...) sont
// dans les follow-ups WHISPR-1338 / 1339, qui necessitent d'ajouter
// d'abord les testID "screen-<name>-bottom" sur chaque ecran cible.
test.describe("PWA layout", () => {
  test("no horizontal overflow on first paint", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    // Tolerance 1px pour les sub-pixel rounding en webkit / chromium.
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test("body fills the viewport vertically", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const sizes = await page.evaluate(() => {
      return {
        bodyHeight: document.body.getBoundingClientRect().height,
        innerHeight: window.innerHeight,
      };
    });
    // L'app expo-rendered doit remplir au moins la totalite du viewport
    // (SafeAreaView + flex:1 racine). Si bodyHeight < innerHeight, c'est
    // un bug layout connu (cf WHISPR-1313 / WHISPR-1335).
    expect(sizes.bodyHeight).toBeGreaterThanOrEqual(sizes.innerHeight - 4);
  });
});
