/**
 * Tests for useVoiceRecorder.
 *
 * Couvre :
 * - buildRecordingOptions: native (m4a/mp4 preset), web mp4 vs webm
 * - start: success / permission denied / audioModule absent / createAsync throws
 * - stop: short recording (< 1s) discarded, normal flow, error caught
 * - pause/resume cycles + accumulated time
 * - cancel: stopAndUnload + reset
 * - cleanup on unmount
 * - inferAudioMimeFromFilename / canonicalizeAudioMime / forceAudioUploadFilename (via stop)
 * - remapAudioUploadUri: native file://*.m4a → copies to .mp4
 */

import { act, renderHook } from "@testing-library/react-native";

// ---- mock expo-haptics (factory must inline due to babel hoist) ----
jest.mock("expo-haptics", () => ({
  __esModule: true,
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium", Heavy: "Heavy" },
  NotificationFeedbackType: { Success: "Success", Error: "Error" },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockHaptics = require("expo-haptics") as {
  impactAsync: jest.Mock;
  notificationAsync: jest.Mock;
  ImpactFeedbackStyle: Record<string, string>;
  NotificationFeedbackType: Record<string, string>;
};

// ---- spy on Alert.alert (do NOT remock react-native; jest setup already provides one) ----
import { Alert } from "react-native";
const mockAlertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

// ---- mock expo-file-system legacy ----
const mockFsDelete = jest.fn(async () => {});
const mockFsCopy = jest.fn(async () => {});
jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  documentDirectory: "file:///docs/",
  deleteAsync: (...a: unknown[]) => mockFsDelete(...a),
  copyAsync: (...a: unknown[]) => mockFsCopy(...a),
}));

// ---- mock expo-av Audio recording (singleton: hook caches the Audio ref) ----
jest.mock(
  "expo-av",
  () => ({
    Audio: {
      requestPermissionsAsync: jest.fn(),
      setAudioModeAsync: jest.fn(),
      Recording: { createAsync: jest.fn() },
      RecordingOptionsPresets: {
        HIGH_QUALITY: {
          android: { extension: ".webm" },
          ios: { extension: ".caf" },
          web: { mimeType: "audio/webm", bitsPerSecond: 128000 },
        },
      },
      AndroidOutputFormat: { MPEG_4: "MPEG_4" },
      AndroidAudioEncoder: { AAC: "AAC" },
      IOSOutputFormat: { MPEG4AAC: "MPEG4AAC" },
      IOSAudioQuality: { MAX: "MAX" },
    },
  }),
  { virtual: true },
);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAudio = require("expo-av").Audio as any;

function makeRecording(uriOverride?: string) {
  return {
    stopAndUnloadAsync: jest.fn(async () => ({ durationMillis: 3000 })),
    getURI: jest.fn(() => uriOverride ?? "file:///tmp/voice-1700000000000.m4a"),
    getStatusAsync: jest.fn(async () => ({ durationMillis: 3000 })),
    pauseAsync: jest.fn(async () => {}),
    startAsync: jest.fn(async () => {}),
  };
}

function resetAudioMocks() {
  mockAudio.requestPermissionsAsync.mockReset();
  mockAudio.requestPermissionsAsync.mockResolvedValue({ status: "granted" });
  mockAudio.setAudioModeAsync.mockReset();
  mockAudio.setAudioModeAsync.mockResolvedValue(undefined);
  mockAudio.Recording.createAsync.mockReset();
  mockAudio.Recording.createAsync.mockResolvedValue({
    recording: makeRecording(),
  });
}

import {
  useVoiceRecorder,
  buildRecordingOptions,
  type RecordedAudio,
} from "../useVoiceRecorder";

// ---- helpers ----
const RN = require("react-native");
let mockPlatformOS = "ios" as "ios" | "android" | "web";
Object.defineProperty(RN.Platform, "OS", {
  get: () => mockPlatformOS,
  configurable: true,
});

beforeEach(() => {
  jest.useFakeTimers();
  resetAudioMocks();
  mockAlertSpy.mockReset();
  mockHaptics.impactAsync.mockReset();
  mockHaptics.notificationAsync.mockReset();
  mockFsCopy.mockReset();
  mockFsCopy.mockResolvedValue(undefined as any);
  mockFsDelete.mockReset();
  mockFsDelete.mockResolvedValue(undefined as any);
  mockPlatformOS = "ios";
});

afterEach(() => {
  jest.useRealTimers();
});

