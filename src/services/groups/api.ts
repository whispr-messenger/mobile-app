import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";
import { messagingAPI } from "../messaging/api";

const API_BASE_URL = `${getApiBaseUrl()}/user/v1`;
const MESSAGING_API_URL = `${getApiBaseUrl()}/messaging/api/v1`;

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await TokenService.getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

const getOwnerId = async (): Promise<string> => {
  const token = await TokenService.getAccessToken();
  if (!token) throw new Error("Not authenticated");
  const payload = TokenService.decodeAccessToken(token);
  if (!payload?.sub) throw new Error("Invalid token payload");
  return payload.sub;
};

export interface GroupMember {
  id: string;
  user_id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  role: "admin" | "moderator" | "member";
  joined_at: string;
  is_active: boolean;
}

export interface GroupStats {
  memberCount: number;
  adminCount: number;
  messageCount: number;
  createdAt: string;
  lastActivity: string;
}

export interface GroupLog {
  id: string;
  action_type:
    | "group_created"
    | "group_updated"
    | "member_added"
    | "member_removed"
    | "role_changed"
    | "settings_updated"
    | "admin_transferred";
  actor_id: string;
  actor_name: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface GroupSettings {
  message_permission: "all_members" | "moderators_plus" | "admins_only";
  media_permission: "all_members" | "moderators_plus" | "admins_only";
  mention_permission: "all_members" | "moderators_plus" | "admins_only";
  add_members_permission: "all_members" | "moderators_plus" | "admins_only";
  moderation_level: "light" | "medium" | "strict";
  content_filter_enabled: boolean;
  join_approval_required: boolean;
}

export interface GroupDetails {
  id: string;
  name: string;
  description?: string;
  picture_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  conversation_id: string;
}

interface RawConversationMember {
  userId?: string;
  user_id?: string;
  role?: string;
  joinedAt?: string;
  joined_at?: string;
  isActive?: boolean;
  is_active?: boolean;
}

interface ResolvedMemberMeta {
  role: "admin" | "moderator" | "member";
  joinedAt?: string;
  isActive?: boolean;
}

interface ConversationMembersResult {
  memberUserIds: string[];
  roleByUserId: Map<string, ResolvedMemberMeta>;
  rawMembers: RawConversationMember[];
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

interface ConversationPayload {
  memberUserIds?: string[];
  member_user_ids?: string[];
  members?: RawConversationMember[];
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  messageCount?: number;
  message_count?: number;
}

/** GET /messaging/api/v1/conversations/:id — payload interne (data ou racine). */
async function fetchMessagingConversationPayload(
  conversationId: string,
  headers: Record<string, string>,
): Promise<any | null> {
  const res = await fetch(
    `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}`,
    { headers },
  ).catch(() => null);
  if (!res?.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json) return null;
  return json.data !== undefined ? json.data : json;
}

function firstFiniteNonNegativeInt(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) {
      return Math.max(0, Math.floor(v));
    }
    if (typeof v === "string" && /^\d+$/.test(v.trim())) {
      const n = parseInt(v.trim(), 10);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
  }
  return undefined;
}

/**
 * Lit le nombre de messages sur la payload conversation telle que renvoyée par
 * le messaging (camelCase / snake_case / metadata / stats imbriqués).
 */
function extractMessageCountFromConversation(conv: any): number | undefined {
  if (!conv || typeof conv !== "object") return undefined;
  const meta =
    conv.metadata && typeof conv.metadata === "object"
      ? (conv.metadata as Record<string, unknown>)
      : {};
  const stats =
    conv.stats && typeof conv.stats === "object"
      ? (conv.stats as Record<string, unknown>)
      : {};

  return firstFiniteNonNegativeInt(
    conv.messageCount,
    conv.message_count,
    conv.totalMessages,
    conv.total_messages,
    conv.messagesCount,
    conv.messages_count,
    conv.numMessages,
    conv.num_messages,
    meta.messageCount,
    meta.message_count,
    meta.totalMessages,
    meta.total_messages,
    meta.messagesCount,
    meta.messages_count,
    stats.messageCount,
    stats.message_count,
    stats.totalMessages,
    stats.total_messages,
  );
}

/**
 * Sans nouvel endpoint backend : déduit le total via GET …/messages existant.
 * 1) Si `meta` expose un total (gateways / futures versions), on l’utilise.
 * 2) Sinon pagination `before` jusqu’à épuisement (plafonné pour limiter le coût).
 */
async function resolveMessageCountViaMessagesList(
  conversationId: string,
  headers: Record<string, string>,
): Promise<number> {
  const PAGE = 100;
  const MAX_PAGES = 50;

  let total = 0;
  let before: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const sp = new URLSearchParams({ limit: String(PAGE) });
    if (before) sp.set("before", before);

    const res = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}/messages?${sp.toString()}`,
      { headers },
    ).catch(() => null);

    if (!res?.ok) {
      return total;
    }

    const json = await res.json().catch(() => null);
    if (!json) {
      return total;
    }

    const meta = (
      json.meta && typeof json.meta === "object" ? json.meta : {}
    ) as Record<string, unknown>;

    if (page === 0) {
      const metaTotal = firstFiniteNonNegativeInt(
        meta.total,
        meta.totalCount,
        meta.total_count,
        meta.totalMessages,
        meta.total_messages,
        meta.messageCount,
        meta.message_count,
      );
      if (metaTotal !== undefined) {
        return metaTotal;
      }
    }

    const arr = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];

    const hasMore =
      meta.hasMore === true ||
      meta.has_more === true ||
      meta.hasMore === "true";

    total += arr.length;

    if (!hasMore || arr.length === 0) {
      return total;
    }

    const last = arr[arr.length - 1] as Record<string, unknown> | undefined;
    const ts = (last?.sentAt ?? last?.sent_at) as string | undefined;
    if (!ts) {
      return total;
    }
    before = ts;
  }

  return total;
}

function membersFromConversationPayload(conv: any): RawConversationMember[] {
  if (!conv || !Array.isArray(conv.members)) return [];
  return conv.members as RawConversationMember[];
}

const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  message_permission: "all_members",
  media_permission: "all_members",
  mention_permission: "all_members",
  add_members_permission: "admins_only",
  moderation_level: "light",
  content_filter_enabled: false,
  join_approval_required: false,
};

function normalizePermission(
  value: unknown,
): "all_members" | "moderators_plus" | "admins_only" | undefined {
  if (
    value === "all_members" ||
    value === "moderators_plus" ||
    value === "admins_only"
  ) {
    return value;
  }
  return undefined;
}

function normalizeModerationLevel(
  value: unknown,
): "light" | "medium" | "strict" | undefined {
  if (value === "light" || value === "medium" || value === "strict") {
    return value;
  }
  return undefined;
}

function toBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function extractGroupSettingsFromConversation(conv: any): GroupSettings {
  const metadata =
    conv?.metadata && typeof conv.metadata === "object"
      ? (conv.metadata as Record<string, unknown>)
      : {};
  const groupSettingsCandidate =
    (metadata.group_settings as unknown) ??
    (metadata.groupSettings as unknown) ??
    (conv?.group_settings as unknown) ??
    (conv?.groupSettings as unknown);
  const groupSettingsRaw =
    groupSettingsCandidate && typeof groupSettingsCandidate === "object"
      ? (groupSettingsCandidate as Record<string, unknown>)
      : {};

  const messagePermission =
    normalizePermission(groupSettingsRaw.message_permission) ??
    normalizePermission(groupSettingsRaw.messagePermission) ??
    normalizePermission(metadata.message_permission) ??
    normalizePermission(metadata.messagePermission) ??
    DEFAULT_GROUP_SETTINGS.message_permission;
  const mediaPermission =
    normalizePermission(groupSettingsRaw.media_permission) ??
    normalizePermission(groupSettingsRaw.mediaPermission) ??
    normalizePermission(metadata.media_permission) ??
    normalizePermission(metadata.mediaPermission) ??
    DEFAULT_GROUP_SETTINGS.media_permission;
  const mentionPermission =
    normalizePermission(groupSettingsRaw.mention_permission) ??
    normalizePermission(groupSettingsRaw.mentionPermission) ??
    normalizePermission(metadata.mention_permission) ??
    normalizePermission(metadata.mentionPermission) ??
    DEFAULT_GROUP_SETTINGS.mention_permission;
  const addMembersPermission =
    normalizePermission(groupSettingsRaw.add_members_permission) ??
    normalizePermission(groupSettingsRaw.addMembersPermission) ??
    normalizePermission(metadata.add_members_permission) ??
    normalizePermission(metadata.addMembersPermission) ??
    DEFAULT_GROUP_SETTINGS.add_members_permission;
  const moderationLevel =
    normalizeModerationLevel(groupSettingsRaw.moderation_level) ??
    normalizeModerationLevel(groupSettingsRaw.moderationLevel) ??
    normalizeModerationLevel(metadata.moderation_level) ??
    normalizeModerationLevel(metadata.moderationLevel) ??
    DEFAULT_GROUP_SETTINGS.moderation_level;

  return {
    message_permission: messagePermission,
    media_permission: mediaPermission,
    mention_permission: mentionPermission,
    add_members_permission: addMembersPermission,
    moderation_level: moderationLevel,
    content_filter_enabled: toBool(
      groupSettingsRaw.content_filter_enabled,
      toBool(
        groupSettingsRaw.contentFilterEnabled,
        toBool(
          metadata.content_filter_enabled,
          toBool(
            metadata.contentFilterEnabled,
            DEFAULT_GROUP_SETTINGS.content_filter_enabled,
          ),
        ),
      ),
    ),
    join_approval_required: toBool(
      groupSettingsRaw.join_approval_required,
      toBool(
        groupSettingsRaw.joinApprovalRequired,
        toBool(
          metadata.join_approval_required,
          toBool(
            metadata.joinApprovalRequired,
            DEFAULT_GROUP_SETTINGS.join_approval_required,
          ),
        ),
      ),
    ),
  };
}

function mapMessagingConversationToGroupDetails(
  conv: any,
  routeGroupId: string,
  conversationId: string,
): GroupDetails {
  const meta = conv.metadata || {};
  const name =
    (typeof conv.name === "string" && conv.name.length > 0 && conv.name) ||
    (typeof meta.name === "string" && meta.name) ||
    "Groupe";
  const description =
    typeof meta.description === "string" ? meta.description : undefined;
  return {
    id: String(
      routeGroupId || conv.externalGroupId || conv.external_group_id || conv.id,
    ),
    name: String(name),
    description,
    picture_url:
      meta.picture_url ??
      meta.avatar_url ??
      conv.pictureUrl ??
      conv.picture_url,
    created_by: String(meta.created_by ?? meta.createdBy ?? ""),
    created_at: String(
      conv.insertedAt ??
        conv.inserted_at ??
        conv.createdAt ??
        conv.created_at ??
        new Date().toISOString(),
    ),
    updated_at: String(
      conv.updatedAt ??
        conv.updated_at ??
        conv.insertedAt ??
        conv.inserted_at ??
        new Date().toISOString(),
    ),
    is_active: conv.isActive ?? conv.is_active ?? true,
    conversation_id: String(conversationId || conv.id),
  };
}

/**
 * Liste des membres : préfère GET /conversations/:id (réponse avec `members`),
 * avec repli sur GET .../members si disponible (gateways futurs).
 */
async function fetchConversationMembers(
  groupOrConversationId: string,
  headers: Record<string, string>,
  conversationId?: string,
): Promise<ConversationMembersResult> {
  const convId = conversationId ?? groupOrConversationId;

  let rawMembers: RawConversationMember[] = [];

  const conv = await fetchMessagingConversationPayload(convId, headers);
  rawMembers = membersFromConversationPayload(conv);

  if (rawMembers.length === 0) {
    const membersResponse = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(convId)}/members`,
      { headers },
    ).catch(() => null);

    const membersJson =
      membersResponse && membersResponse.ok
        ? await membersResponse.json().catch(() => null)
        : null;
    rawMembers = Array.isArray(membersJson)
      ? membersJson
      : Array.isArray(membersJson?.data)
        ? membersJson.data
        : [];
  }

  const roleByUserId = new Map<string, ResolvedMemberMeta>();
  const memberUserIds: string[] = [];
  for (const m of rawMembers) {
    const uid = m.userId ?? m.user_id;
    if (!uid) continue;
    const rawRole = (m.role ?? "member").toLowerCase();
    let role: "admin" | "moderator" | "member" = "member";
    if (rawRole === "admin" || rawRole === "owner") {
      role = "admin";
    } else if (rawRole === "moderator") {
      role = "moderator";
    }
    roleByUserId.set(uid, {
      role,
      joinedAt: m.joinedAt ?? m.joined_at,
      isActive: m.isActive ?? m.is_active,
    });
    memberUserIds.push(uid);
  }

  return { memberUserIds, roleByUserId, rawMembers };
}

