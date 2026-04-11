import { Conversation, Message } from "../../types/messaging";
import { AuthService } from "../AuthService";
import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";
import { snakecaseKeys } from "../../utils/caseTransform";
import { logger } from "../../utils/logger";

const API_BASE_URL = `${getApiBaseUrl()}/messaging/api/v1`;

/**
 * Normalise a backend attachment payload into the MessageAttachment shape the
 * app consumes. The backend returns { file_url, file_name, file_size, mime_type,
 * media_id, metadata, ... } while the app expects { media_type, metadata: {...} }.
 * Prefers media_id-based blob URLs over stored file_url (which may be an expired
 * presigned S3/MinIO URL).
 */
export const mapBackendAttachment = (att: any, fallbackMessageId?: string) => {
  // Already in the expected shape — pass through
  if (att?.metadata?.media_url && att?.media_type) return att;

  const fileType = att?.file_type || "";
  const mime = att?.mime_type || "";
  let media_type: string = fileType || "file";
  if (!fileType || fileType === "file") {
    if (mime.startsWith("image/")) media_type = "image";
    else if (mime.startsWith("video/")) media_type = "video";
    else if (mime.startsWith("audio/")) media_type = "audio";
  }

  const meta = att?.metadata || {};
  const mediaId = att?.media_id || meta.media_id;
  const mediaBlobUrl = mediaId
    ? `${getApiBaseUrl()}/media/v1/${mediaId}/blob`
    : null;
  const mediaThumbnailUrl = mediaId
    ? `${getApiBaseUrl()}/media/v1/${mediaId}/thumbnail`
    : null;

  const resolvedUrl =
    mediaBlobUrl || meta.media_url || att?.file_url || att?.storage_url;
  const resolvedThumbnail =
    mediaThumbnailUrl ||
    att?.thumbnail_url ||
    meta.thumbnail_url ||
    resolvedUrl;

  return {
    id: att?.id,
    message_id: att?.message_id || fallbackMessageId,
    media_id: mediaId || att?.id,
    media_type,
    metadata: {
      filename: att?.file_name || att?.filename || meta.filename,
      size: att?.file_size || att?.size || meta.size,
      mime_type: att?.mime_type || meta.mime_type,
      media_url: resolvedUrl,
      thumbnail_url: resolvedThumbnail,
    },
    created_at: att?.uploaded_at || att?.created_at || new Date().toISOString(),
  };
};

