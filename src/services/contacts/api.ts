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
} from "../../types/contact";

export type { Contact };

import { apiFetch } from "../apiClient";
import { CONTACTS_API_URL } from "../../config/api";
import { TokenService } from "../TokenService";
import { normalizePhoneToE164 } from "../../utils/phoneUtils";

async function getCurrentUserId(): Promise<string> {
  const token = await TokenService.getAccessToken();
  if (!token) throw new Error("Missing access token");
  const payload = TokenService.decodeAccessToken(token);
  if (!payload?.sub) throw new Error("Missing user id");
  return payload.sub;
}

export const contactsAPI = {
  async getContacts(
    params?: ContactSearchParams,
  ): Promise<{ contacts: Contact[]; total: number }> {
    const query = new URLSearchParams();

    if (params?.search) {
      query.append("search", params.search);
    }
    if (params?.sort) {
      query.append("sort", params.sort);
    }
    if (params?.page !== undefined) {
      query.append("page", String(params.page));
    }
    if (params?.limit !== undefined) {
      query.append("limit", String(params.limit));
    }
    if (params?.favorites !== undefined) {
      query.append("favorites", params.favorites ? "true" : "false");
    }

    const queryString = query.toString();
    const userId = await getCurrentUserId();

    const urlV2 = `${CONTACTS_API_URL}/contacts/${encodeURIComponent(userId)}${
      queryString ? `?${queryString}` : ""
    }`;

    const normalizeContact = (raw: any): Contact | null => {
      if (!raw || typeof raw !== "object") return null;
      const ownerId = raw.ownerId ?? raw.owner_id ?? raw.user_id ?? raw.userId;
      const contactId = raw.contactId ?? raw.contact_id ?? raw.contact_id;
      const createdAt = raw.createdAt ?? raw.created_at ?? raw.added_at;
      const updatedAt = raw.updatedAt ?? raw.updated_at;

      const contactUserRaw = raw.contact_user ?? raw.contactUser ?? raw.contact;
      const contact_user =
        contactUserRaw && typeof contactUserRaw === "object"
          ? {
              id: contactUserRaw.id,
              username: contactUserRaw.username,
              phone_number:
                contactUserRaw.phoneNumber ?? contactUserRaw.phone_number,
              first_name: contactUserRaw.firstName ?? contactUserRaw.first_name,
              last_name: contactUserRaw.lastName ?? contactUserRaw.last_name,
              avatar_url:
                contactUserRaw.profilePictureUrl ??
                contactUserRaw.profile_picture_url ??
                contactUserRaw.avatar_url ??
                contactUserRaw.profile_picture,
              last_seen: contactUserRaw.lastSeen ?? contactUserRaw.last_seen,
              is_active:
                typeof contactUserRaw.isActive === "boolean"
                  ? contactUserRaw.isActive
                  : typeof contactUserRaw.is_active === "boolean"
                    ? contactUserRaw.is_active
                    : true,
            }
          : undefined;

      if (!raw.id || !ownerId || !contactId) return null;

      return {
        id: raw.id,
        user_id: ownerId,
        contact_id: contactId,
        nickname: raw.nickname ?? undefined,
        is_favorite: raw.isFavorite ?? raw.is_favorite ?? false,
        added_at: createdAt ?? new Date().toISOString(),
        updated_at: updatedAt ?? createdAt ?? new Date().toISOString(),
        contact_user,
      };
    };

    try {
      const data = await apiFetch<unknown>(urlV2);
      if (Array.isArray(data)) {
        const contacts = (data as any[])
          .map(normalizeContact)
          .filter((c): c is Contact => c !== null);
        return { contacts, total: contacts.length };
      }
      if (data && typeof data === "object") {
        const obj = data as any;
        const contacts = Array.isArray(obj.contacts)
          ? (obj.contacts as any[])
              .map(normalizeContact)
              .filter((c): c is Contact => c !== null)
          : [];
        const total =
          typeof obj.total === "number"
            ? obj.total
            : Array.isArray(obj.contacts)
              ? obj.contacts.length
              : 0;
        return { contacts, total };
      }
      return { contacts: [], total: 0 };
    } catch (err: unknown) {
      const apiError = err as { status?: number };
      if (apiError?.status === 401 || apiError?.status === 404) {
        // Try legacy endpoint, otherwise return empty
      } else {
        throw err;
      }

      const urlV1 = `${CONTACTS_API_URL}/contacts${queryString ? `?${queryString}` : ""}`;
      try {
        const data = await apiFetch<any>(urlV1);
        const contacts = Array.isArray(data.contacts) ? data.contacts : [];
        const total =
          typeof data.total === "number"
            ? data.total
            : Array.isArray(data.contacts)
              ? data.contacts.length
              : 0;
        return { contacts, total };
      } catch (legacyErr: unknown) {
        const legacyApiError = legacyErr as { status?: number };
        if (legacyApiError?.status === 401 || legacyApiError?.status === 404) {
          return { contacts: [], total: 0 };
        }
        throw legacyErr;
      }
    }
  },

  async getContact(contactId: string): Promise<Contact> {
    return apiFetch<Contact>(
      `${CONTACTS_API_URL}/contacts/${encodeURIComponent(contactId)}`,
    );
  },

  async addContact(data: AddContactDto): Promise<Contact> {
    const ownerId = await getCurrentUserId();
    return apiFetch<Contact>(
      `${CONTACTS_API_URL}/contacts/${encodeURIComponent(ownerId)}`,
      {
        method: "POST",
        body: JSON.stringify({
          contactId: data.contactId,
          nickname: data.nickname,
        }),
      },
    );
  },

  async updateContact(
    contactId: string,
    data: UpdateContactDto,
  ): Promise<Contact> {
    return apiFetch<Contact>(
      `${CONTACTS_API_URL}/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  },

  async deleteContact(contactId: string): Promise<void> {
    return apiFetch<void>(
      `${CONTACTS_API_URL}/contacts/${encodeURIComponent(contactId)}`,
      { method: "DELETE" },
    );
  },

  async getContactStats(): Promise<ContactStats> {
    return apiFetch<ContactStats>(`${CONTACTS_API_URL}/contacts/stats`);
  },

  async searchUsers(params: UserSearchParams): Promise<UserSearchResult[]> {
    const mapUser = (raw: any) => {
      if (!raw || typeof raw !== "object") return null;
      if (!raw.id) return null;
      return {
        id: raw.id,
        username: raw.username,
        phone_number: raw.phoneNumber ?? raw.phone_number,
        first_name: raw.firstName ?? raw.first_name,
        last_name: raw.lastName ?? raw.last_name,
        avatar_url:
          raw.profilePictureUrl ??
          raw.profile_picture_url ??
          raw.avatar_url ??
          raw.profile_picture,
        last_seen: raw.lastSeen ?? raw.last_seen,
        is_active:
          typeof raw.isActive === "boolean"
            ? raw.isActive
            : typeof raw.is_active === "boolean"
              ? raw.is_active
              : true,
      };
    };

    const getProfile = async (userId: string) => {
      const data = await apiFetch<any>(
        `${CONTACTS_API_URL}/profile/${encodeURIComponent(userId)}`,
      );
      return mapUser(data);
    };

    const query = params.username?.trim();
    if (query) {
      const digitCount = query.replace(/\D/g, "").length;
      const looksLikePhone = digitCount >= 7 && /^[\d+\s().-]+$/.test(query);
      if (looksLikePhone) {
        const phoneNumber = normalizePhoneToE164(query, "+33");
        try {
          const user = await apiFetch<any>(
            `${CONTACTS_API_URL}/search/phone?phoneNumber=${encodeURIComponent(
              phoneNumber,
            )}`,
          );
          const mapped = mapUser(user);
          if (mapped) {
            return [{ user: mapped, is_contact: false, is_blocked: false }];
          }
          return [];
        } catch (err: any) {
          const status = (err?.status as number) ?? 0;
          if (status === 404) return [];
          throw err;
        }
      }

      try {
        const user = await apiFetch<any>(
          `${CONTACTS_API_URL}/search/username?username=${encodeURIComponent(query)}`,
        );
        const mapped = mapUser(user);
        if (mapped) {
          return [{ user: mapped, is_contact: false, is_blocked: false }];
        }
      } catch (err: any) {
        const status = (err?.status as number) ?? 0;
        if (status !== 404) {
          throw err;
        }
      }

      try {
        const matches = await apiFetch<any[]>(
          `${CONTACTS_API_URL}/search/name?query=${encodeURIComponent(query)}&limit=20`,
        );
        const ids = Array.isArray(matches)
          ? matches.map((m: any) => m.userId).filter(Boolean)
          : [];
        const profiles = await Promise.all(ids.map(getProfile));
        return profiles
          .filter((u): u is NonNullable<ReturnType<typeof mapUser>> => !!u)
          .map((u) => ({ user: u, is_contact: false, is_blocked: false }));
      } catch (err: any) {
        const status = (err?.status as number) ?? 0;
        if (status === 404) return [];
        throw err;
      }
    }

    return [];
  },

  async importPhoneContacts(
    phoneContacts: PhoneContact[],
  ): Promise<UserSearchResult[]> {
    const data = await apiFetch<UserSearchResult[] | unknown>(
      `${CONTACTS_API_URL}/contacts/import`,
      {
        method: "POST",
        body: JSON.stringify(phoneContacts),
      },
    );
    return Array.isArray(data) ? data : [];
  },

  async getContactRequests(): Promise<ContactRequest[]> {
    try {
      const data = await apiFetch<any>(`${CONTACTS_API_URL}/contact_requests`);
      const requests = Array.isArray((data as any).requests)
        ? (data as any).requests
        : [];
      return requests;
    } catch (err: any) {
      const status = (err?.status as number) ?? 0;
      if (status === 401 || status === 404) {
        return [];
      }
      throw err;
    }
  },

  async sendContactRequest(recipientId: string): Promise<ContactRequest> {
    return apiFetch<ContactRequest>(`${CONTACTS_API_URL}/contact_requests`, {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipientId }),
    });
  },

  async acceptContactRequest(requestId: string): Promise<ContactRequest> {
    return apiFetch<ContactRequest>(
      `${CONTACTS_API_URL}/contact_requests/${encodeURIComponent(requestId)}/accept`,
      { method: "POST" },
    );
  },

  async refuseContactRequest(requestId: string): Promise<ContactRequest> {
    return apiFetch<ContactRequest>(
      `${CONTACTS_API_URL}/contact_requests/${encodeURIComponent(requestId)}/refuse`,
      { method: "POST" },
    );
  },

  async getBlockedUsers(
    page: number = 1,
    limit: number = 50,
  ): Promise<{ blocked: BlockedUser[]; total: number }> {
    const query = new URLSearchParams();
    query.append("page", String(page));
    query.append("limit", String(limit));

    const url = `${CONTACTS_API_URL}/contacts/blocked?${query.toString()}`;
    const data = await apiFetch<any>(url);
    const blocked = Array.isArray(data.blocked) ? data.blocked : [];
    const total =
      typeof data.total === "number"
        ? data.total
        : Array.isArray(data.blocked)
          ? data.blocked.length
          : 0;

    return { blocked, total };
  },

  async blockUser(userId: string, data?: BlockUserDto): Promise<BlockedUser> {
    return apiFetch<BlockedUser>(
      `${CONTACTS_API_URL}/contacts/block/${encodeURIComponent(userId)}`,
      {
        method: "POST",
        body: data ? JSON.stringify(data) : undefined,
      },
    );
  },

  async unblockUser(userId: string): Promise<void> {
    return apiFetch<void>(
      `${CONTACTS_API_URL}/contacts/block/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  },
};
