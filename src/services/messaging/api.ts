import {
  Conversation,
  Message,
  MessageAttachment,
} from "../../types/messaging";
import { apiFetch } from "../apiClient";
import { MESSAGING_API_URL } from "../../config/api";

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as any).data as T;
  }
  return payload as T;
}

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
    const url = `${MESSAGING_API_URL}/conversations${queryString ? `?${queryString}` : ""}`;

    const payload = await apiFetch<unknown>(url);
    const data = unwrapData<unknown>(payload);
    return Array.isArray(data) ? (data as Conversation[]) : [];
  },

  async getConversation(id: string): Promise<Conversation> {
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(id)}`,
    );
    return unwrapData<Conversation>(payload);
  },

  async deleteConversation(id: string): Promise<void> {
    return apiFetch<void>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  },

  async getMessages(
    conversationId: string,
    params?: {
      limit?: number;
      before?: string;
      after?: string;
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

    const queryString = query.toString();
    const url = `${MESSAGING_API_URL}/conversations/${encodeURIComponent(
      conversationId,
    )}/messages${queryString ? `?${queryString}` : ""}`;

    const payload = await apiFetch<unknown>(url);
    const data = unwrapData<unknown>(payload);
    return Array.isArray(data) ? (data as Message[]) : [];
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
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: message.content,
          message_type: message.message_type,
          client_random: message.client_random,
          metadata: message.metadata,
          reply_to_id: message.reply_to_id,
        }),
      },
    );
    return unwrapData<Message>(payload);
  },

  async editMessage(
    messageId: string,
    conversationId: string,
    newContent: string,
  ): Promise<Message> {
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          content: newContent,
          conversation_id: conversationId,
        }),
      },
    );
    return unwrapData<Message>(payload);
  },

  async deleteMessage(
    messageId: string,
    conversationId: string,
    deleteForEveryone: boolean,
  ): Promise<void> {
    const url = `${MESSAGING_API_URL}/messages/${encodeURIComponent(
      messageId,
    )}?conversation_id=${encodeURIComponent(conversationId)}&delete_for_everyone=${
      deleteForEveryone ? "true" : "false"
    }`;

    return apiFetch<void>(url, { method: "DELETE" });
  },

  async addReaction(
    messageId: string,
    userId: string,
    reaction: string,
  ): Promise<void> {
    return apiFetch<void>(
      `${MESSAGING_API_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId, reaction }),
      },
    );
  },

  async removeReaction(
    messageId: string,
    userId: string,
    reaction: string,
  ): Promise<void> {
    const url = `${MESSAGING_API_URL}/messages/${encodeURIComponent(
      messageId,
    )}/reactions/${encodeURIComponent(reaction)}?user_id=${encodeURIComponent(userId)}`;

    return apiFetch<void>(url, { method: "DELETE" });
  },

  async getMessageReactions(messageId: string) {
    return apiFetch<unknown>(
      `${MESSAGING_API_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
    );
  },

  async pinMessage(conversationId: string, messageId: string): Promise<void> {
    return apiFetch<void>(
      `${MESSAGING_API_URL}/messages/${encodeURIComponent(messageId)}/pin`,
      {
        method: "POST",
        body: JSON.stringify({ conversation_id: conversationId }),
      },
    );
  },

  async unpinMessage(conversationId: string, messageId: string): Promise<void> {
    const url = `${MESSAGING_API_URL}/messages/${encodeURIComponent(
      messageId,
    )}/pin?conversation_id=${encodeURIComponent(conversationId)}`;

    return apiFetch<void>(url, { method: "DELETE" });
  },

  async getPinnedMessages(conversationId: string): Promise<Message[]> {
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}/pins`,
    );
    const data = unwrapData<unknown>(payload);
    return Array.isArray(data) ? (data as Message[]) : [];
  },

  async getAttachments(messageId: string): Promise<MessageAttachment[]> {
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/messages/${encodeURIComponent(messageId)}/attachments`,
    );
    const data = unwrapData<unknown>(payload);
    return Array.isArray(data) ? (data as MessageAttachment[]) : [];
  },

  async addAttachment(messageId: string, attachment: any): Promise<void> {
    return apiFetch<void>(
      `${MESSAGING_API_URL}/messages/${encodeURIComponent(messageId)}/attachments`,
      {
        method: "POST",
        body: JSON.stringify(attachment),
      },
    );
  },

  async getUserInfo(
    userId: string,
  ): Promise<{ id: string; display_name: string; username?: string } | null> {
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/users/${encodeURIComponent(userId)}`,
    );
    const user = unwrapData<any>(payload);

    if (!user) return null;

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
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}/members`,
    );
    const data = unwrapData<unknown>(payload);

    if (!Array.isArray(data)) return [];

    return data.map((member: any) => ({
      id: member.id,
      display_name: member.display_name || member.username || "Utilisateur",
      username: member.username,
    }));
  },

  async createDirectConversation(otherUserId: string): Promise<Conversation> {
    return apiFetch<Conversation>(`${MESSAGING_API_URL}/conversations`, {
      method: "POST",
      body: JSON.stringify({
        type: "direct",
        other_user_id: otherUserId,
      }),
    });
  },

  async createGroupConversation(
    name: string,
    memberIds: string[],
    description?: string,
    photoUri?: string,
  ): Promise<Conversation> {
    const group = await apiFetch<any>(`${MESSAGING_API_URL}/groups`, {
      method: "POST",
      body: JSON.stringify({
        name,
        description,
        picture_url: photoUri,
        member_ids: memberIds,
      }),
    });

    const conversationId = group.conversation_id;
    if (!conversationId) {
      throw new Error("Group created without conversation_id");
    }

    return apiFetch<Conversation>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}`,
    );
  },
};
