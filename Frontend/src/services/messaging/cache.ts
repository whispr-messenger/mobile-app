/**
 * Cache Service - AsyncStorage for conversations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Conversation } from '../../types/messaging';

const CACHE_KEY = 'whispr.conversations.cache';
const CACHE_TIMESTAMP_KEY = 'whispr.conversations.cache.timestamp';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const cacheService = {
  /**
   * Save conversations to cache with timestamp
   */
  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(conversations));
      await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error saving conversations cache:', error);
    }
  },

  /**
   * Get conversations from cache if not stale
   */
  async getConversations(): Promise<Conversation[] | null> {
    try {
      const [data, timestamp] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY),
        AsyncStorage.getItem(CACHE_TIMESTAMP_KEY),
      ]);

      if (!data || !timestamp) {
        return null;
      }

      const cacheAge = Date.now() - parseInt(timestamp, 10);
      if (cacheAge > CACHE_TTL) {
        // Cache is stale
        return null;
      }

      return JSON.parse(data) as Conversation[];
    } catch (error) {
      console.error('Error reading conversations cache:', error);
      return null;
    }
  },

  /**
   * Clear conversations cache
   */
  async clearCache(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(CACHE_KEY),
        AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY),
      ]);
    } catch (error) {
      console.error('Error clearing conversations cache:', error);
    }
  },
};


