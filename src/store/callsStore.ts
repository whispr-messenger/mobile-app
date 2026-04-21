import { create } from "zustand";
import { Room } from "livekit-client";
import { callsApi } from "../services/calls/callsApi";
import { callsLiveKit } from "../services/calls/liveKitProvider";
import type { CallStatus, CallType } from "../types/calls";

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
    const room = await callsLiveKit.connect({
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
    const room = await callsLiveKit.connect({
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
    callsLiveKit.disconnect();
    set({ active: null });
  },

  setIncoming: (incoming) => set({ incoming }),
}));
