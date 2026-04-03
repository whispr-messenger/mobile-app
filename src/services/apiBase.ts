import Constants from "expo-constants";
import { Platform } from "react-native";

const getDevHost = (): string => {
  if (Platform.OS === "android") return "10.0.2.2";
  const hostUri =
    Constants.expoGoConfig?.debuggerHost ?? Constants.expoConfig?.hostUri;
  if (hostUri) return hostUri.split(":")[0];
  return "localhost";
};

export const getApiBaseUrl = (): string => {
  const extra = Constants.expoConfig?.extra as
    | { apiBaseUrl?: string }
    | undefined;
  if (extra?.apiBaseUrl) return extra.apiBaseUrl;
  if (__DEV__) return `http://${getDevHost()}:8080`;
  return "https://whispr-api.roadmvn.com";
};

export const getWsBaseUrl = (): string => {
  const apiBaseUrl = getApiBaseUrl();
  const wsScheme = apiBaseUrl.startsWith("https://") ? "wss" : "ws";
  return apiBaseUrl.replace(/^https?/, wsScheme);
};
