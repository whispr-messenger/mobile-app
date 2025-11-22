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
    
    // Mock data
    return [];
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

