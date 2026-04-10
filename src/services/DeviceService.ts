import * as Device from "expo-device";
import { randomUUID as expoRandomUUID } from "expo-crypto";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { DeviceInfo } from "../types/auth";
import { storage } from "./storage";

const DEVICE_ID_KEY = "whispr.device.id";

function generateUUID(): string {
  // expo-crypto's randomUUID doesn't work on web — fall back to native browser API
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return expoRandomUUID();
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
