import { getModerationStrings, moderationStrings } from "../moderation";

describe("moderationStrings", () => {
  it("ships fr and en bundles with the same top-level sections", () => {
    const fr = Object.keys(moderationStrings.fr).sort();
    const en = Object.keys(moderationStrings.en).sort();
    expect(en).toEqual(fr);
  });

  it.each([
    ["fr", "Signalements"],
    ["en", "Reports"],
  ])("exposes report.title in %s", (lang, expected) => {
    const strings = moderationStrings[lang as keyof typeof moderationStrings];
    expect(strings.report.title).toBe(expected);
  });

  it("provides the same set of report status labels in both languages", () => {
    const frKeys = Object.keys(moderationStrings.fr.report).sort();
    const enKeys = Object.keys(moderationStrings.en.report).sort();
    expect(enKeys).toEqual(frKeys);
  });
});

describe("getModerationStrings", () => {
  it("returns the requested language bundle", () => {
    expect(getModerationStrings("en")).toBe(moderationStrings.en);
    expect(getModerationStrings("fr")).toBe(moderationStrings.fr);
  });

  it("falls back to fr for unknown languages", () => {
    expect(getModerationStrings("zz")).toBe(moderationStrings.fr);
    expect(getModerationStrings("")).toBe(moderationStrings.fr);
  });
});
