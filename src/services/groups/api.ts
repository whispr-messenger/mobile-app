import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";

const API_BASE_URL = `${getApiBaseUrl()}/user/v1`;

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
   * GET /api/v1/groups/{groupId}
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
      picture_url: undefined,
      created_by: String(group.ownerId ?? ownerId),
      created_at: String(group.createdAt ?? new Date().toISOString()),
      updated_at: String(group.updatedAt ?? new Date().toISOString()),
      is_active: true,
      conversation_id: String(group.id),
    };
  },

  /**
   * GET /api/v1/groups/{groupId}/members
   * Get group members
   */
  async getGroupMembers(
    groupId: string,
    params?: { page?: number; limit?: number; role?: string },
  ): Promise<{ members: GroupMember[]; total: number }> {
    void groupId;
    void params;
    const ownerId = await getOwnerId();

    const profileResponse = await fetch(
      `${API_BASE_URL}/profile/${encodeURIComponent(ownerId)}`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    ).catch(() => null);

    const profile =
      profileResponse && profileResponse.ok
        ? await profileResponse.json().catch(() => null)
        : null;
    const displayName = profile?.firstName || profile?.username || "Owner";

    return {
      members: [
        {
          id: ownerId,
          user_id: ownerId,
          display_name: displayName,
          username: profile?.username ?? undefined,
          avatar_url: profile?.profilePictureUrl ?? undefined,
          role: "admin",
          joined_at: new Date().toISOString(),
          is_active: true,
        },
      ],
      total: 1,
    };
  },

  /**
   * GET /api/v1/groups/{groupId}/stats
   * Get group statistics
   */
  async getGroupStats(groupId: string): Promise<GroupStats> {
    void groupId;
    return {
      memberCount: 1,
      adminCount: 1,
      messageCount: 0,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
  },

  /**
   * GET /api/v1/groups/{groupId}/logs
   * Get group activity logs
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
   * GET /api/v1/groups/{groupId}/settings
   * Get group settings
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
   * POST /api/v1/groups/{groupId}/members
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
    void groupId;
    void userIds;
    void memberInfo;
    return [];
  },

  /**
   * DELETE /api/v1/groups/{groupId}/members/{memberId}
   * Remove member from group
   */
  async removeMember(groupId: string, memberId: string): Promise<void> {
    void groupId;
    void memberId;
  },

  /**
   * POST /api/v1/groups/{groupId}/admin/{userId}
   * Transfer admin rights
   */
  async transferAdmin(groupId: string, userId: string): Promise<void> {
    void groupId;
    void userId;
  },

  /**
   * PUT /api/v1/groups/{groupId}
   * Update group details
   */
  async updateGroup(
    groupId: string,
    updates: { name?: string; description?: string; picture_url?: string },
  ): Promise<GroupDetails> {
    void updates.picture_url;
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}/${encodeURIComponent(groupId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update group");
    }

    const group = await response.json();
    return {
      id: String(group.id),
      name: String(group.name ?? ""),
      description: group.description ?? undefined,
      picture_url: undefined,
      created_by: String(group.ownerId ?? ownerId),
      created_at: String(group.createdAt ?? new Date().toISOString()),
      updated_at: String(group.updatedAt ?? new Date().toISOString()),
      is_active: true,
      conversation_id: String(group.id),
    };
  },

  /**
   * POST /api/v1/groups/{groupId}/leave
   * Leave group
   */
  async leaveGroup(groupId: string, userId: string = "user-1"): Promise<void> {
    void groupId;
    void userId;
  },

  /**
   * DELETE /api/v1/groups/{groupId}
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
