import { TokenService } from "../services/TokenService";
import { emitSessionExpired } from "../services/sessionEvents";

export interface AuthFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** Override token retrieval — primarily a test seam. */
  getToken?: () => Promise<string | null>;
}

/**
 * HTTP error carrying the response status — callers can branch on `.status`
 * (e.g. treat 404 as an empty list) without re-parsing the message string.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Thin wrapper around `fetch` that:
 * 1. Injects `Authorization: Bearer <token>` from TokenService when available.
 * 2. Parses JSON when the response Content-Type says so, falls back to text.
 * 3. Throws an `HttpError` on non-2xx so TanStack Query treats it as failure.
 * 4. Emits `sessionExpired` on 401 so the AuthContext can log the user out.
 */
export async function authenticatedFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {},
): Promise<T> {
  const { headers, getToken, ...rest } = options;
  const token = await (getToken ? getToken() : TokenService.getAccessToken());

  const finalHeaders: Record<string, string> = { ...(headers ?? {}) };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (rest.body && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...rest, headers: finalHeaders });

  if (res.status === 401) {
    emitSessionExpired("authenticated_fetch_401");
  }

  const contentType = res.headers?.get?.("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    throw new HttpError(res.status, payload);
  }

  return payload as T;
}
