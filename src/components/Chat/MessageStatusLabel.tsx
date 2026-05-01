/**
 * MessageStatusLabel — text-based delivery status shown under the most recent
 * message sent by the current user. Replaces the per-bubble check-mark icons
 * (sent/delivered/read) so the chat UI stays cleaner.
 */

import React from "react";
import { Text, StyleSheet } from "react-native";
import { MessageWithRelations } from "../../types/messaging";
import { formatHourMinute } from "../../utils";

type Status = NonNullable<MessageWithRelations["status"]>;

interface MessageStatusLabelProps {
  message: MessageWithRelations;
  /** Display name resolver for read receipts in group conversations. */
  resolveMemberName?: (userId: string) => string;
  isGroup?: boolean;
  /** Total number of *other* members in the conversation (excludes the sender). */
  otherMembersCount?: number;
}

const STATIC_LABELS: Partial<Record<Status, string>> = {
  sending: "Envoi…",
  queued: "Envoi…",
  failed: "Échec d'envoi",
  sent: "Envoyé",
  delivered: "Distribué",
};

function buildReadLabel(
  message: MessageWithRelations,
  isGroup: boolean,
  otherMembersCount: number,
  resolveMemberName?: (userId: string) => string,
): string {
  const readers = (message.delivery_statuses ?? []).filter((d) => !!d.read_at);
  if (!isGroup) {
    const reader = readers[0];
    return reader?.read_at ? `Vu à ${formatHourMinute(reader.read_at)}` : "Vu";
  }
  if (readers.length === 0) return "Vu";
  if (otherMembersCount > 0 && readers.length >= otherMembersCount) {
    const lastReadAt = readers
      .map((r) => r.read_at as string)
      .sort()
      .pop()!;
    return `Vu par tous à ${formatHourMinute(lastReadAt)}`;
  }
  const names = readers
    .map((r) => (resolveMemberName ? resolveMemberName(r.user_id) : r.user_id))
    .filter(Boolean);
  return names.length > 0 ? `Vu par ${names.join(", ")}` : "Vu";
}

export const MessageStatusLabel: React.FC<MessageStatusLabelProps> = ({
  message,
  resolveMemberName,
  isGroup = false,
  otherMembersCount = 0,
}) => {
  const { status } = message;
  if (!status) return null;
  const label =
    status === "read"
      ? buildReadLabel(message, isGroup, otherMembersCount, resolveMemberName)
      : STATIC_LABELS[status];
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
