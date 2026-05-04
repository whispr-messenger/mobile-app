import { AppState, Platform } from "react-native";
import { navigate } from "../../navigation/navigationRef";
import { useCallsStore, type IncomingCallInfo } from "../../store/callsStore";
import {
  buildIncomingCallPresentation,
  systemCallProvider,
} from "./systemCallProvider";

type NotificationsModule = {
  addNotificationReceivedListener: (
    listener: (notification: {
      request?: { content?: { data?: Record<string, unknown> } };
    }) => void,
  ) => { remove: () => void };
  addNotificationResponseReceivedListener: (
    listener: (response: {
      notification?: {
        request?: { content?: { data?: Record<string, unknown> } };
      };
    }) => void,
  ) => { remove: () => void };
};

export interface NormalizedIncomingCallPayload extends IncomingCallInfo {
  callerName?: string;
}

function loadExpoNotifications(): NotificationsModule | null {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  try {
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeIncomingCallPayload(
  raw: unknown,
): NormalizedIncomingCallPayload | null {
  const payload = asRecord(raw);
  const data = asRecord(payload?.data) ?? payload;
  if (!data) return null;

  const event = data.event ?? data.type ?? data.kind ?? data.notification_type;
  const callId = data.call_id ?? data.callId;
  const initiatorId = data.initiator_id ?? data.initiatorId ?? data.user_id;
  const conversationId = data.conversation_id ?? data.conversationId;
  const callType = data.call_type ?? data.callType ?? data.media_type;
  const callerName =
    data.caller_name ??
    data.callerName ??
    data.initiator_name ??
    data.initiatorName;

  if (event !== "incoming_call" && event !== "voip_incoming_call" && !callId) {
    return null;
  }
  if (
    typeof callId !== "string" ||
    typeof initiatorId !== "string" ||
    typeof conversationId !== "string"
  ) {
    return null;
  }

  return {
    callId,
    initiatorId,
    conversationId,
    type: callType === "video" ? "video" : "audio",
    displayName: typeof callerName === "string" ? callerName : initiatorId,
    callerName: typeof callerName === "string" ? callerName : undefined,
  };
}

export function initCallNotificationBridge(): () => void {
  const notifications = loadExpoNotifications();
  if (!notifications) return () => {};

  const handlePayload = (raw: unknown, interaction: boolean) => {
    const incoming = normalizeIncomingCallPayload(raw);
    if (!incoming) return;

    useCallsStore.getState().setIncoming(incoming);

    if (interaction || AppState.currentState === "active") {
      navigate("IncomingCall");
      return;
    }

    void systemCallProvider.showIncomingCall(
      buildIncomingCallPresentation(incoming, incoming.callerName),
    );
  };

  const receivedSub = notifications.addNotificationReceivedListener(
    (notification) => {
      handlePayload(notification?.request?.content?.data, false);
    },
  );
  const responseSub = notifications.addNotificationResponseReceivedListener(
    (response) => {
      handlePayload(response?.notification?.request?.content?.data, true);
    },
  );

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
