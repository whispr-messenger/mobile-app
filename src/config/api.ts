import { getApiBaseUrl, getWsBaseUrl } from "../services/apiBase";

const BASE = getApiBaseUrl();

export const AUTH_API_URL = `${BASE}/auth/v1`;
export const USER_API_URL = `${BASE}/user/v1`;
export const CONTACTS_API_URL = USER_API_URL;
export const MEDIA_API_URL = `${BASE}/media/v1`;
export const MESSAGING_API_URL = `${BASE}/messaging/api/v1`;
export const WS_URL = `${getWsBaseUrl()}/messaging/socket/websocket`;
