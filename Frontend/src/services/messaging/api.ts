/**
 * Messaging API Service - Mock implementation
 * Based on backend REST API specifications
 */

import { Conversation, Message } from '../../types/messaging';
import { mockStore } from './mockStore';

const API_BASE_URL = 'https://api.whispr.local/api/v1';

// Mock delay to simulate network
const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Generate mock messages for a conversation
const generateMockMessages = (conversationId: string, count: number = 50): Message[] => {
  const now = new Date();
  const messages: Message[] = [];
  const users = ['user-1', 'user-2'];
  const sampleTexts = [
    'Salut ! Comment ça va ?',
    'Ça va bien merci !',
    'Quoi de neuf ?',
    'Rien de spécial, et toi ?',
    'Super ! On se voit bientôt ?',
    'Oui, avec plaisir !',
    'Parfait, à bientôt alors 😊',
    'À plus !',
    'Hey, tu as vu le dernier film ?',
    'Non pas encore, il est bien ?',
    'Oui excellent, je te le recommande !',
    'Ok je vais le regarder ce weekend',
    'Tu veux qu\'on y aille ensemble ?',
    'Avec plaisir !',
    'Parfait, je te contacte demain',
    'Ok super !',
    'Bonjour, comment allez-vous ?',
    'Très bien merci, et vous ?',
    'Parfait, merci !',
    'Quel temps fait-il chez vous ?',
    'Il fait beau ici, et chez toi ?',
    'Pareil, super journée !',
    'Tu as fini le projet ?',
    'Oui, enfin ! Ça m\'a pris du temps',
    'Bravo ! Tu as fait du bon travail',
    'Merci beaucoup !',
    'De rien, c\'est mérité',
    'On fait quoi ce soir ?',
    'Je ne sais pas, tu as une idée ?',
    'On pourrait aller au cinéma',
    'Bonne idée !',
    'Ok je réserve les places',
    'Parfait, merci !',
  ];

  for (let i = 0; i < count; i++) {
    const senderId = users[i % users.length];
    const textIndex = i % sampleTexts.length;
    const hoursAgo = Math.floor(i / 2); // Messages espacés de 30 min
    const minutesOffset = (i % 2) * 30;
    const messageId = `msg-${conversationId}-${i}`;
    
    messages.push({
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: 'text' as const,
      content: sampleTexts[textIndex],
      metadata: {},
      client_random: 10000 + i,
      sent_at: new Date(now.getTime() - (hoursAgo * 3600000) - (minutesOffset * 60000)).toISOString(),
      is_deleted: false,
      delete_for_everyone: false,
      // Add reply_to_id for some messages
      reply_to_id: i > 5 && i % 7 === 0 ? `msg-${conversationId}-${i - 3}` : undefined,
      // Add edited_at for some messages
      edited_at: i > 10 && i % 11 === 0 ? new Date(now.getTime() - (hoursAgo * 3600000) - (minutesOffset * 60000) + 60000).toISOString() : undefined,
    });

    // Add some mock reactions to messages
    if (i > 3 && i % 5 === 0) {
      const reactions = ['❤️', '👍', '😂'];
      reactions.forEach((emoji, idx) => {
        mockStore.addReaction(messageId, `user-${(idx % 2) + 1}`, emoji);
      });
    }
  }

  return messages.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
};

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
    
    // Get or generate mock messages
    let allMessages = mockStore.getMessages(conversationId);
    if (allMessages.length === 0) {
      allMessages = generateMockMessages(conversationId, 50);
      mockStore.setMessages(conversationId, allMessages);
    }

    const limit = params?.limit || 50;
    let filteredMessages = [...allMessages];

    // Filter by before timestamp (for pagination - older messages)
    if (params?.before) {
      const beforeDate = new Date(params.before);
      filteredMessages = filteredMessages.filter(
        msg => new Date(msg.sent_at) < beforeDate
      );
    }

    // Filter by after timestamp (for new messages)
    if (params?.after) {
      const afterDate = new Date(params.after);
      filteredMessages = filteredMessages.filter(
        msg => new Date(msg.sent_at) > afterDate
      );
    }

    // Filter out deleted messages (unless delete_for_everyone is false)
    filteredMessages = filteredMessages.filter(
      msg => !msg.is_deleted || !msg.delete_for_everyone
    );

    // Sort by sent_at descending (newest first)
    filteredMessages.sort((a, b) => 
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );

    // Limit results
    return filteredMessages.slice(0, limit);
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
      reply_to_id?: string;
    }
  ): Promise<Message> {
    await mockDelay(300);
    
    const newMessage: Message = {
      id: `msg-${conversationId}-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: 'user-1', // Mock user ID
      message_type: message.message_type,
      content: message.content,
      metadata: message.metadata || {},
      client_random: message.client_random,
      sent_at: new Date().toISOString(),
      is_deleted: false,
      delete_for_everyone: false,
      reply_to_id: message.reply_to_id,
    };

    mockStore.addMessage(conversationId, newMessage);
    return newMessage;
  },

  /**
   * PUT /api/v1/messages/:id
   * Edit a message
   */
  async editMessage(
    messageId: string,
    conversationId: string,
    newContent: string
  ): Promise<Message> {
    await mockDelay(300);
    
    const messages = mockStore.getMessages(conversationId);
    const message = messages.find(m => m.id === messageId);
    
    if (!message) {
      throw new Error('Message not found');
    }

    // Check if message can be edited (within 24 hours)
    const messageAge = Date.now() - new Date(message.sent_at).getTime();
    const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (messageAge > maxEditAge) {
      throw new Error('Message too old to edit');
    }

    const updatedMessage: Message = {
      ...message,
      content: newContent,
      edited_at: new Date().toISOString(),
    };

    mockStore.updateMessage(conversationId, messageId, updatedMessage);
    return updatedMessage;
  },

  /**
   * DELETE /api/v1/messages/:id
   * Delete a message
   */
  async deleteMessage(
    messageId: string,
    conversationId: string,
    deleteForEveryone: boolean
  ): Promise<void> {
    await mockDelay(300);
    
    mockStore.deleteMessage(conversationId, messageId, deleteForEveryone);
  },

  /**
   * POST /api/v1/messages/:id/reactions
   * Add or toggle a reaction
   */
  async addReaction(
    messageId: string,
    userId: string,
    reaction: string
  ): Promise<void> {
    await mockDelay(200);
    
    mockStore.addReaction(messageId, userId, reaction);
  },

  /**
   * DELETE /api/v1/messages/:id/reactions/:reaction
   * Remove a reaction
   */
  async removeReaction(
    messageId: string,
    userId: string,
    reaction: string
  ): Promise<void> {
    await mockDelay(200);
    
    mockStore.removeReaction(messageId, userId, reaction);
  },

  /**
   * GET /api/v1/messages/:id/reactions
   * Get reactions for a message
   */
  async getMessageReactions(messageId: string) {
    await mockDelay(200);
    
    const reactions = mockStore.getReactions(messageId);
    const summary = mockStore.getReactionSummary(messageId);
    
    return {
      reactions,
      summary,
    };
  },

  /**
   * POST /api/v1/messages/:id/pin
   * Pin a message
   */
  async pinMessage(conversationId: string, messageId: string): Promise<void> {
    await mockDelay(200);
    
    mockStore.pinMessage(conversationId, messageId);
  },

  /**
   * DELETE /api/v1/messages/:id/pin
   * Unpin a message
   */
  async unpinMessage(conversationId: string, messageId: string): Promise<void> {
    await mockDelay(200);
    
    mockStore.unpinMessage(conversationId, messageId);
  },

  /**
   * GET /api/v1/conversations/:id/pins
   * Get pinned messages for a conversation
   */
  async getPinnedMessages(conversationId: string): Promise<Message[]> {
    await mockDelay(300);
    
    const pinnedIds = mockStore.getPinnedMessages(conversationId);
    const allMessages = mockStore.getMessages(conversationId);
    
    return allMessages.filter(msg => pinnedIds.includes(msg.id));
  },
};

