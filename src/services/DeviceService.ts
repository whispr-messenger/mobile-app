import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { DeviceInfo } from '../types/auth';

export const DeviceService = {
  getDeviceInfo(): DeviceInfo {
    const appVersion =
      (Constants.expoConfig?.extra?.appVersion as string | undefined) ?? '1.0.0';

    return {
      deviceName: Device.deviceName ?? 'Unknown Device',
      deviceType: Platform.OS,
      model: Device.modelName ?? 'Unknown Model',
      osVersion: Device.osVersion ?? 'Unknown OS',
      appVersion,
    };
  },
};