describe("buildRecordingOptions", () => {
  it("ios returns m4a preset with AAC encoder + 44.1kHz / 128kbps", () => {
    mockPlatformOS = "ios";
    const opts = buildRecordingOptions() as any;
    expect(opts.ios.extension).toBe(".m4a");
    expect(opts.ios.audioQuality).toBe("MAX");
    expect(opts.ios.outputFormat).toBe("MPEG4AAC");
    expect(opts.ios.sampleRate).toBe(44100);
    expect(opts.ios.bitRate).toBe(128000);
  });

  it("android returns m4a preset with MPEG_4 output format", () => {
    mockPlatformOS = "android";
    const opts = buildRecordingOptions() as any;
    expect(opts.android.extension).toBe(".m4a");
    expect(opts.android.outputFormat).toBe("MPEG_4");
    expect(opts.android.audioEncoder).toBe("AAC");
  });

  it("web prefers audio/mp4 if MediaRecorder supports it", () => {
    mockPlatformOS = "web";
    (global as any).MediaRecorder = {
      isTypeSupported: (t: string) => t === "audio/mp4",
    };
    const opts = buildRecordingOptions() as any;
    expect(opts.web.mimeType).toBe("audio/mp4");
    delete (global as any).MediaRecorder;
  });

  it("web falls back to audio/webm when mp4 unsupported", () => {
    mockPlatformOS = "web";
    (global as any).MediaRecorder = { isTypeSupported: () => false };
    const opts = buildRecordingOptions() as any;
    expect(opts.web.mimeType).toBe("audio/webm");
    delete (global as any).MediaRecorder;
  });

  it("web falls back to webm when MediaRecorder not defined", () => {
    mockPlatformOS = "web";
    const opts = buildRecordingOptions() as any;
    expect(opts.web.mimeType).toBe("audio/webm");
  });
});

describe("useVoiceRecorder — start", () => {
  it("starts recording when permission granted", async () => {
    const onRecorded = jest.fn();
    const { result } = renderHook(() => useVoiceRecorder({ onRecorded }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isRecording).toBe(true);
    expect(mockAudio.Recording.createAsync).toHaveBeenCalled();
    expect(mockHaptics.impactAsync).toHaveBeenCalledWith("Medium");
  });

  it("aborts and alerts when permission denied", async () => {
    mockAudio.requestPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });
    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isRecording).toBe(false);
    expect(mockAlertSpy).toHaveBeenCalledWith(
      "Permission requise",
      expect.any(String),
    );
  });

  it("alerts and reverts state when createAsync throws", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockAudio.Recording.createAsync.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isRecording).toBe(false);
    expect(mockAlertSpy).toHaveBeenCalledWith(
      "Erreur",
      "Impossible de démarrer l'enregistrement.",
    );
    errSpy.mockRestore();
  });
});

describe("useVoiceRecorder — stop", () => {
  it("invokes onRecorded with file metadata when recording lasts > 1s", async () => {
    const recording = makeRecording();
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });
    const onRecorded = jest.fn<void, [RecordedAudio]>();

    const { result } = renderHook(() => useVoiceRecorder({ onRecorded }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(onRecorded).toHaveBeenCalledTimes(1);
    const audio = onRecorded.mock.calls[0][0];
    expect(audio.filename).toMatch(/\.(mp4|m4a)$/);
    expect(audio.mimeType).toBe("audio/mp4");
    expect(audio.duration).toBeGreaterThanOrEqual(3);
    expect(result.current.isRecording).toBe(false);
  });

  it("skips onRecorded when recording is shorter than 1 second", async () => {
    const recording = makeRecording();
    recording.getStatusAsync.mockResolvedValueOnce({ durationMillis: 500 });
    recording.stopAndUnloadAsync.mockResolvedValueOnce({ durationMillis: 500 });
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });
    const onRecorded = jest.fn();

    const { result } = renderHook(() => useVoiceRecorder({ onRecorded }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("no-op when called without an active recording", async () => {
    const onRecorded = jest.fn();
    const { result } = renderHook(() => useVoiceRecorder({ onRecorded }));
    await act(async () => {
      await result.current.stop();
    });
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("catches stop errors and resets state", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const recording = makeRecording();
    recording.stopAndUnloadAsync.mockRejectedValueOnce(new Error("stop boom"));
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.isRecording).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("falls back to displayed duration when status durations are missing", async () => {
    const recording = makeRecording();
    recording.stopAndUnloadAsync.mockResolvedValueOnce(undefined as any);
    recording.getStatusAsync = undefined as any;
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });
    const onRecorded = jest.fn<void, [RecordedAudio]>();

    const { result } = renderHook(() => useVoiceRecorder({ onRecorded }));
    await act(async () => {
      await result.current.start();
    });
    // simulate timer running so accumulated ms > 1000
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(onRecorded).toHaveBeenCalled();
  });
});

describe("useVoiceRecorder — pause / resume / lock", () => {
  it("pause sets isPaused and calls pauseAsync", async () => {
    const recording = makeRecording();
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.pause();
    });

    expect(recording.pauseAsync).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);
  });

  it("pause swallows pauseAsync errors", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const recording = makeRecording();
    recording.pauseAsync.mockRejectedValueOnce(new Error("nope"));
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.pause();
    });

    expect(result.current.isPaused).toBe(true);
    warnSpy.mockRestore();
  });

  it("resume restarts the timer + calls startAsync", async () => {
    const recording = makeRecording();
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.pause();
    });
    await act(async () => {
      await result.current.resume();
    });

    expect(recording.startAsync).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(false);
  });

  it("resume swallows startAsync errors", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const recording = makeRecording();
    recording.startAsync.mockRejectedValueOnce(new Error("fail"));
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.pause();
    });
    await act(async () => {
      await result.current.resume();
    });
    expect(result.current.isPaused).toBe(false);
    warnSpy.mockRestore();
  });

  it("pause is a no-op when not recording", async () => {
    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.pause();
    });
    expect(result.current.isPaused).toBe(false);
  });

  it("resume is a no-op when not paused", async () => {
    const recording = makeRecording();
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.resume();
    });
    expect(recording.startAsync).not.toHaveBeenCalled();
  });

  it("lock flips isLocked when recording", async () => {
    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.lock();
    });
    expect(result.current.isLocked).toBe(true);
  });

  it("lock no-op when not recording or already locked", async () => {
    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    act(() => {
      result.current.lock();
    });
    expect(result.current.isLocked).toBe(false);
  });
});

