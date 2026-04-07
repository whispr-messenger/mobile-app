import {
  Conversation,
  Message,
  MessageAttachment,
} from "../../types/messaging";
import { apiFetch } from "../apiClient";
import { MESSAGING_API_URL, USER_API_URL } from "../../config/api";
import { TokenService } from "../TokenService";
import { mediaAPI } from "../media/api";

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as any).data as T;
  }
  return payload as T;
}

export function normalizeConversation(raw: any): Conversation {
  const metadata: Record<string, any> =
    raw &&
    typeof raw === "object" &&
    raw.metadata &&
    typeof raw.metadata === "object"
      ? { ...(raw.metadata as Record<string, any>) }
      : {};

  if (raw?.name && !metadata.name) {
    metadata.name = raw.name;
  }
  if (raw?.picture_url && !metadata.picture_url) {
    metadata.picture_url = raw.picture_url;
  }

  const display_name =
    raw?.display_name ??
    raw?.displayName ??
    metadata.name ??
    raw?.name ??
    (raw?.type === "group" ? "Groupe" : "Contact");

  const avatar_url =
    raw?.avatar_url ??
    raw?.avatarUrl ??
    metadata.picture_url ??
    metadata.pictureUrl ??
    undefined;

  return {
    ...(raw as Conversation),
    metadata,
    display_name,
    avatar_url,
  };
}

export function normalizeMessage(raw: any): Message {
  const sentAt =
    raw?.sent_at ??
    raw?.sentAt ??
    raw?.inserted_at ??
    raw?.insertedAt ??
    raw?.created_at ??
    raw?.createdAt ??
    raw?.timestamp;

  const sent_at =
    typeof sentAt === "string"
      ? sentAt
      : sentAt
        ? new Date(sentAt).toISOString()
        : new Date().toISOString();

  const editedAt =
    raw?.edited_at ??
    raw?.editedAt ??
    raw?.updated_at ??
    raw?.updatedAt ??
    undefined;

  const sender_id =
    raw?.sender_id ??
    raw?.senderId ??
    raw?.user_id ??
    raw?.userId ??
    raw?.from_user_id ??
    raw?.fromUserId;

  const conversation_id = raw?.conversation_id ?? raw?.conversationId;

  return {
    ...(raw as Message),
    id: String(raw?.id),
    conversation_id: String(conversation_id ?? ""),
    sender_id: String(sender_id ?? ""),
    content: typeof raw?.content === "string" ? raw.content : "",
    message_type: (raw?.message_type ?? raw?.messageType ?? "text") as any,
    metadata:
      raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
    client_random: Number(raw?.client_random ?? raw?.clientRandom ?? 0),
    sent_at,
    edited_at: editedAt ? String(editedAt) : undefined,
    is_deleted: Boolean(raw?.is_deleted ?? raw?.isDeleted ?? false),
    delete_for_everyone: Boolean(
      raw?.delete_for_everyone ?? raw?.deleteForEveryone ?? false,
    ),
    reply_to_id: raw?.reply_to_id ?? raw?.replyToId ?? undefined,
  };
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
    return Array.isArray(data)
      ? (data as any[]).map(normalizeConversation)
      : [];
  },

  async getConversation(id: string): Promise<Conversation> {
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(id)}`,
    );
    return normalizeConversation(unwrapData<any>(payload));
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
    return Array.isArray(data) ? (data as any[]).map(normalizeMessage) : [];
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
    return normalizeMessage(unwrapData<any>(payload));
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
    return normalizeMessage(unwrapData<any>(payload));
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

  async getPinnedMessages(_conversationId: string): Promise<Message[]> {
    return [];
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

  async getUserInfo(userId: string): Promise<{
    id: string;
    display_name: string;
    username?: string;
    avatar_url?: string;
  } | null> {
    const payload = await apiFetch<unknown>(
      `${USER_API_URL}/profile/${encodeURIComponent(userId)}`,
    );
    const user = unwrapData<any>(payload);
    if (!user?.id) return null;

    const username =
      typeof user.username === "string" && user.username.trim()
        ? user.username.trim()
        : undefined;
    const firstName =
      typeof user.firstName === "string" && user.firstName.trim()
        ? user.firstName.trim()
        : undefined;
    const phoneNumber =
      typeof user.phoneNumber === "string" && user.phoneNumber.trim()
        ? user.phoneNumber.trim()
        : undefined;

    const displayName = username ?? firstName ?? phoneNumber ?? "Utilisateur";
    const avatar_url =
      typeof user.profilePictureUrl === "string" &&
      user.profilePictureUrl.trim()
        ? user.profilePictureUrl.trim()
        : undefined;

    return {
      id: user.id,
      display_name: displayName,
      username,
      avatar_url,
    };
  },

  async getConversationMembers(conversationId: string): Promise<
    Array<{
      id: string;
      display_name: string;
      username?: string;
      avatar_url?: string;
    }>
  > {
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}`,
    );
    const conversation = unwrapData<any>(payload);
    const members = Array.isArray(conversation?.members)
      ? conversation.members
      : [];

    return members
      .map((m: any) => {
        const id = m?.user_id ?? m?.userId ?? m?.id;
        if (!id) return null;
        const username = m?.username ?? m?.user?.username;
        const display_name =
          m?.display_name ??
          m?.displayName ??
          m?.user?.first_name ??
          m?.user?.firstName ??
          username ??
          "Utilisateur";
        const avatar_url =
          m?.avatar_url ??
          m?.avatarUrl ??
          m?.user?.avatar_url ??
          m?.user?.avatarUrl ??
          m?.user?.profilePictureUrl ??
          m?.user?.profile_picture_url ??
          m?.user?.profilePictureURL ??
          m?.user?.profilePicture ??
          undefined;
        return { id, display_name, username, avatar_url };
      })
      .filter(Boolean) as Array<{
      id: string;
      display_name: string;
      username?: string;
      avatar_url?: string;
    }>;
  },

  async createDirectConversation(otherUserId: string): Promise<Conversation> {
    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "direct",
          other_user_id: otherUserId,
        }),
      },
    );
    return unwrapData<Conversation>(payload);
  },

  async createGroupConversation(
    name: string,
    memberIds: string[],
    description?: string,
    photoUri?: string,
  ): Promise<Conversation> {
    const token = await TokenService.getAccessToken();
    const creatorId = token
      ? TokenService.decodeAccessToken(token)?.sub
      : undefined;

    let pictureUrl: string | undefined;
    const isLocalUri =
      typeof photoUri === "string" &&
      (photoUri.startsWith("file:") ||
        photoUri.startsWith("content:") ||
        photoUri.startsWith("ph:"));

    if (photoUri && creatorId && isLocalUri) {
      try {
        const upload = await mediaAPI.uploadGroupIcon(creatorId, photoUri);
        if (upload.url) pictureUrl = upload.url;
      } catch (e: any) {
        const message = e?.message ? String(e.message) : "";
        throw new Error(
          message
            ? `Impossible d'uploader la photo du groupe: ${message}`
            : "Impossible d'uploader la photo du groupe",
        );
      }
    } else if (photoUri && !photoUri.startsWith("file:")) {
      pictureUrl = photoUri;
    }

    const payload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "group",
          name,
          user_ids: memberIds,
          metadata: {
            description: description || undefined,
            picture_url: pictureUrl || undefined,
          },
        }),
      },
    );

    const created = unwrapData<any>(payload);
    const conversationId = created?.id;
    if (!conversationId) throw new Error("Group created without id");

    const conversationPayload = await apiFetch<unknown>(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}`,
    );
    return normalizeConversation(unwrapData<any>(conversationPayload));
  },
};
