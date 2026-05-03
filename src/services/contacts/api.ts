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
} from "../../types/contact";
import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";

export type { Contact };

const API_BASE_URL = `${getApiBaseUrl()}/user/v1`;

type CacheEntry<T> = { value: T; expiresAt: number };

const IS_TEST = process.env.NODE_ENV === "test";

const CONTACTS_TTL_MS = 60_000;
const CONTACT_REQUESTS_TTL_MS = 30_000;
const USER_PROFILE_TTL_MS = 10 * 60_000;

let contactsCache: CacheEntry<{ contacts: Contact[]; total: number }> | null =
  null;
let contactsInflight: Promise<{ contacts: Contact[]; total: number }> | null =
  null;

let requestsCache: CacheEntry<ContactRequest[]> | null = null;
let requestsInflight: Promise<ContactRequest[]> | null = null;

const userProfileCache = new Map<string, CacheEntry<User | null>>();
const userProfileInflight = new Map<string, Promise<User | null>>();
let lastAuthToken: string | null = null;

const invalidateContactsCache = () => {
  contactsCache = null;
  contactsInflight = null;
};

const invalidateRequestsCache = () => {
  requestsCache = null;
  requestsInflight = null;
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await TokenService.getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
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
  if (!IS_TEST) {
    const cached = userProfileCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inflight = userProfileInflight.get(userId);
    if (inflight) return inflight;
  }

  const promise = (async (): Promise<User | null> => {
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
      const normalized: User = {
        id: u.id ?? userId,
        username: u.username ?? "",
        phone_number: u.phoneNumber ?? u.phone_number,
        first_name: u.firstName ?? u.first_name,
        last_name: u.lastName ?? u.last_name,
        avatar_url:
          u.profilePictureUrl ??
          u.profile_picture_url ??
          u.profilePicture ??
          u.profile_picture ??
          u.avatar_url,
        last_seen: u.lastSeen ?? u.last_seen,
        is_active: u.isActive ?? u.is_active ?? true,
      };
      userProfileCache.set(userId, {
        value: normalized,
        expiresAt: Date.now() + USER_PROFILE_TTL_MS,
      });
      return normalized;
    } catch {
      userProfileCache.set(userId, {
        value: null,
        expiresAt: Date.now() + USER_PROFILE_TTL_MS,
      });
      return null;
    }
  })();

  if (!IS_TEST) {
    userProfileInflight.set(userId, promise);
    promise.finally(() => userProfileInflight.delete(userId));
  }
  return promise;
};

// Some backend search endpoints return `200` with an empty body when no
// match is found, which makes `response.json()` throw. Read as text first
// and treat empty/whitespace-only payloads as `null` to avoid noisy errors.
const parseJsonSafe = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }

  const promise = (async (): Promise<User | null> => {
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
      const normalized: User = {
        id: u.id ?? userId,
        username: u.username ?? "",
        phone_number: u.phoneNumber ?? u.phone_number,
        first_name: u.firstName ?? u.first_name,
        last_name: u.lastName ?? u.last_name,
        avatar_url:
          u.profilePictureUrl ??
          u.profile_picture_url ??
          u.profilePicture ??
          u.profile_picture ??
          u.avatar_url,
        last_seen: u.lastSeen ?? u.last_seen,
        is_active: u.isActive ?? u.is_active ?? true,
      };
      userProfileCache.set(userId, {
        value: normalized,
        expiresAt: Date.now() + USER_PROFILE_TTL_MS,
      });
      return normalized;
    } catch {
      userProfileCache.set(userId, {
        value: null,
        expiresAt: Date.now() + USER_PROFILE_TTL_MS,
      });
      return null;
    }
  })();

  if (!IS_TEST) {
    userProfileInflight.set(userId, promise);
    promise.finally(() => userProfileInflight.delete(userId));
  }
  return promise;
};

