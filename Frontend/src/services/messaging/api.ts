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
        metadata: { name: 'Équipe Dev' },
        created_at: new Date(now.getTime() - 86400000 * 5).toISOString(),
        updated_at: new Date(now.getTime() - 7200000).toISOString(),
        is_active: true,
        last_message: {
          id: 'msg-2',
          conversation_id: 'conv-2',
          sender_id: 'user-3',
          message_type: 'text',
          content: 'Le déploiement est prêt !',
          metadata: {},
          client_random: 12346,
          sent_at: new Date(now.getTime() - 7200000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 0,
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
    
    return [];
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

