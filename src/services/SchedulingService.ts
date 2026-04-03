import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { AuthService } from './AuthService';
import { TokenService } from './TokenService';

type ApiError = Error & { status?: number; body?: unknown };

function getDevHost(): string {
  if (Platform.OS === 'android') return '10.0.2.2';
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) return debuggerHost.split(':')[0];
  return 'localhost';
}

function getSchedulingBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  if (__DEV__) {
    const configured = extra?.devSchedulingApiUrl;
    if (configured) return configured.replace(/\/+$/, '');
    return `http://${getDevHost()}:3005`;
  }
  return `${(extra?.apiBaseUrl ?? 'https://whispr-api.roadmvn.com').replace(/\/+$/, '')}/scheduling`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = await TokenService.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${getSchedulingBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !isRetry) {
    try {
      await AuthService.refreshTokens();
      return apiFetch<T>(path, options, true);
    } catch {
      // fall through
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      (body as { message?: string })?.message ?? `HTTP ${response.status}`
    ) as ApiError;
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return undefined as unknown as T;
  return response.json() as Promise<T>;
}

export interface ScheduledMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'media' | 'system';
  scheduled_at: string; // ISO datetime
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledMessageDto {
  conversation_id: string;
  content: string;
  message_type?: 'text' | 'media' | 'system';
  scheduled_at: string; // ISO datetime
  metadata?: Record<string, unknown>;
}

export interface UpdateScheduledMessageDto {
  content?: string;
  scheduled_at?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  timestamp: string;
}

export interface SchedulingMetrics {
  total_scheduled: number;
  total_sent: number;
  total_failed: number;
  pending_count: number;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export const SchedulingService = {
  /**
   * POST /scheduling/api/v1/scheduled-messages
   * Schedule a message for future delivery.
   */
  async createScheduledMessage(
    dto: CreateScheduledMessageDto
  ): Promise<ScheduledMessage> {
    return apiFetch<ScheduledMessage>('/api/v1/scheduled-messages', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  /**
   * GET /scheduling/api/v1/scheduled-messages
   * List scheduled messages for the current user.
   */
  async getScheduledMessages(params?: {
    conversation_id?: string;
    status?: 'pending' | 'sent' | 'failed' | 'cancelled';
    limit?: number;
    offset?: number;
  }): Promise<ScheduledMessage[]> {
    const query = new URLSearchParams();
    if (params?.conversation_id) query.append('conversation_id', params.conversation_id);
    if (params?.status) query.append('status', params.status);
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    if (params?.offset !== undefined) query.append('offset', String(params.offset));

    const qs = query.toString();
    return apiFetch<ScheduledMessage[]>(`/api/v1/scheduled-messages${qs ? `?${qs}` : ''}`);
  },

  /**
   * PATCH /scheduling/api/v1/scheduled-messages/:id
   * Update a scheduled message.
   */
  async updateScheduledMessage(
    id: string,
    dto: UpdateScheduledMessageDto
  ): Promise<ScheduledMessage> {
    return apiFetch<ScheduledMessage>(
      `/api/v1/scheduled-messages/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }
    );
  },

  /**
   * DELETE /scheduling/api/v1/scheduled-messages/:id
   * Cancel a scheduled message.
   */
  async cancelScheduledMessage(id: string): Promise<void> {
    await apiFetch<void>(`/api/v1/scheduled-messages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // ─── Monitoring ─────────────────────────────────────────────────────────────

  /**
   * GET /scheduling/api/v1/monitoring/health
   */
  async getHealth(): Promise<HealthStatus> {
    return apiFetch<HealthStatus>('/api/v1/monitoring/health');
  },

  /**
   * GET /scheduling/api/v1/monitoring/metrics
   */
  async getMetrics(): Promise<SchedulingMetrics> {
    return apiFetch<SchedulingMetrics>('/api/v1/monitoring/metrics');
  },

  /**
   * GET /scheduling/api/v1/monitoring/queues
   */
  async getQueueStats(): Promise<QueueStats[]> {
    const data = await apiFetch<QueueStats | QueueStats[]>('/api/v1/monitoring/queues');
    return Array.isArray(data) ? data : [data];
  },
};

export default SchedulingService;
