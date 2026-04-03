import { Conversation, Message } from "../../types/messaging";
import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";

const API_BASE_URL = `${getApiBaseUrl()}/messaging/api/v1`;

// Backend wraps responses in { data: ... } — unwrap if present
const unwrap = async (response: Response) => {
  const json = await response.json();
  return json?.data !== undefined ? json.data : json;
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await TokenService.getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

export const messagingAPI = {
  async getConversations(params?: {
    include_archived?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    const query = new URLSearchParams();

    if (params?.include_archived !== undefined) {
      query.append(
        "include_archived",
        params.include_archived ? "true" : "false",
      );
    }
    if (params?.limit !== undefined) {
      query.append("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.append("offset", String(params.offset));
    }

    const queryString = query.toString();
    const url = `${API_BASE_URL}/conversations${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: {
        ...(await getAuthHeaders()),
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch conversations");
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? data : [];
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(id)}`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch conversation");
    }
    return unwrap(response);
  },

  async deleteConversation(id: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete conversation");
    }
  },

  async getMessages(
    conversationId: string,
    params?: {
      limit?: number;
      before?: string;
      after?: string;
      search?: string;
    },
  ): Promise<Message[]> {
    const query = new URLSearchParams();

    if (params?.limit !== undefined) {
      query.append("limit", String(params.limit));
    }
    if (params?.before) {
      query.append("before", params.before);
    }
    if (params?.after) {
      query.append("after", params.after);
    }
    if (params?.search) {
      query.append("search", params.search);
    }

    const queryString = query.toString();
    const url = `${API_BASE_URL}/conversations/${encodeURIComponent(
      conversationId,
    )}/messages${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: {
        ...(await getAuthHeaders()),
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? data : [];
  },

  async sendMessage(
    conversationId: string,
    message: {
      content: string;
      message_type: "text" | "media" | "system";
      client_random: number;
      metadata?: Record<string, any>;
      reply_to_id?: string;
    },
  ): Promise<Message> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          content: message.content,
          message_type: message.message_type,
          client_random: message.client_random,
          metadata: message.metadata,
          reply_to_id: message.reply_to_id,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    return unwrap(response);
  },

  async editMessage(
    messageId: string,
    conversationId: string,
    newContent: string,
  ): Promise<Message> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          content: newContent,
          conversation_id: conversationId,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to edit message");
    }

    return unwrap(response);
  },

  async deleteMessage(
    messageId: string,
    conversationId: string,
    deleteForEveryone: boolean,
  ): Promise<void> {
    const url = `${API_BASE_URL}/messages/${encodeURIComponent(
      messageId,
    )}?conversation_id=${encodeURIComponent(conversationId)}&delete_for_everyone=${
      deleteForEveryone ? "true" : "false"
    }`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...(await getAuthHeaders()),
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete message");
    }
  },

  async addReaction(
    messageId: string,
    userId: string,
    reaction: string,
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          user_id: userId,
          reaction,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to add reaction");
    }
  },

  async removeReaction(
    messageId: string,
    userId: string,
    reaction: string,
  ): Promise<void> {
    const url = `${API_BASE_URL}/messages/${encodeURIComponent(
      messageId,
    )}/reactions/${encodeURIComponent(reaction)}?user_id=${encodeURIComponent(userId)}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...(await getAuthHeaders()),
      },
    });

    if (!response.ok) {
      throw new Error("Failed to remove reaction");
    }
  },

  async getMessageReactions(messageId: string) {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch message reactions");
    }

    return unwrap(response);
  },

  async pinMessage(conversationId: string, messageId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/pin`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          conversation_id: conversationId,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to pin message");
    }
  },

  async unpinMessage(conversationId: string, messageId: string): Promise<void> {
    const url = `${API_BASE_URL}/messages/${encodeURIComponent(
      messageId,
    )}/pin?conversation_id=${encodeURIComponent(conversationId)}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...(await getAuthHeaders()),
      },
    });

    if (!response.ok) {
      throw new Error("Failed to unpin message");
    }
  },

  async getPinnedMessages(conversationId: string): Promise<Message[]> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/pins`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch pinned messages");
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? data : [];
  },

  async getAttachments(messageId: string) {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/attachments`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch attachments");
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? data : [];
  },

  async addAttachment(messageId: string, attachment: any): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/attachments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify(attachment),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to add attachment");
    }
  },

  async getUserInfo(
    userId: string,
  ): Promise<{ id: string; display_name: string; username?: string } | null> {
    const response = await fetch(
      `${getApiBaseUrl()}/user/v1/profile/${encodeURIComponent(userId)}`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch user info");
    }

    const user = await response.json();
    if (!user) {
      return null;
    }

    const displayName = user.first_name || user.username || "Utilisateur";

    return {
      id: user.id,
      display_name: displayName,
      username: user.username,
    };
  },

  async getConversationMembers(
    conversationId: string,
  ): Promise<Array<{ id: string; display_name: string; username?: string }>> {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/members`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch conversation members");
    }

    const data = await unwrap(response);
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((member: any) => ({
      id: member.id,
      display_name: member.display_name || member.username || "Utilisateur",
      username: member.username,
    }));
  },

  async createDirectConversation(otherUserId: string): Promise<Conversation> {
    const token = await TokenService.getAccessToken();
    let currentUserId = "";
    if (token) {
      const payload = TokenService.decodeAccessToken(token);
      currentUserId = payload?.sub ?? "";
    }

    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({
        type: "direct",
        user_ids: [currentUserId, otherUserId],
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create direct conversation");
    }

    return unwrap(response);
  },

  async createGroupConversation(
    name: string,
    memberIds: string[],
    description?: string,
    photoUri?: string,
  ): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({
        name,
        description,
        picture_url: photoUri,
        member_ids: memberIds,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create group");
    }

    const group = await unwrap(response);
    const conversationId = group.conversation_id;

    if (!conversationId) {
      throw new Error("Group created without conversation_id");
    }

    const conversationResponse = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!conversationResponse.ok) {
      throw new Error("Failed to fetch group conversation");
    }

    return unwrap(conversationResponse);
  },

  /**
   * Search messages within a specific conversation via the API.
   * Falls back to null if the backend does not support the search param,
   * so callers can use client-side filtering as a fallback.
   */
  async searchMessages(
    conversationId: string,
    query: string,
    params?: { limit?: number },
  ): Promise<Message[] | null> {
    try {
      const searchParams = new URLSearchParams();
      searchParams.append("search", query);
      if (params?.limit !== undefined) {
        searchParams.append("limit", String(params.limit));
      }

      const url = `${API_BASE_URL}/conversations/${encodeURIComponent(
        conversationId,
      )}/messages?${searchParams.toString()}`;

      const response = await fetch(url, {
        headers: {
          ...(await getAuthHeaders()),
        },
      });

      if (!response.ok) {
        // Backend may not support search param — return null to signal fallback
        return null;
      }

      const data = await unwrap(response);
      return Array.isArray(data) ? data : [];
    } catch {
      return null;
    }
  },

  /**
   * Search messages globally across all conversations.
   * Calls GET /messaging/api/v1/messages/search?query=...
   * Returns null if the endpoint is not available so callers can fall back.
   */
  async searchMessagesGlobal(
    query: string,
    params?: { limit?: number; offset?: number },
  ): Promise<Message[] | null> {
    try {
      const searchParams = new URLSearchParams();
      searchParams.append("query", query);
      if (params?.limit !== undefined) {
        searchParams.append("limit", String(params.limit));
      }
      if (params?.offset !== undefined) {
        searchParams.append("offset", String(params.offset));
      }

      const url = `${API_BASE_URL}/messages/search?${searchParams.toString()}`;

      const response = await fetch(url, {
        headers: {
          ...(await getAuthHeaders()),
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await unwrap(response);
      return Array.isArray(data) ? data : [];
    } catch {
      return null;
    }
  },
};
