import { Platform } from "react-native";

const PROD_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

// Dev: direct port access — Prod: path-based routing via Nginx
export const SERVICE_URLS = PROD_BASE
  ? {
      messagingHttp: `${PROD_BASE}/messaging/api`,
      messagingWs: `wss://${PROD_BASE.replace(/^https?:\/\//, "")}/messaging`,
      auth: `${PROD_BASE}/auth`,
      user: `${PROD_BASE}/user`,
      media: `${PROD_BASE}/media`,
      scheduling: `${PROD_BASE}/scheduling`,
    }
  : {
      messagingHttp: `http://localhost:${process.env.EXPO_PUBLIC_MESSAGING_PORT ?? "4010"}/api`,
      messagingWs: `ws://localhost:${process.env.EXPO_PUBLIC_MESSAGING_PORT ?? "4010"}`,
      auth: `http://localhost:${process.env.EXPO_PUBLIC_AUTH_PORT ?? "3010"}/auth`,
      user: `http://localhost:${process.env.EXPO_PUBLIC_USER_PORT ?? "3011"}/user`,
      media: `http://localhost:${process.env.EXPO_PUBLIC_MEDIA_PORT ?? "3012"}/media`,
      scheduling: `http://localhost:${process.env.EXPO_PUBLIC_SCHEDULING_PORT ?? "3013"}`,
    };
