/**
 * API client pour l'inbox de notifications (WHISPR-1437).
 * Endpoint : /notifications/api/v1/inbox
 */

import { getApiBaseUrl } from "./apiBase";
import { TokenService } from "./TokenService";
import type { InboxResponse, MarkReadResponse } from "../types/inbox";

function getBaseUrl(): string {
  return `${getApiBaseUrl()}/notifications/api/v1`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await TokenService.getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const inboxApi = {
  async fetchInbox(params: {
    cursor?: string | null;
    limit?: number;
  }): Promise<InboxResponse> {
    const headers = await authHeaders();
    const qs = new URLSearchParams();
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.limit) qs.set("limit", String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    const res = await fetch(`${getBaseUrl()}/inbox${query}`, { headers });
    if (!res.ok) throw new Error(`inbox fetch failed: ${res.status}`);
    return res.json() as Promise<InboxResponse>;
  },

  async markRead(ids: string[]): Promise<MarkReadResponse> {
    const headers = await authHeaders();
    const res = await fetch(`${getBaseUrl()}/inbox/mark-read`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`mark-read failed: ${res.status}`);
    return res.json() as Promise<MarkReadResponse>;
  },

  async markAllRead(): Promise<MarkReadResponse> {
    const headers = await authHeaders();
    const res = await fetch(`${getBaseUrl()}/inbox/mark-read`, {
      method: "POST",
      headers,
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) throw new Error(`mark-all-read failed: ${res.status}`);
    return res.json() as Promise<MarkReadResponse>;
  },
};
