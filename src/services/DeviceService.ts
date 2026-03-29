import * as Device from 'expo-device';
import { randomUUID } from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const storage = Platform.OS === 'web'
  ? {
      getItemAsync: async (key: string) => localStorage.getItem(key),
      setItemAsync: async (key: string, value: string) => localStorage.setItem(key, value),
    }
  : require('expo-secure-store') as {
      getItemAsync: (key: string) => Promise<string | null>;
      setItemAsync: (key: string, value: string) => Promise<void>;
    };
import type { DeviceInfo } from '../types/auth';

const DEVICE_ID_KEY = 'whispr.device.id';

export const DeviceService = {
  async getOrCreateDeviceId(): Promise<string> {
    const existing = await storage.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const id = randomUUID();
    await storage.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  },

  async getDeviceInfo(): Promise<DeviceInfo> {
    const appVersion =
      (Constants.expoConfig?.extra?.appVersion as string | undefined) ?? '1.0.0';

    const deviceId = await this.getOrCreateDeviceId();

    return {
      deviceId,
      deviceName: Device.deviceName ?? 'Unknown Device',
      deviceType: Platform.OS,
      model: Device.modelName ?? 'Unknown Model',
      osVersion: Device.osVersion ?? 'Unknown OS',
      appVersion,
    };
  },
};
