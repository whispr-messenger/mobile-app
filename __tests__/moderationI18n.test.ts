import {
  moderationStrings,
  getModerationStrings,
} from "../src/i18n/moderation";

describe("moderationStrings", () => {
  it("exposes both fr and en", () => {
    expect(moderationStrings.fr).toBeDefined();
    expect(moderationStrings.en).toBeDefined();
  });

  it("fr and en have the same top-level sections", () => {
    expect(Object.keys(moderationStrings.fr).sort()).toEqual(
      Object.keys(moderationStrings.en).sort(),
    );
  });

  it.each(["report", "sanction"] as const)(
    "fr.%s and en.%s have the same keys",
    (section) => {
      const fr = (moderationStrings.fr as any)[section];
      const en = (moderationStrings.en as any)[section];
      expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    },
  );

  it("strings are non-empty", () => {
    for (const sectionKey of Object.keys(moderationStrings.fr)) {
      const section = (moderationStrings.fr as any)[sectionKey];
      for (const key of Object.keys(section)) {
        expect(typeof section[key]).toBe("string");
        expect(section[key].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getModerationStrings", () => {
  it("returns French for 'fr'", () => {
    expect(getModerationStrings("fr")).toBe(moderationStrings.fr);
  });

  it("returns English for 'en'", () => {
    expect(getModerationStrings("en")).toBe(moderationStrings.en);
  });

  it("falls back to French for unknown languages", () => {
    expect(getModerationStrings("de")).toBe(moderationStrings.fr);
    expect(getModerationStrings("")).toBe(moderationStrings.fr);
  });
});