// Backend wraps responses in { data: ... } — unwrap if present
const unwrap = async (response: Response) => {
  try {
    const json = await response.json();
    const data = json?.data !== undefined ? json.data : json;
    return snakecaseKeys(data);
  } catch {
    return null;
  }
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await TokenService.getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

/**
 * Wrapper around fetch that automatically refreshes the access token and
 * retries once when the server returns 401 Unauthorized.
 */
const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<Response> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      ...(await getAuthHeaders()),
    },
  });

  if (response.status === 401 && !isRetry) {
    try {
      await AuthService.refreshTokens();
      return authenticatedFetch(url, options, true);
    } catch {
      // refresh failed — fall through to let caller handle the 401
    }
  }

  return response;
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

    const response = await authenticatedFetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch conversations");
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? data : [];
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(id)}`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch conversation");
    }
    return unwrap(response);
  },

  async deleteConversation(id: string): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(id)}`,
      { method: "DELETE" },
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

    const response = await authenticatedFetch(url);
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
      client_random: number | string;
      metadata?: Record<string, any>;
      reply_to_id?: string;
    },
  ): Promise<Message> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const response = await authenticatedFetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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

    const response = await authenticatedFetch(url, { method: "DELETE" });

    if (!response.ok) {
      throw new Error("Failed to delete message");
    }
  },

  async addReaction(
    messageId: string,
    userId: string,
    reaction: string,
  ): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          reaction,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg =
        (body as { message?: string; error?: string })?.message ||
        (body as { error?: string })?.error ||
        `HTTP ${response.status}`;
      const err = new Error(msg) as Error & { status: number; body: unknown };
      err.status = response.status;
      err.body = body;
      throw err;
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

    const response = await authenticatedFetch(url, { method: "DELETE" });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg =
        (body as { message?: string; error?: string })?.message ||
        (body as { error?: string })?.error ||
        `HTTP ${response.status}`;
      const err = new Error(msg) as Error & { status: number; body: unknown };
      err.status = response.status;
      err.body = body;
      throw err;
    }
  },

  async getMessageReactions(messageId: string) {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/reactions`,
    );

    if (!response.ok) {
      // Back ou routes pas encore alignés — pas de réactions affichées
      if (response.status === 404 || response.status === 400) {
        return { reactions: [] };
      }
      throw new Error("Failed to fetch message reactions");
    }

    return unwrap(response);
  },

  async pinMessage(conversationId: string, messageId: string): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/pin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

    const response = await authenticatedFetch(url, { method: "DELETE" });

    if (!response.ok) {
      throw new Error("Failed to unpin message");
    }
  },

  async getPinnedMessages(conversationId: string): Promise<Message[]> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/pins`,
    );

    if (!response.ok) {
      // Endpoint may not exist yet (404) — return empty array gracefully
      if (response.status === 404) {
        return [];
      }
      throw new Error("Failed to fetch pinned messages");
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? data : [];
  },

  async getAttachments(messageId: string) {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/attachments`,
    );

    if (!response.ok) {
      // Endpoint may not exist yet (404) — return empty array gracefully
      if (response.status === 404) {
        return [];
      }
      throw new Error("Failed to fetch attachments");
    }

    const data = await unwrap(response);
    const raw = Array.isArray(data) ? data : [];
    return raw.map((att: any) => mapBackendAttachment(att, messageId));
  },

  async addAttachment(messageId: string, attachment: any): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/attachments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attachment),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to add attachment");
    }
  },

  async getUserInfo(userId: string): Promise<{
    id: string;
    display_name: string;
    username?: string;
    avatar_url?: string;
  } | null> {
    try {
      const response = await authenticatedFetch(
        `${getApiBaseUrl()}/user/v1/profile/${encodeURIComponent(userId)}`,
      );

      if (!response.ok) {
        logger.warn(
          "getUserInfo",
          `HTTP ${response.status} for user ${userId}`,
        );
        return null;
      }

      const user = await response.json().catch(() => null);
      if (!user) {
        logger.warn("getUserInfo", `Empty body for user ${userId}`);
        return null;
      }

      // Handle both camelCase (from user-service) and snake_case formats
      const firstName = user.firstName || user.first_name || "";
      const lastName = user.lastName || user.last_name || "";
      const phoneNumber = user.phoneNumber || user.phone_number || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const displayName =
        fullName || user.username || phoneNumber || "Utilisateur";

      const avatarUrl =
        user.profilePictureUrl ||
        user.profile_picture_url ||
        user.avatar_url ||
        undefined;

      return {
        id: user.id,
        display_name: displayName,
        username: user.username,
        avatar_url: avatarUrl,
      };
    } catch (err) {
      logger.warn("getUserInfo", `Failed for user ${userId}`, err);
      return null;
    }
  },

  async getConversationMembers(
    conversationId: string,
  ): Promise<Array<{ id: string; display_name: string; username?: string }>> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/members`,
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

    const response = await authenticatedFetch(`${API_BASE_URL}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    _description?: string,
    _photoUri?: string,
  ): Promise<Conversation> {
    const token = await TokenService.getAccessToken();
    let currentUserId = "";
    if (token) {
      const payload = TokenService.decodeAccessToken(token);
      currentUserId = payload?.sub ?? "";
    }

    const allIds = currentUserId
      ? [currentUserId, ...memberIds.filter((id) => id !== currentUserId)]
      : memberIds;

    const response = await authenticatedFetch(`${API_BASE_URL}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "group",
        name,
        user_ids: allIds,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create group conversation");
    }

    return unwrap(response);
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

      const response = await authenticatedFetch(url);

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
   * Calls GET /messaging/api/messages/search?query=...
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

      const response = await authenticatedFetch(url);

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
