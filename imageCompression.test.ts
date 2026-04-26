/**
 * WHISPR-1039: garantit que la compression ne déforme jamais une image.
 * Test unitaire pur sur la fonction de décision `buildResizeAction`.
 */

import { buildResizeAction } from "./src/utils/imageCompression";

describe("buildResizeAction (WHISPR-1039)", () => {
  const MAX_W = 1920;
  const MAX_H = 1920;

  it("borne uniquement la largeur pour une image paysage trop large", () => {
    expect(buildResizeAction(4000, 3000, MAX_W, MAX_H)).toEqual([
      { resize: { width: MAX_W } },
    ]);
  });

  it("borne uniquement la hauteur pour une image portrait trop haute", () => {
    expect(buildResizeAction(1080, 4000, MAX_W, MAX_H)).toEqual([
      { resize: { height: MAX_H } },
    ]);
  });

  it("ne renvoie aucun resize si l'image rentre déjà dans les bornes", () => {
    expect(buildResizeAction(800, 600, MAX_W, MAX_H)).toEqual([]);
    expect(buildResizeAction(MAX_W, MAX_H, MAX_W, MAX_H)).toEqual([]);
  });

  it("traite une image carrée trop grande comme paysage (cap largeur)", () => {
    expect(buildResizeAction(3000, 3000, MAX_W, MAX_H)).toEqual([
      { resize: { width: MAX_W } },
    ]);
  });

  it("ne contraint jamais les deux dimensions simultanément", () => {
    // Régression directe : avant le fix, le resize forçait { width, height }
    // ce qui écrasait l'image en carré 1920x1920.
    for (const [w, h] of [
      [4000, 3000],
      [1080, 4000],
      [3000, 3000],
      [200, 200],
    ]) {
      const result = buildResizeAction(w, h, MAX_W, MAX_H);
      if (result.length === 0) continue;
      const resize = result[0].resize as Record<string, unknown>;
      const hasWidth = "width" in resize;
      const hasHeight = "height" in resize;
      expect(hasWidth && hasHeight).toBe(false);
    }
  });
});
