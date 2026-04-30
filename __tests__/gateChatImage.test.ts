/**
 * Tests for gateChatImageBeforeSend — on-device TFJS image moderation gate
 */

const mockGate = jest.fn();

jest.mock("../src/services/moderation/tfjs.service", () => ({
  tfjsService: { gate: (...args: any[]) => mockGate(...args) },
}));

jest.mock("../src/utils/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { gateChatImageBeforeSend } from "../src/services/moderation/gate-chat-image";

beforeEach(() => jest.clearAllMocks());

describe("gateChatImageBeforeSend", () => {
  it("returns ok:true when TFJS allows the image", async () => {
    mockGate.mockResolvedValue({
      allowed: true,
      bestClass: "safe",
      probs: { safe: 0.95 },
    });

    const result = await gateChatImageBeforeSend("file:///photos/cat.jpg");

    expect(result).toEqual({ ok: true });
    expect(mockGate).toHaveBeenCalledWith({ uri: "file:///photos/cat.jpg" });
  });

  it("returns ok:false with reason and scores when TFJS blocks the image", async () => {
    mockGate.mockResolvedValue({
      allowed: false,
      bestClass: "nudity",
      probs: { nudity: 0.92, safe: 0.08 },
    });

    const result = await gateChatImageBeforeSend("file:///photos/blocked.jpg");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.bestClass).toBe("nudity");
      expect(result.scores).toEqual({ nudity: 0.92, safe: 0.08 });
      expect(result.reason).toBeTruthy();
    }
  });

  it("fails closed when TFJS throws an error", async () => {
    mockGate.mockRejectedValue(new Error("Model load failed"));

    const result = await gateChatImageBeforeSend("file:///photos/error.jpg");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBeTruthy();
    }
  });

  it("fails closed when TFJS throws a non-Error", async () => {
    mockGate.mockRejectedValue("unexpected string throw");

    const result = await gateChatImageBeforeSend("file:///photos/weird.jpg");

    expect(result.ok).toBe(false);
  });
});
