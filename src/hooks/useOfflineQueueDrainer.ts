/**
 * useOfflineQueueDrainer — WHISPR-1060
 *
 * Global drainer for the persisted offline message queue. Mount once at
 * the root of the authenticated tree. Triggers:
 *
 *   1. Once on mount (handles the "user relaunched the app while pending
 *      messages are sitting in AsyncStorage" case).
 *   2. Every time the shared WebSocket transitions to `connected`
 *      (handles reconnection after a flaky network).
 *
 * The per-screen drainer in ChatScreen used to run only when the affected
 * conversation was open, which meant messages sent while the user was in
 * another conversation (or had closed the app) stayed pending forever.
 */

import { useEffect, useRef } from "react";
import { getSharedSocket } from "../services/messaging/websocket";
import { messagingAPI } from "../services/messaging/api";
import { offlineQueue } from "../services/offlineQueue";
import { logger } from "../utils/logger";

export function useOfflineQueueDrainer(): void {
  // Guard against concurrent drain passes: if a reconnect fires while a
  // previous drain is still in flight, skip — it'll retry on the next
  // `connected` event anyway.
  const inFlight = useRef(false);

  useEffect(() => {
    const drain = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const { sent, failed } = await offlineQueue.drainAll(async (queued) => {
          await messagingAPI.sendMessage(queued.conversation_id, {
            content: queued.content,
            message_type: queued.message_type,
            client_random: queued.client_random,
            metadata: {},
            reply_to_id: queued.reply_to_id,
          });
        });
        if (sent > 0 || failed > 0) {
          logger.info(
            "offlineQueueDrainer",
            `Drained offline queue: ${sent} sent, ${failed} still pending`,
          );
        }
      } catch (err) {
        logger.error("offlineQueueDrainer", "Drain pass crashed", err);
      } finally {
        inFlight.current = false;
      }
    };

    // Kick off one drain as soon as we mount — covers the "app relaunched
    // while offline messages are still persisted" case.
    void drain();

    const socket = getSharedSocket();
    const unsubscribe = socket.addConnectionStateListener((state) => {
      if (state === "connected") {
        void drain();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
