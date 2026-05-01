/**
 * MessageStatusLabel — text-based delivery status shown under the most recent
 * message sent by the current user. Replaces the per-bubble check-mark icons
 * (sent/delivered/read) so the chat UI stays cleaner.
 */

import React from "react";
import { Text, StyleSheet } from "react-native";
import { MessageWithRelations } from "../../types/messaging";

interface MessageStatusLabelProps {
  message: MessageWithRelations;
  /** Display name resolver for read receipts in group conversations. */
  resolveMemberName?: (userId: string) => string;
  isGroup?: boolean;
  /** Total number of *other* members in the conversation (excludes the sender). */
  otherMembersCount?: number;
}

function formatReadTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const MessageStatusLabel: React.FC<MessageStatusLabelProps> = ({
  message,
  resolveMemberName,
  isGroup = false,
  otherMembersCount = 0,
}) => {
  const { status, delivery_statuses } = message;

  if (!status) return null;

  let label: string | null = null;

  if (status === "sending" || status === "queued") {
    label = "Envoi…";
  } else if (status === "failed") {
    label = "Échec d'envoi";
  } else if (status === "sent") {
    label = "Envoyé";
  } else if (status === "delivered") {
    label = "Distribué";
  } else if (status === "read") {
    if (isGroup) {
      const readers = (delivery_statuses ?? []).filter((d) => !!d.read_at);
      if (readers.length === 0) {
        label = "Vu";
      } else if (otherMembersCount > 0 && readers.length >= otherMembersCount) {
        // Use the most recent read_at across readers for the time stamp.
        const lastReadAt = readers
          .map((r) => r.read_at as string)
          .sort()
          .pop()!;
        label = `Vu par tous à ${formatReadTime(lastReadAt)}`;
      } else {
        const names = readers
          .map((r) =>
            resolveMemberName ? resolveMemberName(r.user_id) : r.user_id,
          )
          .filter(Boolean);
        label = names.length > 0 ? `Vu par ${names.join(", ")}` : "Vu";
      }
    } else {
      const reader = (delivery_statuses ?? []).find((d) => !!d.read_at);
      label = reader?.read_at ? `Vu à ${formatReadTime(reader.read_at)}` : "Vu";
    }
  }

  if (!label) return null;

  return <Text style={styles.label}>{label}</Text>;
};

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
    marginRight: 4,
    textAlign: "right",
  },
});
