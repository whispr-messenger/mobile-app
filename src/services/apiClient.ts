import { TokenService } from "./TokenService";

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      (body as any)?.message ?? `HTTP ${response.status}`,
    ) as Error & {
      status: number;
      body: unknown;
    };
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return undefined as unknown as T;

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return undefined as unknown as T;
  if (!contentType.includes("application/json")) {
    return text as unknown as T;
  }
  return JSON.parse(text) as T;
}
