import { Platform } from 'react-native';

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost';

export const SERVICE_URLS = {
  messagingHttp: `${BASE}:${process.env.EXPO_PUBLIC_MESSAGING_PORT ?? '4010'}/api/v1`,
  messagingWs:   `ws://${BASE.replace(/^https?:\/\//, '')}:${process.env.EXPO_PUBLIC_MESSAGING_PORT ?? '4010'}`,
  auth:          `${BASE}:${process.env.EXPO_PUBLIC_AUTH_PORT ?? '3010'}/api/v1`,
  user:          `${BASE}:${process.env.EXPO_PUBLIC_USER_PORT ?? '3011'}/api/v1`,
  media:         `${BASE}:${process.env.EXPO_PUBLIC_MEDIA_PORT ?? '3012'}/api/v1`,
  scheduling:    `${BASE}:${process.env.EXPO_PUBLIC_SCHEDULING_PORT ?? '3013'}/api/v1`,
};