/**
 * Repli : ids depuis payload conversation (memberUserIds ou tableau members).
 */
async function fetchConversationMemberIdsFallback(
  groupId: string,
  headers: Record<string, string>,
): Promise<{ ids: string[]; conv: ConversationPayload | null }> {
  const conv = await fetchMessagingConversationPayload(groupId, headers);
  if (!conv) {
    return { ids: [], conv: null };
  }
  const fromMembers = membersFromConversationPayload(conv)
    .map((m) => m.userId ?? m.user_id)
    .filter((id): id is string => !!id);
  const ids: string[] =
    fromMembers.length > 0
      ? fromMembers
      : Array.isArray(conv.memberUserIds)
        ? conv.memberUserIds
        : Array.isArray(conv.member_user_ids)
          ? conv.member_user_ids
          : [];
  return { ids, conv: conv as ConversationPayload };
}

async function updateGroupViaMessagingConversation(
  conversationId: string,
  updates: { name?: string; description?: string; picture_url?: string },
  headers: Record<string, string>,
  routeGroupId: string,
): Promise<GroupDetails> {
  const current = await fetchMessagingConversationPayload(
    conversationId,
    headers,
  );
  const currentMeta =
    ((current?.metadata ?? {}) as Record<string, unknown>) || {};
  const nextMeta: Record<string, unknown> = { ...currentMeta };

  if (updates.description !== undefined) {
    nextMeta.description = updates.description;
  }

  if (updates.picture_url !== undefined) {
    nextMeta.group_avatar_url = updates.picture_url;
    nextMeta.avatar_url = updates.picture_url;
    nextMeta.picture_url = updates.picture_url;
    nextMeta.group_icon_url = updates.picture_url;
  }

  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) {
    body.name = updates.name;
  }
  if (Object.keys(nextMeta).length > 0) body.metadata = nextMeta;
  if (Object.keys(body).length === 0) {
    throw new Error("Aucune mise à jour à appliquer");
  }

  const res = await fetch(
    `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = new Error(
      `Échec mise à jour conversation (${res.status}): ${errText}`,
    ) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  const json = await res.json().catch(() => null);
  const inner = json?.data !== undefined ? json.data : json;
  return mapMessagingConversationToGroupDetails(
    inner,
    routeGroupId,
    conversationId,
  );
}

export const groupsAPI = {
  /**
   * Détails groupe : d'abord conversation messaging (GET /conversations/:id),
   * puis entité user-service /user/v1/groups/:ownerId si besoin.
   */
  async getGroupDetails(
    groupId: string,
    conversationId?: string,
  ): Promise<GroupDetails> {
    const headers = await getAuthHeaders();
    const messagingId = conversationId || groupId;
    const conv = await fetchMessagingConversationPayload(messagingId, headers);
    if (conv) {
      const typ = String(conv.type ?? "").toLowerCase();
      if (typ === "group") {
        return mapMessagingConversationToGroupDetails(
          conv,
          groupId,
          messagingId,
        );
      }
    }

    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}`,
      {
        headers: {
          ...headers,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch group details");
    }

    const data = await response.json().catch(() => []);
    const groups = Array.isArray(data) ? data : [];
    const group = groups.find((g: any) => String(g?.id) === groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    return {
      id: String(group.id),
      name: String(group.name ?? ""),
      description: group.description ?? undefined,
      picture_url: group.picture_url ?? group.avatar_url ?? undefined,
      created_by: String(group.ownerId ?? ownerId),
      created_at: String(group.createdAt ?? new Date().toISOString()),
      updated_at: String(group.updatedAt ?? new Date().toISOString()),
      is_active: true,
      conversation_id: String(conversationId ?? group.id),
    };
  },

  /**
   * GET /api/groups/{groupId}/members
   * Get group members
   */
  async getGroupMembers(
    groupId: string,
    params?: {
      conversationId?: string;
      page?: number;
      limit?: number;
      role?: string;
    },
  ): Promise<{ members: GroupMember[]; total: number }> {
    void params?.page;
    void params?.limit;
    void params?.role;
    const ownerId = await getOwnerId();
    const headers = await getAuthHeaders();
    const conversationId = params?.conversationId;
    const convId = conversationId ?? groupId;

    const { memberUserIds, roleByUserId } = await fetchConversationMembers(
      groupId,
      headers,
      conversationId,
    );

    let fallbackConv: ConversationPayload | null = null;
    let resolvedMemberIds = memberUserIds;
    if (resolvedMemberIds.length === 0) {
      const fallback = await fetchConversationMemberIdsFallback(
        convId,
        headers,
      );
      resolvedMemberIds = fallback.ids;
      fallbackConv = fallback.conv;
    }

    const members: GroupMember[] = await batchedMap(
      resolvedMemberIds,
      MEMBER_PROFILE_FETCH_CONCURRENCY,
      async (userId: string) => {
        const profileResponse = await fetch(
          `${API_BASE_URL}/profile/${encodeURIComponent(userId)}`,
          { headers },
        ).catch(() => null);

        const profile =
          profileResponse && profileResponse.ok
            ? await profileResponse.json().catch(() => null)
            : null;

        const firstName = profile?.firstName || profile?.first_name || "";
        const lastName = profile?.lastName || profile?.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim();
        const displayName = fullName || profile?.username || "Utilisateur";

        const memberMeta = roleByUserId.get(userId);
        const role: "admin" | "moderator" | "member" =
          memberMeta?.role ?? (userId === ownerId ? "admin" : "member");

        return {
          id: userId,
          user_id: userId,
          display_name: displayName,
          username: profile?.username ?? undefined,
          avatar_url: profile?.profilePictureUrl ?? undefined,
          role,
          joined_at:
            memberMeta?.joinedAt ??
            fallbackConv?.createdAt ??
            fallbackConv?.created_at ??
            new Date().toISOString(),
          is_active: memberMeta?.isActive ?? true,
        };
      },
    );

    return { members, total: members.length };
  },

  /**
   * GET /api/groups/{groupId}/stats
   * Get group statistics
   */
  async getGroupStats(
    groupId: string,
    params?: { conversationId?: string },
  ): Promise<GroupStats> {
    const headers = await getAuthHeaders();
    const conversationId = params?.conversationId;
    const convId = conversationId ?? groupId;

    const { memberUserIds, rawMembers } = await fetchConversationMembers(
      groupId,
      headers,
      conversationId,
    );

    const conv = await fetchMessagingConversationPayload(convId, headers);
    if (!conv) {
      throw new Error("Failed to fetch conversation for group stats");
    }

    const resolvedMemberIds =
      memberUserIds.length > 0
        ? memberUserIds
        : membersFromConversationPayload(conv)
            .map((m) => m.userId ?? m.user_id)
            .filter((id): id is string => !!id);

    const adminLike = rawMembers.filter((m) =>
      ["admin", "owner"].includes(String(m.role ?? "member").toLowerCase()),
    ).length;
    const adminCount =
      adminLike > 0 ? adminLike : resolvedMemberIds.length > 0 ? 1 : 0;

    const convAny = conv as ConversationPayload & Record<string, unknown>;

    const fromConversation = extractMessageCountFromConversation(conv);
    const messageCount =
      fromConversation !== undefined
        ? fromConversation
        : await resolveMessageCountViaMessagesList(convId, headers);

    const fallbackLastActivity = String(
      convAny.updatedAt ??
        convAny.updated_at ??
        (conv as any).updatedAt ??
        (conv as any).updated_at ??
        convAny.createdAt ??
        convAny.created_at ??
        new Date().toISOString(),
    );

    return {
      memberCount: resolvedMemberIds.length,
      adminCount,
      messageCount,
      createdAt: String(
        convAny.createdAt ??
          convAny.created_at ??
          (conv as any).insertedAt ??
          (conv as any).inserted_at ??
          new Date().toISOString(),
      ),
      lastActivity: fallbackLastActivity,
    };
  },

  /**
   * TODO(WHISPR-961): backend endpoint not yet implemented in user-service.
   * Needs GET /user/v1/groups/:groupId/logs returning paginated group audit
   * events (member add/remove, role change, settings update, admin transfer).
   * Until then we return an empty list so the UI renders the empty state
   * instead of throwing.
   */
  async getGroupLogs(
    groupId: string,
    params?: { page?: number; limit?: number; actionType?: string },
  ): Promise<{ logs: GroupLog[]; total: number }> {
    void groupId;
    void params;
    return { logs: [], total: 0 };
  },

  /**
   * TODO(WHISPR-961): backend endpoint not yet implemented in user-service.
   * Needs GET/PATCH /user/v1/groups/:groupId/settings backed by a
   * group_settings table (permissions, moderation level, join approval).
   * Until then we return the app defaults so the settings screen is usable.
   */
  async getGroupSettings(
    groupId: string,
    params?: { conversationId?: string },
  ): Promise<GroupSettings> {
    const headers = await getAuthHeaders();
    const convId = params?.conversationId ?? groupId;
    const conv = await fetchMessagingConversationPayload(convId, headers);
    if (!conv) {
      return { ...DEFAULT_GROUP_SETTINGS };
    }
    return extractGroupSettingsFromConversation(conv);
  },

  async updateGroupSettings(
    groupId: string,
    updates: Partial<GroupSettings>,
    params?: { conversationId?: string },
  ): Promise<GroupSettings> {
    const headers = await getAuthHeaders();
    const convId = params?.conversationId ?? groupId;
    const conv = await fetchMessagingConversationPayload(convId, headers);
    if (!conv) {
      throw new Error("Impossible de charger la conversation du groupe");
    }

    const current = extractGroupSettingsFromConversation(conv);
    const mergedSettings: GroupSettings = {
      ...current,
      ...updates,
    };

    const metadata =
      conv.metadata && typeof conv.metadata === "object"
        ? (conv.metadata as Record<string, unknown>)
        : {};

    const res = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(convId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          metadata: {
            ...metadata,
            group_settings: mergedSettings,
          },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Impossible de mettre a jour les parametres (${res.status})${text ? `: ${text}` : ""}`,
      );
    }

    const updated = await fetchMessagingConversationPayload(convId, headers);
    return updated
      ? extractGroupSettingsFromConversation(updated)
      : mergedSettings;
  },

  /**
   * POST /api/groups/{groupId}/members
   * Add members to group
   */
  async addMembers(
    groupId: string,
    userIds: string[],
    memberInfo?: Array<{
      userId: string;
      displayName: string;
      username?: string;
      avatarUrl?: string;
    }>,
    conversationId?: string,
  ): Promise<GroupMember[]> {
    void memberInfo;
    const headers = await getAuthHeaders();
    const convId = conversationId ?? groupId;

    const results: GroupMember[] = [];
    for (const userId of userIds) {
      const response = await fetch(
        `${MESSAGING_API_URL}/conversations/${encodeURIComponent(convId)}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ user_id: userId }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to add member ${userId} to group`);
      }

      // Resolve the new member's profile
      const profileResponse = await fetch(
        `${API_BASE_URL}/profile/${encodeURIComponent(userId)}`,
        { headers },
      ).catch(() => null);

      const profile =
        profileResponse && profileResponse.ok
          ? await profileResponse.json().catch(() => null)
          : null;

      const firstName = profile?.firstName || profile?.first_name || "";
      const lastName = profile?.lastName || profile?.last_name || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const displayName = fullName || profile?.username || "Utilisateur";

      results.push({
        id: userId,
        user_id: userId,
        display_name: displayName,
        username: profile?.username ?? undefined,
        avatar_url: profile?.profilePictureUrl ?? undefined,
        role: "member",
        joined_at: new Date().toISOString(),
        is_active: true,
      });
    }

    return results;
  },

  /**
   * DELETE /api/groups/{groupId}/members/{memberId}
   * Remove member from group
   */
  async removeMember(
    groupId: string,
    memberId: string,
    conversationId?: string,
  ): Promise<void> {
    const convId = conversationId ?? groupId;
    const response = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(convId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg =
        (body as { error?: string; message?: string })?.error ??
        (body as { message?: string })?.message ??
        "Impossible de retirer le membre";
      const err = new Error(msg) as Error & { status: number };
      err.status = response.status;
      throw err;
    }
  },

  /**
   * Transfert admin : PATCH rôle via messaging-service
   * (`/conversations/:id/members/:userId/role`).
   */
  async transferAdmin(
    groupId: string,
    userId: string,
    conversationId?: string,
  ): Promise<void> {
    const convId = conversationId ?? groupId;
    const currentId = await getOwnerId();
    await messagingAPI.updateGroupMemberRole(convId, userId, "admin");
    if (currentId !== userId) {
      await messagingAPI.updateGroupMemberRole(convId, currentId, "member");
    }
  },

  /**
   * Mise à jour groupe : PATCH user-service, repli PUT conversation messaging.
   */
  async updateGroup(
    groupId: string,
    updates: { name?: string; description?: string; picture_url?: string },
    conversationId?: string,
  ): Promise<GroupDetails> {
    const ownerId = await getOwnerId();
    const headers = await getAuthHeaders();

    if (conversationId) {
      const updated = await updateGroupViaMessagingConversation(
        conversationId,
        updates,
        headers,
        groupId,
      );

      try {
        const body: Record<string, string | undefined> = {
          name: updates.name,
          description: updates.description,
        };
        if (updates.picture_url !== undefined) {
          body.picture_url = updates.picture_url;
        }
        const response = await fetch(
          `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}/${encodeURIComponent(groupId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify(body),
          },
        );
        void response;
      } catch {
        // best-effort sync only
      }

      return updated;
    }

    const body: Record<string, string | undefined> = {
      name: updates.name,
      description: updates.description,
    };
    if (updates.picture_url !== undefined) {
      body.picture_url = updates.picture_url;
    }
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}/${encodeURIComponent(groupId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      },
    );

    if (response.ok) {
      const group = await response.json().catch(() => null);
      if (!group) {
        throw new Error("Failed to parse group update response");
      }
      return {
        id: String(group.id),
        name: String(group.name ?? ""),
        description: group.description ?? undefined,
        picture_url: group.picture_url ?? group.avatar_url ?? undefined,
        created_by: String(group.ownerId ?? ownerId),
        created_at: String(group.createdAt ?? new Date().toISOString()),
        updated_at: String(group.updatedAt ?? new Date().toISOString()),
        is_active: true,
        conversation_id: String(conversationId ?? group.id),
      };
    }

    if (
      conversationId &&
      (response.status === 404 || response.status === 403)
    ) {
      return updateGroupViaMessagingConversation(
        conversationId,
        updates,
        headers,
        groupId,
      );
    }

    throw new Error("Failed to update group");
  },

  async leaveGroup(
    groupId: string,
    userId?: string,
    conversationId?: string,
  ): Promise<void> {
    const currentUserId = await getOwnerId();
    const memberId = userId ?? currentUserId;
    const convId = conversationId ?? groupId;
    const headers = await getAuthHeaders();

    // Backend contract: leaving your own group membership must use
    // POST /conversations/:id/leave (DELETE members/:id is for admin removal).
    if (memberId === currentUserId) {
      const leaveResponse = await fetch(
        `${MESSAGING_API_URL}/conversations/${encodeURIComponent(convId)}/leave`,
        {
          method: "POST",
          headers,
        },
      );

      if (leaveResponse.ok || leaveResponse.status === 204) {
        return;
      }

      // Compatibility fallback for older backends still expecting DELETE.
      if (![404, 405].includes(leaveResponse.status)) {
        const body = await leaveResponse.json().catch(() => ({}));
        const raw =
          (body as { error?: string; message?: string })?.error ??
          (body as { message?: string })?.message ??
          `HTTP ${leaveResponse.status}`;
        const err = new Error(raw) as Error & { status: number };
        err.status = leaveResponse.status;
        throw err;
      }
    }

    const response = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(convId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const raw =
        (body as { error?: string; message?: string })?.error ??
        (body as { message?: string })?.message ??
        `HTTP ${response.status}`;
      const msg =
        response.status === 403
          ? "Seuls les administrateurs peuvent retirer un membre pour le moment. Demandez à un administrateur de vous retirer du groupe."
          : raw;
      const err = new Error(msg) as Error & { status: number };
      err.status = response.status;
      throw err;
    }
  },

  async deleteGroup(groupId: string, conversationId?: string): Promise<void> {
    const ownerId = await getOwnerId();
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}/${encodeURIComponent(groupId)}`,
      {
        method: "DELETE",
        headers: {
          ...headers,
        },
      },
    );

    if (response.ok || response.status === 204) {
      return;
    }

    if (conversationId && response.status === 404) {
      const convRes = await fetch(
        `${MESSAGING_API_URL}/conversations/${encodeURIComponent(conversationId)}`,
        { method: "DELETE", headers },
      );
      if (!convRes.ok && convRes.status !== 204) {
        throw new Error("Failed to delete group conversation");
      }
      return;
    }

    throw new Error("Failed to delete group");
  },
};
