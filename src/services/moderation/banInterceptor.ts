/**
 * Ban Interceptor — checks on app launch if user has an active ban
 * and provides data to redirect to SanctionNoticeScreen.
 */

import { sanctionsAPI } from './moderationApi';
import type { UserSanction } from '../../types/moderation';

export interface BanCheckResult {
  banned: boolean;
  sanction?: UserSanction;
}

/**
 * Check whether the current user has an active ban (temp_ban or perm_ban).
 * Returns { banned: true, sanction } if so, { banned: false } otherwise.
 *
 * This should be called after authentication succeeds and before the user
 * reaches the main navigation flow.
 */
export const checkActiveBan = async (): Promise<BanCheckResult> => {
  try {
    const sanctions = await sanctionsAPI.getMySanctions();
    const activeBan = sanctions.find(
      (s) => s.active && (s.type === 'temp_ban' || s.type === 'perm_ban'),
    );
    return { banned: !!activeBan, sanction: activeBan };
  } catch {
    // Network / auth errors should not block app launch — fail open.
    return { banned: false };
  }
};

/**
 * Check whether a temp_ban has expired based on its expiresAt field.
 * Returns true if the ban should no longer be enforced.
 */
export const isBanExpired = (sanction: UserSanction): boolean => {
  if (sanction.type === 'perm_ban') return false;
  if (!sanction.expiresAt) return false;
  return new Date(sanction.expiresAt).getTime() < Date.now();
};

/**
 * Format the remaining ban duration for display.
 * Returns a human-readable string like "2 days, 3 hours".
 */
export const formatBanRemaining = (expiresAt: string): string => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
};

/**
 * Hook-compatible wrapper: call from useEffect at app root.
 *
 * Usage:
 * ```ts
 * useEffect(() => {
 *   onAppLaunchBanCheck(navigation);
 * }, []);
 * ```
 */
export const onAppLaunchBanCheck = async (
  navigation: { reset: (state: any) => void },
): Promise<void> => {
  const result = await checkActiveBan();
  if (result.banned && result.sanction) {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'SanctionNotice',
          params: { sanctionId: result.sanction.id },
        },
      ],
    });
  }
};
