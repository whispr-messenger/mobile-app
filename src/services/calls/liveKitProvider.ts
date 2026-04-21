import { Room } from "livekit-client";

export interface LiveKitConfig {
  url: string;
  token: string;
}

/**
 * Thin wrapper around livekit-client's Room to centralise lifecycle (connect,
 * disconnect, mic/camera toggle, camera flip) and keep the rest of the app
 * free of direct LiveKit imports.
 */
export class CallsLiveKit {
  private room: Room | null = null;

  async connect(config: LiveKitConfig): Promise<Room> {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 640, height: 480, frameRate: 24 },
      },
    });
    await this.room.connect(config.url, config.token);
    return this.room;
  }

  async enableMic(enable: boolean): Promise<void> {
    await this.room?.localParticipant.setMicrophoneEnabled(enable);
  }

  async enableCamera(enable: boolean): Promise<void> {
    await this.room?.localParticipant.setCameraEnabled(enable);
  }

  async flipCamera(): Promise<void> {
    // React Native (@livekit/react-native-webrtc) exposes a private
    // _switchCamera() on the underlying MediaStreamTrack. Call it on the
    // currently published video track, if any.
    const videoTrack = this.room?.localParticipant.getTrackPublication(
      "camera" as any,
    )?.track;
    const mediaTrack = videoTrack?.mediaStreamTrack as
      | { _switchCamera?: () => void }
      | undefined;
    mediaTrack?._switchCamera?.();
  }

  disconnect(): void {
    this.room?.disconnect();
    this.room = null;
  }

  get currentRoom(): Room | null {
    return this.room;
  }
}

export const callsLiveKit = new CallsLiveKit();
