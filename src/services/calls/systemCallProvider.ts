import * as ExpoCrypto from "expo-crypto";
import { PermissionsAndroid, Platform } from "react-native";
import { navigate, navigationRef } from "../../navigation/navigationRef";
import { useCallsStore, type IncomingCallInfo } from "../../store/callsStore";
import { isCallsAvailable } from "../../hooks/useCallsAvailable";

type CallKeepModule = typeof import("react-native-call-keeper").default;

type EndReason = 1 | 2 | 3 | 4 | 5 | 6;
type CallDirection = "incoming" | "outgoing";

interface NativeCallState {
  direction: CallDirection;
  startedAt: number;
  connected: boolean;
}

const OUTGOING_END_EVENT_GRACE_MS = 5_000;

export interface NativeCallPresentation {
  callId: string;
  handle: string;
  displayName?: string;
  hasVideo: boolean;
}

function loadCallKeep(): CallKeepModule | null {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  if (!isCallsAvailable()) return null;
  try {
    return require("react-native-call-keeper").default as CallKeepModule;
  } catch {
    return null;
  }
}

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

class SystemCallProvider {
  private callKeep: CallKeepModule | null = null;
  private initialized = false;
  private backendToNative = new Map<string, string>();
  private nativeToBackend = new Map<string, string>();
  private callState = new Map<string, NativeCallState>();
  private suppressedEndEvents = new Set<string>();

  isSupported(): boolean {
    return loadCallKeep() !== null;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.callKeep = loadCallKeep();
    if (!this.callKeep) return;

    if (Platform.OS === "android") {
      await this.requestAndroidPermissions();
    }

    await this.callKeep.setup({
      appName: "Whispr",
      includesCallsInRecents: true,
      supportsVideo: true,
      maximumCallGroups: 1,
      maximumCallsPerCallGroup: 1,
    });
    if (Platform.OS === "android") {
      await this.callKeep.setAvailable(true).catch(() => {});
    }
    this.bindEvents();
    this.initialized = true;
  }

  async showIncomingCall(presentation: NativeCallPresentation): Promise<void> {
    await this.initialize();
    if (!this.callKeep) return;

    const callUUID = this.ensureMapping(presentation.callId);
    this.callState.set(callUUID, {
      direction: "incoming",
      startedAt: Date.now(),
      connected: false,
    });
    await this.callKeep.displayIncomingCall(
      callUUID,
      presentation.handle,
      presentation.displayName,
      "generic",
      presentation.hasVideo,
    );
  }

  async startOutgoingCall(presentation: NativeCallPresentation): Promise<void> {
    await this.initialize();
    if (!this.callKeep) return;

    const callUUID = this.ensureMapping(presentation.callId);
    this.callState.set(callUUID, {
      direction: "outgoing",
      startedAt: Date.now(),
      connected: false,
    });
    await this.callKeep.startCall(
      callUUID,
      presentation.handle,
      presentation.displayName,
      "generic",
      presentation.hasVideo,
    );
  }

  async markCallConnected(callId: string): Promise<void> {
    await this.initialize();
    if (!this.callKeep) return;

    const callUUID = this.backendToNative.get(callId);
    if (!callUUID) return;

    const callState = this.callState.get(callUUID);
    if (callState) {
      callState.connected = true;
    }
    await this.callKeep.setCurrentCallActive(callUUID).catch(() => {});
    await this.callKeep.reportConnectedOutgoingCall(callUUID).catch(() => {});
  }

  async endCall(callId: string, reason: EndReason = 3): Promise<void> {
    await this.initialize();
    if (!this.callKeep) return;

    const callUUID = this.backendToNative.get(callId);
    if (!callUUID) return;

    this.suppressedEndEvents.add(callUUID);
    await this.callKeep.reportEndCallWithUUID(callUUID, reason).catch(() => {});
    await this.callKeep.endCall(callUUID).catch(() => {});
    this.clearMapping(callId);
  }

