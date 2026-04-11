/**
 * Local favorites storage using AsyncStorage.
 *
 * The backend does not support a favorite field on contacts,
 * so we persist favorite contact IDs on the device.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "whispr_favorite_contacts";

/**
 * Return the set of contact IDs marked as favorite.
 */
export const getFavoriteIds = async (): Promise<Set<string>> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const ids: string[] = JSON.parse(raw);
    return new Set(ids);
  } catch {
    return new Set();
  }
};

/**
 * Toggle the favorite state for a given contact ID.
 * Returns the new favorite state (`true` = now a favorite).
 */
export const toggleFavorite = async (contactId: string): Promise<boolean> => {
  const ids = await getFavoriteIds();
  const isFavorite = ids.has(contactId);
  if (isFavorite) {
    ids.delete(contactId);
  } else {
    ids.add(contactId);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  return !isFavorite;
};
