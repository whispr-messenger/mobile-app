import { create } from "zustand";
import { callsApi } from "../services/calls/callsApi";
import {
  getCallsAvailability,
  getCallsUnavailableMessage,
} from "../hooks/useCallsAvailable";
import type { CallStatus, CallType } from "../types/calls";
import type { Room } from "livekit-client";

declare const require: (path: string) => any;

function getCallsLiveKit() {
  const { available, reason } = getCallsAvailability();
  if (!available) {
    throw new Error(getCallsUnavailableMessage(reason));
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
  type: CallType;
  room: Room | null;
  displayName?: string;
  avatarUrl?: string;
}

export interface IncomingCallInfo {
  callId: string;
  initiatorId: string;
  conversationId: string;
  type: CallType;
  displayName?: string;
  avatarUrl?: string;
}

interface CallsState {
  active: ActiveCall | null;
  incoming: IncomingCallInfo | null;
  initiate: (
    conversationId: string,
    type: CallType,
    participants: string[],
    displayName?: string,
    avatarUrl?: string,
  ) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
  end: () => Promise<void>;
  setIncoming: (incoming: IncomingCallInfo | null) => void;
  reset: () => void;
}

export const useCallsStore = create<CallsState>((set, get) => ({
  active: null,
  incoming: null,

  initiate: async (
    conversationId,
    type,
    participants,
    displayName,
    avatarUrl,
  ) => {
    const resp = await callsApi.initiate(conversationId, type, participants);
    const provider = getCallsLiveKit();
    const room = await provider.connect({
      url: resp.livekit_url,
      token: resp.livekit_token,
    });
    // Publish local tracks immediately so mute/flip/camera controls have
    // something to act on. Without this, setMicrophoneEnabled(false) is a
    // no-op (no published track) and the user thinks the button is broken.
    try {
      await provider.enableMic(true);
      if (type === "video") {
        await provider.enableCamera(true);
      }
    } catch (err) {
      // Permission denied or device unavailable — keep the call going so the
      // user still sees the UI, the controls will toggle on retry.
      console.warn("Failed to publish local tracks", err);
    }
    set({
      active: {
        callId: resp.call_id,
        status: resp.status,
        liveKitUrl: resp.livekit_url,
        liveKitToken: resp.livekit_token,
        type,
        room,
        displayName,
        avatarUrl,
      },
    });
  },

  acceptIncoming: async () => {
    const inc = get().incoming;
    if (!inc) return;
    // WHISPR-1200 : on tague chaque étape pour que la couche UI puisse
    // distinguer un échec API (call introuvable, droits, etc.) d'un échec
    // LiveKit (URL injoignable, token invalide, WebRTC non supporté).
    let resp;
    try {
      resp = await callsApi.accept(inc.callId);
    } catch (err) {
      throw new Error(`accept-api: ${(err as Error).message}`);
    }
    const provider = getCallsLiveKit();
    let room;
    try {
      room = await provider.connect({
        url: resp.livekit_url,
        token: resp.livekit_token,
      });
    } catch (err) {
      throw new Error(`livekit-connect: ${(err as Error).message}`);
    }
    try {
      await provider.enableMic(true);
      if (inc.type === "video") {
        await provider.enableCamera(true);
      }
    } catch (err) {
      console.warn("Failed to publish local tracks", err);
    }
    set({
      active: {
        callId: inc.callId,
        status: "connected",
        liveKitUrl: resp.livekit_url,
        liveKitToken: resp.livekit_token,
        type: inc.type,
        room,
        displayName: inc.displayName,
        avatarUrl: inc.avatarUrl,
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

  // WHISPR-1198: appelé par AuthContext.signOut pour empêcher l'état d'appel
  // (token LiveKit, callId, ringer fantôme) de fuir d'un compte vers le
  // suivant sur le même device. Best-effort sur la déconnexion LiveKit : la
  // session côté backend est de toute façon morte, on ne dépend pas du succès.
  reset: () => {
    const a = get().active;
    if (a?.room) {
      try {
        a.room.disconnect();
      } catch {
        // ignore — best-effort cleanup pendant le signOut
      }
    }
    set({ active: null, incoming: null });
  },
}));
