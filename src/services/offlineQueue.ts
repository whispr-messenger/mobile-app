/**
 * Offline Message Queue
 * Stores messages that failed to send due to no connectivity.
 * Messages are drained and sent when the WebSocket reconnects.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "whispr.offline.message.queue";

export interface QueuedMessage {
  id: string; // temp id (temp-{timestamp}-{random})
  conversation_id: string;
  content: string;
  message_type: "text" | "media" | "system";
  client_random: number;
  reply_to_id?: string;
  queued_at: string; // ISO timestamp
}

export const offlineQueue = {
  async getAll(): Promise<QueuedMessage[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as QueuedMessage[];
    } catch {
      return [];
    }
  },

  async enqueue(message: QueuedMessage): Promise<void> {
    try {
      const current = await this.getAll();
      // Avoid duplicates by client_random
      if (current.some((m) => m.client_random === message.client_random))
        return;
      await AsyncStorage.setItem(
        QUEUE_KEY,
        JSON.stringify([...current, message]),
      );
    } catch (error) {
      console.error("[offlineQueue] enqueue error:", error);
    }
  },

  async remove(clientRandom: number): Promise<void> {
    try {
      const current = await this.getAll();
      await AsyncStorage.setItem(
        QUEUE_KEY,
        JSON.stringify(current.filter((m) => m.client_random !== clientRandom)),
      );
    } catch (error) {
      console.error("[offlineQueue] remove error:", error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(QUEUE_KEY);
    } catch (error) {
      console.error("[offlineQueue] clearAll error:", error);
    }
  },

  async getForConversation(conversationId: string): Promise<QueuedMessage[]> {
    const all = await this.getAll();
    return all.filter((m) => m.conversation_id === conversationId);
  },
};
