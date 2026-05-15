import { detectMention } from "./src/utils/mentions";

describe("detectMention", () => {
  it("returns null for direct conversations", () => {
    expect(detectMention("hello @alice", "direct", 5)).toBeNull();
  });

  it("returns null for groups with no members", () => {
    expect(detectMention("hello @alice", "group", 0)).toBeNull();
  });

  it("returns null when the text has no @", () => {
    expect(detectMention("just some text", "group", 3)).toBeNull();
  });

  it("detects a mention at the end of the text", () => {
    expect(detectMention("hello @ali", "group", 3)).toEqual({
      query: "ali",
      startIndex: 6,
    });
  });

  it("detects a bare @ as an empty mention", () => {
    expect(detectMention("hello @", "group", 3)).toEqual({
      query: "",
      startIndex: 6,
    });
  });

  it("detects the last mention when multiple @ appear", () => {
    expect(detectMention("@alice hi @b", "group", 3)).toEqual({
      query: "b",
      startIndex: 10,
    });
  });

  it("returns null when the @ is followed by a word and a non-trailing space", () => {
    expect(detectMention("@alice hi", "group", 3)).toBeNull();
  });

  it("lowercases the query", () => {
    expect(detectMention("hello @ADA", "group", 3)).toEqual({
      query: "ada",
      startIndex: 6,
    });
  });
});
