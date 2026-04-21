import { AuthService } from "../AuthService";
import { TokenService } from "../TokenService";
import { getApiBaseUrl } from "../apiBase";

/**
 * Données fictives — flux contestation sans appel API réel.
 * TODO(retirer): passer à `false` ou supprimer ce bloc quand POST /moderation/appeal est OK en preprod.
 */
export const MOCK_MODERATION_APPEAL_SUCCESS = __DEV__ && true;

const mockDelayMs = 600;

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

export type AppealReason =
  | "context_incomplete"
  | "misclassification"
  | "false_report"
  | "other";

export interface SubmitModerationAppealPayload {
  decisionId: string;
  reason: AppealReason;
  description: string;
  attachmentFileName?: string;
}

export interface SubmitModerationAppealResult {
  appealId: string;
  status: string;
}

export async function submitModerationAppeal(
  payload: SubmitModerationAppealPayload,
): Promise<SubmitModerationAppealResult> {
  if (MOCK_MODERATION_APPEAL_SUCCESS) {
    await new Promise((r) => setTimeout(r, mockDelayMs));
    return {
      appealId: `APP-${payload.decisionId}-MOCK`,
      status: "received",
    };
  }

  const url = `${getApiBaseUrl()}/api/v1/moderation/appeal/${payload.decisionId}`;
  const body = {
    reason: payload.reason,
    description: payload.description.trim(),
    attachment_filename: payload.attachmentFileName ?? undefined,
  };

  const response = await authenticatedFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(
      (errorBody as { message?: string })?.message ?? `HTTP ${response.status}`,
    ) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  const parsed = (await response.json().catch(() => ({}))) as {
    appealId?: string;
    id?: string;
    status?: string;
  };

  return {
    appealId: parsed.appealId ?? parsed.id ?? payload.decisionId,
    status: parsed.status ?? "received",
  };
}
