import {
  validateReactionEmoji,
  checkReactionLimits,
  userHasReaction,
  MAX_DISTINCT_REACTIONS_PER_MESSAGE,
  MAX_DISTINCT_REACTIONS_PER_USER_PER_MESSAGE,
} from "../reactionEmoji";
import type { MessageReaction } from "../../types/messaging";

const makeReaction = (
  user_id: string,
  reaction: string,
  overrides: Partial<MessageReaction> = {},
): MessageReaction =>
  ({
    id: `${user_id}-${reaction}`,
    user_id,
    reaction,
    message_id: "m1",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as MessageReaction;

describe("validateReactionEmoji", () => {
  it("accepts a simple emoji", () => {
    expect(validateReactionEmoji("👍")).toEqual({ ok: true });
  });

  it("accepts a composed ZWJ emoji (single grapheme)", () => {
    expect(validateReactionEmoji("👨‍👩‍👧")).toEqual({ ok: true });
  });

  it("rejects an empty string", () => {
    const result = validateReactionEmoji("");
    expect(result.ok).toBe(false);
  });

  it("rejects a whitespace-only string", () => {
    const result = validateReactionEmoji("   ");
    expect(result.ok).toBe(false);
  });

  it("rejects an emoji exceeding the grapheme limit", () => {
    const result = validateReactionEmoji("👍👍👍👍👍👍👍👍👍👍👍");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/10/);
    }
  });

  it("rejects blacklisted emojis", () => {
    for (const emoji of ["🖕", "☠️", "💀"]) {
      const result = validateReactionEmoji(emoji);
      expect(result.ok).toBe(false);
    }
  });

  it("trims whitespace before validating", () => {
    expect(validateReactionEmoji("  👍  ")).toEqual({ ok: true });
  });

  it("rejects a blacklisted emoji even when padded with whitespace", () => {
    const result = validateReactionEmoji("  💀  ");
    expect(result.ok).toBe(false);
  });
});

describe("validateReactionEmoji fallback without Intl.Segmenter", () => {
  const originalSegmenter = (Intl as typeof Intl & { Segmenter?: unknown })
    .Segmenter;

  beforeAll(() => {
    (Intl as unknown as { Segmenter?: unknown }).Segmenter = undefined;
  });

  afterAll(() => {
    (Intl as unknown as { Segmenter?: unknown }).Segmenter = originalSegmenter;
  });

  it("still accepts a valid emoji using the spread fallback", () => {
    expect(validateReactionEmoji("👍")).toEqual({ ok: true });
  });

  it("still rejects an empty string", () => {
    expect(validateReactionEmoji("").ok).toBe(false);
  });
});

describe("checkReactionLimits", () => {
  it("allows adding a reaction when the reactions list is undefined", () => {
    expect(checkReactionLimits(undefined, "u1", "👍")).toEqual({ ok: true });
  });

  it("allows a user to re-add an emoji already present on the message", () => {
    const reactions = [makeReaction("u2", "👍")];
    expect(checkReactionLimits(reactions, "u1", "👍")).toEqual({ ok: true });
  });

  it("rejects a new distinct emoji when the message cap is reached", () => {
    const reactions: MessageReaction[] = [];
    for (let i = 0; i < MAX_DISTINCT_REACTIONS_PER_MESSAGE; i++) {
      reactions.push(makeReaction(`u${i}`, `e${i}`));
    }
    const result = checkReactionLimits(reactions, "uNew", "brandNew");
    expect(result.ok).toBe(false);
  });

  it("still allows an existing emoji even when the message cap is reached", () => {
    const reactions: MessageReaction[] = [];
    for (let i = 0; i < MAX_DISTINCT_REACTIONS_PER_MESSAGE; i++) {
      reactions.push(makeReaction(`u${i}`, `e${i}`));
    }
    expect(checkReactionLimits(reactions, "uNew", "e0")).toEqual({ ok: true });
  });

  it("rejects a new distinct emoji when the user per-message cap is reached", () => {
    const reactions: MessageReaction[] = [];
    for (let i = 0; i < MAX_DISTINCT_REACTIONS_PER_USER_PER_MESSAGE; i++) {
      reactions.push(makeReaction("u1", `e${i}`));
    }
    const result = checkReactionLimits(reactions, "u1", "brandNew");
    expect(result.ok).toBe(false);
  });

  it("allows the user to re-use one of their own existing emojis", () => {
    const reactions: MessageReaction[] = [];
    for (let i = 0; i < MAX_DISTINCT_REACTIONS_PER_USER_PER_MESSAGE; i++) {
      reactions.push(makeReaction("u1", `e${i}`));
    }
    expect(checkReactionLimits(reactions, "u1", "e0")).toEqual({ ok: true });
  });

  it("counts caps per user, not globally", () => {
    const reactions: MessageReaction[] = [];
    for (let i = 0; i < MAX_DISTINCT_REACTIONS_PER_USER_PER_MESSAGE; i++) {
      reactions.push(makeReaction("u1", `e${i}`));
    }
    expect(checkReactionLimits(reactions, "u2", "newEmoji")).toEqual({
      ok: true,
    });
  });
});

describe("userHasReaction", () => {
  it("returns false when reactions is undefined", () => {
    expect(userHasReaction(undefined, "u1", "👍")).toBe(false);
  });

  it("returns false on an empty array", () => {
    expect(userHasReaction([], "u1", "👍")).toBe(false);
  });

  it("returns true when the user has that exact emoji", () => {
    const reactions = [makeReaction("u1", "👍")];
    expect(userHasReaction(reactions, "u1", "👍")).toBe(true);
  });

  it("returns false when another user has the emoji", () => {
    const reactions = [makeReaction("u2", "👍")];
    expect(userHasReaction(reactions, "u1", "👍")).toBe(false);
  });

  it("returns false when the user has a different emoji", () => {
    const reactions = [makeReaction("u1", "❤️")];
    expect(userHasReaction(reactions, "u1", "👍")).toBe(false);
  });
});
