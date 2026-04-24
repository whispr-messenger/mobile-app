/**
 * Tests for AudioMessage — verifies the `/media/v1/:id/blob` URL is resolved
 * to a playable presigned URL (or streamed blob:) before being handed to
 * `Audio.Sound.createAsync`. Without this resolution, the Audio element on
 * web receives JSON bytes and playback fails silently.
 */

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockGetAccessToken = jest.fn();
jest.mock("./src/services/TokenService", () => ({
  TokenService: { getAccessToken: (...a: any[]) => mockGetAccessToken(...a) },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue("tok");
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
  const Platform = require("react-native").Platform;
  Platform.OS = "web";
});

describe("AudioMessage resolves /blob URL before playback", () => {
  it("fetches the presigned URL and passes it to Audio.Sound.createAsync on play", async () => {
    const fetchSpy = jest
      .fn()
      .mockResolvedValue(
        mockFetchJson({ url: "https://cdn.example.com/voice.m4a" }),
      );
    (global as any).fetch = fetchSpy;

    const { getByRole, UNSAFE_getAllByType } = render(
      <AudioMessage
        uri="https://whispr.devzeyu.com/media/v1/abc/blob"
        duration={3}
      />,
    );

    // Wait for the resolver effect to run
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // Simulate user pressing play
    const Touchable = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(Touchable);
    fireEvent.press(touchables[0]);

    await waitFor(() => {
      expect(mockCreateAsync).toHaveBeenCalled();
    });

    const [source] = mockCreateAsync.mock.calls[0];
    expect(source.uri).toBe("https://cdn.example.com/voice.m4a");
    // The raw /blob URL must NEVER reach Audio.Sound — it returns JSON
    expect(source.uri).not.toContain("/media/v1/abc/blob");
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
});
