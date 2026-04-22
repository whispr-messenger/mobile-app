import { create } from "zustand";
import Constants from "expo-constants";
import { callsApi } from "../services/calls/callsApi";
import type { CallStatus, CallType } from "../types/calls";
import type { Room } from "livekit-client";

declare const require: (path: string) => any;

const executionEnvironment = (Constants as any)?.executionEnvironment;
const appOwnership = (Constants as any)?.appOwnership;
const isExpoGo =
  executionEnvironment === "storeClient" || appOwnership === "expo";

function getCallsLiveKit() {
  if (isExpoGo) {
    throw new Error(
      "Calls are not supported in Expo Go. Use a development build.",
    );
  }
  const mod =
    require("../services/calls/liveKitProvider") as typeof import("../services/calls/liveKitProvider");
  return mod.callsLiveKit;
}

export interface ActiveCall {
  callId: string;
  status: CallStatus;
  liveKitUrl: string;
  liveKitToken: string;
  room: Room | null;
}

export interface IncomingCallInfo {
  callId: string;
  initiatorId: string;
  conversationId: string;
  type: CallType;
}

interface CallsState {
  active: ActiveCall | null;
  incoming: IncomingCallInfo | null;
  initiate: (
    conversationId: string,
    type: CallType,
    participants: string[],
  ) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
  end: () => Promise<void>;
  setIncoming: (incoming: IncomingCallInfo | null) => void;
}

export const useCallsStore = create<CallsState>((set, get) => ({
  active: null,
  incoming: null,

  initiate: async (conversationId, type, participants) => {
    const resp = await callsApi.initiate(conversationId, type, participants);
    const room = await getCallsLiveKit().connect({
      url: resp.livekit_url,
      token: resp.livekit_token,
    });
    set({
      active: {
        callId: resp.call_id,
        status: resp.status,
        liveKitUrl: resp.livekit_url,
        liveKitToken: resp.livekit_token,
        room,
      },
    });
  },

  acceptIncoming: async () => {
    const inc = get().incoming;
    if (!inc) return;
    const resp = await callsApi.accept(inc.callId);
    const room = await getCallsLiveKit().connect({
      url: resp.livekit_url,
      token: resp.livekit_token,
    });
    set({
      active: {
        callId: inc.callId,
        status: "connected",
        liveKitUrl: resp.livekit_url,
        liveKitToken: resp.livekit_token,
        room,
      },
      incoming: null,
    });
  },

  declineIncoming: async () => {
    const inc = get().incoming;
    if (!inc) return;
    await callsApi.decline(inc.callId);
    set({ incoming: null });
  },

  end: async () => {
    const a = get().active;
    if (!a) return;
    await callsApi.end(a.callId);
    getCallsLiveKit().disconnect();
    set({ active: null });
  },

  setIncoming: (incoming) => set({ incoming }),
}));
