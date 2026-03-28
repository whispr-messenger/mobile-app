import { Platform } from 'react-native';

const PROD_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

// Dev: direct port access — Prod: path-based routing via Nginx
export const SERVICE_URLS = PROD_BASE
  ? {
      messagingHttp: `${PROD_BASE}/messaging/api/v1`,
      messagingWs:   `wss://${PROD_BASE.replace(/^https?:\/\//, '')}/messaging/ws`,
      auth:          `${PROD_BASE}/auth/v1`,
      user:          `${PROD_BASE}/user/v1`,
      media:         `${PROD_BASE}/media/v1`,
      scheduling:    `${PROD_BASE}/scheduling`,
    }
  : {
      messagingHttp: `http://localhost:${process.env.EXPO_PUBLIC_MESSAGING_PORT ?? '4010'}/api/v1`,
      messagingWs:   `ws://localhost:${process.env.EXPO_PUBLIC_MESSAGING_PORT ?? '4010'}`,
      auth:          `http://localhost:${process.env.EXPO_PUBLIC_AUTH_PORT ?? '3010'}/auth/v1`,
      user:          `http://localhost:${process.env.EXPO_PUBLIC_USER_PORT ?? '3011'}/user/v1`,
      media:         `http://localhost:${process.env.EXPO_PUBLIC_MEDIA_PORT ?? '3012'}/media/v1`,
      scheduling:    `http://localhost:${process.env.EXPO_PUBLIC_SCHEDULING_PORT ?? '3013'}`,
    };
