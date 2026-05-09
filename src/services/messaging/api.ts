import { Conversation, Message, PinnedMessage } from "../../types/messaging";
import { AuthService } from "../AuthService";
import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";
import { snakecaseKeys } from "../../utils/caseTransform";
import { logger } from "../../utils/logger";
import { isReachableUrl, isValidUuid } from "../../utils";
import { fetchProfilesBatch } from "../profile/batchFetch";

const API_BASE_URL = `${getApiBaseUrl()}/messaging/api/v1`;

function extractMediaIdFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/media\/v1\/([^/]+)\/(?:blob|thumbnail)(?:\?|$)/i);
  return match?.[1];
}

/**
 * Normalise a backend attachment payload into the MessageAttachment shape the
 * app consumes. The backend returns { file_url, file_name, file_size, mime_type,
 * media_id, metadata, ... } while the app expects { media_type, metadata: {...} }.
 * Prefers media_id-based blob URLs over stored file_url (which may be an expired
 * presigned S3/MinIO URL).
 */
export const mapBackendAttachment = (att: any, fallbackMessageId?: string) => {
  const fileType = att?.file_type || "";
  const mime = att?.mime_type || "";
  let media_type: "audio" | "video" | "image" | "file" = (
    ["audio", "video", "image", "file"] as const
  ).includes(fileType)
    ? fileType
    : "file";
  if (!fileType || fileType === "file") {
    if (mime.startsWith("image/")) media_type = "image";
    else if (mime.startsWith("video/")) media_type = "video";
    else if (mime.startsWith("audio/")) media_type = "audio";
  }

  const meta = att?.metadata || {};
  const mediaId =
    att?.media_id ||
    meta.media_id ||
    extractMediaIdFromUrl(att?.file_url) ||
    extractMediaIdFromUrl(meta.media_url) ||
    extractMediaIdFromUrl(att?.storage_url) ||
    extractMediaIdFromUrl(att?.thumbnail_url) ||
    extractMediaIdFromUrl(meta.thumbnail_url);
  const mediaBlobUrl = mediaId
    ? `${getApiBaseUrl()}/media/v1/${mediaId}/blob`
    : null;
  const mediaThumbnailUrl = mediaId
    ? `${getApiBaseUrl()}/media/v1/${mediaId}/thumbnail`
    : null;

  // Reject any URL that points at the internal cluster or raw MinIO host —
  // the browser cannot resolve those DNS names and http:// on an https page
  // triggers Mixed Content. Always prefer the media-service /blob proxy when
  // a mediaId is available, which stays on the public gateway origin.
  const fallbackUrl = [meta.media_url, att?.file_url, att?.storage_url].find(
    isReachableUrl,
  );
  const fallbackThumbnail = [att?.thumbnail_url, meta.thumbnail_url].find(
    isReachableUrl,
  );

  // Prefer the media-service /blob proxy when we have a mediaId — it stays on
  // the public API gateway and never leaks internal MinIO URLs. Only fall back
  // to a stored URL when no mediaId is known (legacy rows).
  const resolvedUrl = mediaBlobUrl || fallbackUrl;
  const resolvedThumbnail =
    mediaThumbnailUrl || fallbackThumbnail || resolvedUrl;

  return {
    id: att?.id,
    message_id: att?.message_id || fallbackMessageId,
    media_id: mediaId,
    media_type,
    metadata: {
      filename: att?.file_name || att?.filename || meta.filename,
      size: att?.file_size || att?.size || meta.size,
      mime_type: att?.mime_type || meta.mime_type,
      media_url: resolvedUrl,
      thumbnail_url: resolvedThumbnail,
      duration:
        meta.duration ??
        att?.duration ??
        att?.audio_duration ??
        att?.file_duration,
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

/** Erreur réseau / HTTP avec code statut (diagnostic logs / toasts). */
function httpError(label: string, response: Response): Error {
  return new Error(`${label} (${response.status})`);
}

/** Erreur HTTP enrichie : status + corps parsé pour gestion fine côté appelant. */
export type ApiError = Error & { status: number; body?: unknown };

async function richHttpError(
  label: string,
  response: Response,
): Promise<ApiError> {
  const body = await response.json().catch(() => undefined);
  const message =
    (body as { error?: string; message?: string })?.error ||
    (body as { message?: string })?.message ||
    `${label} (${response.status})`;
  const err = new Error(message) as ApiError;
  err.status = response.status;
  err.body = body;
  return err;
}

/**
 * Run an async mapper over items in bounded-size batches to cap the number of
 * concurrent requests. Avoids DoS-ing the client and backend when a group has
 * hundreds of members and each one requires a profile fetch.
 */
async function batchedMap<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// le user-service throttle court est a ~10 req/s; on garde 5 in-flight
// max pour laisser de la marge et eviter le burst 429 au load de la
// ConversationsList (enrichissement profile en parallele).
const MEMBER_PROFILE_FETCH_CONCURRENCY = 5;

// --- User profile cache ------------------------------------------------------
// Avoid re-fetching the same /user/v1/profile/{id} on every render cycle. A
// simple in-memory map keyed by userId with a short TTL is enough to smooth
// out the startup burst (conversations list enrichment, chat screen opens,
// typing indicators) without overloading the backend rate limiter (429).
type CachedUserInfo = {
  id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
};

const USER_INFO_TTL_MS = 5 * 60 * 1000; // 5 minutes
// TTL court pour les 429 : on attend juste que la fenetre throttle se
// reouvre, sinon le user reste sans nom/avatar pendant 5 min apres un
// simple burst.
const USER_INFO_RATE_LIMIT_TTL_MS = 30 * 1000; // 30 seconds
const userInfoCache = new Map<
  string,
  { value: CachedUserInfo | null; expiresAt: number }
>();
// Dedup concurrent requests for the same user — first caller triggers the
// network call, subsequent callers get the same Promise.
const userInfoInflight = new Map<string, Promise<CachedUserInfo | null>>();

/**
 * Invalidate a cached user profile (e.g. after the current user edits their
 * own profile, or when we know an external profile changed).
 */
export const invalidateUserInfoCache = (userId?: string): void => {
  if (userId) {
    userInfoCache.delete(userId);
    userInfoInflight.delete(userId);
  } else {
    userInfoCache.clear();
    userInfoInflight.clear();
  }
};

/**
 * Normalise un payload brut du user-service (camelCase ou snake_case) en
 * CachedUserInfo. Utilise par getUserInfo unitaire et par getUsersInfoBatch.
 */
function normalizeRawUserInfo(user: any): CachedUserInfo | null {
  if (!user || typeof user !== "object") return null;
  const id = String(user.id ?? user.userId ?? "");
  if (!id) return null;
  const firstName = user.firstName || user.first_name || "";
  const lastName = user.lastName || user.last_name || "";
  const phoneNumber = user.phoneNumber || user.phone_number || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName || user.username || phoneNumber || "Utilisateur";
  const avatarUrl =
    user.profilePictureUrl ||
    user.profile_picture_url ||
    user.profilePicture ||
    user.profile_picture ||
    user.avatarUrl ||
    user.avatar_url ||
    undefined;
  return {
    id,
    display_name: displayName,
    username: user.username,
    avatar_url: avatarUrl,
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
    const url = `${API_BASE_URL}/conversations${queryString ? `?${queryString}` : ""}`;

    const response = await authenticatedFetch(url);
    if (!response.ok) {
      throw httpError("Failed to fetch conversations", response);
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? data : [];
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(id)}`,
    );
    if (!response.ok) {
      throw httpError("Failed to fetch conversation", response);
    }
    return unwrap(response);
  },

  async deleteConversation(id: string): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      throw httpError("Failed to delete conversation", response);
    }
  },

  /**
   * Archive une conversation pour l'utilisateur courant (per-user, multi-device).
   * Lève une ApiError sur 4xx/5xx ; le caller décide quoi faire de 422
   * (déjà archivée — l'état serveur est déjà celui qu'on voulait).
   */
  async archiveConversation(conversationId: string): Promise<void> {
    if (!isValidUuid(conversationId)) {
      const err = new Error("Invalid conversation id") as ApiError;
      err.status = 400;
      throw err;
    }

    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(
        conversationId,
      )}/archive`,
      { method: "POST" },
    );

    if (!response.ok) {
      throw await richHttpError("Failed to archive conversation", response);
    }
  },

  async unarchiveConversation(conversationId: string): Promise<void> {
    if (!isValidUuid(conversationId)) {
      const err = new Error("Invalid conversation id") as ApiError;
      err.status = 400;
      throw err;
    }

    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(
        conversationId,
      )}/archive`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      throw await richHttpError("Failed to unarchive conversation", response);
    }
  },

  /**
   * GET /conversations/archived — listing paginé. Le backend renvoie
   * { data: [...], meta: {...} } avec data camelisé (isArchived…) là où les
   * autres endpoints conversation retournent du snake_case. On normalise tout
   * en snake_case pour rester homogène avec le type Conversation interne.
   */
  async getArchivedConversations(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    data: Conversation[];
    meta: {
      count: number;
      limit: number;
      offset: number;
      has_more: boolean;
      user_id: string;
    };
  }> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) {
      query.append("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.append("offset", String(params.offset));
    }
    const queryString = query.toString();
    const url = `${API_BASE_URL}/conversations/archived${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await authenticatedFetch(url);
    if (!response.ok) {
      throw httpError("Failed to fetch archived conversations", response);
    }

    const json = await response.json().catch(() => ({}) as any);
    const normalised = snakecaseKeys(json) as {
      data?: Conversation[];
      meta?: {
        count?: number;
        limit?: number;
        offset?: number;
        has_more?: boolean;
        user_id?: string;
      };
    };

    return {
      data: Array.isArray(normalised.data) ? normalised.data : [],
      meta: {
        count: normalised.meta?.count ?? 0,
        limit: normalised.meta?.limit ?? params?.limit ?? 50,
        offset: normalised.meta?.offset ?? params?.offset ?? 0,
        has_more: normalised.meta?.has_more ?? false,
        user_id: normalised.meta?.user_id ?? "",
      },
    };
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
      throw httpError("Failed to fetch messages", response);
    }

    const data = await unwrap(response);
    const messages = Array.isArray(data) ? data : [];
    return messages.map((msg: any) =>
      Array.isArray(msg?.attachments) && msg.attachments.length > 0
        ? {
            ...msg,
            attachments: msg.attachments.map((att: any) =>
              mapBackendAttachment(att, msg.id),
            ),
          }
        : msg,
    );
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
      throw httpError("Failed to send message", response);
    }

    return unwrap(response);
  },

  async forwardMessage(
    messageId: string,
    conversationIds: string[],
  ): Promise<Message[]> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/forward`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_ids: conversationIds }),
      },
    );

    if (!response.ok) {
      throw httpError("Failed to forward message", response);
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? data : [];
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
      throw httpError("Failed to edit message", response);
    }

    return unwrap(response);
  },

  async markMessageAsUnread(
    messageId: string,
    conversationId: string,
  ): Promise<void> {
    // POST /messages/:id/unread?conversation_id=... — backend revert le
    // delivery_status du message pour le user courant et broadcast un
    // event message_unread sur le user channel des autres participants.
    const url = `${API_BASE_URL}/messages/${encodeURIComponent(
      messageId,
    )}/unread?conversation_id=${encodeURIComponent(conversationId)}`;

    const response = await authenticatedFetch(url, { method: "POST" });

    if (!response.ok) {
      throw httpError("Failed to mark message as unread", response);
    }
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
      throw httpError("Failed to delete message", response);
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
      throw httpError("Failed to fetch message reactions", response);
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
      throw httpError("Failed to pin message", response);
    }
  },

  async unpinMessage(conversationId: string, messageId: string): Promise<void> {
    const url = `${API_BASE_URL}/messages/${encodeURIComponent(
      messageId,
    )}/pin?conversation_id=${encodeURIComponent(conversationId)}`;

    const response = await authenticatedFetch(url, { method: "DELETE" });

    if (!response.ok) {
      throw httpError("Failed to unpin message", response);
    }
  },

  async getPinnedMessages(conversationId: string): Promise<PinnedMessage[]> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/pins`,
    );

    if (!response.ok) {
      // Endpoint may not exist yet (404) — return empty array gracefully
      if (response.status === 404) {
        return [];
      }
      throw httpError("Failed to fetch pinned messages", response);
    }

    const data = await unwrap(response);
    return Array.isArray(data) ? (data as PinnedMessage[]) : [];
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
      throw httpError("Failed to fetch attachments", response);
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
      throw httpError("Failed to add attachment", response);
    }
  },

  async getUserInfo(userId: string): Promise<CachedUserInfo | null> {
    // 1. Fresh cache hit → return immediately, no network call.
    const cached = userInfoCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // 2. A request for the same userId is already in flight → reuse it.
    const inflight = userInfoInflight.get(userId);
    if (inflight) {
      return inflight;
    }

    // 3. Kick off a new fetch and remember the Promise so concurrent callers
    //    (conversations list enrichment, typing indicator, chat screen open)
    //    share a single network round-trip.
    const promise = (async (): Promise<CachedUserInfo | null> => {
      try {
        const response = await authenticatedFetch(
          `${getApiBaseUrl()}/user/v1/profile/${encodeURIComponent(userId)}`,
        );

        if (!response.ok) {
          // 429 = throttler user-service (court 10 req/s). Cas attendu sous
          // charge (load ConversationsList), pas une erreur. On cache null
          // avec un TTL court pour laisser la fenetre se reouvrir, sinon le
          // membre reste sans nom/avatar pendant 5 min apres un simple burst.
          const isRateLimited = response.status === 429;
          if (isRateLimited) {
            logger.info(
              "getUserInfo",
              `Rate limited (429) for user ${userId}, retry after short TTL`,
            );
          } else {
            logger.warn(
              "getUserInfo",
              `HTTP ${response.status} for user ${userId}`,
            );
          }
          userInfoCache.set(userId, {
            value: null,
            expiresAt:
              Date.now() +
              (isRateLimited ? USER_INFO_RATE_LIMIT_TTL_MS : USER_INFO_TTL_MS),
          });
          return null;
        }

        const user = await response.json().catch(() => null);
        const info = normalizeRawUserInfo(user);
        if (!info) {
          logger.warn("getUserInfo", `Empty body for user ${userId}`);
          userInfoCache.set(userId, {
            value: null,
            expiresAt: Date.now() + USER_INFO_TTL_MS,
          });
          return null;
        }
        userInfoCache.set(userId, {
          value: info,
          expiresAt: Date.now() + USER_INFO_TTL_MS,
        });
        return info;
      } catch (err) {
        logger.warn("getUserInfo", `Failed for user ${userId}`, err);
        return null;
      } finally {
        userInfoInflight.delete(userId);
      }
    })();

    userInfoInflight.set(userId, promise);
    return promise;
  },

  /**
   * Recupere plusieurs profils utilisateurs en un seul appel batch
   * (POST /user/v1/profiles/batch, WHISPR-1349 / WHISPR-1357). Hydrate le
   * cache `userInfoCache` pour chaque profil retourne, et marque les
   * `missing` comme null (TTL court) pour eviter de retenter au prochain
   * render.
   *
   * Sert au load de ConversationsList et ContactsScreen ou on a une liste
   * d'IDs connue d'avance et on veut eviter le burst de N fetchs.
   *
   * Retourne un Map id -> info|null couvrant tous les ids demandes.
   */
  async getUsersInfoBatch(
    userIds: string[],
  ): Promise<Map<string, CachedUserInfo | null>> {
    const result = new Map<string, CachedUserInfo | null>();
    const toFetch: string[] = [];

    // Premier passage : on recolte les hits cache frais et on liste le reste
    for (const id of userIds) {
      if (!id) continue;
      if (result.has(id)) continue;
      const cached = userInfoCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        result.set(id, cached.value);
      } else {
        toFetch.push(id);
      }
    }

    if (toFetch.length === 0) {
      return result;
    }

    try {
      const { profiles, missing } = await fetchProfilesBatch<unknown>(
        toFetch,
        authenticatedFetch,
      );
      const missingSet = new Set(missing);
      for (const raw of profiles) {
        const info = normalizeRawUserInfo(raw);
        if (info?.id) {
          userInfoCache.set(info.id, {
            value: info,
            expiresAt: Date.now() + USER_INFO_TTL_MS,
          });
          result.set(info.id, info);
          missingSet.delete(info.id);
        }
      }
      // Tout id non resolu (renvoye missing par le backend, ou non present
      // dans le payload) bascule null en cache pour eviter un second appel
      // immediat. TTL standard suffit : si le profil reapparait l'utilisateur
      // declenchera un nouveau fetch au prochain reload.
      for (const id of toFetch) {
        if (!result.has(id) || missingSet.has(id)) {
          userInfoCache.set(id, {
            value: null,
            expiresAt: Date.now() + USER_INFO_TTL_MS,
          });
          result.set(id, null);
        }
      }
    } catch (err) {
      logger.warn(
        "getUsersInfoBatch",
        `Batch fetch failed for ${toFetch.length} ids`,
        err,
      );
      for (const id of toFetch) {
        if (!result.has(id)) result.set(id, null);
      }
    }
    return result;
  },

  async getConversationMembers(conversationId: string): Promise<
    Array<{
      id: string;
      display_name: string;
      username?: string;
      avatar_url?: string;
      role: "admin" | "moderator" | "member";
      joined_at?: string;
      is_active?: boolean;
    }>
  > {
    type BackendMember = {
      userId?: string;
      user_id?: string;
      id?: string;
      role?: string;
      joinedAt?: string;
      joined_at?: string;
      isActive?: boolean;
      is_active?: boolean;
      username?: string;
      display_name?: string;
    };

    let rawMembers: BackendMember[] = [];

    try {
      const conv = await messagingAPI.getConversation(conversationId);
      const fromConv = (conv as { members?: BackendMember[] }).members;
      if (Array.isArray(fromConv) && fromConv.length > 0) {
        rawMembers = fromConv;
      }
    } catch {
      /* GET /conversations/:id peut échouer — on tente /members ci-dessous */
    }

    if (rawMembers.length === 0) {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/members`,
      );
      if (response.ok) {
        const data = await unwrap(response);
        if (Array.isArray(data)) {
          rawMembers = data as BackendMember[];
        }
      }
    }

    if (rawMembers.length === 0) {
      return [];
    }

    // Resolve display name and avatar for each member via /user/v1/profile/:userId
    // in parallel to avoid sequential N+1.
    const userApiBase = `${getApiBaseUrl()}/user/v1`;
    const token = await TokenService.getAccessToken();
    const authHeaders: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    return batchedMap(
      rawMembers,
      MEMBER_PROFILE_FETCH_CONCURRENCY,
      async (member) => {
        const userId = member.userId ?? member.user_id ?? member.id ?? "";
        const rawRole = (member.role ?? "member").toLowerCase();
        let role: "admin" | "moderator" | "member" = "member";
        if (rawRole === "admin" || rawRole === "owner") {
          role = "admin";
        } else if (rawRole === "moderator") {
          role = "moderator";
        }

        let displayName = member.display_name || member.username || "";
        let avatarUrl: string | undefined;
        let username: string | undefined = member.username;

        if (userId) {
          try {
            const profileResponse = await fetch(
              `${userApiBase}/profile/${encodeURIComponent(userId)}`,
              { headers: authHeaders },
            );
            if (profileResponse.ok) {
              const profile = await profileResponse.json().catch(() => null);
              if (profile) {
                const firstName = profile.firstName || profile.first_name || "";
                const lastName = profile.lastName || profile.last_name || "";
                const fullName = `${firstName} ${lastName}`.trim();
                displayName =
                  fullName || profile.username || displayName || "Utilisateur";
                username = profile.username ?? username;
                avatarUrl =
                  profile.profilePictureUrl ??
                  profile.profile_picture_url ??
                  profile.avatarUrl ??
                  profile.avatar_url ??
                  undefined;
              }
            }
          } catch (err) {
            logger.warn(
              "getConversationMembers",
              `Failed to resolve profile for ${userId}`,
              err,
            );
          }
        }

        if (!displayName) displayName = "Utilisateur";

        return {
          id: userId,
          display_name: displayName,
          username,
          avatar_url: avatarUrl,
          role,
          joined_at: member.joinedAt ?? member.joined_at,
          is_active: member.isActive ?? member.is_active,
        };
      },
    );
  },

  async addGroupMembers(
    conversationId: string,
    userIds: string[],
  ): Promise<void> {
    for (const userId of userIds) {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg =
          (body as { message?: string; error?: string })?.message ||
          (body as { error?: string })?.error ||
          `HTTP ${response.status}`;
        const err = new Error(msg) as Error & { status: number };
        err.status = response.status;
        throw err;
      }
    }
  },

  async removeGroupMember(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(
        conversationId,
      )}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );

    if (!response.ok && response.status !== 204) {
      const body = await response.json().catch(() => ({}));
      const msg =
        (body as { message?: string; error?: string })?.message ||
        (body as { error?: string })?.error ||
        `HTTP ${response.status}`;
      const err = new Error(msg) as Error & { status: number };
      err.status = response.status;
      throw err;
    }
  },

  async updateGroupMemberRole(
    conversationId: string,
    userId: string,
    role: "admin" | "member" | "moderator",
  ): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(
        conversationId,
      )}/members/${encodeURIComponent(userId)}/role`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg =
        (body as { message?: string; error?: string })?.message ||
        (body as { error?: string })?.error ||
        `HTTP ${response.status}`;
      const err = new Error(msg) as Error & { status: number };
      err.status = response.status;
      throw err;
    }
  },

  async createDirectConversation(otherUserId: string): Promise<Conversation> {
    const token = await TokenService.getAccessToken();
    let currentUserId = "";
    if (token) {
      const payload = TokenService.decodeAccessToken(token);
      currentUserId = payload?.sub ?? "";
    }

    if (!token || !currentUserId) {
      throw new Error("Authentication required");
    }

    const contactsResponse = await fetch(
      `${getApiBaseUrl()}/user/v1/contacts`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    ).catch(() => null);

    if (!contactsResponse) {
      throw new Error("Impossible de vérifier vos contacts (réseau).");
    }

    let items: any[] = [];
    if (contactsResponse.ok) {
      const raw = await contactsResponse.json().catch(() => null);
      const data = raw?.data !== undefined ? raw.data : raw;
      items = Array.isArray(data)
        ? data
        : Array.isArray(data?.contacts)
          ? data.contacts
          : Array.isArray(data?.data)
            ? data.data
            : [];
    } else {
      const errorText = await contactsResponse.text().catch(() => "");
      const lowered = String(errorText || "").toLowerCase();
      if (
        !(contactsResponse.status === 404 && lowered.includes("no contacts"))
      ) {
        throw new Error("Impossible de vérifier vos contacts.");
      }
    }

    const isContact = items.some((c: any) => {
      const contactId = c?.contactId ?? c?.contact_id;
      return String(contactId ?? "") === String(otherUserId);
    });

    if (!isContact) {
      throw new Error(
        "Vous devez être amis avec cet utilisateur pour créer un chat 1v1.",
      );
    }

    const payloads: Array<Record<string, unknown>> = [
      // Preferred contract on current backend: current user comes from auth,
      // only the target participant is provided explicitly.
      { type: "direct", other_user_id: otherUserId },
      // Compatibility fallback for legacy revisions still expecting user_ids.
      { type: "direct", user_ids: [currentUserId, otherUserId] },
    ];

    let lastResponse: Response | null = null;
    for (let i = 0; i < payloads.length; i++) {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/conversations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloads[i]),
        },
      );

      if (response.ok) {
        return unwrap(response);
      }

      lastResponse = response;

      // 400/404/405 generally indicate payload shape mismatch — try fallback.
      if (
        i < payloads.length - 1 &&
        [400, 404, 405].includes(response.status)
      ) {
        continue;
      }
      break;
    }

    if (!lastResponse) {
      throw new Error("Failed to create direct conversation");
    }

    const body = await lastResponse.json().catch(() => ({}));
    const message =
      (body as { message?: string; error?: string })?.message ||
      (body as { error?: string })?.error ||
      `Failed to create direct conversation (${lastResponse.status})`;
    const err = new Error(message) as Error & { status: number };
    err.status = lastResponse.status;
    throw err;
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
      throw httpError("Failed to create group conversation", response);
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
    // Try the dedicated per-conversation search endpoint first, then fall
    // back to the `?search=` query param on the messages list endpoint. This
    // matches both shapes the messaging service has shipped historically
    // (WHISPR-928) so mobile clients keep working across backend revisions.
    const limit = params?.limit ?? 50;
    const attempts: Array<() => string> = [
      () =>
        `${API_BASE_URL}/messages/search?conversation_id=${encodeURIComponent(
          conversationId,
        )}&query=${encodeURIComponent(query)}&limit=${limit}`,
      () => {
        const sp = new URLSearchParams({ query, limit: String(limit) });
        return `${API_BASE_URL}/conversations/${encodeURIComponent(
          conversationId,
        )}/messages/search?${sp.toString()}`;
      },
      () => {
        const sp = new URLSearchParams({ search: query, limit: String(limit) });
        return `${API_BASE_URL}/conversations/${encodeURIComponent(
          conversationId,
        )}/messages?${sp.toString()}`;
      },
    ];

    for (const buildUrl of attempts) {
      try {
        const response = await authenticatedFetch(buildUrl());
        if (!response.ok) {
          // 404/405/400 -> try the next shape; any other status is a real
          // failure and we let callers fall back to client-side filtering.
          if ([400, 404, 405].includes(response.status)) continue;
          return null;
        }
        const data = await unwrap(response);
        return Array.isArray(data) ? data : [];
      } catch {
        continue;
      }
    }
    return null;
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
