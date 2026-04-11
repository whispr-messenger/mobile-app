import { DeviceEventEmitter } from "react-native";

export const SESSION_EXPIRED_EVENT = "whispr.session.expired";

export function emitSessionExpired(reason?: string) {
  DeviceEventEmitter.emit(SESSION_EXPIRED_EVENT, { reason });
}

export function onSessionExpired(
  handler: (payload?: { reason?: string }) => void,
) {
  return DeviceEventEmitter.addListener(SESSION_EXPIRED_EVENT, handler);
}
