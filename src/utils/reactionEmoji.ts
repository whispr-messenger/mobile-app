/**
 * Validation et limites des réactions — aligné spec Whispr (Unicode, limites par message / utilisateur).
 * Back Elixir: validate_length(:reaction, max: 10)
 */

import type { MessageReaction } from "../types/messaging";

export const MAX_REACTION_GRAPHEMES = 10;
export const MAX_DISTINCT_REACTIONS_PER_MESSAGE = 50;
export const MAX_DISTINCT_REACTIONS_PER_USER_PER_MESSAGE = 5;

/** Emojis à refuser côté client (liste noire minimale — le back peut en ajouter) */
const REACTION_BLACKLIST = new Set<string>(["🖕", "☠️", "💀"]);

type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity?: "grapheme" },
) => { segment: (input: string) => Iterable<{ segment: string }> };

function countGraphemes(s: string): number {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterCtor })
    .Segmenter;
  try {
    if (typeof Segmenter === "function") {
      const seg = new Segmenter(undefined, { granularity: "grapheme" });
      return [...seg.segment(s)].length;
    }
  } catch {
    /* runtime sans Segmenter */
  }
  return [...s].length;
}

export function validateReactionEmoji(
  emoji: string,
): { ok: true } | { ok: false; reason: string } {
  const trimmed = emoji.trim();
  if (!trimmed) {
    return { ok: false, reason: "Emoji vide." };
  }
  const n = countGraphemes(trimmed);
  if (n < 1) {
    return { ok: false, reason: "Emoji non reconnu." };
  }
  if (n > MAX_REACTION_GRAPHEMES) {
    return {
      ok: false,
      reason: `Maximum ${MAX_REACTION_GRAPHEMES} caractères visuels par réaction.`,
    };
  }
  if (REACTION_BLACKLIST.has(trimmed)) {
    return { ok: false, reason: "Cet emoji n'est pas autorisé." };
  }
  return { ok: true };
}

/**
 * Vérifie les plafonds avant d'ajouter une nouvelle réaction (pas un retrait).
 */
export function checkReactionLimits(
  reactions: MessageReaction[] | undefined,
  userId: string,
  newEmoji: string,
): { ok: true } | { ok: false; reason: string } {
  const list = reactions || [];
  const distinctOnMessage = new Set(list.map((r) => r.reaction));
  const userDistinct = new Set(
    list.filter((r) => r.user_id === userId).map((r) => r.reaction),
  );

  if (
    !distinctOnMessage.has(newEmoji) &&
    distinctOnMessage.size >= MAX_DISTINCT_REACTIONS_PER_MESSAGE
  ) {
    return {
      ok: false,
      reason: `Ce message a déjà ${MAX_DISTINCT_REACTIONS_PER_MESSAGE} types de réactions différents.`,
    };
  }

  if (
    !userDistinct.has(newEmoji) &&
    userDistinct.size >= MAX_DISTINCT_REACTIONS_PER_USER_PER_MESSAGE
  ) {
    return {
      ok: false,
      reason: `Vous ne pouvez utiliser que ${MAX_DISTINCT_REACTIONS_PER_USER_PER_MESSAGE} emojis différents sur ce message.`,
    };
  }

  return { ok: true };
}

export function userHasReaction(
  reactions: MessageReaction[] | undefined,
  userId: string,
  emoji: string,
): boolean {
  return (reactions || []).some(
    (r) => r.user_id === userId && r.reaction === emoji,
  );
}
