/**
 * Content report API — POST /api/v1/moderation/report (interfaces.md)
 */

import { AuthService } from "../AuthService";
import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";

const REPORT_PATH = "/messaging/api/v1/reports";

export type ReportCategoryId =
  | "offensive"
  | "spam"
  | "nudity"
  | "violence"
  | "harassment"
  | "other";

export interface SubmitContentReportPayload {
  conversationId: string;
  messageId: string;
  reportedUserId: string;
  category: ReportCategoryId;
  description?: string;
}

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

export async function submitContentReport(
  payload: SubmitContentReportPayload,
): Promise<Response> {
  const url = `${getApiBaseUrl()}${REPORT_PATH}`;
  const body = {
    reported_user_id: payload.reportedUserId,
    conversation_id: payload.conversationId,
    message_id: payload.messageId,
    category: payload.category,
    description: payload.description?.trim() || undefined,
  };

  return authenticatedFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
