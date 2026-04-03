import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Conversation, Message } from '../../types/messaging';
import { TokenService } from '../TokenService';

/**
 * Messaging REST base: `{apiBaseUrl}/api/v1` (see app.json `extra.apiBaseUrl`).
 * Web dev keeps localhost:4000 for local messaging service.
 */
function getMessagingApiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  if (Platform.OS === 'web') {
    return 'http://localhost:4000/api/v1';
  }
  const configured = extra?.apiBaseUrl;
  if (configured) {
    return `${configured.replace(/\/+$/, '')}/api/v1`;
  }
  if (__DEV__) {
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${host}:4000/api/v1`;
  }
  return 'https://whispr.epitech.beer/api/v1';
}

const API_BASE_URL = getMessagingApiBaseUrl();

async function buildAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = { ...extra };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

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
      headers: await buildAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(id)}`, {
      headers: await buildAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch conversation');
    }
    return response.json();
  },

  async deleteConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await buildAuthHeaders(),
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
      headers: await buildAuthHeaders(),
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
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: await buildAuthHeaders(),
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
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: await buildAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to remove reaction');
    }
  },

  async getMessageReactions(messageId: string) {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        headers: await buildAuthHeaders(),
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
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: await buildAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to unpin message');
    }
  },

  async getPinnedMessages(conversationId: string): Promise<Message[]> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/pins`,
      {
        headers: await buildAuthHeaders(),
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
        headers: await buildAuthHeaders(),
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
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: await buildAuthHeaders(),
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
        headers: await buildAuthHeaders(),
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
      headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
        headers: await buildAuthHeaders(),
      }
    );

    if (!conversationResponse.ok) {
      throw new Error('Failed to fetch group conversation');
    }

    return conversationResponse.json();
  },

  // ─── Conversation management ────────────────────────────────────────────────

  async updateConversation(
    id: string,
    updates: { name?: string; description?: string; picture_url?: string }
  ): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update conversation');
    return response.json();
  },

  async pinConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(id)}/pin`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to pin conversation');
  },

  async unpinConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(id)}/pin`, {
      method: 'DELETE',
      headers: await buildAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to unpin conversation');
  },

  async searchConversations(query: string): Promise<Conversation[]> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/search?q=${encodeURIComponent(query)}`,
      { headers: await buildAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to search conversations');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  // ─── Member management ──────────────────────────────────────────────────────

  async addConversationMember(conversationId: string, userId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/members`,
      {
        method: 'POST',
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ user_id: userId }),
      }
    );
    if (!response.ok) throw new Error('Failed to add member');
  },

  async removeConversationMember(conversationId: string, userId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: await buildAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to remove member');
  },

  async changeConversationMemberRole(
    conversationId: string,
    userId: string,
    role: 'admin' | 'moderator' | 'member'
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}/role`,
      {
        method: 'PATCH',
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role }),
      }
    );
    if (!response.ok) throw new Error('Failed to change member role');
  },

  // ─── Message delivery/read status ───────────────────────────────────────────

  async markMessageDelivered(messageId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/delivered`,
      {
        method: 'POST',
        headers: await buildAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to mark message as delivered');
  },

  async markMessageRead(messageId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/read`,
      {
        method: 'POST',
        headers: await buildAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to mark message as read');
  },

  // ─── Standalone attachments ──────────────────────────────────────────────────

  async uploadAttachment(
    file: { uri: string; name: string; type: string },
    conversationId?: string
  ): Promise<{ id: string; url: string; name: string; size: number; mime_type: string }> {
    const formData = new FormData();
    formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    if (conversationId) formData.append('conversation_id', conversationId);

    const token = await TokenService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/attachments/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload attachment');
    return response.json();
  },

  async downloadAttachment(attachmentId: string): Promise<string> {
    const response = await fetch(
      `${API_BASE_URL}/attachments/${encodeURIComponent(attachmentId)}/download`,
      { headers: await buildAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to download attachment');
    // Returns the blob URL or redirect URL
    const data = await response.json().catch(() => null);
    return data?.url ?? response.url;
  },
};
