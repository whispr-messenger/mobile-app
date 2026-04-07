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

    try {
      const data = await apiFetch<unknown>(urlV2);
      if (Array.isArray(data)) {
        return { contacts: data as Contact[], total: data.length };
      }
      if (data && typeof data === "object") {
        const obj = data as any;
        const contacts = Array.isArray(obj.contacts)
          ? (obj.contacts as Contact[])
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
      if (apiError?.status !== 404) throw err;

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
        if (legacyApiError?.status === 404) {
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
    return apiFetch<Contact>(`${CONTACTS_API_URL}/contacts`, {
      method: "POST",
      body: JSON.stringify({
        contact_id: data.contactId,
        nickname: data.nickname,
      }),
    });
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
    const query = new URLSearchParams();

    if (params.username) {
      query.append("username", params.username);
    }
    if (params.phoneHash) {
      query.append("phoneHash", params.phoneHash);
    }

    const queryString = query.toString();
    const url = `${CONTACTS_API_URL}/users/search${queryString ? `?${queryString}` : ""}`;

    const data = await apiFetch<any>(url);

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

    if (data && typeof data === "object") {
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
    const data = await apiFetch<any>(`${CONTACTS_API_URL}/contact_requests`);
    const requests = Array.isArray((data as any).requests)
      ? (data as any).requests
      : [];
    return requests;
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
