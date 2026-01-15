import { Conversation, Message } from '../../types/messaging';
import { Platform } from 'react-native';
import AuthService from '../AuthService';

const API_BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:4000/api/v1'
    : 'https://api.whispr.local/api/v1';

const getAuthHeaders = (): Record<string, string> => {
  try {
    const auth = AuthService.getInstance();
    const current = auth.getCurrentUser();
    if (current?.userId) {
      return {
        'X-User-Id': current.userId,
      };
    }
  } catch {
  }
  return {};
};

export const messagingAPI = {
  async getConversations(params?: {
    include_archived?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    const query = new URLSearchParams();

    if (params?.include_archived !== undefined) {
      query.append('include_archived', params.include_archived ? 'true' : 'false');
    }
    if (params?.limit !== undefined) {
      query.append('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.append('offset', String(params.offset));
    }

    const queryString = query.toString();
    const url = `${API_BASE_URL}/conversations${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(id)}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch conversation');
    }
    return response.json();
  },

  async deleteConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
  },

  async getMessages(
      conversationId: string,
      params?: {
        limit?: number;
        before?: string;
        after?: string;
    }
  ): Promise<Message[]> {
    const query = new URLSearchParams();

    if (params?.limit !== undefined) {
      query.append('limit', String(params.limit));
    }
    if (params?.before) {
      query.append('before', params.before);
    }
    if (params?.after) {
      query.append('after', params.after);
    }

    const queryString = query.toString();
    const url = `${API_BASE_URL}/conversations/${encodeURIComponent(
      conversationId
    )}/messages${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

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
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          content: message.content,
          message_type: message.message_type,
          client_random: message.client_random,
          metadata: message.metadata,
          reply_to_id: message.reply_to_id,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  },

  async editMessage(
    messageId: string,
    conversationId: string,
    newContent: string
  ): Promise<Message> {
    const response = await fetch(`${API_BASE_URL}/messages/${encodeURIComponent(messageId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        content: newContent,
        conversation_id: conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to edit message');
    }

    return response.json();
  },

  async deleteMessage(
    messageId: string,
    conversationId: string,
    deleteForEveryone: boolean
  ): Promise<void> {
    const url = `${API_BASE_URL}/messages/${encodeURIComponent(
      messageId
    )}?conversation_id=${encodeURIComponent(conversationId)}&delete_for_everyone=${
      deleteForEveryone ? 'true' : 'false'
    }`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete message');
    }
  },

  async addReaction(
    messageId: string,
    userId: string,
    reaction: string
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          user_id: userId,
          reaction,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to add reaction');
    }
  },

  async removeReaction(
    messageId: string,
    userId: string,
    reaction: string
  ): Promise<void> {
    const url = `${API_BASE_URL}/messages/${encodeURIComponent(
      messageId
    )}/reactions/${encodeURIComponent(reaction)}?user_id=${encodeURIComponent(userId)}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to remove reaction');
    }
  },

  async getMessageReactions(messageId: string) {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch message reactions');
    }

    return response.json();
  },

  async pinMessage(conversationId: string, messageId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/pin`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          conversation_id: conversationId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to pin message');
    }
  },

  async unpinMessage(conversationId: string, messageId: string): Promise<void> {
    const url = `${API_BASE_URL}/messages/${encodeURIComponent(
      messageId
    )}/pin?conversation_id=${encodeURIComponent(conversationId)}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to unpin message');
    }
  },

  async getPinnedMessages(conversationId: string): Promise<Message[]> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/pins`,
      {
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch pinned messages');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async getAttachments(messageId: string) {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/attachments`,
      {
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch attachments');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async addAttachment(messageId: string, attachment: any): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/attachments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(attachment),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to add attachment');
    }
  },

  async getUserInfo(
    userId: string
  ): Promise<{ id: string; display_name: string; username?: string } | null> {
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const user = await response.json();
    if (!user) {
      return null;
    }

    const displayName = user.first_name || user.username || 'Utilisateur';

    return {
      id: user.id,
      display_name: displayName,
      username: user.username,
    };
  },

  async getConversationMembers(
    conversationId: string
  ): Promise<Array<{ id: string; display_name: string; username?: string }>> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/members`,
      {
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch conversation members');
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((member: any) => ({
      id: member.id,
      display_name: member.display_name || member.username || 'Utilisateur',
      username: member.username,
    }));
  },

  async createDirectConversation(otherUserId: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        type: 'direct',
        other_user_id: otherUserId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create direct conversation');
    }

    return response.json();
  },

  async createGroupConversation(
    name: string,
    memberIds: string[],
    description?: string,
    photoUri?: string
  ): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        name,
        description,
        picture_url: photoUri,
        member_ids: memberIds,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create group');
    }

    const group = await response.json();
    const conversationId = group.conversation_id;

    if (!conversationId) {
      throw new Error('Group created without conversation_id');
    }

    const conversationResponse = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}`,
      {
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    if (!conversationResponse.ok) {
      throw new Error('Failed to fetch group conversation');
    }

    return conversationResponse.json();
  },
};