  async resetAll(): Promise<void> {
    await this.initialize();
    if (!this.callKeep) return;

    await this.callKeep.endAllCalls().catch(() => {});
    this.backendToNative.clear();
    this.nativeToBackend.clear();
    this.callState.clear();
    this.suppressedEndEvents.clear();
  }

  private ensureMapping(callId: string): string {
    const existing = this.backendToNative.get(callId);
    if (existing) return existing;

    const callUUID = generateUUID();
    this.backendToNative.set(callId, callUUID);
    this.nativeToBackend.set(callUUID, callId);
    return callUUID;
  }

  private clearMapping(callId: string): void {
    const callUUID = this.backendToNative.get(callId);
    if (!callUUID) return;
    this.backendToNative.delete(callId);
    this.nativeToBackend.delete(callUUID);
    this.callState.delete(callUUID);
    this.suppressedEndEvents.delete(callUUID);
  }

  private async requestAndroidPermissions(): Promise<void> {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.WRITE_CALL_LOG,
    ]).catch(() => {});
  }

  private bindEvents(): void {
    if (!this.callKeep) return;

    this.callKeep.removeEventListener("answerCall");
    this.callKeep.removeEventListener("endCall");

    this.callKeep.addEventListener("answerCall", ({ callUUID }) => {
      void this.handleAnswerCall(callUUID);
    });
    this.callKeep.addEventListener("endCall", ({ callUUID }) => {
      void this.handleEndCall(callUUID);
    });
  }

  private async handleAnswerCall(callUUID: string): Promise<void> {
    const callId =
      this.nativeToBackend.get(callUUID) ??
      useCallsStore.getState().incoming?.callId ??
      null;
    if (!callId) return;

    const incoming = useCallsStore.getState().incoming;
    if (!incoming || incoming.callId !== callId) return;

    await this.callKeep?.backToForeground().catch(() => {});

    try {
      await useCallsStore.getState().acceptIncoming();
      await this.markCallConnected(callId);
      navigate("InCall");
    } catch (err) {
      console.error("[systemCallProvider] Failed to answer call", err);
    }
  }

  private async handleEndCall(callUUID: string): Promise<void> {
    if (this.suppressedEndEvents.has(callUUID)) {
      this.suppressedEndEvents.delete(callUUID);
      return;
    }

    const nativeState = this.callState.get(callUUID);
    if (
      nativeState?.direction === "outgoing" &&
      !nativeState.connected &&
      Date.now() - nativeState.startedAt < OUTGOING_END_EVENT_GRACE_MS
    ) {
      console.warn(
        "[systemCallProvider] Ignoring early endCall for outgoing call",
        callUUID,
      );
      return;
    }

    const callId =
      this.nativeToBackend.get(callUUID) ??
      useCallsStore.getState().active?.callId ??
      useCallsStore.getState().incoming?.callId ??
      null;
    if (!callId) return;

    const active = useCallsStore.getState().active;
    const incoming = useCallsStore.getState().incoming;

    try {
      if (active?.callId === callId) {
        await useCallsStore.getState().end();
      } else if (incoming?.callId === callId) {
        await useCallsStore.getState().declineIncoming();
      }
    } catch (err) {
      console.error("[systemCallProvider] Failed to end call", err);
    } finally {
      this.clearMapping(callId);
      if (
        navigationRef.isReady() &&
        ["InCall", "IncomingCall"].includes(
          navigationRef.getCurrentRoute()?.name ?? "",
        )
      ) {
        navigate("ConversationsList");
      }
    }
  }
}

export function buildIncomingCallPresentation(
  incoming: IncomingCallInfo,
  displayName?: string,
): NativeCallPresentation {
  return {
    callId: incoming.callId,
    handle: incoming.initiatorId,
    displayName: displayName ?? incoming.displayName ?? incoming.initiatorId,
    hasVideo: incoming.type === "video",
  };
}

export const systemCallProvider = new SystemCallProvider();
