import { TokenService } from "../TokenService";
import { AuthService } from "../AuthService";
import { getApiBaseUrl } from "../apiBase";
import type {
  Report,
  UserSanction,
  Appeal,
  AppealEvidence,
  AppealType,
  ReportStats,
  ConversationSanction,
  AuditLogEntry,
  UserRole,
} from "../../types/moderation";

const MESSAGING_BASE = () => `${getApiBaseUrl()}/messaging/api/v1`;
const USER_BASE = () => `${getApiBaseUrl()}/user/v1`;

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await TokenService.getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<Response> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
      ...(await getAuthHeaders()),
    },
  });

  if (response.status === 401 && !isRetry) {
    try {
      await AuthService.refreshTokens();
      return authenticatedFetch(url, options, true);
    } catch {
      /* fall through */
    }
  }

  return response;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  const json = await response.json();
  return json.data ?? json;
};

// ─── Reports (messaging-service) ─────────────────────────────────

export const reportsAPI = {
  async createReport(params: {
    reported_user_id: string;
    conversation_id?: string;
    message_id?: string;
    category: string;
    description?: string;
  }): Promise<Report> {
    const res = await authenticatedFetch(`${MESSAGING_BASE()}/reports`, {
      method: "POST",
      body: JSON.stringify(params),
    });
    return parseJson<Report>(res);
  },

  async getMyReports(limit = 20, offset = 0): Promise<Report[]> {
    const res = await authenticatedFetch(
      `${MESSAGING_BASE()}/reports?limit=${limit}&offset=${offset}`,
    );
    return parseJson<Report[]>(res);
  },

  async getReport(id: string): Promise<Report> {
    const res = await authenticatedFetch(`${MESSAGING_BASE()}/reports/${id}`);
    return parseJson<Report>(res);
  },

  async getReportQueue(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    category?: string;
  }): Promise<Report[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.status) query.set("status", params.status);
    if (params?.category) query.set("category", params.category);
    const res = await authenticatedFetch(
      `${MESSAGING_BASE()}/reports/queue?${query}`,
    );
    return parseJson<Report[]>(res);
  },

  async getReportStats(): Promise<ReportStats> {
    const res = await authenticatedFetch(`${MESSAGING_BASE()}/reports/stats`);
    return parseJson<ReportStats>(res);
  },

  async resolveReport(
    id: string,
    action: string,
    notes?: string,
  ): Promise<Report> {
    const res = await authenticatedFetch(
      `${MESSAGING_BASE()}/reports/${id}/resolve`,
      {
        method: "PUT",
        body: JSON.stringify({ action, notes }),
      },
    );
    return parseJson<Report>(res);
  },
};

// ─── Conversation Sanctions (messaging-service) ──────────────────

export const conversationSanctionsAPI = {
  async list(conversationId: string): Promise<ConversationSanction[]> {
    const res = await authenticatedFetch(
      `${MESSAGING_BASE()}/conversations/${conversationId}/sanctions`,
    );
    return parseJson<ConversationSanction[]>(res);
  },

  async create(
    conversationId: string,
    params: {
      user_id: string;
      type: string;
      reason: string;
      expires_at?: string;
    },
  ): Promise<ConversationSanction> {
    const res = await authenticatedFetch(
      `${MESSAGING_BASE()}/conversations/${conversationId}/sanctions`,
      { method: "POST", body: JSON.stringify(params) },
    );
    return parseJson<ConversationSanction>(res);
  },

  async lift(conversationId: string, sanctionId: string): Promise<void> {
    await authenticatedFetch(
      `${MESSAGING_BASE()}/conversations/${conversationId}/sanctions/${sanctionId}`,
      { method: "DELETE" },
    );
  },
};

// ─── Global Sanctions (user-service) ─────────────────────────────

