// Export all utilities from this file
export { FormattedText } from "./textFormatter";
export { logger } from "./logger";
export { copyToClipboard } from "./clipboard";
export { toSnakeCase, snakecaseKeys } from "./caseTransform";
export { isReachableUrl } from "./urlFilters";

/**
 * Format a username for display with a single "@" prefix.
 * Strips any existing leading "@" before prepending one,
 * preventing the "@@username" bug.
 */
export const formatUsername = (username: string | undefined | null): string => {
  if (!username) return "";
  const clean = username.replace(/^@+/, "");
  if (!clean) return "";
  return `@${clean}`;
};

export const normalizeUsername = (
  username: string | undefined | null,
): string => {
  const raw = (username ?? "").trim().replace(/^@+/, "").toLowerCase();
  if (!raw) return "";
  const normalized = raw.replace(/[^a-z0-9_]/g, "_").slice(0, 20);
  if (!/[a-z0-9]/.test(normalized)) return "";
  return normalized;
};

interface ConversationLike {
  type: "direct" | "group";
  display_name?: string;
  metadata?: Record<string, any>;
}

/**
 * Resolve the display label for a conversation in lists/headers.
 *
 * For direct conversations, prefers the enriched `display_name` produced by
 * the backend lookup (full name → username → phone number). Falls back to
 * "Utilisateur" when enrichment hasn't completed yet — never the misleading
 * generic "Contact" placeholder.
 *
 * For groups, prefers `metadata.name` and falls back to "Groupe".
 */
export const getConversationDisplayName = (
  conversation: ConversationLike,
): string => {
  if (conversation.type === "direct") {
    return conversation.display_name?.trim() || "Utilisateur";
  }
  return conversation.metadata?.name?.trim() || "Groupe";
};
