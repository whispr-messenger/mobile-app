import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceService } from "./DeviceService";
import { TokenService } from "./TokenService";

const ASYNC_STORAGE_KEYS = [
  "whispr.profile.v1",
  "whispr.conversations.cache",
  "whispr.conversations.cache.timestamp",
] as const;

export const AppResetService = {
  async resetAppData(): Promise<void> {
    await Promise.all([
      TokenService.clearAll(),
      DeviceService.clearDeviceId(),
      ...ASYNC_STORAGE_KEYS.map((k) => AsyncStorage.removeItem(k)),
    ]);
  },
};
