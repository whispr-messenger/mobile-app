import { AuthService } from "../AuthService";
import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";
import type {
  AcceptCallResponse,
  Call,
  CallType,
  InitiateCallResponse,
} from "../../types/calls";

const API_BASE = `${getApiBaseUrl()}/calls/api/v1`;

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await TokenService.getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

/**
 * Wrapper around fetch that automatically refreshes the access token and
 * retries once when the server returns 401 Unauthorized.
 */
const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<Response> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      ...(await getAuthHeaders()),
    },
  });

  if (response.status === 401 && !isRetry) {
    try {
      await AuthService.refreshTokens();
      return authenticatedFetch(url, options, true);
    } catch {
      // refresh failed — fall through to let caller handle the 401
    }
  }

  return response;
};

const httpError = (label: string, response: Response): Error =>
  new Error(`${label} (${response.status})`);

// Backend wraps responses in { data: ... } — unwrap if present.
const unwrap = async (response: Response): Promise<any> => {
  try {
    const json = await response.json();
    return json?.data !== undefined ? json.data : json;
  } catch {
    return null;
  }
};

const jsonHeaders = { "Content-Type": "application/json" } as const;

export const callsApi = {
  async initiate(
    conversationId: string,
    type: CallType,
    participantIds: string[],
  ): Promise<InitiateCallResponse> {
    const response = await authenticatedFetch(`${API_BASE}/calls`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        conversation_id: conversationId,
        type,
        participant_ids: participantIds,
      }),
    });
    if (!response.ok) throw httpError("Failed to initiate call", response);
    return unwrap(response);
  },

  async accept(callId: string): Promise<AcceptCallResponse> {
    const response = await authenticatedFetch(
      `${API_BASE}/calls/${encodeURIComponent(callId)}/accept`,
      { method: "POST", headers: jsonHeaders },
    );
    if (!response.ok) throw httpError("Failed to accept call", response);
    return unwrap(response);
  },

  async decline(callId: string): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE}/calls/${encodeURIComponent(callId)}/decline`,
      { method: "POST", headers: jsonHeaders },
    );
    if (!response.ok) throw httpError("Failed to decline call", response);
  },

  async end(callId: string): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE}/calls/${encodeURIComponent(callId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) throw httpError("Failed to end call", response);
  },

  async list(params?: {
    status?: string;
    conversation_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Call[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.conversation_id) {
      query.append("conversation_id", params.conversation_id);
    }
    if (params?.limit !== undefined) {
      query.append("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.append("offset", String(params.offset));
    }
    const queryString = query.toString();
    const url = `${API_BASE}/calls${queryString ? `?${queryString}` : ""}`;

    const response = await authenticatedFetch(url);
    if (!response.ok) throw httpError("Failed to list calls", response);
    const data = await unwrap(response);
    return { data: Array.isArray(data) ? data : (data?.data ?? []) };
  },

  async get(callId: string): Promise<Call> {
    const response = await authenticatedFetch(
      `${API_BASE}/calls/${encodeURIComponent(callId)}`,
    );
    if (!response.ok) throw httpError("Failed to fetch call", response);
    return unwrap(response);
  },
};
