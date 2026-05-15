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

import {
  MediaService,
  isUploadValidationError,
} from "./src/services/MediaService";

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

describe("MediaService.uploadMedia client-side validation (WHISPR-1220)", () => {
  const mockBlob = (size: number): Blob => {
    return { size, type: "" } as unknown as Blob;
  };
  const mockFetchOnce = (size: number) => {
    const blob = mockBlob(size);
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      blob: () => Promise.resolve(blob),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a non-allowlisted MIME for the avatar context (image-only)", async () => {
    mockFetchOnce(1024);

    await expect(
      MediaService.uploadMedia(
        { uri: "https://blob.test/x", name: "x.zip", type: "application/zip" },
        undefined,
        { context: "avatar" },
      ),
    ).rejects.toMatchObject({
      code: "UPLOAD_MIME_NOT_ALLOWED",
      context: "avatar",
      mimeType: "application/zip",
    });
  });

  it("accepts MIME with parameters (e.g. 'image/jpeg; charset=binary')", async () => {
    // Three fetches on the web success path: size check, FormData blob
    // conversion, then the actual POST upload.
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        blob: () => Promise.resolve(mockBlob(1024)),
      })
      .mockResolvedValueOnce({
        blob: () => Promise.resolve(mockBlob(1024)),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "m-1" }),
      });

    await expect(
      MediaService.uploadMedia(
        {
          uri: "https://blob.test/x",
          name: "x.jpg",
          type: "image/jpeg; charset=binary",
        },
        undefined,
        { context: "avatar" },
      ),
    ).resolves.toMatchObject({ id: "m-1" });
  });

  it("rejects a file larger than the message context limit (100 MB)", async () => {
    mockFetchOnce(101 * 1024 * 1024);

    await expect(
      MediaService.uploadMedia(
        { uri: "https://blob.test/big", name: "big.mp4", type: "video/mp4" },
        undefined,
        { context: "message" },
      ),
    ).rejects.toMatchObject({
      code: "UPLOAD_TOO_LARGE",
      context: "message",
      limitBytes: 100 * 1024 * 1024,
      actualBytes: 101 * 1024 * 1024,
    });
  });

  it("rejects an avatar over 5 MB even when MIME is valid", async () => {
    mockFetchOnce(6 * 1024 * 1024);

    await expect(
      MediaService.uploadMedia(
        { uri: "https://blob.test/big", name: "big.png", type: "image/png" },
        undefined,
        { context: "avatar" },
      ),
    ).rejects.toMatchObject({
      code: "UPLOAD_TOO_LARGE",
      context: "avatar",
      limitBytes: 5 * 1024 * 1024,
    });
  });

  it("falls back to context=message when no meta is provided (allows pdf)", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        blob: () => Promise.resolve(mockBlob(1024)),
      })
      .mockResolvedValueOnce({
        blob: () => Promise.resolve(mockBlob(1024)),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "m-pdf" }),
      });

    await expect(
      MediaService.uploadMedia({
        uri: "https://blob.test/doc",
        name: "doc.pdf",
        type: "application/pdf",
      }),
    ).resolves.toMatchObject({ id: "m-pdf" });
  });
});

describe("MediaService.isUploadValidationError (WHISPR-1220)", () => {
  it("matches errors thrown by validateUpload", () => {
    const err = Object.assign(new Error("boom"), {
      code: "UPLOAD_TOO_LARGE" as const,
    });
    expect(isUploadValidationError(err)).toBe(true);
  });

  it("rejects unrelated errors and primitives", () => {
    expect(isUploadValidationError(new Error("network"))).toBe(false);
    expect(isUploadValidationError({ code: "UPLOAD_TOO_LARGE" })).toBe(false);
    expect(isUploadValidationError(null)).toBe(false);
    expect(isUploadValidationError("UPLOAD_TOO_LARGE")).toBe(false);
  });
});
