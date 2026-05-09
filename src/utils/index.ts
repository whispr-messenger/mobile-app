// Export all utilities from this file
export { FormattedText } from "./textFormatter";
export { logger } from "./logger";
export { copyToClipboard } from "./clipboard";
export { toSnakeCase, snakecaseKeys } from "./caseTransform";
export { isReachableUrl, isHttpUrl } from "./urlFilters";

/**
 * Format a username for display with a single "@" prefix.
 * Strips any existing leading "@" before prepending one,
 * preventing the "@@username" bug.
 */
/**
 * Format a Date / ISO date / timestamp as "HH:MM" using French 24-hour
 * formatting. Used wherever a time-of-day string appears in the UI
 * (timestamps, read receipts, scheduled-message previews).
 */
export const formatHourMinute = (date: Date | string | number): string => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatUsername = (username: string | undefined | null): string => {
  if (!username) return "";
  const clean = username.replace(/^@+/, "");
  if (!clean) return "";
  return `@${clean}`;
};

const USERNAME_INVALID_CHARS_RE = /[^\p{L}\p{N}_]/gu;
const USERNAME_HAS_ALNUM_RE = /[\p{L}\p{N}]/u;
const USERNAME_VALID_RE = /^[\p{L}\p{N}_]+$/u;

export const normalizeUsername = (
  username: string | undefined | null,
): string => {
  const raw = (username ?? "")
    .normalize("NFC")
    .trim()
    .replace(/^@+/, "")
    .toLocaleLowerCase();
  if (!raw) return "";
  const sanitized = raw.replace(USERNAME_INVALID_CHARS_RE, "_");
  const normalized = Array.from(sanitized).slice(0, 20).join("");
  if (!USERNAME_HAS_ALNUM_RE.test(normalized)) return "";
  return normalized;
};

export const isValidUsername = (
  username: string | undefined | null,
): boolean => {
  const value = (username ?? "").normalize("NFC").trim();
  if (!value) return false;
  return USERNAME_VALID_RE.test(value) && USERNAME_HAS_ALNUM_RE.test(value);
};

interface ConversationLike {
  type: "direct" | "group";
  display_name?: string;
  username?: string;
  phone_number?: string;
  metadata?: Record<string, any>;
}

/**
 * True when the given string looks like a raw UUID v1-v5 (backend sometimes
 * leaks the user_id straight into display_name when enrichment fails).
 */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUuid = (value: string | undefined | null): boolean =>
  !!value && UUID_RE.test(value.trim());
const isUuidLike = (value: string): boolean => UUID_RE.test(value.trim());

/**
 * Resolve the display label for a conversation in lists/headers.
 *
 * For direct conversations the preference chain is:
 *   display_name (real name from profile)
 *   -> username
 *   -> phone_number
 *   -> "Utilisateur"
 *
 * Values that look like UUIDs are treated as missing to avoid surfacing
 * raw user ids to the UI when enrichment hasn't completed yet.
 *
 * For groups, prefers `metadata.name` and falls back to "Groupe".
 */
export const getConversationDisplayName = (
  conversation: ConversationLike,
): string => {
  if (conversation.type === "direct") {
    const rawUsername =
      conversation.username ?? conversation.metadata?.username;
    const usernameLabel = rawUsername
      ? `@${String(rawUsername).replace(/^@+/, "")}`
      : "";
    const candidates: Array<string | undefined> = [
      conversation.display_name,
      usernameLabel,
      conversation.phone_number,
      conversation.metadata?.phone_number,
    ];
    for (const raw of candidates) {
      const trimmed = (raw ?? "").toString().trim();
      if (trimmed && !isUuidLike(trimmed)) {
        return trimmed;
      }
    }
    return "Utilisateur";
  }
  return conversation.metadata?.name?.trim() || "Groupe";
};
