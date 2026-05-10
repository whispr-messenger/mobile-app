/**
 * Types pour l'inbox de notifications (WHISPR-1437).
 * Correspond au contrat API du notification-service.
 */

export type InboxEventType =
  | "mention"
  | "reply"
  | "contact_request"
  | "missed_call";

export interface MentionPayload {
  from_user_id: string;
  from_username: string;
  conversation_id: string;
  message_id: string;
  preview: string;
  conversation_name?: string;
}

export interface ReplyPayload {
  from_user_id: string;
  from_username: string;
  conversation_id: string;
  message_id: string;
  preview: string;
}

export interface ContactRequestPayload {
  from_user_id: string;
  from_username: string;
  request_id: string;
}

export interface MissedCallPayload {
  from_user_id: string;
  from_username: string;
  call_id: string;
  call_type: string;
}

export type InboxItemPayload =
  | MentionPayload
  | ReplyPayload
  | ContactRequestPayload
  | MissedCallPayload;

export interface InboxItem {
  id: string;
  event_type: InboxEventType;
  payload: InboxItemPayload;
  read_at: string | null;
  created_at: string;
}

export interface InboxResponse {
  items: InboxItem[];
  next_cursor: string | null;
  unread_count: number;
}

export interface MarkReadResponse {
  marked: number;
}
