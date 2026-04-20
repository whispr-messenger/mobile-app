import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as ExpoCrypto from "expo-crypto";
import type { DeviceInfo } from "../types/auth";
import { storage } from "./storage";

const DEVICE_ID_KEY = "whispr.device.id";

function generateUUID(): string {
  const g = globalThis as unknown as {
    crypto?: { randomUUID?: () => string };
  };
  if (typeof g.crypto?.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  if (typeof ExpoCrypto.randomUUID === "function") {
    return ExpoCrypto.randomUUID();
  }
  const bytes = ExpoCrypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
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
