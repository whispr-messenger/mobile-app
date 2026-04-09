import AsyncStorage from "@react-native-async-storage/async-storage";
import { TokenService } from "./TokenService";

const ASYNC_STORAGE_KEYS = [
  "whispr.profile.v1",
  "whispr.conversations.cache",
  "whispr.conversations.cache.timestamp",
] as const;

export const AppResetService = {
  async resetAppData(): Promise<void> {
    await Promise.all([
      TokenService.clearTokens(),
      AsyncStorage.removeItem("whispr.device.id"),
      ...ASYNC_STORAGE_KEYS.map((k) => AsyncStorage.removeItem(k)),
    ]);
  },
};
