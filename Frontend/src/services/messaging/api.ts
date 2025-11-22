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
    
    // Mock data - realistic conversations with names and avatars
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
        is_muted: false,
        is_archived: false,
        display_name: 'Elon Musk',
        avatar_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg/150px-Elon_Musk_Royal_Society_%28crop2%29.jpg',
        last_message: {
          id: 'msg-1',
          conversation_id: 'conv-1',
          sender_id: 'user-2',
          message_type: 'text',
          content: 'Mars mission is on track! 🚀',
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
        metadata: { name: 'Whispr Security Team' },
        created_at: new Date(now.getTime() - 86400000 * 5).toISOString(),
        updated_at: new Date(now.getTime() - 7200000).toISOString(),
        is_active: true,
        is_pinned: true,
        is_muted: false,
        is_archived: false,
        display_name: 'Whispr Security Team',
        avatar_url: 'https://i.pravatar.cc/150?img=5',
        last_message: {
          id: 'msg-2',
          conversation_id: 'conv-2',
          sender_id: 'user-3',
          message_type: 'text',
          content: 'Audit de sécurité terminé, rapport disponible',
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
        is_muted: false,
        is_archived: false,
        display_name: 'Bill Gates',
        avatar_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Bill_Gates_2018.jpg/150px-Bill_Gates_2018.jpg',
        last_message: {
          id: 'msg-3',
          conversation_id: 'conv-3',
          sender_id: 'user-4',
          message_type: 'text',
          content: 'New foundation project needs your input',
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
        metadata: { name: 'CTF Team 2025' },
        created_at: new Date(now.getTime() - 86400000 * 7).toISOString(),
        updated_at: new Date(now.getTime() - 3600000 * 2).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'CTF Team 2025',
        avatar_url: 'https://i.pravatar.cc/150?img=12',
        last_message: {
          id: 'msg-4',
          conversation_id: 'conv-4',
          sender_id: 'user-5',
          message_type: 'text',
          content: 'Challenge crypto résolu, flag: WHISPR{encrypted_data}',
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
        metadata: { name: 'DevOps Engineers' },
        created_at: new Date(now.getTime() - 86400000 * 10).toISOString(),
        updated_at: new Date(now.getTime() - 86400000 * 2).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'DevOps Engineers',
        avatar_url: 'https://i.pravatar.cc/150?img=15',
        last_message: {
          id: 'msg-5',
          conversation_id: 'conv-5',
          sender_id: 'user-6',
          message_type: 'text',
          content: 'Pipeline CI/CD mis à jour avec les nouveaux tests de sécurité',
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
        metadata: { name: 'Hackathon 2025' },
        created_at: new Date(now.getTime() - 86400000 * 15).toISOString(),
        updated_at: new Date(now.getTime() - 3600000 * 5).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'Hackathon 2025',
        avatar_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=150&h=150&fit=crop',
        last_message: {
          id: 'msg-6',
          conversation_id: 'conv-6',
          sender_id: 'user-7',
          message_type: 'text',
          content: 'Projet Whispr sélectionné pour la finale ! 🚀',
          metadata: {},
          client_random: 12350,
          sent_at: new Date(now.getTime() - 3600000 * 5).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 104,
      },
      {
        id: 'conv-7',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 1).toISOString(),
        updated_at: new Date(now.getTime() - 1800000).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'Vladimir Poutine',
        avatar_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Vladimir_Putin_17-11-2021_%28cropped%29.jpg/150px-Vladimir_Putin_17-11-2021_%28cropped%29.jpg',
        last_message: {
          id: 'msg-7',
          conversation_id: 'conv-7',
          sender_id: 'user-8',
          message_type: 'text',
          content: 'Meeting scheduled for next week',
          metadata: {},
          client_random: 12351,
          sent_at: new Date(now.getTime() - 1800000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 1,
      },
      {
        id: 'conv-8',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 4).toISOString(),
        updated_at: new Date(now.getTime() - 5400000).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'Queen Elizabeth II',
        avatar_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Queen_Elizabeth_II_in_March_2015.jpg/150px-Queen_Elizabeth_II_in_March_2015.jpg',
        last_message: {
          id: 'msg-8',
          conversation_id: 'conv-8',
          sender_id: 'user-9',
          message_type: 'text',
          content: 'Royal engagement confirmed for next month',
          metadata: {},
          client_random: 12352,
          sent_at: new Date(now.getTime() - 5400000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 8,
      },
      {
        id: 'conv-9',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 6).toISOString(),
        updated_at: new Date(now.getTime() - 3600000 * 3).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: true,
        is_archived: false,
        display_name: 'Mark Zuckerberg',
        avatar_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Mark_Zuckerberg_F8_2019_Keynote_%2832830578717%29_%28cropped%29.jpg/150px-Mark_Zuckerberg_F8_2019_Keynote_%2832830578717%29_%28cropped%29.jpg',
        last_message: {
          id: 'msg-9',
          conversation_id: 'conv-9',
          sender_id: 'user-10',
          message_type: 'text',
          content: 'Meta AI updates ready for review',
          metadata: {},
          client_random: 12353,
          sent_at: new Date(now.getTime() - 3600000 * 3).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 0,
      },
      {
        id: 'conv-10',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 8).toISOString(),
        updated_at: new Date(now.getTime() - 7200000).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'Jeff Bezos',
        avatar_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Jeff_Bezos_at_Amazon_Spheres_Grand_Opening_in_Seattle_-_2018_%2839074799225%29_%28cropped%29.jpg/150px-Jeff_Bezos_at_Amazon_Spheres_Grand_Opening_in_Seattle_-_2018_%2839074799225%29_%28cropped%29.jpg',
        last_message: {
          id: 'msg-10',
          conversation_id: 'conv-10',
          sender_id: 'user-11',
          message_type: 'text',
          content: 'Blue Origin mission scheduled for next month',
          metadata: {},
          client_random: 12354,
          sent_at: new Date(now.getTime() - 7200000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 3,
      },
      {
        id: 'conv-11',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 9).toISOString(),
        updated_at: new Date(now.getTime() - 10800000).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'Tim Cook',
        avatar_url: 'https://i.pravatar.cc/150?img=51',
        last_message: {
          id: 'msg-11',
          conversation_id: 'conv-11',
          sender_id: 'user-12',
          message_type: 'text',
          content: 'iPhone 16 launch event confirmed',
          metadata: {},
          client_random: 12355,
          sent_at: new Date(now.getTime() - 10800000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 5,
      },
      {
        id: 'conv-12',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 11).toISOString(),
        updated_at: new Date(now.getTime() - 14400000).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'Sundar Pichai',
        avatar_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Sundar_pichai.png/150px-Sundar_pichai.png',
        last_message: {
          id: 'msg-12',
          conversation_id: 'conv-12',
          sender_id: 'user-13',
          message_type: 'text',
          content: 'Google I/O 2025 planning in progress',
          metadata: {},
          client_random: 12356,
          sent_at: new Date(now.getTime() - 14400000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 2,
      },
      {
        id: 'conv-13',
        type: 'group',
        metadata: { name: 'Crypto Enthusiasts' },
        created_at: new Date(now.getTime() - 86400000 * 12).toISOString(),
        updated_at: new Date(now.getTime() - 18000000).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        display_name: 'Crypto Enthusiasts',
        avatar_url: 'https://i.pravatar.cc/150?img=47',
        last_message: {
          id: 'msg-13',
          conversation_id: 'conv-13',
          sender_id: 'user-14',
          message_type: 'text',
          content: 'Bitcoin reached new ATH! 🚀',
          metadata: {},
          client_random: 12357,
          sent_at: new Date(now.getTime() - 18000000).toISOString(),
          is_deleted: false,
          delete_for_everyone: false,
        },
        unread_count: 25,
      },
      {
        id: 'conv-14',
        type: 'direct',
        metadata: {},
        created_at: new Date(now.getTime() - 86400000 * 13).toISOString(),
        updated_at: new Date(now.getTime() - 21600000).toISOString(),
        is_active: true,
        is_pinned: false,
        is_muted: true,
        is_archived: false,
        display_name: 'Satya Nadella',
        avatar_url: 'https://i.pravatar.cc/150?img=52',
        last_message: {
          id: 'msg-14',
          conversation_id: 'conv-14',
          sender_id: 'user-15',
          message_type: 'text',
          content: 'Azure infrastructure updates completed',
          metadata: {},
          client_random: 12358,
          sent_at: new Date(now.getTime() - 21600000).toISOString(),
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

