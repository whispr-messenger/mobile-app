import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";

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

export const groupsAPI = {
  /**
   * GET /api/groups/{groupId}
   * Get group details
   */
  async getGroupDetails(
    groupId: string,
    conversationId?: string,
  ): Promise<GroupDetails> {
    void conversationId;
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}`,
      {
        headers: {
          ...(await getAuthHeaders()),
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
      conversation_id: String(group.id),
    };
  },

  /**
   * GET /api/groups/{groupId}/members
   * Get group members
   */
  async getGroupMembers(
    groupId: string,
    params?: { page?: number; limit?: number; role?: string },
  ): Promise<{ members: GroupMember[]; total: number }> {
    void params;
    const ownerId = await getOwnerId();
    const headers = await getAuthHeaders();

    // Fetch conversation to get memberUserIds (backend returns camelCase)
    const convResponse = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(groupId)}`,
      { headers },
    );
    if (!convResponse.ok) {
      throw new Error("Failed to fetch conversation for group members");
    }
    const convJson = await convResponse.json().catch(() => null);
    const conv = convJson?.data !== undefined ? convJson.data : convJson;
    const memberUserIds: string[] = Array.isArray(conv?.memberUserIds)
      ? conv.memberUserIds
      : Array.isArray(conv?.member_user_ids)
        ? conv.member_user_ids
        : [];

    // Fetch real roles from /conversations/:id/members (backend returns
    // { userId, role, joinedAt, isActive } per entry) so we can show the
    // correct admin/moderator/member role instead of inferring from ownerId.
    const membersResponse = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(groupId)}/members`,
      { headers },
    ).catch(() => null);
    const membersJson =
      membersResponse && membersResponse.ok
        ? await membersResponse.json().catch(() => null)
        : null;
    const rawMembers: Array<{
      userId?: string;
      user_id?: string;
      role?: string;
      joinedAt?: string;
      joined_at?: string;
      isActive?: boolean;
      is_active?: boolean;
    }> = Array.isArray(membersJson)
      ? membersJson
      : Array.isArray(membersJson?.data)
        ? membersJson.data
        : [];
    const roleByUserId = new Map<
      string,
      {
        role: "admin" | "moderator" | "member";
        joinedAt?: string;
        isActive?: boolean;
      }
    >();
    for (const m of rawMembers) {
      const uid = m.userId ?? m.user_id;
      if (!uid) continue;
      const rawRole = (m.role ?? "member").toLowerCase();
      const role: "admin" | "moderator" | "member" =
        rawRole === "admin" || rawRole === "moderator" ? rawRole : "member";
      roleByUserId.set(uid, {
        role,
        joinedAt: m.joinedAt ?? m.joined_at,
        isActive: m.isActive ?? m.is_active,
      });
    }

    // Resolve each member's profile
    const members: GroupMember[] = await Promise.all(
      memberUserIds.map(async (userId: string) => {
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
            conv?.createdAt ??
            conv?.created_at ??
            new Date().toISOString(),
          is_active: memberMeta?.isActive ?? true,
        };
      }),
    );

    return { members, total: members.length };
  },

  /**
   * GET /api/groups/{groupId}/stats
   * Get group statistics
   */
  async getGroupStats(groupId: string): Promise<GroupStats> {
    const headers = await getAuthHeaders();

    const convResponse = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(groupId)}`,
      { headers },
    );
    if (!convResponse.ok) {
      throw new Error("Failed to fetch conversation for group stats");
    }
    const convJson = await convResponse.json().catch(() => null);
    const conv = convJson?.data !== undefined ? convJson.data : convJson;

    const memberUserIds: string[] = Array.isArray(conv?.memberUserIds)
      ? conv.memberUserIds
      : Array.isArray(conv?.member_user_ids)
        ? conv.member_user_ids
        : [];

    // Derive admin count from real member roles when available.
    let adminCount = 1;
    const membersResponse = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(groupId)}/members`,
      { headers },
    ).catch(() => null);
    if (membersResponse && membersResponse.ok) {
      const membersJson = await membersResponse.json().catch(() => null);
      const rawMembers: Array<{ role?: string }> = Array.isArray(membersJson)
        ? membersJson
        : Array.isArray(membersJson?.data)
          ? membersJson.data
          : [];
      const admins = rawMembers.filter(
        (m) => (m.role ?? "").toLowerCase() === "admin",
      ).length;
      if (admins > 0) adminCount = admins;
    }

    return {
      memberCount: memberUserIds.length,
      adminCount,
      messageCount: conv?.messageCount ?? conv?.message_count ?? 0,
      createdAt:
        conv?.createdAt ?? conv?.created_at ?? new Date().toISOString(),
      lastActivity:
        conv?.updatedAt ??
        conv?.updated_at ??
        conv?.createdAt ??
        conv?.created_at ??
        new Date().toISOString(),
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
  async getGroupSettings(groupId: string): Promise<GroupSettings> {
    void groupId;
    return {
      message_permission: "all_members",
      media_permission: "all_members",
      mention_permission: "all_members",
      add_members_permission: "admins_only",
      moderation_level: "light",
      content_filter_enabled: false,
      join_approval_required: false,
    };
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
  ): Promise<GroupMember[]> {
    void memberInfo;
    const headers = await getAuthHeaders();

    const results: GroupMember[] = [];
    for (const userId of userIds) {
      const response = await fetch(
        `${MESSAGING_API_URL}/conversations/${encodeURIComponent(groupId)}/members`,
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
  async removeMember(groupId: string, memberId: string): Promise<void> {
    const response = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to remove member from group");
    }
  },

  /**
   * No backend endpoint for admin transfer yet.
   * This is a no-op until the user-service exposes a role management endpoint.
   */
  async transferAdmin(groupId: string, userId: string): Promise<void> {
    void groupId;
    void userId;
  },

  /**
   * PUT /api/groups/{groupId}
   * Update group details
   */
  async updateGroup(
    groupId: string,
    updates: { name?: string; description?: string; picture_url?: string },
  ): Promise<GroupDetails> {
    const ownerId = await getOwnerId();
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
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update group");
    }

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
      conversation_id: String(group.id),
    };
  },

  /**
   * POST /api/groups/{groupId}/leave
   * Leave group
   */
  async leaveGroup(groupId: string, userId?: string): Promise<void> {
    const memberId = userId ?? (await getOwnerId());
    const response = await fetch(
      `${MESSAGING_API_URL}/conversations/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to leave group");
    }
  },

  /**
   * DELETE /api/groups/{groupId}
   * Delete group
   */
  async deleteGroup(groupId: string): Promise<void> {
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}/${encodeURIComponent(groupId)}`,
      {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok && response.status !== 204) {
      throw new Error("Failed to delete group");
    }
  },
};
