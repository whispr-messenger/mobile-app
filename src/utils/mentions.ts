/**
 * Mention detection: scan the caret area of `text` for an unfinished @mention.
 *
 * Rules:
 *   - Only groups with at least one member can trigger a mention.
 *   - The @ character must be the last one in `text` (so chaining mentions
 *     is supported: "@alice hi @b" still detects the trailing mention).
 *   - The mention stops at the first space, or runs to the end of the string.
 *
 * Returns the detected mention's query + its @ position, or null if no
 * active mention is present.
 */
export type MentionDetection = {
  query: string;
  startIndex: number;
};

export const detectMention = (
  text: string,
  conversationType: "direct" | "group",
  memberCount: number,
): MentionDetection | null => {
  if (conversationType !== "group" || memberCount === 0) return null;

  const lastAtIndex = text.lastIndexOf("@");
  if (lastAtIndex === -1) return null;

  const afterAt = text.substring(lastAtIndex + 1);
  const spaceIndex = afterAt.indexOf(" ");

  // A trailing space (but no word after it) still counts as an in-progress
  // mention, matching the previous inline behaviour.
  const isActive = spaceIndex === -1 || spaceIndex === afterAt.length - 1;
  if (!isActive) return null;

  const query = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
  return { query: query.toLowerCase(), startIndex: lastAtIndex };
};
