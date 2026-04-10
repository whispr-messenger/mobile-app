import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { DeviceInfo } from "../types/auth";
import { storage } from "./storage";

const DEVICE_ID_KEY = "whispr.device.id";

function generateUUID(): string {
  // Use native browser crypto.randomUUID if available (modern browsers, secure context)
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 UUID using getRandomValues or Math.random
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
      const n = parseInt(c, 10);
      return (
        n ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4)))
      ).toString(16);
    });
  }
  // Last resort: Math.random based UUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const DeviceService = {
  async getOrCreateDeviceId(): Promise<string> {
    const existing = await storage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const id = generateUUID();
    await storage.setItem(DEVICE_ID_KEY, id);
    return id;
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