const buildSearchResult = (
  u: any,
  contactIds?: Set<string>,
  blockedIds?: Set<string>,
): UserSearchResult => {
  const userId = u.id ?? u.userId;
  return {
    user: {
      id: userId,
      username: u.username ?? "",
      phone_number: u.phoneNumber ?? u.phone_number,
      first_name: u.firstName ?? u.first_name,
      last_name: u.lastName ?? u.last_name,
      avatar_url:
        u.profilePictureUrl ??
        u.profile_picture_url ??
        u.profilePicture ??
        u.profile_picture ??
        u.avatar_url,
      last_seen: u.lastSeen ?? u.last_seen,
      is_active: u.isActive ?? u.is_active ?? true,
    },
    is_contact: contactIds ? contactIds.has(userId) : false,
    // WHISPR-1215 — couvre le sens "je l'ai bloqué". Le sens inverse
    // ("il m'a bloqué") demande un flag côté serveur et fait l'objet d'un
    // ticket séparé.
    is_blocked: blockedIds ? blockedIds.has(userId) : false,
  };
};

export const contactsAPI = {
  async getContacts(
    params?: ContactSearchParams,
    userId?: string,
  ): Promise<{ contacts: Contact[]; total: number }> {
    void userId;
    const token = await TokenService.getAccessToken();
    if (!token) {
      return { contacts: [], total: 0 };
    }
    if (!IS_TEST) {
      if (lastAuthToken !== token) {
        lastAuthToken = token;
        userProfileCache.clear();
        userProfileInflight.clear();
        invalidateContactsCache();
        invalidateRequestsCache();
      }

      if (!params && contactsCache && contactsCache.expiresAt > Date.now()) {
        return contactsCache.value;
      }
      if (!params && contactsInflight) {
        return contactsInflight;
      }
    }

    const promise = (async (): Promise<{
      contacts: Contact[];
      total: number;
    }> => {
      const url = `${API_BASE_URL}/contacts`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorBody: any = null;
        try {
          errorBody = JSON.parse(errorText);
        } catch {
          errorBody = null;
        }

        const errorMessage =
          errorBody?.data?.message ?? errorBody?.message ?? errorText;

        if (
          response.status === 404 &&
          errorMessage?.toLowerCase().includes("no contacts")
        ) {
          return { contacts: [], total: 0 };
        }

        throw new Error(
          `Failed to fetch contacts (${response.status}): ${errorMessage}`,
        );
      }

      const raw = await response.json();
      const data = raw?.data !== undefined ? raw.data : raw;
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.contacts)
          ? data.contacts
          : [];
      const contacts = items.map(normalizeContact);

      // Enrich contacts with user data in parallel
      const enriched = await Promise.all(
        contacts.map(async (contact: Contact) => {
          if (contact.contact_id) {
            const user = await fetchUserById(contact.contact_id);
            if (user) {
              return { ...contact, contact_user: user };
            }
          }
          return contact;
        }),
      );

      const result = { contacts: enriched, total: enriched.length };
      if (!IS_TEST && !params) {
        contactsCache = {
          value: result,
          expiresAt: Date.now() + CONTACTS_TTL_MS,
        };
      }
      return result;
    })();

    if (!IS_TEST && !params) {
      contactsInflight = promise;
      promise.finally(() => {
        contactsInflight = null;
      });
    }

    return promise;
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
    const response = await fetch(`${API_BASE_URL}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({
        contactId: data.contactId,
        nickname: data.nickname,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to add contact");
    }

    invalidateContactsCache();
    return normalizeContact(await response.json());
  },

  async updateContact(
    contactId: string,
    data: UpdateContactDto,
  ): Promise<Contact> {
    const response = await fetch(
      `${API_BASE_URL}/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update contact");
    }

    invalidateContactsCache();
    return normalizeContact(await response.json());
  },

  async deleteContact(contactId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorBody: any = null;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = null;
      }

      const errorMessage =
        errorBody?.data?.message ?? errorBody?.message ?? errorText;

      if (
        response.status === 404 &&
        String(errorMessage || "")
          .toLowerCase()
          .includes("contact not found")
      ) {
        return;
      }

      throw new Error(
        `Failed to delete contact (${response.status}): ${errorMessage || "Unknown error"}`,
      );
    }
    invalidateContactsCache();
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

  /**
   * Profil utilisateur par ID (scan QR, liens profonds).
   */
  async getUserPreviewById(userId: string): Promise<UserSearchResult | null> {
    const user = await fetchUserById(userId);
    if (!user) return null;
    const [contactIds, blockedIds] = await Promise.all([
      this.getContacts()
        .then(({ contacts }) => new Set(contacts.map((c) => c.contact_id)))
        .catch(() => new Set<string>()),
      this.getBlockedUsers()
        .then(({ blocked }) => new Set(blocked.map((b) => b.blocked_user_id)))
        .catch(() => new Set<string>()),
    ]);
    return buildSearchResult(user, contactIds, blockedIds);
  },

  async searchUsers(params: UserSearchParams): Promise<UserSearchResult[]> {
    const query = params.username?.trim() || params.phoneHash?.trim();
    if (!query) {
      return [];
    }

    // WHISPR-1215 — fetch contacts and blocked users in parallel so each
    // result carries the real is_blocked flag (was hard-coded to false).
    const [contactIds, blockedIds] = await Promise.all([
      this.getContacts()
        .then(({ contacts }) => new Set(contacts.map((c) => c.contact_id)))
        .catch(() => new Set<string>()),
      this.getBlockedUsers()
        .then(({ blocked }) => new Set(blocked.map((b) => b.blocked_user_id)))
        .catch(() => new Set<string>()),
    ]);

    // Run all search strategies in parallel for fuzzy matching
    const searches: Promise<UserSearchResult[]>[] = [];

    // 1. Search by username (exact match from API)
    searches.push(
      fetch(
        `${API_BASE_URL}/search/username?username=${encodeURIComponent(query)}`,
        {
          headers: { ...(await getAuthHeaders()) },
        },
      )
        .then(async (r) => {
          if (!r.ok) return [];
          const data = (await parseJsonSafe(r)) as any;
          // WHISPR-1233 — backend wraps the response as `{ user: User | null }`.
          // Fall back to the raw payload for backwards compatibility.
          const user = data?.user ?? data;
          if (!user?.id && !user?.userId) return [];
          return [buildSearchResult(user, contactIds, blockedIds)];
        })
        .catch(() => []),
    );

    // 2. Search by name (fuzzy — backend supports partial match)
    searches.push(
      fetch(
        `${API_BASE_URL}/search/name?query=${encodeURIComponent(query)}&limit=20`,
        {
          headers: { ...(await getAuthHeaders()) },
        },
      )
        .then(async (r) => {
          if (!r.ok) return [];
          const data = (await parseJsonSafe(r)) as any;
          const items = Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
              ? data.results
              : [];
          return items
            .filter((u: any) => u?.id || u?.userId)
            .map((u: any) => buildSearchResult(u, contactIds, blockedIds));
        })
        .catch(() => []),
    );

    // 3. Search by phone number (if input looks like a phone number)
    const looksLikePhone = /^[+\d\s()-]{3,}$/.test(query);
    if (looksLikePhone) {
      searches.push(
        fetch(
          `${API_BASE_URL}/search/phone?phoneNumber=${encodeURIComponent(query)}`,
          {
            headers: { ...(await getAuthHeaders()) },
          },
        )
          .then(async (r) => {
            if (!r.ok) return [];
            const data = (await parseJsonSafe(r)) as any;
            if (!data) return [];
            // WHISPR-1233 — backend wraps the response as `{ user: User | null }`.
            // Unwrap it; fall back to the raw payload for backwards compatibility.
            const payload = data?.user !== undefined ? data.user : data;
            if (!payload) return [];
            const items = Array.isArray(payload)
              ? payload
              : payload?.id || payload?.userId
                ? [payload]
                : [];
            return items
              .filter((u: any) => u?.id || u?.userId)
              .map((u: any) => buildSearchResult(u, contactIds, blockedIds));
          })
          .catch(() => []),
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
    const phoneNumbers = phoneContacts
      .map((c) => c.phoneNumber?.trim())
      .filter((p): p is string => !!p);

    if (!phoneNumbers.length) return [];

    // WHISPR-1215 — pull the user's blocked list once, before issuing the
    // search calls, so each result reflects the real is_blocked state.
    const blockedIds = await this.getBlockedUsers()
      .then(({ blocked }) => new Set(blocked.map((b) => b.blocked_user_id)))
      .catch(() => new Set<string>());

    // Try batch endpoint first
    try {
      const batchResponse = await fetch(`${API_BASE_URL}/search/phone/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ phoneNumbers }),
      });

      if (batchResponse.ok) {
        const data = (await parseJsonSafe(batchResponse)) as any;
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];

        const seen = new Set<string>();
        const results: UserSearchResult[] = [];
        for (const u of items) {
          const id = u?.id ?? u?.userId;
          if (id && !seen.has(id)) {
            seen.add(id);
            results.push(buildSearchResult(u, undefined, blockedIds));
          }
        }
        return results;
      }

      // Non-OK response (e.g. 404) — fall through to sequential fallback
    } catch {
      // Batch endpoint unavailable — fall through to sequential fallback
    }

    // Fallback: sequential requests (one per phone number)
    const results: UserSearchResult[] = [];
    const seen = new Set<string>();

    for (const phone of phoneNumbers) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/search/phone?phoneNumber=${encodeURIComponent(phone)}`,
          { headers },
        );
        if (!response.ok) continue;

        const data = (await parseJsonSafe(response)) as any;
        if (!data) continue;

        // WHISPR-1233 — backend wraps the response as `{ user: User | null }`.
        // Unwrap it; fall back to the raw payload for backwards compatibility.
        const payload = data?.user !== undefined ? data.user : data;
        if (!payload) continue;

        const items = Array.isArray(payload)
          ? payload
          : payload?.id || payload?.userId
            ? [payload]
            : [];

        for (const u of items) {
          const id = u?.id ?? u?.userId;
          if (id && !seen.has(id)) {
            seen.add(id);
            results.push(buildSearchResult(u, undefined, blockedIds));
          }
        }
      } catch {
        // Skip contacts that fail to resolve
      }
    }

    return results;
  },

  async getContactRequests(): Promise<ContactRequest[]> {
    const token = await TokenService.getAccessToken();
    if (!token) return [];

    if (!IS_TEST) {
      if (lastAuthToken !== token) {
        lastAuthToken = token;
        userProfileCache.clear();
        userProfileInflight.clear();
        invalidateContactsCache();
        invalidateRequestsCache();
      }

      if (requestsCache && requestsCache.expiresAt > Date.now()) {
        return requestsCache.value;
      }
      if (requestsInflight) return requestsInflight;
    }

    const promise = (async (): Promise<ContactRequest[]> => {
      const response = await fetch(`${API_BASE_URL}/contact-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        return [];
      }
      const raw = await response.json();
      const data = raw?.data !== undefined ? raw.data : raw;
      const items = Array.isArray(data) ? data : [];
      const mapped = items.map((r: any) => ({
        id: r.id,
        requester_id: r.requesterId ?? r.requester_id,
        recipient_id: r.recipientId ?? r.recipient_id,
        status: r.status,
        created_at: toIso(r.createdAt ?? r.created_at),
        updated_at: toIso(r.updatedAt ?? r.updated_at),
        requester_user: r.requester
          ? {
              id: r.requester.id,
              username: r.requester.username ?? "",
              phone_number: r.requester.phoneNumber ?? r.requester.phone_number,
              first_name: r.requester.firstName ?? r.requester.first_name,
              last_name: r.requester.lastName ?? r.requester.last_name,
              avatar_url:
                r.requester.profilePictureUrl ??
                r.requester.profile_picture_url ??
                r.requester.profilePicture ??
                r.requester.profile_picture ??
                r.requester.avatar_url,
              last_seen: r.requester.lastSeen ?? r.requester.last_seen,
              is_active: r.requester.isActive ?? r.requester.is_active ?? true,
            }
          : undefined,
        recipient_user: r.recipient
          ? {
              id: r.recipient.id,
              username: r.recipient.username ?? "",
              phone_number: r.recipient.phoneNumber ?? r.recipient.phone_number,
              first_name: r.recipient.firstName ?? r.recipient.first_name,
              last_name: r.recipient.lastName ?? r.recipient.last_name,
              avatar_url:
                r.recipient.profilePictureUrl ??
                r.recipient.profile_picture_url ??
                r.recipient.profilePicture ??
                r.recipient.profile_picture ??
                r.recipient.avatar_url,
              last_seen: r.recipient.lastSeen ?? r.recipient.last_seen,
              is_active: r.recipient.isActive ?? r.recipient.is_active ?? true,
            }
          : undefined,
      }));
      if (!IS_TEST) {
        requestsCache = {
          value: mapped,
          expiresAt: Date.now() + CONTACT_REQUESTS_TTL_MS,
        };
      }
      return mapped;
    })();

    if (!IS_TEST) {
      requestsInflight = promise;
      promise.finally(() => {
        requestsInflight = null;
      });
    }
    return promise;
  },

  async sendContactRequest(recipientId: string): Promise<ContactRequest> {
    const response = await fetch(`${API_BASE_URL}/contact-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ contactId: recipientId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const e = new Error(
        err.message || "Failed to send contact request",
      ) as Error & { status: number };
      e.status = response.status;
      throw e;
    }

    invalidateRequestsCache();
    const r = await response.json();
    return {
      id: r.id,
      requester_id: r.requesterId ?? r.requester_id,
      recipient_id: r.recipientId ?? r.recipient_id,
      status: r.status,
      created_at: toIso(r.createdAt ?? r.created_at),
      updated_at: toIso(r.updatedAt ?? r.updated_at),
    };
  },

  async acceptContactRequest(requestId: string): Promise<ContactRequest> {
    const response = await fetch(
      `${API_BASE_URL}/contact-requests/${encodeURIComponent(requestId)}/accept`,
      {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Failed to accept contact request");
    }

    invalidateContactsCache();
    invalidateRequestsCache();
    const r = await response.json();
    return {
      id: r.id,
      requester_id: r.requesterId ?? r.requester_id,
      recipient_id: r.recipientId ?? r.recipient_id,
      status: r.status,
      created_at: toIso(r.createdAt ?? r.created_at),
      updated_at: toIso(r.updatedAt ?? r.updated_at),
    };
  },

  async refuseContactRequest(requestId: string): Promise<ContactRequest> {
    const response = await fetch(
      `${API_BASE_URL}/contact-requests/${encodeURIComponent(requestId)}/reject`,
      {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
        },
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Failed to reject contact request");
    }

    invalidateRequestsCache();
    const r = await response.json();
    return {
      id: r.id,
      requester_id: r.requesterId ?? r.requester_id,
      recipient_id: r.recipientId ?? r.recipient_id,
      status: r.status,
      created_at: toIso(r.createdAt ?? r.created_at),
      updated_at: toIso(r.updatedAt ?? r.updated_at),
    };
  },

  // The backend returns all blocked users at once (no pagination support).
  // page/limit are kept in the signature for interface compatibility.
  async getBlockedUsers(
    _page: number = 1,
    _limit: number = 50,
  ): Promise<{ blocked: BlockedUser[]; total: number }> {
    const response = await fetch(`${API_BASE_URL}/blocked-users`, {
      headers: {
        ...(await getAuthHeaders()),
      },
    });

    if (!response.ok) {
      return { blocked: [], total: 0 };
    }

    const raw = await response.json().catch(() => null);
    const data = raw?.data !== undefined ? raw.data : raw;
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
    const response = await fetch(`${API_BASE_URL}/blocked-users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ blockedId: userId }),
    });

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
    const response = await fetch(
      `${API_BASE_URL}/blocked-users/${encodeURIComponent(userId)}`,
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
