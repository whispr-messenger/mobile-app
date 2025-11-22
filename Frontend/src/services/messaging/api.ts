/**
 * Messaging API Service - Mock implementation
 * Based on backend REST API specifications
 */

import { Conversation, Message } from '../../types/messaging';

const API_BASE_URL = 'https://api.whispr.local/api/v1';

// Mock delay to simulate network
const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const messagingAPI = {
  /**
   * GET /api/v1/conversations
   * List conversations with pagination
   */
  async getConversations(params?: {
    include_archived?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    await mockDelay(600);
    
    // Mock data - realistic conversations
    const now = new Date();
    const mockConversations: Conversation[] = [
      {
        id: 'conv-1',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 2).toISOString(),
        updated_at: new Date(now.getTime() - 3600000).toISOString(),
        is_active: true,
        is_pinned: true,
        last_message: {
          id: 'msg-1',
          conversation_id: 'conv-1',
          sender_id: 'user-2',
          message_type: 'text',
          content: 'Salut, ça va ?',
          metadata: {},
          client_random: 12345,
          sent_at: new Date(now.getTime() - 3600000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 2,
      },
      {
        id: 'conv-2',
        type: 'group',
        metadata: { name: 'Whispr project Team' },
        created_at: new Date(now.getTime() - 86400000 * 5).toISOString(),
        updated_at: new Date(now.getTime() - 7200000).toISOString(),
        is_active: true,
        is_pinned: true,
        last_message: {
          id: 'msg-2',
          conversation_id: 'conv-2',
          sender_id: 'user-3',
          message_type: 'text',
          content: 'Tudy GIF',
          metadata: {},
          client_random: 12346,
          sent_at: new Date(now.getTime() - 7200000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 0,
      },
      {
        id: 'conv-3',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 3).toISOString(),
        updated_at: new Date(now.getTime() - 86400000 * 1).toISOString(),
        is_active: true,
        is_pinned: true,
        last_message: {
          id: 'msg-3',
          conversation_id: 'conv-3',
          sender_id: 'user-4',
          message_type: 'text',
          content: 'I will be available on that day !!',
          metadata: {},
          client_random: 12347,
          sent_at: new Date(now.getTime() - 86400000 * 1).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 0,
      },
      {
        id: 'conv-4',
        type: 'group',
        metadata: { name: 'Summer Trip 2025' },
        created_at: new Date(now.getTime() - 86400000 * 7).toISOString(),
        updated_at: new Date(now.getTime() - 3600000 * 2).toISOString(),
        is_active: true,
        is_pinned: false,
        last_message: {
          id: 'msg-4',
          conversation_id: 'conv-4',
          sender_id: 'user-5',
          message_type: 'text',
          content: 'image.png, Suggested by @amin',
          metadata: {},
          client_random: 12348,
          sent_at: new Date(now.getTime() - 3600000 * 2).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 14,
      },
      {
        id: 'conv-5',
        type: 'group',
        metadata: { name: 'Design Community' },
        created_at: new Date(now.getTime() - 86400000 * 10).toISOString(),
        updated_at: new Date(now.getTime() - 86400000 * 2).toISOString(),
        is_active: true,
        is_pinned: false,
        last_message: {
          id: 'msg-5',
          conversation_id: 'conv-5',
          sender_id: 'user-6',
          message_type: 'text',
          content: 'IOS 13 Design Kit. Turn your ideas into incredible wor...',
          metadata: {},
          client_random: 12349,
          sent_at: new Date(now.getTime() - 86400000 * 2).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 63,
      },
      {
        id: 'conv-6',
        type: 'group',
        metadata: { name: 'Hakathon buddies' },
        created_at: new Date(now.getTime() - 86400000 * 15).toISOString(),
        updated_at: new Date(now.getTime() - 3600000 * 5).toISOString(),
        is_active: true,
        is_pinned: false,
        last_message: {
          id: 'msg-6',
          conversation_id: 'conv-6',
          sender_id: 'user-7',
          message_type: 'text',
          content: 'Sketch App. 🧑‍💻',
          metadata: {},
          client_random: 12350,
          sent_at: new Date(now.getTime() - 3600000 * 5).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 104,
      },
    ];
    
    return mockConversations;
  },

  /**
   * GET /api/v1/conversations/:id
   * Get conversation details
   */
  async getConversation(id: string): Promise<Conversation> {
    await mockDelay(400);
    
    throw new Error('Not implemented');
  },

  /**
   * GET /api/v1/conversations/:id/messages
   * Get messages for a conversation with pagination
   */
  async getMessages(
    conversationId: string,
    params?: {
      limit?: number;
      before?: string;
      after?: string;
    }
  ): Promise<Message[]> {
    await mockDelay(500);
    
    // Mock messages
    const now = new Date();
    const mockMessages: Message[] = [
      {
        id: 'msg-1',
        conversation_id: conversationId,
        sender_id: 'user-2',
        message_type: 'text',
        content: 'Salut ! Comment ça va ?',
        metadata: {},
        client_random: 12345,
        sent_at: new Date(now.getTime() - 3600000).toISOString(),
        is_deleted: false,
        delete_for_everyone: false,
      },
      {
        id: 'msg-2',
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Ça va bien merci !',
        metadata: {},
        client_random: 12346,
        sent_at: new Date(now.getTime() - 3300000).toISOString(),
        is_deleted: false,
        delete_for_everyone: false,
      },
    ];
    
    return mockMessages;
  },

  /**
   * POST /api/v1/conversations/:id/messages
   * Send a new message
   */
  async sendMessage(
    conversationId: string,
    message: {
      content: string;
      message_type: 'text' | 'media' | 'system';
      client_random: number;
      metadata?: Record<string, any>;
    }
  ): Promise<Message> {
    await mockDelay(300);
    
    throw new Error('Not implemented');
  },
};

