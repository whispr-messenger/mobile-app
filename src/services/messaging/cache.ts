/**
 * Cache Service - AsyncStorage for conversations
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Conversation, MessageWithRelations } from "../../types/messaging";

const CACHE_KEY = "whispr.conversations.cache";
const CACHE_TIMESTAMP_KEY = "whispr.conversations.cache.timestamp";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const MESSAGES_CACHE_KEY_PREFIX = "whispr.messages.cache.";
const MESSAGES_CACHE_TIMESTAMP_PREFIX = "whispr.messages.cache.timestamp.";
const MESSAGES_CACHE_TTL = 60 * 60 * 1000;
const MESSAGES_CACHE_MAX = 75;

function normalizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function messagesKey(conversationId: string): string {
  return `${MESSAGES_CACHE_KEY_PREFIX}${normalizeKeyPart(conversationId)}`;
}

function messagesTimestampKey(conversationId: string): string {
  return `${MESSAGES_CACHE_TIMESTAMP_PREFIX}${normalizeKeyPart(conversationId)}`;
}

export const cacheService = {
  /**
   * Save conversations to cache with timestamp
   */
  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(conversations));
      await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error("Error saving conversations cache:", error);
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
      console.error("Error reading conversations cache:", error);
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
      console.error("Error clearing conversations cache:", error);
    }
  },

  async saveMessages(
    conversationId: string,
    messages: MessageWithRelations[],
  ): Promise<void> {
    try {
      if (!conversationId) return;
      const trimmed = Array.isArray(messages)
        ? messages
            .filter((m) => m && typeof m.id === "string")
            .slice(0, MESSAGES_CACHE_MAX)
        : [];
      await AsyncStorage.setItem(
        messagesKey(conversationId),
        JSON.stringify(trimmed),
      );
      await AsyncStorage.setItem(
        messagesTimestampKey(conversationId),
        Date.now().toString(),
      );
    } catch (error) {
      console.error("Error saving messages cache:", error);
    }
  },

  async getMessages(
    conversationId: string,
  ): Promise<MessageWithRelations[] | null> {
    try {
      if (!conversationId) return null;
      const [data, timestamp] = await Promise.all([
        AsyncStorage.getItem(messagesKey(conversationId)),
        AsyncStorage.getItem(messagesTimestampKey(conversationId)),
      ]);

      if (!data || !timestamp) {
        return null;
      }

      const cacheAge = Date.now() - parseInt(timestamp, 10);
      if (cacheAge > MESSAGES_CACHE_TTL) {
        return null;
      }

      const parsed = JSON.parse(data) as MessageWithRelations[];
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      console.error("Error reading messages cache:", error);
      return null;
    }
  },

  async clearMessages(conversationId: string): Promise<void> {
    try {
      if (!conversationId) return;
      await Promise.all([
        AsyncStorage.removeItem(messagesKey(conversationId)),
        AsyncStorage.removeItem(messagesTimestampKey(conversationId)),
      ]);
    } catch (error) {
      console.error("Error clearing messages cache:", error);
    }
  },

  async clearAllMessages(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const targets = keys.filter(
        (k) =>
          k.startsWith(MESSAGES_CACHE_KEY_PREFIX) ||
          k.startsWith(MESSAGES_CACHE_TIMESTAMP_PREFIX),
      );
      if (targets.length === 0) return;
      await AsyncStorage.multiRemove(targets);
    } catch (error) {
      console.error("Error clearing all messages cache:", error);
    }
  },
};
