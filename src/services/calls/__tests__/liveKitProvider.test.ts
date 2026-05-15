/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("livekit-client", () => ({
  Room: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    localParticipant: {
      setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
      setCameraEnabled: jest.fn().mockResolvedValue(undefined),
      getTrackPublication: jest.fn(),
    },
  })),
}));

import { CallsLiveKit } from "./src/services/calls/liveKitProvider";

describe("CallsLiveKit.flipCamera", () => {
  it("native path: calls _switchCamera() and does NOT call setCameraEnabled", async () => {
    const provider = new CallsLiveKit();
    await provider.connect({ url: "wss://fake", token: "t" });
    const room = provider.currentRoom as any;

    const switchCamera = jest.fn();
    room.localParticipant.getTrackPublication.mockReturnValue({
      track: {
        mediaStreamTrack: {
          _switchCamera: switchCamera,
        },
      },
    });

    await provider.flipCamera();

    expect(switchCamera).toHaveBeenCalledTimes(1);
    expect(room.localParticipant.setCameraEnabled).not.toHaveBeenCalled();
  });

  it("web path: toggles facingMode from user to environment", async () => {
    const provider = new CallsLiveKit();
    await provider.connect({ url: "wss://fake", token: "t" });
    const room = provider.currentRoom as any;

    room.localParticipant.getTrackPublication.mockReturnValue({
      track: {
        mediaStreamTrack: {
          getSettings: () => ({ facingMode: "user" }),
        },
      },
    });

    await provider.flipCamera();

    expect(room.localParticipant.setCameraEnabled).toHaveBeenCalledTimes(2);
    expect(room.localParticipant.setCameraEnabled).toHaveBeenNthCalledWith(
      1,
      false,
    );
    expect(room.localParticipant.setCameraEnabled).toHaveBeenNthCalledWith(
      2,
      true,
      { facingMode: "environment" },
    );
  });

  it("web path: toggles facingMode from environment back to user", async () => {
    const provider = new CallsLiveKit();
    await provider.connect({ url: "wss://fake", token: "t" });
    const room = provider.currentRoom as any;

    room.localParticipant.getTrackPublication.mockReturnValue({
      track: {
        mediaStreamTrack: {
          getSettings: () => ({ facingMode: "environment" }),
        },
      },
    });

    await provider.flipCamera();

    expect(room.localParticipant.setCameraEnabled).toHaveBeenCalledTimes(2);
    expect(room.localParticipant.setCameraEnabled).toHaveBeenNthCalledWith(
      1,
      false,
    );
    expect(room.localParticipant.setCameraEnabled).toHaveBeenNthCalledWith(
      2,
      true,
      { facingMode: "user" },
    );
  });

  it("no-op when no room (connect() never called)", async () => {
    const provider = new CallsLiveKit();

    await expect(provider.flipCamera()).resolves.toBeUndefined();
    expect(provider.currentRoom).toBeNull();
  });

  it("no-op when no camera publication", async () => {
    const provider = new CallsLiveKit();
    await provider.connect({ url: "wss://fake", token: "t" });
    const room = provider.currentRoom as any;

    room.localParticipant.getTrackPublication.mockReturnValue(undefined);

    await expect(provider.flipCamera()).resolves.toBeUndefined();
    expect(room.localParticipant.setCameraEnabled).not.toHaveBeenCalled();
  });
});
