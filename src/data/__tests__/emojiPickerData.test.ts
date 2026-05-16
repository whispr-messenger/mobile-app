import {
  EMOJI_PICKER_CATEGORIES,
  QUICK_REACTION_DEFAULTS,
  filterCategoriesBySearch,
  getAllPickerEmojis,
} from "../emojiPickerData";

describe("emojiPickerData constants", () => {
  it("ships a non-empty list of categories with the required shape", () => {
    expect(EMOJI_PICKER_CATEGORIES.length).toBeGreaterThan(0);
    EMOJI_PICKER_CATEGORIES.forEach((cat) => {
      expect(cat.key).toEqual(expect.any(String));
      expect(cat.labelFr).toEqual(expect.any(String));
      expect(Array.isArray(cat.keywords)).toBe(true);
      expect(Array.isArray(cat.emojis)).toBe(true);
      expect(cat.emojis.length).toBeGreaterThan(0);
    });
  });

  it("provides at least the six default quick reactions", () => {
    expect(QUICK_REACTION_DEFAULTS).toEqual(
      expect.arrayContaining(["❤️", "👍", "😂", "😮", "😢", "😡"]),
    );
  });

  it("uses unique category keys", () => {
    const keys = EMOJI_PICKER_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("getAllPickerEmojis", () => {
  it("returns a deduplicated flat list of every emoji across categories", () => {
    const all = getAllPickerEmojis();
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("filterCategoriesBySearch", () => {
  it("returns the full list when the query is empty or whitespace", () => {
    expect(filterCategoriesBySearch("")).toBe(EMOJI_PICKER_CATEGORIES);
    expect(filterCategoriesBySearch("   ")).toBe(EMOJI_PICKER_CATEGORIES);
  });

  it("matches by labelFr (case-insensitive)", () => {
    const cat = EMOJI_PICKER_CATEGORIES[0];
    const result = filterCategoriesBySearch(cat.labelFr.toUpperCase());
    expect(result).toContain(cat);
  });

  it("matches by keyword", () => {
    const sample = EMOJI_PICKER_CATEGORIES.find((c) => c.keywords.length > 0);
    if (!sample) return;
    const keyword = sample.keywords[0];
    const result = filterCategoriesBySearch(keyword);
    expect(result).toContain(sample);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterCategoriesBySearch("zzz_no_match_zzz")).toEqual([]);
  });
});
