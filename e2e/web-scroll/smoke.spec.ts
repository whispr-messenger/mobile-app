import { test, expect } from "@playwright/test";

// Smoke test : la PWA charge sur les 3 viewports sans crash JS.
// Sert de garde-fou contre les regressions web build (bundle Metro casse,
// asset 404, hydration error).
test.describe("PWA shell", () => {
  test("loads without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Filtrer les erreurs de chargement asset attendues
        // (favicons, fonts) qui ne cassent pas l'app.
        if (!/favicon|font|woff|sw\.js/i.test(text)) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto("/");
    // On attend que React hydrate. La presence d'un root non-vide est
    // un signal suffisant ici, l'app etant une SPA single-page.
    await page.waitForLoadState("networkidle");

    // Le root expo-rendered doit exister.
    const root = page.locator("#root, #__expo-root, body > div").first();
    await expect(root).toBeVisible();

    expect(
      consoleErrors,
      `Console errors detected: ${consoleErrors.join(" | ")}`,
    ).toHaveLength(0);
  });

  test("has a non-empty title", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
