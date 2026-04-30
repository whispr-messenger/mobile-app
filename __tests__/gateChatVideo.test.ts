/**
 * Tests for gateChatVideoBeforeSend — v3-only moderation path for videos.
 *
 * - v2 selected → pass through (no thumbnail, no inference).
 * - v3 selected, happy path → thumbnail extraction + TFJS gate.
 * - v3 selected, thumbnail extraction fails → fail-closed.
 * - v3 selected, TFJS gate fails → fail-closed.
 * - v3 selected, gate blocks → reason + scores forwarded to caller.
 */

const mockGate = jest.fn();
const mockGetVersion = jest.fn();
const mockGetThumbnail = jest.fn();

jest.mock("../src/services/moderation/tfjs.service", () => ({
  tfjsService: { gate: (...args: unknown[]) => mockGate(...args) },
}));

jest.mock("../src/services/moderation/model-version", () => ({
  getModerationModelVersion: (...args: unknown[]) => mockGetVersion(...args),
}));

jest.mock("expo-video-thumbnails", () => ({
  getThumbnailAsync: (...args: unknown[]) => mockGetThumbnail(...args),
}));

jest.mock("../src/utils/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { gateChatVideoBeforeSend } from "../src/services/moderation/gate-chat-video";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("gateChatVideoBeforeSend", () => {
  it("returns ok:true immediately when v2 is selected (no gate, no thumbnail)", async () => {
    mockGetVersion.mockResolvedValue("v2");

    const result = await gateChatVideoBeforeSend("file:///videos/clip.mp4");

    expect(result).toEqual({ ok: true });
    expect(mockGetThumbnail).not.toHaveBeenCalled();
    expect(mockGate).not.toHaveBeenCalled();
  });

  it("runs the v3 gate on the extracted first-frame thumbnail", async () => {
    mockGetVersion.mockResolvedValue("v3");
    mockGetThumbnail.mockResolvedValue({ uri: "file:///cache/thumb-0.jpg" });
    mockGate.mockResolvedValue({
      allowed: true,
      bestClass: "not_food",
      probs: { food: 0.1, not_food: 0.9 },
    });

    const result = await gateChatVideoBeforeSend("file:///videos/clip.mp4");

    expect(result).toEqual({ ok: true });
    expect(mockGetThumbnail).toHaveBeenCalledWith(
      "file:///videos/clip.mp4",
      expect.objectContaining({ time: 0 }),
    );
    expect(mockGate).toHaveBeenCalledWith({
      uri: "file:///cache/thumb-0.jpg",
      version: "v3",
    });
  });

  it("forwards block reason and scores when the v3 gate rejects the frame", async () => {
    mockGetVersion.mockResolvedValue("v3");
    mockGetThumbnail.mockResolvedValue({ uri: "file:///cache/thumb-0.jpg" });
    mockGate.mockResolvedValue({
      allowed: false,
      bestClass: "food",
      probs: { food: 0.94, not_food: 0.06 },
    });

    const result = await gateChatVideoBeforeSend("file:///videos/clip.mp4");

    expect(result).toMatchObject({
      ok: false,
      bestClass: "food",
      scores: { food: 0.94, not_food: 0.06 },
    });
  });

  it("fails closed when thumbnail extraction throws", async () => {
    mockGetVersion.mockResolvedValue("v3");
    mockGetThumbnail.mockRejectedValue(new Error("no such file"));

    const result = await gateChatVideoBeforeSend("file:///videos/broken.mp4");

    expect(result).toMatchObject({ ok: false });
    expect(mockGate).not.toHaveBeenCalled();
  });

  it("fails closed when the v3 gate throws during inference", async () => {
    mockGetVersion.mockResolvedValue("v3");
    mockGetThumbnail.mockResolvedValue({ uri: "file:///cache/thumb-0.jpg" });
    mockGate.mockRejectedValue(new Error("tfjs backend down"));

    const result = await gateChatVideoBeforeSend("file:///videos/clip.mp4");

    expect(result).toMatchObject({ ok: false });
  });
});
