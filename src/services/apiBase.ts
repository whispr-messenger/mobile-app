import Constants from "expo-constants";

const PROD_API_URL = "https://whispr-api.roadmvn.com";

export const getApiBaseUrl = (): string => {
  const extra = Constants.expoConfig?.extra as
    | { apiBaseUrl?: string }
    | undefined;
  return extra?.apiBaseUrl || PROD_API_URL;
};

export const getWsBaseUrl = (): string => {
  const apiBaseUrl = getApiBaseUrl();
  const wsScheme = apiBaseUrl.startsWith("https://") ? "wss" : "ws";
  return apiBaseUrl.replace(/^https?/, wsScheme);
};
