/**
 * Messaging Types - Based on backend specifications
 */

export type ConversationType = 'direct' | 'group';

export interface Conversation {
  id: string;
  type: ConversationType;
  external_group_id?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Frontend enriched fields
  last_message?: Message;
  unread_count?: number;
  participants?: ConversationParticipant[];
  is_pinned?: boolean; // From conversation_members for current user
  is_muted?: boolean; // Frontend local state
  is_archived?: boolean; // Frontend local state
  avatar_url?: string; // For direct conversations (other user) or groups
  display_name?: string; // Computed display name
}

export interface ConversationParticipant {
  user_id: string;
  settings: Record<string, any>;
  joined_at: string;
  last_read_at?: string;
  is_active: boolean;
  is_pinned: boolean;
  is_archived: boolean;
}

export type MessageType = 'text' | 'media' | 'system';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  reply_to_id?: string;
  message_type: MessageType;
  content: string; // Decrypted content for display
  metadata: Record<string, any>;
  client_random: number;
  sent_at: string;
  edited_at?: string;
  is_deleted: boolean;
  delete_for_everyone: boolean;
}

export interface DeliveryStatus {
  id: string;
  message_id: string;
  user_id: string;
  device_id?: string;
  delivered_at?: string;
  read_at?: string;
}

export interface MessageWithStatus extends Message {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  delivery_statuses?: DeliveryStatus[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string; // Emoji Unicode
  created_at: string;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  media_id: string;
  media_type: 'image' | 'video' | 'file' | 'audio';
  metadata: {
    filename?: string;
    size?: number;
    mime_type?: string;
    thumbnail_url?: string;
    duration?: number;
  };
  created_at: string;
}

export interface MessageWithRelations extends MessageWithStatus {
  reply_to?: Message;
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
  is_pinned?: boolean;
  reaction_summary?: Record<string, number>; // { '❤️': 5, '👍': 2 }
}


