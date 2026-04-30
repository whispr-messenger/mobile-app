/**
 * Offline Message Queue
 * Stores messages that failed to send due to no connectivity.
 * Messages are drained and sent when the WebSocket reconnects.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoCrypto from "expo-crypto";

const QUEUE_KEY = "whispr.offline.message.queue";

export interface QueuedMessage {
  id: string; // temp id (temp-{timestamp}-{random})
  conversation_id: string;
  content: string;
  message_type: "text" | "media" | "system";
  client_random: number;
  // WHISPR-1219 — UUID v4 generated at enqueue. Today messaging-service
  // dedupes on (sender_id, client_random) via a unique index, but
  // client_random is only ~20 bits → real birthday-collision risk past a
  // few hundred messages from the same sender. The UUID ships in the
  // body so backend can migrate the dedupe key without coordinating a
  // client release.
  client_message_id?: string;
  reply_to_id?: string;
  queued_at: string; // ISO timestamp
}

function generateUUID(): string {
  // Mirrors DeviceService.generateUUID — same fallback chain. RN ≥ 0.74
  // and modern web have crypto.randomUUID natively; expo-crypto is the
  // backstop on older runtimes and in jest where the global is polyfilled.
  const g = globalThis as unknown as {
    crypto?: { randomUUID?: () => string };
  };
  if (typeof g.crypto?.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  if (typeof ExpoCrypto.randomUUID === "function") {
    return ExpoCrypto.randomUUID();
  }
  const bytes = ExpoCrypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// WHISPR-1219 — module-level mutex around drainAll. Concurrent triggers
// (manual call + WS reconnect arriving in the same tick) used to send
// the same message twice. Second invocation now short-circuits and
// returns `skipped: true` so callers can tell apart "drained nothing"
// from "another drain is already in flight".
let drainPromise: Promise<{ sent: number; failed: number }> | null = null;

export interface DrainResult {
  sent: number;
  failed: number;
  /** True iff another drainAll() was already in flight when this one started. */
  skipped?: boolean;
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
      const persisted: QueuedMessage = {
        ...message,
        client_message_id: message.client_message_id ?? generateUUID(),
      };
      await AsyncStorage.setItem(
        QUEUE_KEY,
        JSON.stringify([...current, persisted]),
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

  /**
   * WHISPR-1060: drain every persisted message through `sendFn`.
   *
   * Intended to be called once on app start and again every time the shared
   * WebSocket transitions to `connected`. `sendFn` must return a settled
   * promise — resolved = drop from the queue, rejected = keep for next pass.
   *
   * Processing is sequential (not parallel) on purpose: bursts of catch-up
   * sends right after reconnect would otherwise race the server's rate
   * limiter, and preserving insertion order matters for chat UX.
   *
   * WHISPR-1219: concurrent invocations are rejected via a module-level
   * mutex. The second caller gets `{ sent: 0, failed: 0, skipped: true }`
   * immediately so each message is sent exactly once even if multiple
   * triggers fire on the same tick (manual button + WS reconnect).
   *
   * Returns the counts so callers can log or surface them.
   */
  async drainAll(
    sendFn: (message: QueuedMessage) => Promise<unknown>,
  ): Promise<DrainResult> {
    if (drainPromise) {
      return { sent: 0, failed: 0, skipped: true };
    }
    drainPromise = (async () => {
      const pending = await this.getAll();
      let sent = 0;
      let failed = 0;
      for (const queued of pending) {
        try {
          await sendFn(queued);
          await this.remove(queued.client_random);
          sent += 1;
        } catch {
          failed += 1;
        }
      }
      return { sent, failed };
    })();
    try {
      return await drainPromise;
    } finally {
      drainPromise = null;
    }
  },
};
