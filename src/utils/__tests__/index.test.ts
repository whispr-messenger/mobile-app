import { isValidUsername, normalizeUsername } from "./index";

describe("username utils", () => {
  it("keeps cyrillic characters when normalizing a username", () => {
    expect(normalizeUsername("Привет_123")).toBe("привет_123");
  });

  it("replaces unsupported separators but preserves unicode letters", () => {
    expect(normalizeUsername("  @Тест-User.42  ")).toBe("тест_user_42");
  });

  it("accepts unicode usernames made of letters, digits and underscores", () => {
    expect(isValidUsername("привет_123")).toBe(true);
    expect(isValidUsername("jóse_42")).toBe(true);
  });

  it("rejects usernames without letters or digits", () => {
    expect(isValidUsername("___")).toBe(false);
  });
});
