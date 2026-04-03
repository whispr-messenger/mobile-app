import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { TokenService } from '../TokenService';

function getDevHost(): string {
  if (Platform.OS === 'android') return '10.0.2.2';
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) return debuggerHost.split(':')[0];
  return 'localhost';
}

function getGroupsBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  if (__DEV__) {
    const configured = extra?.devUserApiUrl;
    if (configured) return configured.replace(/\/+$/, '');
    return `http://${getDevHost()}:3002`;
  }
  return (extra?.apiBaseUrl ?? 'https://whispr-api.roadmvn.com').replace(/\/+$/, '');
}

const API_BASE_URL = `${getGroupsBaseUrl()}/user/v1`;

async function buildAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export interface GroupMember {
  id: string;
  user_id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  role: 'admin' | 'moderator' | 'member';
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
  action_type: 'group_created' | 'group_updated' | 'member_added' | 'member_removed' | 'role_changed' | 'settings_updated' | 'admin_transferred';
  actor_id: string;
  actor_name: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface GroupSettings {
  message_permission: 'all_members' | 'moderators_plus' | 'admins_only';
  media_permission: 'all_members' | 'moderators_plus' | 'admins_only';
  mention_permission: 'all_members' | 'moderators_plus' | 'admins_only';
  add_members_permission: 'all_members' | 'moderators_plus' | 'admins_only';
  moderation_level: 'light' | 'medium' | 'strict';
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
   * GET /user/v1/groups/:ownerId
   * List groups for the current user
   */
  async getUserGroups(ownerId: string): Promise<GroupDetails[]> {
    const response = await fetch(`${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}`, {
      headers: await buildAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch groups');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * POST /user/v1/groups/:ownerId
   * Create a group
   */
  async createGroup(
    ownerId: string,
    payload: { name: string; description?: string; picture_url?: string; member_ids?: string[] }
  ): Promise<GroupDetails> {
    const response = await fetch(`${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}`, {
      method: 'POST',
      headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to create group');
    return response.json();
  },

  /**
   * PATCH /user/v1/groups/:ownerId/:groupId
   * Update group details
   */
  async updateGroup(
    ownerId: string,
    groupId: string,
    updates: { name?: string; description?: string; picture_url?: string }
  ): Promise<GroupDetails> {
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}/${encodeURIComponent(groupId)}`,
      {
        method: 'PATCH',
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updates),
      }
    );
    if (!response.ok) throw new Error('Failed to update group');
    return response.json();
  },

  /**
   * DELETE /user/v1/groups/:ownerId/:groupId
   * Delete a group
   */
  async deleteGroup(ownerId: string, groupId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(ownerId)}/${encodeURIComponent(groupId)}`,
      {
        method: 'DELETE',
        headers: await buildAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to delete group');
  },

  /**
   * GET group members via messaging-service conversation members endpoint
   * (user-service groups don't expose /members directly)
   */
  async getGroupMembers(
    groupId: string,
    params?: { page?: number; limit?: number; role?: string }
  ): Promise<{ members: GroupMember[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.append('page', String(params.page));
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    if (params?.role) query.append('role', params.role);

    const qs = query.toString();
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/members${qs ? `?${qs}` : ''}`,
      { headers: await buildAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch group members');
    const data = await response.json();
    const members = Array.isArray(data.members) ? data.members : Array.isArray(data) ? data : [];
    return { members, total: data.total ?? members.length };
  },

  /**
   * GET /user/v1/groups/:groupId/stats
   */
  async getGroupStats(groupId: string): Promise<GroupStats> {
    const response = await fetch(`${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/stats`, {
      headers: await buildAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch group stats');
    return response.json();
  },

  /**
   * GET /user/v1/groups/:groupId/logs
   */
  async getGroupLogs(
    groupId: string,
    params?: { page?: number; limit?: number; actionType?: string }
  ): Promise<{ logs: GroupLog[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.append('page', String(params.page));
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    if (params?.actionType) query.append('action_type', params.actionType);

    const qs = query.toString();
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/logs${qs ? `?${qs}` : ''}`,
      { headers: await buildAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch group logs');
    const data = await response.json();
    const logs = Array.isArray(data.logs) ? data.logs : [];
    return { logs, total: data.total ?? logs.length };
  },

  /**
   * GET /user/v1/groups/:groupId/settings
   */
  async getGroupSettings(groupId: string): Promise<GroupSettings> {
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/settings`,
      { headers: await buildAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch group settings');
    return response.json();
  },

  /**
   * POST /user/v1/groups/:groupId/members
   */
  async addMembers(
    groupId: string,
    userIds: string[],
    memberInfo?: Array<{ userId: string; displayName: string; username?: string; avatarUrl?: string }>
  ): Promise<GroupMember[]> {
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/members`,
      {
        method: 'POST',
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ user_ids: userIds, member_info: memberInfo }),
      }
    );
    if (!response.ok) throw new Error('Failed to add members');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * DELETE /user/v1/groups/:groupId/members/:memberId
   */
  async removeMember(groupId: string, memberId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'DELETE',
        headers: await buildAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to remove member');
  },

  /**
   * POST /user/v1/groups/:groupId/admin/:userId
   */
  async transferAdmin(groupId: string, userId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/admin/${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        headers: await buildAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to transfer admin');
  },

  /**
   * POST /user/v1/groups/:groupId/leave
   */
  async leaveGroup(groupId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/leave`,
      {
        method: 'POST',
        headers: await buildAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to leave group');
  },
};
