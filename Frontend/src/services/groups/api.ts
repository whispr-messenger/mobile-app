/**
 * Groups API Service - Mock implementation
 * WHISPR-212: Group details screen
 */

import { Conversation } from '../../types/messaging';

const API_BASE_URL = 'https://api.whispr.local/api/v1';

// Mock delay to simulate network
const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

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

// Mock data
const mockGroups: Record<string, GroupDetails> = {};
const mockMembers: Record<string, GroupMember[]> = {};
const mockStats: Record<string, GroupStats> = {};
const mockLogs: Record<string, GroupLog[]> = {};
const mockSettings: Record<string, GroupSettings> = {};

// Initialize mock data for existing group conversations
const initializeMockData = (groupId: string, conversationId?: string) => {
  if (!mockGroups[groupId]) {
    const groupNames: Record<string, { name: string; description: string }> = {
      'group-security-team': { name: 'Whispr Security Team', description: 'Équipe de sécurité pour discussions importantes' },
      'group-ctf-team': { name: 'CTF Team 2025', description: 'Équipe de Capture The Flag 2025' },
      'group-devops': { name: 'DevOps Engineers', description: 'Équipe DevOps pour l\'infrastructure' },
      'group-hackathon': { name: 'Hackathon 2025', description: 'Organisation du Hackathon 2025' },
      'group-crypto': { name: 'Crypto Enthusiasts', description: 'Communauté de passionnés de cryptographie' },
    };

    const groupInfo = groupNames[groupId] || { name: 'Groupe', description: 'Description du groupe' };

    mockGroups[groupId] = {
      id: groupId,
      name: groupInfo.name,
      description: groupInfo.description,
      picture_url: undefined,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      conversation_id: conversationId || groupId,
    };

    mockMembers[groupId] = [
      {
        id: 'member-1',
        user_id: 'user-1',
        display_name: 'Vous',
        username: 'you',
        role: 'admin',
        joined_at: new Date().toISOString(),
        is_active: true,
      },
      {
        id: 'member-2',
        user_id: 'user-2',
        display_name: 'Jean Dupont',
        username: 'jean_dupont',
        avatar_url: 'https://i.pravatar.cc/150?img=1',
        role: 'member',
        joined_at: new Date().toISOString(),
        is_active: true,
      },
    ];

    mockStats[groupId] = {
      memberCount: 2,
      adminCount: 1,
      messageCount: 50,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    mockLogs[groupId] = [
      {
        id: 'log-1',
        action_type: 'group_created',
        actor_id: 'user-1',
        actor_name: 'Vous',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'log-2',
        action_type: 'member_added',
        actor_id: 'user-1',
        actor_name: 'Vous',
        timestamp: new Date().toISOString(),
        metadata: { member_id: 'user-2', member_name: 'Jean Dupont' },
      },
    ];

    mockSettings[groupId] = {
      message_permission: 'all_members',
      media_permission: 'all_members',
      mention_permission: 'all_members',
      add_members_permission: 'moderators_plus',
      moderation_level: 'medium',
      content_filter_enabled: true,
      join_approval_required: false,
    };
  }
};

export const groupsAPI = {
  /**
   * GET /api/v1/groups/{groupId}
   * Get group details
   */
  async getGroupDetails(groupId: string, conversationId?: string): Promise<GroupDetails> {
    await mockDelay(400);
    initializeMockData(groupId, conversationId);
    return mockGroups[groupId];
  },

  /**
   * GET /api/v1/groups/{groupId}/members
   * Get group members
   */
  async getGroupMembers(
    groupId: string,
    params?: { page?: number; limit?: number; role?: string }
  ): Promise<{ members: GroupMember[]; total: number }> {
    await mockDelay(300);
    initializeMockData(groupId, undefined);
    let members = mockMembers[groupId] || [];

    // Filter by role if specified
    if (params?.role) {
      members = members.filter(m => m.role === params.role);
    }

    // Pagination
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      members: members.slice(start, end),
      total: members.length,
    };
  },

  /**
   * GET /api/v1/groups/{groupId}/stats
   * Get group statistics
   */
  async getGroupStats(groupId: string): Promise<GroupStats> {
    await mockDelay(300);
    initializeMockData(groupId, undefined);
    return mockStats[groupId];
  },

  /**
   * GET /api/v1/groups/{groupId}/logs
   * Get group activity logs
   */
  async getGroupLogs(
    groupId: string,
    params?: { page?: number; limit?: number; actionType?: string }
  ): Promise<{ logs: GroupLog[]; total: number }> {
    await mockDelay(300);
    initializeMockData(groupId, undefined);
    let logs = mockLogs[groupId] || [];

    // Filter by action type if specified
    if (params?.actionType) {
      logs = logs.filter(l => l.action_type === params.actionType);
    }

    // Pagination
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      logs: logs.slice(start, end),
      total: logs.length,
    };
  },

  /**
   * GET /api/v1/groups/{groupId}/settings
   * Get group settings
   */
  async getGroupSettings(groupId: string): Promise<GroupSettings> {
    await mockDelay(300);
    initializeMockData(groupId, undefined);
    return mockSettings[groupId];
  },

  /**
   * POST /api/v1/groups/{groupId}/members
   * Add members to group
   */
  async addMembers(groupId: string, userIds: string[], memberInfo?: Array<{ userId: string; displayName: string; username?: string; avatarUrl?: string }>): Promise<GroupMember[]> {
    await mockDelay(500);
    initializeMockData(groupId, undefined);
    
    const newMembers: GroupMember[] = userIds.map((userId, index) => {
      const info = memberInfo?.find(m => m.userId === userId);
      return {
        id: `member-${Date.now()}-${userId}-${index}`,
        user_id: userId,
        display_name: info?.displayName || `User ${userId}`,
        username: info?.username || `user_${userId}`,
        avatar_url: info?.avatarUrl,
        role: 'member' as const,
        joined_at: new Date().toISOString(),
        is_active: true,
      };
    });

    mockMembers[groupId] = [...(mockMembers[groupId] || []), ...newMembers];
    mockStats[groupId].memberCount = mockMembers[groupId].length;

    const logEntry: GroupLog = {
      id: `log-${Date.now()}`,
      action_type: 'member_added',
      actor_id: 'user-1',
      actor_name: 'Vous',
      timestamp: new Date().toISOString(),
      metadata: {
        members_added: newMembers.map(m => ({ id: m.user_id, name: m.display_name })),
      },
    };
    mockLogs[groupId] = [logEntry, ...(mockLogs[groupId] || [])];

    return newMembers;
  },

  /**
   * DELETE /api/v1/groups/{groupId}/members/{memberId}
   * Remove member from group
   */
  async removeMember(groupId: string, memberId: string): Promise<void> {
    await mockDelay(400);
    initializeMockData(groupId, undefined);
    
    mockMembers[groupId] = mockMembers[groupId].filter(m => m.id !== memberId);
    mockStats[groupId].memberCount = mockMembers[groupId].length;
  },

  /**
   * POST /api/v1/groups/{groupId}/admin/{userId}
   * Transfer admin rights
   */
  async transferAdmin(groupId: string, userId: string): Promise<void> {
    await mockDelay(500);
    initializeMockData(groupId, undefined);
    
    mockMembers[groupId] = mockMembers[groupId].map(m => {
      if (m.user_id === userId) {
        return { ...m, role: 'admin' as const };
      }
      if (m.role === 'admin') {
        return { ...m, role: 'member' as const };
      }
      return m;
    });

    const adminCount = mockMembers[groupId].filter(m => m.role === 'admin').length;
    mockStats[groupId].adminCount = adminCount;
  },

  /**
   * PUT /api/v1/groups/{groupId}
   * Update group details
   */
  async updateGroup(
    groupId: string,
    updates: { name?: string; description?: string; picture_url?: string }
  ): Promise<GroupDetails> {
    await mockDelay(500);
    initializeMockData(groupId, undefined);
    
    if (mockGroups[groupId]) {
      mockGroups[groupId] = {
        ...mockGroups[groupId],
        ...updates,
        updated_at: new Date().toISOString(),
      };
    }

    return mockGroups[groupId];
  },
};

