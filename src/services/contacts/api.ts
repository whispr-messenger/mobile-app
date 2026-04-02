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
import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";

export type { Contact };

const API_BASE_URL = `${getApiBaseUrl()}/user/v1`;

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await TokenService.getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

const getOwnerId = async (): Promise<string> => {
  const token = await TokenService.getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  const payload = TokenService.decodeAccessToken(token);
  if (!payload?.sub) {
    throw new Error("Invalid token payload");
  }
  return payload.sub;
};

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  return new Date().toISOString();
};

const normalizeContact = (c: any): Contact => {
  return {
    id: String(c?.id ?? ""),
    user_id: String(c?.ownerId ?? c?.owner_id ?? ""),
    contact_id: String(c?.contactId ?? c?.contact_id ?? ""),
    nickname: c?.nickname ?? undefined,
    is_favorite: false,
    added_at: toIso(c?.createdAt ?? c?.created_at),
    updated_at: toIso(c?.updatedAt ?? c?.updated_at),
  };
};

export const contactsAPI = {
  async getContacts(
    params?: ContactSearchParams,
    userId?: string,
  ): Promise<{ contacts: Contact[]; total: number }> {
    const ownerId = await getOwnerId();
    const url = `${API_BASE_URL}/contacts/${encodeURIComponent(ownerId)}`;
    const response = await fetch(url, {
      headers: {
        ...(await getAuthHeaders()),
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch contacts");
    }

    const data = await response.json();
    const items = Array.isArray(data)
      ? data
      : Array.isArray(data?.contacts)
        ? data.contacts
        : [];
    const contacts = items.map(normalizeContact);
    return { contacts, total: contacts.length };
  },

  async getContact(contactId: string): Promise<Contact> {
    const { contacts } = await this.getContacts();
    const found = contacts.find(
      (c) => c.id === contactId || c.contact_id === contactId,
    );
    if (!found) {
      throw new Error("Contact not found");
    }
    return found;
  },

  async addContact(data: AddContactDto): Promise<Contact> {
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/contacts/${encodeURIComponent(ownerId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          contactId: data.contactId,
          nickname: data.nickname,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to add contact");
    }

    return normalizeContact(await response.json());
  },

  async updateContact(
    contactId: string,
    data: UpdateContactDto,
  ): Promise<Contact> {
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/contacts/${encodeURIComponent(ownerId)}/${encodeURIComponent(contactId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ nickname: data.nickname }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update contact");
    }

    return normalizeContact(await response.json());
  },

  async deleteContact(contactId: string): Promise<void> {
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/contacts/${encodeURIComponent(ownerId)}/${encodeURIComponent(contactId)}`,
      {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete contact");
    }
  },

  async getContactStats(): Promise<ContactStats> {
    const { contacts } = await this.getContacts();
    return {
      total: contacts.length,
      favorites: contacts.filter((c) => c.is_favorite).length,
      recently_added: 0,
      recently_active: 0,
    };
  },

  async searchUsers(params: UserSearchParams): Promise<UserSearchResult[]> {
    if (!params.username) {
      return [];
    }

    const url = `${API_BASE_URL}/search/username?username=${encodeURIComponent(params.username)}`;
    const response = await fetch(url, {
      headers: {
        ...(await getAuthHeaders()),
      },
    });

    if (!response.ok) {
      return [];
    }

    const user = await response.json().catch(() => null);
    if (!user) return [];

    return [
      {
        user: {
          id: user.id,
          username: user.username,
          phone_number: user.phoneNumber,
          first_name: user.firstName,
          last_name: user.lastName,
          avatar_url: user.profilePictureUrl,
          last_seen: user.lastSeen,
          is_active: user.isActive ?? true,
        },
        is_contact: false,
        is_blocked: false,
      },
    ];
  },

  async importPhoneContacts(
    phoneContacts: PhoneContact[],
  ): Promise<UserSearchResult[]> {
    void phoneContacts;
    return [];
  },

  async getContactRequests(): Promise<ContactRequest[]> {
    return [];
  },

  async sendContactRequest(recipientId: string): Promise<ContactRequest> {
    const requesterId = await getOwnerId();
    await this.addContact({ contactId: recipientId });
    const now = new Date().toISOString();
    return {
      id: `req_${Date.now()}`,
      requester_id: requesterId,
      recipient_id: recipientId,
      status: "accepted",
      created_at: now,
      updated_at: now,
    };
  },

  async acceptContactRequest(requestId: string): Promise<ContactRequest> {
    const now = new Date().toISOString();
    return {
      id: requestId,
      requester_id: "",
      recipient_id: "",
      status: "accepted",
      created_at: now,
      updated_at: now,
    };
  },

  async refuseContactRequest(requestId: string): Promise<ContactRequest> {
    const now = new Date().toISOString();
    return {
      id: requestId,
      requester_id: "",
      recipient_id: "",
      status: "rejected",
      created_at: now,
      updated_at: now,
    };
  },

  async getBlockedUsers(
    page: number = 1,
    limit: number = 50,
  ): Promise<{ blocked: BlockedUser[]; total: number }> {
    void page;
    void limit;
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/blocked-users/${encodeURIComponent(ownerId)}`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      return { blocked: [], total: 0 };
    }

    const data = await response.json().catch(() => []);
    const entries = Array.isArray(data) ? data : [];
    const blocked = entries.map((e: any) => ({
      id: String(e?.id ?? ""),
      user_id: String(e?.blockerId ?? e?.blocker_id ?? ""),
      blocked_user_id: String(e?.blockedId ?? e?.blocked_id ?? ""),
      blocked_at: toIso(e?.createdAt ?? e?.created_at),
    }));

    return { blocked, total: blocked.length };
  },

  async blockUser(userId: string, data?: BlockUserDto): Promise<BlockedUser> {
    void data;
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/blocked-users/${encodeURIComponent(ownerId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ blockedId: userId }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to block user");
    }

    const blocked = await response.json();
    return {
      id: String(blocked?.id ?? ""),
      user_id: String(blocked?.blockerId ?? blocked?.blocker_id ?? ""),
      blocked_user_id: String(blocked?.blockedId ?? blocked?.blocked_id ?? ""),
      blocked_at: toIso(blocked?.createdAt ?? blocked?.created_at),
    };
  },

  async unblockUser(userId: string): Promise<void> {
    const ownerId = await getOwnerId();
    const response = await fetch(
      `${API_BASE_URL}/blocked-users/${encodeURIComponent(ownerId)}/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to unblock user");
    }
  },
};
