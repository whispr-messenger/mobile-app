// Mock dependencies before importing MediaService.
jest.mock("./src/services/AuthService", () => ({
  AuthService: { refreshTokens: jest.fn() },
}));
jest.mock("./src/services/TokenService", () => ({
  TokenService: { getAccessToken: jest.fn().mockResolvedValue("tok") },
}));
jest.mock("./src/services/apiBase", () => ({
  getApiBaseUrl: () => "https://api.test",
}));
jest.mock("react-native", () => ({ Platform: { OS: "web" } }));
jest.mock("expo-file-system/legacy", () => ({}));

import { MediaService } from "./src/services/MediaService";

describe("MediaService.shareMediaWithRetry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns immediately when userIds is empty without calling shareMedia", async () => {
    const spy = jest
      .spyOn(MediaService, "shareMedia")
      .mockResolvedValue(undefined);

    await MediaService.shareMediaWithRetry("media1", []);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("succeeds on first attempt without retrying", async () => {
    const spy = jest
      .spyOn(MediaService, "shareMedia")
      .mockResolvedValueOnce(undefined);
    const sleep = jest.fn();

    await MediaService.shareMediaWithRetry("media1", ["alice"], { sleep });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("retries when shareMedia fails and eventually succeeds", async () => {
    const spy = jest
      .spyOn(MediaService, "shareMedia")
      .mockRejectedValueOnce(new Error("blip 1"))
      .mockRejectedValueOnce(new Error("blip 2"))
      .mockResolvedValueOnce(undefined);
    const sleep = jest.fn().mockResolvedValue(undefined);

    await MediaService.shareMediaWithRetry("media1", ["alice"], {
      sleep,
      initialDelayMs: 1000,
      maxAttempts: 3,
    });

    expect(spy).toHaveBeenCalledTimes(3);
    // Backoff: 1000ms, 2000ms (between attempts 1->2 and 2->3).
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
    spy.mockRestore();
  });

  it("throws the last error after exhausting retries", async () => {
    const finalError = new Error("permanent");
    const spy = jest
      .spyOn(MediaService, "shareMedia")
      .mockRejectedValueOnce(new Error("blip 1"))
      .mockRejectedValueOnce(new Error("blip 2"))
      .mockRejectedValueOnce(finalError);
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(
      MediaService.shareMediaWithRetry("media1", ["alice"], {
        sleep,
        initialDelayMs: 1,
        maxAttempts: 3,
      }),
    ).rejects.toBe(finalError);

    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
