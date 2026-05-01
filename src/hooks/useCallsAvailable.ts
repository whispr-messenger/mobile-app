/**
 * useCallsAvailable — Détection centralisée du support des appels.
 *
 * Les appels reposent sur des modules natifs (@livekit/react-native,
 * @livekit/react-native-webrtc, react-native-call-keeper) absents d'Expo Go.
 * Ce hook (et le helper sync isCallsAvailable) permet à l'UI d'afficher un
 * fallback explicite plutôt que de planter silencieusement au clic.
 */

import { useMemo } from "react";
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

export type CallsUnavailableReason = "expo-go" | "no-webrtc" | "web";

export interface CallsAvailability {
  available: boolean;
  reason: CallsUnavailableReason | null;
}

function detectIsExpoGo(): boolean {
  const executionEnvironment = (Constants as any)?.executionEnvironment;
  const appOwnership = (Constants as any)?.appOwnership;
  return executionEnvironment === "storeClient" || appOwnership === "expo";
}

function detectHasWebRtcNative(): boolean {
  const native = NativeModules as Record<string, unknown>;
  return Boolean(native?.WebRTCModule || native?.LivekitReactNativeWebRTC);
}

export function getCallsAvailability(): CallsAvailability {
  if (Platform.OS === "web") {
    return { available: false, reason: "web" };
  }
  if (detectIsExpoGo()) {
    return { available: false, reason: "expo-go" };
  }
  if (!detectHasWebRtcNative()) {
    return { available: false, reason: "no-webrtc" };
  }
  return { available: true, reason: null };
}

export function isCallsAvailable(): boolean {
  return getCallsAvailability().available;
}

export function isExpoGo(): boolean {
  return detectIsExpoGo();
}

export function getCallsUnavailableMessage(
  reason: CallsUnavailableReason | null,
): string {
  switch (reason) {
    case "expo-go":
      return "Les appels ne sont pas disponibles dans Expo Go. Utilisez un build de développement.";
    case "no-webrtc":
      return "Les appels nécessitent une reconstruction de l'application (module WebRTC manquant).";
    case "web":
      return "Les appels ne sont pas disponibles sur le web.";
    default:
      return "Les appels ne sont pas disponibles sur cet appareil.";
  }
}

export function useCallsAvailable(): CallsAvailability {
  return useMemo(getCallsAvailability, []);
}
