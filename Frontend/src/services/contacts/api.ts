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
  ContactRequest,
} from '../../types/contact';
import { Platform } from 'react-native';
import AuthService from '../AuthService';

const API_BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:4000/api/v1'
    : 'https://api.whispr.local/api/v1';

const getAuthHeaders = (): Record<string, string> => {
  try {
    const auth = AuthService.getInstance();
    const current = auth.getCurrentUser();
    if (current?.userId) {
      return {
        'X-User-Id': current.userId,
      };
    }
  } catch {
  }
  return {};
};

export const contactsAPI = {
  async getContacts(params?: ContactSearchParams): Promise<{ contacts: Contact[]; total: number }> {
    const query = new URLSearchParams();

    if (params?.search) {
      query.append('search', params.search);
    }
    if (params?.sort) {
      query.append('sort', params.sort);
    }
    if (params?.page !== undefined) {
      query.append('page', String(params.page));
    }
    if (params?.limit !== undefined) {
      query.append('limit', String(params.limit));
    }
    if (params?.favorites !== undefined) {
      query.append('favorites', params.favorites ? 'true' : 'false');
    }

    const queryString = query.toString();
    const url = `${API_BASE_URL}/contacts${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch contacts');
    }

    const data = await response.json();
    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    const total =
      typeof data.total === 'number'
        ? data.total
        : Array.isArray(data.contacts)
        ? data.contacts.length
        : 0;

    return { contacts, total };
  },

  async getContact(contactId: string): Promise<Contact> {
    const response = await fetch(`${API_BASE_URL}/contacts/${encodeURIComponent(contactId)}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch contact');
    }
    return response.json();
  },

  async addContact(data: AddContactDto): Promise<Contact> {
    const response = await fetch(`${API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        contact_id: data.contactId,
        nickname: data.nickname,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add contact');
    }

    return response.json();
  },

  async updateContact(contactId: string, data: UpdateContactDto): Promise<Contact> {
    const response = await fetch(`${API_BASE_URL}/contacts/${encodeURIComponent(contactId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update contact');
    }

    return response.json();
  },

  async deleteContact(contactId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/contacts/${encodeURIComponent(contactId)}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete contact');
    }
  },

  async getContactStats(): Promise<ContactStats> {
    const response = await fetch(`${API_BASE_URL}/contacts/stats`, {
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch contact stats');
    }

    return response.json();
  },

  async searchUsers(params: UserSearchParams): Promise<UserSearchResult[]> {
    const query = new URLSearchParams();

    if (params.username) {
      query.append('username', params.username);
    }
    if (params.phoneHash) {
      query.append('phoneHash', params.phoneHash);
    }

    const queryString = query.toString();
    const url = `${API_BASE_URL}/users/search${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error('Failed to search users');
    }

    const data = await response.json();

    const normalizeArray = (items: any[]): UserSearchResult[] => {
      return items
        .map((item) => {
          if (!item) return null;

          if (item.user && item.user.id) {
            return {
              user: item.user,
              is_contact: !!item.is_contact,
              is_blocked: !!item.is_blocked,
            };
          }

          if (item.id && item.username) {
            return {
              user: {
                id: item.id,
                username: item.username,
                phone_number: item.phone_number,
                first_name: item.first_name,
                last_name: item.last_name,
                avatar_url: item.avatar_url || item.profile_picture,
                last_seen: item.last_seen,
                is_active: item.is_active ?? true,
              },
              is_contact: !!item.is_contact,
              is_blocked: !!item.is_blocked,
            };
          }

          return null;
        })
        .filter((item): item is UserSearchResult => item !== null);
    };

    if (Array.isArray(data)) {
      return normalizeArray(data);
    }

    if (data && typeof data === 'object') {
      if (Array.isArray((data as any).matches)) {
        return normalizeArray((data as any).matches);
      }

      if (Array.isArray((data as any).results)) {
        return normalizeArray((data as any).results);
      }

      if (Array.isArray((data as any).users)) {
        return normalizeArray((data as any).users);
      }

      const single = normalizeArray([data]);
      if (single.length > 0) {
        return single;
      }
    }

    return [];
  },

  async importPhoneContacts(phoneContacts: PhoneContact[]): Promise<UserSearchResult[]> {
    const response = await fetch(`${API_BASE_URL}/contacts/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(phoneContacts),
    });

    if (!response.ok) {
      throw new Error('Failed to import phone contacts');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async getContactRequests(): Promise<ContactRequest[]> {
    const response = await fetch(`${API_BASE_URL}/contact_requests`, {
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch contact requests');
    }

    const data = await response.json();
    const requests = Array.isArray((data as any).requests) ? (data as any).requests : [];
    return requests;
  },

  async sendContactRequest(recipientId: string): Promise<ContactRequest> {
    const response = await fetch(`${API_BASE_URL}/contact_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        recipient_id: recipientId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send contact request');
    }

    return response.json();
  },

  async acceptContactRequest(requestId: string): Promise<ContactRequest> {
    const response = await fetch(
      `${API_BASE_URL}/contact_requests/${encodeURIComponent(requestId)}/accept`,
      {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to accept contact request');
    }

    return response.json();
  },

  async refuseContactRequest(requestId: string): Promise<ContactRequest> {
    const response = await fetch(
      `${API_BASE_URL}/contact_requests/${encodeURIComponent(requestId)}/refuse`,
      {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to refuse contact request');
    }

    return response.json();
  },

  async getBlockedUsers(page: number = 1, limit: number = 50): Promise<{ blocked: BlockedUser[]; total: number }> {
    const query = new URLSearchParams();
    query.append('page', String(page));
    query.append('limit', String(limit));

    const url = `${API_BASE_URL}/contacts/blocked?${query.toString()}`;
    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch blocked users');
    }

    const data = await response.json();
    const blocked = Array.isArray(data.blocked) ? data.blocked : [];
    const total =
      typeof data.total === 'number'
        ? data.total
        : Array.isArray(data.blocked)
        ? data.blocked.length
        : 0;

    return { blocked, total };
  },

  async blockUser(userId: string, data?: BlockUserDto): Promise<BlockedUser> {
    const response = await fetch(
      `${API_BASE_URL}/contacts/block/${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: data ? JSON.stringify(data) : undefined,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to block user');
    }

    return response.json();
  },

  async unblockUser(userId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/contacts/block/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to unblock user');
    }
  },
};
