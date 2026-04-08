import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { DeviceInfo } from "../types/auth";

const DEVICE_ID_KEY = "whispr.device.id";

export const DeviceService = {
  async getOrCreateDeviceId(): Promise<string> {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const id = randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  },

  async clearDeviceId(): Promise<void> {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  },

  async getDeviceInfo(): Promise<DeviceInfo> {
    const appVersion =
      (Constants.expoConfig?.extra?.appVersion as string | undefined) ??
      "1.0.0";

    const deviceId = await this.getOrCreateDeviceId();

    return {
      deviceId,
      deviceName: Device.deviceName ?? "Unknown Device",
      deviceType: Platform.OS,
      model: Device.modelName ?? "Unknown Model",
      osVersion: Device.osVersion ?? "Unknown OS",
      appVersion,
    };
  },
};