export const sanctionsAPI = {
  async getMySanctions(): Promise<UserSanction[]> {
    const res = await authenticatedFetch(`${USER_BASE()}/sanctions/me`);
    return parseJson<UserSanction[]>(res);
  },

  async getAllActive(limit = 50, offset = 0): Promise<UserSanction[]> {
    const res = await authenticatedFetch(
      `${USER_BASE()}/sanctions?limit=${limit}&offset=${offset}`,
    );
    return parseJson<UserSanction[]>(res);
  },

  async getSanction(id: string): Promise<UserSanction> {
    const res = await authenticatedFetch(`${USER_BASE()}/sanctions/${id}`);
    return parseJson<UserSanction>(res);
  },

  async createSanction(params: {
    userId: string;
    type: string;
    reason: string;
    evidenceRef?: Record<string, any>;
    expiresAt?: string;
  }): Promise<UserSanction> {
    const res = await authenticatedFetch(`${USER_BASE()}/sanctions`, {
      method: "POST",
      body: JSON.stringify(params),
    });
    return parseJson<UserSanction>(res);
  },

  async liftSanction(id: string): Promise<UserSanction> {
    const res = await authenticatedFetch(
      `${USER_BASE()}/sanctions/${id}/lift`,
      { method: "PUT" },
    );
    return parseJson<UserSanction>(res);
  },
};

// ─── Appeals (user-service) ──────────────────────────────────────

export const appealsAPI = {
  async getMyAppeals(): Promise<Appeal[]> {
    const res = await authenticatedFetch(`${USER_BASE()}/appeals`);
    return parseJson<Appeal[]>(res);
  },

  async getAppealQueue(limit = 20, offset = 0): Promise<Appeal[]> {
    const res = await authenticatedFetch(
      `${USER_BASE()}/appeals/queue?limit=${limit}&offset=${offset}`,
    );
    return parseJson<Appeal[]>(res);
  },

  async getAppeal(id: string): Promise<Appeal> {
    const res = await authenticatedFetch(`${USER_BASE()}/appeals/${id}`);
    return parseJson<Appeal>(res);
  },

  async createAppeal(params: {
    sanctionId?: string | null;
    type?: AppealType;
    reason: string;
    evidence?: AppealEvidence;
  }): Promise<Appeal> {
    const body = {
      sanctionId: params.sanctionId ?? null,
      type: params.type ?? "sanction",
      reason: params.reason,
      evidence: params.evidence ?? {},
    };
    const res = await authenticatedFetch(`${USER_BASE()}/appeals`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return parseJson<Appeal>(res);
  },

  async reviewAppeal(
    id: string,
    status: "accepted" | "rejected",
    reviewerNotes?: string,
  ): Promise<Appeal> {
    const res = await authenticatedFetch(
      `${USER_BASE()}/appeals/${id}/review`,
      {
        method: "PUT",
        body: JSON.stringify({ status, reviewerNotes }),
      },
    );
    return parseJson<Appeal>(res);
  },
};

// ─── Roles (user-service) ────────────────────────────────────────

export const rolesAPI = {
  async getMyRole(): Promise<{ role: UserRole }> {
    const res = await authenticatedFetch(`${USER_BASE()}/roles/me`);
    return parseJson<{ role: UserRole }>(res);
  },

  async setRole(userId: string, role: UserRole): Promise<any> {
    const res = await authenticatedFetch(`${USER_BASE()}/roles/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    return parseJson(res);
  },
};

// ─── Audit Logs (user-service) ───────────────────────────────────

export const auditAPI = {
  async getLogs(params?: {
    limit?: number;
    offset?: number;
    actorId?: string;
    targetType?: string;
    action?: string;
  }): Promise<{ data: AuditLogEntry[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.actorId) query.set("actorId", params.actorId);
    if (params?.targetType) query.set("targetType", params.targetType);
    if (params?.action) query.set("action", params.action);
    const res = await authenticatedFetch(`${USER_BASE()}/audit-logs?${query}`);
    return parseJson(res);
  },
};
