// Export all utilities from this file
export { FormattedText } from "./textFormatter";
export { logger } from "./logger";
export { copyToClipboard } from "./clipboard";

/**
 * Format a username for display with a single "@" prefix.
 * Strips any existing leading "@" before prepending one,
 * preventing the "@@username" bug.
 */
export const formatUsername = (username: string | undefined | null): string => {
  if (!username) return "@";
  const clean = username.replace(/^@+/, "");
  return `@${clean}`;
};
