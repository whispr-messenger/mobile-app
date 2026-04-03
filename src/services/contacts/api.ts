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
import Constants from 'expo-constants';
import { logger } from '../../utils/logger';
import { TokenService } from '../TokenService';

function getDevHost(): string {
  if (Platform.OS === 'android') return '10.0.2.2';
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) return debuggerHost.split(':')[0];
  return 'localhost';
}

function getContactsBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  if (__DEV__) {
    const configured = extra?.devUserApiUrl;
    if (configured) return configured.replace(/\/+$/, '');
    return `http://${getDevHost()}:3002`;
  }
  return (extra?.apiBaseUrl ?? 'https://whispr-api.roadmvn.com').replace(/\/+$/, '');
}

const API_BASE_URL = `${getContactsBaseUrl()}/user/v1`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch contact');
    }
    return response.json();
  },

  async addContact(data: AddContactDto): Promise<Contact> {
    const response = await fetch(`${API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
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
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
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
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete contact');
    }
  },

  async getContactStats(): Promise<ContactStats> {
    const response = await fetch(`${API_BASE_URL}/contacts/stats`, {
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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
    const url = `${API_BASE_URL}/contacts/import`;
    logger.warn('contactsAPI', 'importPhoneContacts POST', {
      url,
      platform: Platform.OS,
      contactCount: phoneContacts.length,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify(phoneContacts),
      });
    } catch (error) {
      logger.error('contactsAPI', 'importPhoneContacts fetch threw (network?)', error);
      throw error;
    }

    logger.warn('contactsAPI', 'importPhoneContacts response', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      let bodyPreview = '';
      try {
        bodyPreview = (await response.text()).slice(0, 500);
      } catch {
        /* ignore */
      }
      logger.error('contactsAPI', 'importPhoneContacts HTTP error body preview', {
        status: response.status,
        bodyPreview,
      });
      throw new Error(`Failed to import phone contacts: HTTP ${response.status}`);
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    logger.warn('contactsAPI', 'importPhoneContacts parsed', { resultCount: list.length });
    return list;
  },

  async getContactRequests(): Promise<ContactRequest[]> {
    const response = await fetch(`${API_BASE_URL}/contact_requests`, {
      headers: await getAuthHeaders(),
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
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
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
        headers: await getAuthHeaders(),
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
        headers: await getAuthHeaders(),
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

    const url = `${API_BASE_URL}/blocked-users/${query.toString()}`;
    const response = await fetch(url, {
      headers: await getAuthHeaders(),
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

  async blockUser(userId: string, blockerId: string, data?: BlockUserDto): Promise<BlockedUser> {
    const response = await fetch(
      `${API_BASE_URL}/blocked-users/${encodeURIComponent(blockerId)}`,
      {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_id: userId, ...data }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to block user');
    }

    return response.json();
  },

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/blocked-users/${encodeURIComponent(blockerId)}/${encodeURIComponent(blockedId)}`,
      {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to unblock user');
    }
  },
};
