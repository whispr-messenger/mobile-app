/**
 * Contacts API Service - Mock implementation
 * Based on backend REST API specifications
 * @see user-service/documentation/2_fonctional_specs/3_contact_management.md
 */

import {
  Contact,
  AddContactDto,
  UpdateContactDto,
  BlockUserDto,
  ContactSearchParams,
  ContactStats,
  UserSearchParams,
  UserSearchResult,
  BlockedUser,
  PhoneContact,
} from '../../types/contact';
import { mockStore } from './mockStore';

const API_BASE_URL = 'https://api.whispr.local/api/v1';

// Mock delay to simulate network
const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const contactsAPI = {
  /**
   * Get list of contacts with optional search and filters
   * GET /api/v1/contacts
   */
  async getContacts(params?: ContactSearchParams): Promise<{ contacts: Contact[]; total: number }> {
    await mockDelay(300);
    
    let contacts = mockStore.getContacts();
    
    // Apply search filter
    if (params?.search) {
      const searchLower = params.search.toLowerCase();
      contacts = contacts.filter(contact => {
        const user = contact.contact_user;
        if (!user) return false;
        
        const nickname = contact.nickname?.toLowerCase() || '';
        const firstName = user.first_name?.toLowerCase() || '';
        const lastName = user.last_name?.toLowerCase() || '';
        const username = user.username?.toLowerCase() || '';
        
        return (
          nickname.includes(searchLower) ||
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          username.includes(searchLower)
        );
      });
    }
    
    // Apply favorites filter
    if (params?.favorites) {
      contacts = contacts.filter(c => c.is_favorite);
    }
    
    // Apply sorting
    if (params?.sort) {
      contacts.sort((a, b) => {
        switch (params.sort) {
          case 'name':
            const nameA = a.nickname || a.contact_user?.first_name || a.contact_user?.username || '';
            const nameB = b.nickname || b.contact_user?.first_name || b.contact_user?.username || '';
            return nameA.localeCompare(nameB);
          case 'added_at':
            return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
          case 'last_seen':
            const lastSeenA = a.contact_user?.last_seen ? new Date(a.contact_user.last_seen).getTime() : 0;
            const lastSeenB = b.contact_user?.last_seen ? new Date(b.contact_user.last_seen).getTime() : 0;
            return lastSeenB - lastSeenA;
          case 'favorites':
            if (a.is_favorite && !b.is_favorite) return -1;
            if (!a.is_favorite && b.is_favorite) return 1;
            return 0;
          default:
            return 0;
        }
      });
    }
    
    const total = contacts.length;
    
    // Apply pagination
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;
    contacts = contacts.slice(start, end);
    
    return { contacts, total };
  },

  /**
   * Get a single contact by ID
   * GET /api/v1/contacts/{contactId}
   */
  async getContact(contactId: string): Promise<Contact> {
    await mockDelay(200);
    
    const contact = mockStore.getContact(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    return contact;
  },

  /**
   * Add a new contact
   * POST /api/v1/contacts
   */
  async addContact(data: AddContactDto): Promise<Contact> {
    await mockDelay(400);
    
    // Check if contact already exists
    const existing = mockStore.getContacts().find(
      c => c.contact_id === data.contactId
    );
    if (existing) {
      throw new Error('Contact already exists');
    }
    
    // Check if user exists
    const user = mockStore.getUser(data.contactId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if blocked
    const isBlocked = mockStore.isBlocked(data.contactId);
    if (isBlocked) {
      throw new Error('Cannot add blocked user as contact');
    }
    
    const contact = mockStore.addContact({
      contactId: data.contactId,
      nickname: data.nickname,
    });
    
    return contact;
  },

  /**
   * Update a contact (nickname, favorite)
   * PUT /api/v1/contacts/{contactId}
   */
  async updateContact(contactId: string, data: UpdateContactDto): Promise<Contact> {
    await mockDelay(300);
    
    const contact = mockStore.updateContact(contactId, data);
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    return contact;
  },

  /**
   * Delete a contact
   * DELETE /api/v1/contacts/{contactId}
   */
  async deleteContact(contactId: string): Promise<void> {
    await mockDelay(300);
    
    const success = mockStore.deleteContact(contactId);
    if (!success) {
      throw new Error('Contact not found');
    }
  },

  /**
   * Get contact statistics
   * GET /api/v1/contacts/stats
   */
  async getContactStats(): Promise<ContactStats> {
    await mockDelay(200);
    
    const contacts = mockStore.getContacts();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      total: contacts.length,
      favorites: contacts.filter(c => c.is_favorite).length,
      recently_added: contacts.filter(
        c => new Date(c.added_at) > sevenDaysAgo
      ).length,
      recently_active: contacts.filter(
        c => c.contact_user?.last_seen && new Date(c.contact_user.last_seen) > sevenDaysAgo
      ).length,
    };
  },

  /**
   * Search for users to add as contacts
   * GET /api/v1/users/search
   */
  async searchUsers(params: UserSearchParams): Promise<UserSearchResult[]> {
    await mockDelay(300);
    
    const results = mockStore.searchUsers(params);
    return results;
  },

  /**
   * Import phone contacts
   * POST /api/v1/contacts/import
   */
  async importPhoneContacts(phoneContacts: PhoneContact[]): Promise<UserSearchResult[]> {
    await mockDelay(500);
    
    // Simulate matching phone hashes with users
    const matches = mockStore.matchPhoneContacts(phoneContacts);
    return matches;
  },

  /**
   * Get list of blocked users
   * GET /api/v1/contacts/blocked
   */
  async getBlockedUsers(page: number = 1, limit: number = 50): Promise<{ blocked: BlockedUser[]; total: number }> {
    await mockDelay(200);
    
    const blocked = mockStore.getBlockedUsers();
    const total = blocked.length;
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = blocked.slice(start, end);
    
    return { blocked: paginated, total };
  },

  /**
   * Block a user
   * POST /api/v1/contacts/block/{userId}
   */
  async blockUser(userId: string, data?: BlockUserDto): Promise<BlockedUser> {
    await mockDelay(300);
    
    const blocked = mockStore.blockUser(userId, data?.reason);
    return blocked;
  },

  /**
   * Unblock a user
   * DELETE /api/v1/contacts/block/{userId}
   */
  async unblockUser(userId: string): Promise<void> {
    await mockDelay(300);
    
    const success = mockStore.unblockUser(userId);
    if (!success) {
      throw new Error('User not blocked');
    }
  },
};

