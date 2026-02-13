import { Conversation } from '../../types/messaging';
import { Platform } from 'react-native';

const API_BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:4000/api/v1'
    : 'https://api.whispr.local/api/v1';

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
   * GET /api/v1/groups/{groupId}
   * Get group details
   */
  async getGroupDetails(groupId: string, conversationId?: string): Promise<GroupDetails> {
    throw new Error('Not implemented');
  },

  /**
   * GET /api/v1/groups/{groupId}/members
   * Get group members
   */
  async getGroupMembers(
    groupId: string,
    params?: { page?: number; limit?: number; role?: string }
  ): Promise<{ members: GroupMember[]; total: number }> {
    return {
      members: [],
      total: 0,
    };
  },

  /**
   * GET /api/v1/groups/{groupId}/stats
   * Get group statistics
   */
  async getGroupStats(groupId: string): Promise<GroupStats> {
    throw new Error('Not implemented');
  },

  /**
   * GET /api/v1/groups/{groupId}/logs
   * Get group activity logs
   */
  async getGroupLogs(
    groupId: string,
    params?: { page?: number; limit?: number; actionType?: string }
  ): Promise<{ logs: GroupLog[]; total: number }> {
    return {
      logs: [],
      total: 0,
    };
  },

  /**
   * GET /api/v1/groups/{groupId}/settings
   * Get group settings
   */
  async getGroupSettings(groupId: string): Promise<GroupSettings> {
    throw new Error('Not implemented');
  },

  /**
   * POST /api/v1/groups/{groupId}/members
   * Add members to group
   */
  async addMembers(groupId: string, userIds: string[], memberInfo?: Array<{ userId: string; displayName: string; username?: string; avatarUrl?: string }>): Promise<GroupMember[]> {
    throw new Error('Not implemented');
  },

  /**
   * DELETE /api/v1/groups/{groupId}/members/{memberId}
   * Remove member from group
   */
  async removeMember(groupId: string, memberId: string): Promise<void> {
    throw new Error('Not implemented');
  },

  /**
   * POST /api/v1/groups/{groupId}/admin/{userId}
   * Transfer admin rights
   */
  async transferAdmin(groupId: string, userId: string): Promise<void> {
    throw new Error('Not implemented');
  },

  /**
   * PUT /api/v1/groups/{groupId}
   * Update group details
   */
  async updateGroup(
    groupId: string,
    updates: { name?: string; description?: string; picture_url?: string }
  ): Promise<GroupDetails> {
    throw new Error('Not implemented');
  },

  /**
   * POST /api/v1/groups/{groupId}/leave
   * Leave group
   */
  async leaveGroup(groupId: string, userId: string = 'user-1'): Promise<void> {
    throw new Error('Not implemented');
  },

  /**
   * DELETE /api/v1/groups/{groupId}
   * Delete group
   */
  async deleteGroup(groupId: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
