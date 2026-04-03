import {
  Contact,
  User,
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
    is_favorite: c?.isFavorite ?? c?.is_favorite ?? false,
    added_at: toIso(c?.createdAt ?? c?.created_at),
    updated_at: toIso(c?.updatedAt ?? c?.updated_at),
  };
};

const fetchUserById = async (userId: string): Promise<User | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/profile/${encodeURIComponent(userId)}`,
      {
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );
    if (!response.ok) return null;
    const u = await response.json();
    if (!u) return null;
    return {
      id: u.id ?? userId,
      username: u.username ?? "",
      phone_number: u.phoneNumber ?? u.phone_number,
      first_name: u.firstName ?? u.first_name,
      last_name: u.lastName ?? u.last_name,
      avatar_url: u.profilePictureUrl ?? u.avatar_url,
      last_seen: u.lastSeen ?? u.last_seen,
      is_active: u.isActive ?? u.is_active ?? true,
    };
  } catch {
    return null;
  }
};

const buildSearchResult = (u: any): UserSearchResult => ({
  user: {
    id: u.id ?? u.userId,
    username: u.username ?? "",
    phone_number: u.phoneNumber ?? u.phone_number,
    first_name: u.firstName ?? u.first_name,
    last_name: u.lastName ?? u.last_name,
    avatar_url: u.profilePictureUrl ?? u.avatar_url,
    last_seen: u.lastSeen ?? u.last_seen,
    is_active: u.isActive ?? u.is_active ?? true,
  },
  is_contact: false,
  is_blocked: false,
});

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

    // Enrich contacts with user data in parallel
    const enriched = await Promise.all(
      contacts.map(async (contact) => {
        if (contact.contact_id) {
          const user = await fetchUserById(contact.contact_id);
          if (user) {
            return { ...contact, contact_user: user };
          }
        }
        return contact;
      }),
    );

    return { contacts: enriched, total: enriched.length };
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
    const query = params.username?.trim() || params.phoneHash?.trim();
    if (!query) {
      return [];
    }

    // Run all search strategies in parallel for fuzzy matching
    const searches: Promise<UserSearchResult[]>[] = [];

    // 1. Search by username (exact match from API)
    searches.push(
      fetch(`${API_BASE_URL}/search/username?username=${encodeURIComponent(query)}`, {
        headers: { ...(await getAuthHeaders()) },
      })
        .then(async (r) => {
          if (!r.ok) return [];
          const user = await r.json().catch(() => null);
          if (!user?.id && !user?.userId) return [];
          return [buildSearchResult(user)];
        })
        .catch(() => [])
    );

    // 2. Search by name (fuzzy — backend supports partial match)
    searches.push(
      fetch(`${API_BASE_URL}/search/name?query=${encodeURIComponent(query)}&limit=20`, {
        headers: { ...(await getAuthHeaders()) },
      })
        .then(async (r) => {
          if (!r.ok) return [];
          const data = await r.json().catch(() => []);
          const items = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
          return items.filter((u: any) => u?.id || u?.userId).map(buildSearchResult);
        })
        .catch(() => [])
    );

    // 3. Search by phone number (if input looks like a phone number)
    const looksLikePhone = /^[+\d\s()-]{3,}$/.test(query);
    if (looksLikePhone) {
      searches.push(
        fetch(`${API_BASE_URL}/search/phone?phoneNumber=${encodeURIComponent(query)}`, {
          headers: { ...(await getAuthHeaders()) },
        })
          .then(async (r) => {
            if (!r.ok) return [];
            const data = await r.json().catch(() => null);
            if (!data) return [];
            const items = Array.isArray(data) ? data : (data?.id || data?.userId) ? [data] : [];
            return items.filter((u: any) => u?.id || u?.userId).map(buildSearchResult);
          })
          .catch(() => [])
      );
    }

    const allResults = await Promise.all(searches);

    // Deduplicate by user id
    const seen = new Set<string>();
    const merged: UserSearchResult[] = [];
    for (const batch of allResults) {
      for (const result of batch) {
        if (!seen.has(result.user.id)) {
          seen.add(result.user.id);
          merged.push(result);
        }
      }
    }

    return merged;
  },

  async importPhoneContacts(
    phoneContacts: PhoneContact[],
  ): Promise<UserSearchResult[]> {
    if (!phoneContacts.length) return [];

    const headers = await getAuthHeaders();
    const results: UserSearchResult[] = [];
    const seen = new Set<string>();

    for (const contact of phoneContacts) {
      const phone = contact.phoneNumber?.trim();
      if (!phone) continue;

      try {
        const response = await fetch(
          `${API_BASE_URL}/search/phone?phoneNumber=${encodeURIComponent(phone)}`,
          { headers },
        );
        if (!response.ok) continue;

        const data = await response.json().catch(() => null);
        if (!data) continue;

        const items = Array.isArray(data)
          ? data
          : data?.id || data?.userId
            ? [data]
            : [];

        for (const u of items) {
          const id = u?.id ?? u?.userId;
          if (id && !seen.has(id)) {
            seen.add(id);
            results.push(buildSearchResult(u));
          }
        }
      } catch {
        // Skip contacts that fail to resolve
      }
    }

    return results;
  },

  // The backend (user-service) has no contact request system — contacts are
  // added/removed directly. This returns an empty array by design.
  async getContactRequests(): Promise<ContactRequest[]> {
    return [];
  },

  // The backend has no request system — contacts are added directly.
  // This calls addContact and returns a ContactRequest-shaped response
  // for callers that expect the request/accept flow.
  async sendContactRequest(recipientId: string): Promise<ContactRequest> {
    const requesterId = await getOwnerId();
    const contact = await this.addContact({ contactId: recipientId });
    return {
      id: contact.id,
      requester_id: requesterId,
      recipient_id: recipientId,
      status: "accepted",
      created_at: contact.added_at,
      updated_at: contact.updated_at,
    };
  },

  // No-op: the backend adds contacts directly (no request/accept flow).
  // Returns a ContactRequest-shaped response for interface compatibility.
  async acceptContactRequest(requestId: string): Promise<ContactRequest> {
    const ownerId = await getOwnerId();
    const now = new Date().toISOString();
    return {
      id: requestId,
      requester_id: "",
      recipient_id: ownerId,
      status: "accepted",
      created_at: now,
      updated_at: now,
    };
  },

  // No-op: the backend has no contact request system, so there is nothing
  // to refuse. Returns a ContactRequest-shaped response for interface compatibility.
  async refuseContactRequest(requestId: string): Promise<ContactRequest> {
    const ownerId = await getOwnerId();
    const now = new Date().toISOString();
    return {
      id: requestId,
      requester_id: "",
      recipient_id: ownerId,
      status: "rejected",
      created_at: now,
      updated_at: now,
    };
  },

  // The backend returns all blocked users at once (no pagination support).
  // page/limit are kept in the signature for interface compatibility.
  async getBlockedUsers(
    _page: number = 1,
    _limit: number = 50,
  ): Promise<{ blocked: BlockedUser[]; total: number }> {
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
