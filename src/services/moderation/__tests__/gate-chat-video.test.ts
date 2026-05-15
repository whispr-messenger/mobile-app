/**
 * Tests for gateChatVideoBeforeSend — on-device TFJS video moderation gate.
 *
 * Focus: web platform short-circuits the gate entirely (expo-video-thumbnails
 * is unsupported on web and throws), and v2 moderation model still returns
 * ok:true without invoking the thumbnail extractor.
 */

const mockGetThumbnailAsync = jest.fn();
const mockGate = jest.fn();
const mockGetModerationModelVersion = jest.fn();

jest.mock("expo-video-thumbnails", () => ({
  getThumbnailAsync: (...args: any[]) => mockGetThumbnailAsync(...args),
}));

jest.mock("./src/services/moderation/tfjs.service", () => ({
  tfjsService: { gate: (...args: any[]) => mockGate(...args) },
}));

jest.mock("./src/services/moderation/model-version", () => ({
  getModerationModelVersion: (...args: any[]) =>
    mockGetModerationModelVersion(...args),
}));

jest.mock("./src/utils/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import { Platform } from "react-native";
import { gateChatVideoBeforeSend } from "./src/services/moderation/gate-chat-video";

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = "ios";
});

describe("gateChatVideoBeforeSend", () => {
  it("returns ok:true on web without calling the thumbnail extractor", async () => {
    (Platform as { OS: string }).OS = "web";

    const result = await gateChatVideoBeforeSend("file:///foo.mp4");

    expect(result).toEqual({ ok: true });
    expect(mockGetThumbnailAsync).not.toHaveBeenCalled();
    expect(mockGate).not.toHaveBeenCalled();
    expect(mockGetModerationModelVersion).not.toHaveBeenCalled();
  });

  it("returns ok:true on iOS when moderation model is v2 (no video gating)", async () => {
    (Platform as { OS: string }).OS = "ios";
    mockGetModerationModelVersion.mockResolvedValue("v2");

    const result = await gateChatVideoBeforeSend("file:///foo.mp4");

    expect(result).toEqual({ ok: true });
    expect(mockGetThumbnailAsync).not.toHaveBeenCalled();
    expect(mockGate).not.toHaveBeenCalled();
  });
});
