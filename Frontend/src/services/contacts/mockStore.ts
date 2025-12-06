/**
 * Mock Store for Contacts - In-memory data storage
 * Simulates backend database for development
 */

import {
  Contact,
  User,
  BlockedUser,
  AddContactDto,
  UpdateContactDto,
  UserSearchParams,
  UserSearchResult,
  PhoneContact,
} from '../../types/contact';

class ContactsMockStore {
  private contacts: Contact[] = [];
  private users: User[] = [];
  private blockedUsers: BlockedUser[] = [];
  private currentUserId = 'user-1';

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    // Initialize mock users
    this.users = [
      {
        id: 'user-2',
        username: 'elon_musk',
        phone_number: '+33612345678',
        first_name: 'Elon',
        last_name: 'Musk',
        avatar_url: 'https://i.pravatar.cc/150?img=1',
        last_seen: new Date().toISOString(),
        is_active: true,
      },
      {
        id: 'user-3',
        username: 'jean_dupont',
        phone_number: '+33623456789',
        first_name: 'Jean',
        last_name: 'Dupont',
        avatar_url: 'https://i.pravatar.cc/150?img=2',
        last_seen: new Date(Date.now() - 3600000).toISOString(),
        is_active: true,
      },
      {
        id: 'user-4',
        username: 'marie_martin',
        phone_number: '+33634567890',
        first_name: 'Marie',
        last_name: 'Martin',
        avatar_url: 'https://i.pravatar.cc/150?img=3',
        last_seen: new Date(Date.now() - 7200000).toISOString(),
        is_active: true,
      },
      {
        id: 'user-5',
        username: 'pierre_bernard',
        phone_number: '+33645678901',
        first_name: 'Pierre',
        last_name: 'Bernard',
        avatar_url: 'https://i.pravatar.cc/150?img=4',
        last_seen: new Date(Date.now() - 86400000).toISOString(),
        is_active: false,
      },
    ];

    // Initialize mock contacts
    const now = new Date();
    this.contacts = [
      {
        id: 'contact-1',
        user_id: this.currentUserId,
        contact_id: 'user-2',
        nickname: 'Elon',
        is_favorite: true,
        added_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        contact_user: this.users[0],
      },
      {
        id: 'contact-2',
        user_id: this.currentUserId,
        contact_id: 'user-3',
        is_favorite: false,
        added_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        contact_user: this.users[1],
      },
      {
        id: 'contact-3',
        user_id: this.currentUserId,
        contact_id: 'user-4',
        nickname: 'Marie',
        is_favorite: true,
        added_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        contact_user: this.users[2],
      },
    ];
  }

  getContacts(): Contact[] {
    return this.contacts.map(c => ({ ...c }));
  }

  getContact(contactId: string): Contact | null {
    const contact = this.contacts.find(c => c.id === contactId || c.contact_id === contactId);
    return contact ? { ...contact } : null;
  }

  getUser(userId: string): User | null {
    return this.users.find(u => u.id === userId) || null;
  }

  addContact(data: { contactId: string; nickname?: string }): Contact {
    const user = this.getUser(data.contactId);
    if (!user) {
      throw new Error('User not found');
    }

    const contact: Contact = {
      id: `contact-${Date.now()}`,
      user_id: this.currentUserId,
      contact_id: data.contactId,
      nickname: data.nickname,
      is_favorite: false,
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contact_user: user,
    };

    this.contacts.push(contact);
    return { ...contact };
  }

  updateContact(contactId: string, data: UpdateContactDto): Contact | null {
    const index = this.contacts.findIndex(c => c.id === contactId || c.contact_id === contactId);
    if (index === -1) return null;

    const contact = this.contacts[index];
    if (data.nickname !== undefined) {
      contact.nickname = data.nickname;
    }
    if (data.isFavorite !== undefined) {
      contact.is_favorite = data.isFavorite;
    }
    contact.updated_at = new Date().toISOString();

    return { ...contact };
  }

  deleteContact(contactId: string): boolean {
    const index = this.contacts.findIndex(c => c.id === contactId || c.contact_id === contactId);
    if (index === -1) return false;

    this.contacts.splice(index, 1);
    return true;
  }

  isBlocked(userId: string): boolean {
    return this.blockedUsers.some(
      b => (b.user_id === this.currentUserId && b.blocked_user_id === userId) ||
           (b.user_id === userId && b.blocked_user_id === this.currentUserId)
    );
  }

  searchUsers(params: UserSearchParams): UserSearchResult[] {
    let results: User[] = [];

    if (params.username) {
      results = this.users.filter(u =>
        u.username.toLowerCase().includes(params.username!.toLowerCase())
      );
    } else if (params.phoneHash) {
      // In real implementation, this would match phone hash
      // For mock, we'll just return some users
      results = this.users.slice(0, 2);
    } else {
      results = [...this.users];
    }

    // Filter out current user and existing contacts
    const contactIds = new Set(this.contacts.map(c => c.contact_id));
    results = results.filter(u => u.id !== this.currentUserId && !contactIds.has(u.id));

    return results.map(user => ({
      user,
      is_contact: false,
      is_blocked: this.isBlocked(user.id),
    }));
  }

  matchPhoneContacts(phoneContacts: PhoneContact[]): UserSearchResult[] {
    // In real implementation, this would match phone hashes
    // For mock, we'll return users that match phone numbers
    const matches: UserSearchResult[] = [];

    phoneContacts.forEach(phoneContact => {
      const user = this.users.find(u => {
        // Simple mock matching - in real app would use phone hash
        return u.phone_number && phoneContact.phoneNumber.includes(u.phone_number.slice(-4));
      });

      if (user && user.id !== this.currentUserId) {
        const isContact = this.contacts.some(c => c.contact_id === user.id);
        if (!isContact) {
          matches.push({
            user,
            is_contact: false,
            is_blocked: this.isBlocked(user.id),
          });
        }
      }
    });

    return matches;
  }

  getBlockedUsers(): BlockedUser[] {
    return this.blockedUsers
      .filter(b => b.user_id === this.currentUserId)
      .map(b => ({ ...b }));
  }

  blockUser(userId: string, reason?: string): BlockedUser {
    // Remove from contacts if exists
    this.contacts = this.contacts.filter(c => c.contact_id !== userId);

    const blocked: BlockedUser = {
      id: `blocked-${Date.now()}`,
      user_id: this.currentUserId,
      blocked_user_id: userId,
      reason,
      blocked_at: new Date().toISOString(),
      blocked_user: this.getUser(userId) || undefined,
    };

    this.blockedUsers.push(blocked);
    return { ...blocked };
  }

  unblockUser(userId: string): boolean {
    const index = this.blockedUsers.findIndex(
      b => b.user_id === this.currentUserId && b.blocked_user_id === userId
    );
    if (index === -1) return false;

    this.blockedUsers.splice(index, 1);
    return true;
  }
}

export const mockStore = new ContactsMockStore();

