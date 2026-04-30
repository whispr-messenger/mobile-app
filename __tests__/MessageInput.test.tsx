/**
 * Tests for MessageInput — specifically the Safari/web voice recording fix.
 *
 * Bug: on iOS Safari, expo-av's HIGH_QUALITY preset forces `audio/webm`,
 * which Safari refuses with NotSupportedError. Safari (iOS + macOS) only
 * supports `audio/mp4`. `buildRecordingOptions` negotiates a compatible MIME
 * type on web and leaves native platforms untouched.
 */

import { Platform } from "react-native";

// expo-av must be mocked before MessageInput is imported.
jest.mock(
  "expo-av",
  () => ({
    Audio: {
      RecordingOptionsPresets: {
        HIGH_QUALITY: {
          android: { extension: ".m4a" },
          ios: { extension: ".m4a" },
          web: { mimeType: "audio/webm", bitsPerSecond: 128000 },
        },
      },
    },
  }),
  { virtual: true },
);

import { buildRecordingOptions } from "../src/components/Chat/MessageInput";

type MediaRecorderLike = { isTypeSupported?: (mime: string) => boolean };

const originalMediaRecorder = (global as any).MediaRecorder;

const setMediaRecorder = (impl?: MediaRecorderLike | undefined) => {
  if (impl === undefined) {
    delete (global as any).MediaRecorder;
    return;
  }
  (global as any).MediaRecorder = impl;
};

afterEach(() => {
  setMediaRecorder(originalMediaRecorder);
});

describe("buildRecordingOptions", () => {
  it("uses audio/mp4 on web when Safari reports it as supported", () => {
    Platform.OS = "web";
    setMediaRecorder({
      isTypeSupported: (mime: string) => mime === "audio/mp4",
    });

    const opts = buildRecordingOptions();

    expect(opts.web).toEqual({
      mimeType: "audio/mp4",
      bitsPerSecond: 128000,
    });
  });

  it("falls back to audio/webm when audio/mp4 is not supported", () => {
    Platform.OS = "web";
    setMediaRecorder({
      isTypeSupported: (mime: string) => mime === "audio/webm",
    });

    const opts = buildRecordingOptions();

    expect(opts.web).toEqual({
      mimeType: "audio/webm",
      bitsPerSecond: 128000,
    });
  });

  it("returns the HIGH_QUALITY preset identity on native (iOS) — no web override injected", () => {
    Platform.OS = "ios";
    setMediaRecorder({ isTypeSupported: () => true });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Audio } = require("expo-av");
    const expected = Audio.RecordingOptionsPresets.HIGH_QUALITY;
    const opts = buildRecordingOptions();

    // Same object reference → nothing was spread/overridden for web.
    expect(opts).toBe(expected);
  });

  it("returns the HIGH_QUALITY preset identity on native (Android)", () => {
    Platform.OS = "android";
    setMediaRecorder(undefined);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Audio } = require("expo-av");
    const expected = Audio.RecordingOptionsPresets.HIGH_QUALITY;
    const opts = buildRecordingOptions();

    expect(opts).toBe(expected);
  });
});