describe("useVoiceRecorder — cancel + cleanup", () => {
  it("cancel stops and unloads the recording", async () => {
    const recording = makeRecording();
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.cancel();
    });

    expect(recording.stopAndUnloadAsync).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
  });

  it("cancel handles errors gracefully", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const recording = makeRecording();
    recording.stopAndUnloadAsync.mockRejectedValueOnce(new Error("err"));
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.isRecording).toBe(false);
    errSpy.mockRestore();
  });

  it("cancel no-ops when nothing active", async () => {
    const { result } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.isRecording).toBe(false);
  });

  it("cleans up on unmount when a recording is active", async () => {
    const recording = makeRecording();
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const { result, unmount } = renderHook(() =>
      useVoiceRecorder({ onRecorded: jest.fn() }),
    );
    await act(async () => {
      await result.current.start();
    });
    unmount();
    expect(recording.stopAndUnloadAsync).toHaveBeenCalled();
  });
});

describe("useVoiceRecorder — stop path: web blob rewrap + android remap", () => {
  it("on web, rewraps a blob: URI into an object URL with mp4 ext when supported", async () => {
    mockPlatformOS = "web";
    (global as any).MediaRecorder = {
      isTypeSupported: (t: string) => t === "audio/mp4",
    };

    const recording = makeRecording("blob:https://app/abc-123");
    recording.stopAndUnloadAsync.mockResolvedValueOnce({
      durationMillis: 4000,
    });
    recording.getStatusAsync.mockResolvedValueOnce({ durationMillis: 4000 });
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    (global as any).fetch = jest.fn(async () => ({
      blob: async () => new Blob(["payload"], { type: "audio/mp4" }),
    }));
    (global as any).URL.createObjectURL = jest.fn(() => "blob:rewrap-xyz");

    const onRecorded = jest.fn<void, [RecordedAudio]>();
    const { result } = renderHook(() => useVoiceRecorder({ onRecorded }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(onRecorded).toHaveBeenCalled();
    const audio = onRecorded.mock.calls[0][0];
    expect(audio.uri).toBe("blob:rewrap-xyz");
    expect(audio.mimeType).toBe("audio/mp4");
    delete (global as any).MediaRecorder;
  });

  it("on iOS native, remaps file:// .m4a to .mp4 by copy", async () => {
    mockPlatformOS = "ios";
    const recording = makeRecording("file:///tmp/foo.m4a");
    recording.stopAndUnloadAsync.mockResolvedValueOnce({
      durationMillis: 3000,
    });
    recording.getStatusAsync.mockResolvedValueOnce({ durationMillis: 3000 });
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const onRecorded = jest.fn<void, [RecordedAudio]>();
    const { result } = renderHook(() => useVoiceRecorder({ onRecorded }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(mockFsCopy).toHaveBeenCalled();
    const audio = onRecorded.mock.calls[0][0];
    expect(audio.uri).toMatch(/\.mp4$/);
    expect(audio.filename).toMatch(/\.mp4$/);
  });

  it("on iOS, copy failure falls back to the original URI", async () => {
    mockPlatformOS = "ios";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockFsCopy.mockRejectedValueOnce(new Error("disk full"));
    const recording = makeRecording("file:///tmp/foo.m4a");
    recording.stopAndUnloadAsync.mockResolvedValueOnce({
      durationMillis: 3000,
    });
    recording.getStatusAsync.mockResolvedValueOnce({ durationMillis: 3000 });
    mockAudio.Recording.createAsync.mockResolvedValueOnce({ recording });

    const onRecorded = jest.fn<void, [RecordedAudio]>();
    const { result } = renderHook(() => useVoiceRecorder({ onRecorded }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });

    const audio = onRecorded.mock.calls[0][0];
    expect(audio.uri).toBe("file:///tmp/foo.m4a");
    warnSpy.mockRestore();
  });
});
