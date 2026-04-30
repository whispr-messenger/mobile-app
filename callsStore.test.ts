/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("./src/services/calls/callsApi", () => ({
  callsApi: {
    initiate: jest.fn().mockResolvedValue({
      call_id: "c1",
      status: "ringing",
      livekit_url: "wss://lk",
      livekit_token: "tok",
    }),
    accept: jest.fn().mockResolvedValue({
      livekit_url: "wss://lk",
      livekit_token: "tok",
    }),
    decline: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("./src/services/calls/liveKitProvider", () => ({
  callsLiveKit: {
    connect: jest.fn().mockResolvedValue({ id: "room" }),
    enableMic: jest.fn().mockResolvedValue(undefined),
    enableCamera: jest.fn().mockResolvedValue(undefined),
    flipCamera: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    executionEnvironment: "standalone",
    appOwnership: "standalone",
  },
}));

import { useCallsStore } from "./src/store/callsStore";
import { callsLiveKit } from "./src/services/calls/liveKitProvider";

const mockProvider = callsLiveKit as unknown as {
  connect: jest.Mock;
  enableMic: jest.Mock;
  enableCamera: jest.Mock;
  flipCamera: jest.Mock;
  disconnect: jest.Mock;
};

describe("callsStore — track publish on connect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCallsStore.setState({ active: null, incoming: null });
  });

  it("initiate(audio) publishes mic but NOT camera", async () => {
    await useCallsStore.getState().initiate("conv-1", "audio", ["u2"]);

    expect(mockProvider.connect).toHaveBeenCalledTimes(1);
    expect(mockProvider.enableMic).toHaveBeenCalledWith(true);
    expect(mockProvider.enableCamera).not.toHaveBeenCalled();
    expect(useCallsStore.getState().active?.type).toBe("audio");
  });

  it("initiate(video) publishes both mic AND camera", async () => {
    await useCallsStore.getState().initiate("conv-1", "video", ["u2"]);

    expect(mockProvider.enableMic).toHaveBeenCalledWith(true);
    expect(mockProvider.enableCamera).toHaveBeenCalledWith(true);
    expect(useCallsStore.getState().active?.type).toBe("video");
  });

  it("acceptIncoming(video) publishes both mic AND camera", async () => {
    useCallsStore.setState({
      incoming: {
        callId: "c1",
        initiatorId: "u2",
        conversationId: "conv-1",
        type: "video",
      },
    });

    await useCallsStore.getState().acceptIncoming();

    expect(mockProvider.enableMic).toHaveBeenCalledWith(true);
    expect(mockProvider.enableCamera).toHaveBeenCalledWith(true);
    expect(useCallsStore.getState().active?.type).toBe("video");
    expect(useCallsStore.getState().incoming).toBeNull();
  });

  it("acceptIncoming(audio) publishes mic but NOT camera", async () => {
    useCallsStore.setState({
      incoming: {
        callId: "c1",
        initiatorId: "u2",
        conversationId: "conv-1",
        type: "audio",
      },
    });

    await useCallsStore.getState().acceptIncoming();

    expect(mockProvider.enableMic).toHaveBeenCalledWith(true);
    expect(mockProvider.enableCamera).not.toHaveBeenCalled();
    expect(useCallsStore.getState().active?.type).toBe("audio");
  });

  it("initiate keeps the call alive even when getUserMedia is denied", async () => {
    mockProvider.enableMic.mockRejectedValueOnce(
      new Error("Permission denied"),
    );

    await useCallsStore.getState().initiate("conv-1", "audio", ["u2"]);

    // Active call still set so the user sees the in-call UI and can retry.
    expect(useCallsStore.getState().active).not.toBeNull();
  });

  // WHISPR-1200 — la couche UI a besoin de distinguer un échec API d'un
  // échec LiveKit pour afficher un message utile. acceptIncoming doit donc
  // tagguer chaque étape avec un préfixe stable.
  it("tags accept-api errors so the UI can surface them (WHISPR-1200)", async () => {
    const callsApi = require("./src/services/calls/callsApi").callsApi as {
      accept: jest.Mock;
    };
    callsApi.accept.mockRejectedValueOnce(new Error("403 Forbidden"));
    useCallsStore.setState({
      incoming: {
        callId: "c1",
        initiatorId: "u2",
        conversationId: "conv-1",
        type: "audio",
      },
    });

    await expect(useCallsStore.getState().acceptIncoming()).rejects.toThrow(
      /^accept-api: /,
    );
  });

  it("tags livekit-connect errors so the UI can surface them (WHISPR-1200)", async () => {
    mockProvider.connect.mockRejectedValueOnce(
      new Error("WebSocket connection failed"),
    );
    useCallsStore.setState({
      incoming: {
        callId: "c1",
        initiatorId: "u2",
        conversationId: "conv-1",
        type: "audio",
      },
    });

    await expect(useCallsStore.getState().acceptIncoming()).rejects.toThrow(
      /^livekit-connect: /,
    );
  });

  // WHISPR-1198 — reset() est appelé par AuthContext.signOut pour empêcher
  // les fuites d'état d'appel entre deux comptes successifs sur le device.
  describe("reset (WHISPR-1198)", () => {
    it("clears active and incoming when nothing is in flight", () => {
      useCallsStore.getState().reset();
      expect(useCallsStore.getState().active).toBeNull();
      expect(useCallsStore.getState().incoming).toBeNull();
    });

    it("disconnects the LiveKit room and nulls active when an active call exists", () => {
      const disconnect = jest.fn();
      useCallsStore.setState({
        active: {
          callId: "c-leak",
          status: "connected",
          liveKitUrl: "wss://lk",
          liveKitToken: "tok",
          type: "audio",
          room: { disconnect } as any,
        },
        incoming: {
          callId: "c-ring",
          initiatorId: "u-other",
          conversationId: "conv-1",
          type: "video",
        },
      });

      useCallsStore.getState().reset();

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(useCallsStore.getState().active).toBeNull();
      expect(useCallsStore.getState().incoming).toBeNull();
    });

    it("swallows disconnect errors so signOut never throws", () => {
      const disconnect = jest.fn(() => {
        throw new Error("livekit dead");
      });
      useCallsStore.setState({
        active: {
          callId: "c-leak",
          status: "connected",
          liveKitUrl: "wss://lk",
          liveKitToken: "tok",
          type: "audio",
          room: { disconnect } as any,
        },
        incoming: null,
      });

      expect(() => useCallsStore.getState().reset()).not.toThrow();
      expect(useCallsStore.getState().active).toBeNull();
    });
  });
});
