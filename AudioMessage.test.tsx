/**
 * Tests for AudioMessage — verifies the `/media/v1/:id/blob` URL is resolved
 * to a playable presigned URL (or streamed blob:) before being handed to
 * `Audio.Sound.createAsync`. Without this resolution, the Audio element on
 * web receives JSON bytes and playback fails silently.
 */

import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockGetAccessToken = jest.fn();
jest.mock("./src/services/TokenService", () => ({
  TokenService: { getAccessToken: (...a: any[]) => mockGetAccessToken(...a) },
}));

const mockDownloadAudioToCacheFile = jest.fn();
jest.mock("./src/services/MediaService", () => ({
  MediaService: {
    downloadAudioToCacheFile: (...a: any[]) => mockDownloadAudioToCacheFile(...a),
  },
}));

const mockCreateAsync = jest.fn();
const mockSetAudioModeAsync = jest.fn();
jest.mock(
  "expo-av",
  () => ({
    Audio: {
      Sound: {
        createAsync: (...a: any[]) => mockCreateAsync(...a),
      },
      setAudioModeAsync: (...a: any[]) => mockSetAudioModeAsync(...a),
    },
  }),
  { virtual: true },
);

import { AudioMessage } from "./src/components/Chat/AudioMessage";

const mockFetchJson = (body: unknown) => ({
  ok: true,
  url: "",
  headers: {
    get: (k: string) => (k === "content-type" ? "application/json" : null),
  },
  json: async () => body,
});

const mockFetchBytes = () => ({
  ok: true,
  url: "",
  headers: { get: () => "audio/mp4" },
  blob: async () => new Blob([new Uint8Array([0xff])], { type: "audio/mp4" }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue("tok");
  mockDownloadAudioToCacheFile.mockResolvedValue("file:///cache/audio/abc.mp4");
  mockCreateAsync.mockResolvedValue({
    sound: {
      playAsync: jest.fn().mockResolvedValue({}),
      pauseAsync: jest.fn().mockResolvedValue({}),
      unloadAsync: jest.fn().mockResolvedValue({}),
      setPositionAsync: jest.fn().mockResolvedValue({}),
    },
    status: { isLoaded: true, durationMillis: 3000 },
  });
  mockSetAudioModeAsync.mockResolvedValue({});
  (global as any).URL.createObjectURL = jest.fn(() => "blob:audio-fake");
  (global as any).URL.revokeObjectURL = jest.fn();
  const Platform = require("react-native").Platform;
  Platform.OS = "web";
});

describe("AudioMessage resolves /blob URL before playback (WHISPR-1216)", () => {
  it("renders the provided duration immediately in the iOS-like widget", () => {
    (global as any).fetch = jest.fn();

    const { getAllByText } = render(
      <AudioMessage uri="file:///local/voice.m4a" duration={83} />,
    );

    expect(getAllByText("1:23").length).toBeGreaterThan(0);
  });

  it("streams via /blob?stream=1 and passes the proxied blob URL — never the presigned URL — to Audio.Sound.createAsync", async () => {
    const presigned =
      "https://minio.whispr.devzeyu.com/bucket/voice.m4a?X-Amz-Signature=abc";
    const fetchSpy = jest.fn().mockImplementation((url: string) => {
      if (url.includes("stream=1")) return Promise.resolve(mockFetchBytes());
      return Promise.resolve(mockFetchJson({ url: presigned }));
    });
    (global as any).fetch = fetchSpy;

    const { UNSAFE_getAllByType } = render(
      <AudioMessage
        uri="https://whispr.devzeyu.com/media/v1/abc/blob"
        duration={3}
      />,
    );

    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([u]: [string]) => u.includes("stream=1")),
      ).toBe(true);
    });

    const Touchable = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(Touchable);
    fireEvent.press(touchables[0]);

    await waitFor(() => {
      expect(mockCreateAsync).toHaveBeenCalled();
    });

    const [source] = mockCreateAsync.mock.calls[0];
    expect(source.uri).toBe("blob:audio-fake");
    // Critical regression check: the presigned URL must NEVER reach the
    // playback layer.
    expect(source.uri).not.toContain(presigned);
    expect(source.uri).not.toContain("X-Amz-Signature");
  }, 15000);

  it("passes local file:// URIs through unchanged (recording preview)", async () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;

    const { UNSAFE_getAllByType } = render(
      <AudioMessage uri="file:///local/voice.m4a" duration={3} />,
    );

    const Touchable = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(Touchable);
    fireEvent.press(touchables[0]);

    await waitFor(() => {
      expect(mockCreateAsync).toHaveBeenCalled();
    });

    const [source] = mockCreateAsync.mock.calls[0];
    expect(source.uri).toBe("file:///local/voice.m4a");
    // No network request — local URI needs no resolution
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("downloads native media-service audio to a local file before playback", async () => {
    const Platform = require("react-native").Platform;
    Platform.OS = "ios";
    (global as any).fetch = jest.fn();

    const { UNSAFE_getAllByType } = render(
      <AudioMessage
        uri="https://whispr.devzeyu.com/media/v1/abc/blob"
        mediaId="abc"
        duration={3}
      />,
    );

    await waitFor(() => {
      expect(mockDownloadAudioToCacheFile).toHaveBeenCalledWith("abc");
    });

    const Touchable = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(Touchable);
    fireEvent.press(touchables[0]);

    await waitFor(() => {
      expect(mockCreateAsync).toHaveBeenCalled();
    });

    const [source] = mockCreateAsync.mock.calls[0];
    expect(source.uri).toBe("file:///cache/audio/abc.mp4");
  });
});
