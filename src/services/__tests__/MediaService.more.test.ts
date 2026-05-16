/**
 * Tests complémentaires pour MediaService — couvre les paths que le test
 * existant (MediaService.test.ts) laisse de côté :
 *
 * - apiFetch : 401 → refreshTokens → retry, erreurs HTTP, 204 no-content
 * - getMediaMetadata, deleteMedia, shareMedia, downloadThumbnail (succès + 4xx)
 * - downloadMedia : ok + blob() fallback
 * - downloadAudioToCacheFile : succès + retry 404 → succès + content-type invalide
 * - downloadMediaToCacheFile : avatar image direct + JSON envelope fallback path
 * - uploadMedia : XHR progress success + XHR HTTP error + native fetch success path
 */

jest.mock("../AuthService", () => ({
  AuthService: { refreshTokens: jest.fn() },
}));
jest.mock("../TokenService", () => ({
  TokenService: { getAccessToken: jest.fn() },
}));
jest.mock("../apiBase", () => ({
  getApiBaseUrl: () => "https://api.test",
}));

// expo-file-system: same factory pattern as useVoiceRecorder.test.tsx — inline.
jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  documentDirectory: "file:///docs/",
  deleteAsync: jest.fn(async () => {}),
  makeDirectoryAsync: jest.fn(async () => {}),
  downloadAsync: jest.fn(),
  moveAsync: jest.fn(async () => {}),
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(async () => {}),
}));

// Tests below run on the jest-expo native preset (Platform.OS = "ios") so the
// hook code paths exercised here are the *native* ones unless we override
// Platform per-test.

import { MediaService } from "../MediaService";
import { AuthService } from "../AuthService";
import { TokenService } from "../TokenService";
import { Platform } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFs = require("expo-file-system/legacy") as Record<
  string,
  jest.Mock
> & {
  cacheDirectory: string;
};

const mockGetAccessToken = TokenService.getAccessToken as jest.Mock;
const mockRefreshTokens = AuthService.refreshTokens as jest.Mock;

function makeJsonResponse(body: unknown, init: Partial<Response> = {}) {
  const ok = init.ok ?? true;
  const status = init.status ?? 200;
  return {
    ok,
    status,
    url: "https://api.test/url",
    json: async () => body,
    blob: async () => ({ size: 1, type: "application/octet-stream" }) as Blob,
    headers: new Map<string, string>(),
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue("tok");
});

describe("MediaService apiFetch", () => {
  it("retries once on 401 after a successful refreshTokens", async () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    fetchSpy
      .mockResolvedValueOnce(makeJsonResponse({}, { ok: false, status: 401 }))
      .mockResolvedValueOnce(makeJsonResponse({ id: "m-1" }));
    mockRefreshTokens.mockResolvedValueOnce(undefined);

    const result = await MediaService.getMediaMetadata("m-1");
    expect(result).toEqual({ id: "m-1" });
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("surfaces non-401 HTTP errors with status + body", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ message: "nope" }, { ok: false, status: 404 }),
      );

    await expect(
      MediaService.getMediaMetadata("missing"),
    ).rejects.toMatchObject({
      message: "nope",
      status: 404,
    });
  });

  it("returns undefined for a 204 No-Content response", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({}, { ok: true, status: 204 }));

    await expect(MediaService.deleteMedia("m-1")).resolves.toBeUndefined();
  });

  it("falls through on a 401 when refreshTokens throws", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeJsonResponse({}, { ok: false, status: 401 }));
    mockRefreshTokens.mockRejectedValueOnce(new Error("refresh fail"));

    await expect(MediaService.getMediaMetadata("m-1")).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("MediaService.shareMedia + downloadThumbnail", () => {
  it("shareMedia no-ops when userIds is empty", async () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    await MediaService.shareMedia("m-1", []);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shareMedia PATCHes /share with userIds JSON", async () => {
    const fetchSpy = jest
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ sharedWith: ["u-1"] }));
    (global as any).fetch = fetchSpy;

    await MediaService.shareMedia("m-1", ["u-1"]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.test/media/v1/m-1/share",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ userIds: ["u-1"] }),
      }),
    );
  });

  it("downloadThumbnail returns response.url on success", async () => {
    const fetchSpy = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      url: "https://signed.url/thumb.jpg",
    });
    (global as any).fetch = fetchSpy;
    await expect(MediaService.downloadThumbnail("m-1")).resolves.toBe(
      "https://signed.url/thumb.jpg",
    );
  });

  it("downloadThumbnail throws on non-OK", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(MediaService.downloadThumbnail("m-1")).rejects.toThrow(
      /HTTP 500/,
    );
  });
});

describe("MediaService.downloadMedia", () => {
  it("returns url + blob on success", async () => {
    const blob = { size: 12, type: "image/jpeg" } as Blob;
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      url: "https://signed.url/m-1",
      blob: async () => blob,
    });

    const out = await MediaService.downloadMedia("m-1");
    expect(out.url).toBe("https://signed.url/m-1");
    expect(out.blob).toBe(blob);
  });

  it("falls back to url-only when blob() throws", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      url: "https://signed.url/m-1",
      blob: async () => {
        throw new Error("no blob");
      },
    });

    const out = await MediaService.downloadMedia("m-1");
    expect(out.url).toBe("https://signed.url/m-1");
    expect(out.blob).toBeUndefined();
  });

  it("throws on HTTP error", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 502 });
    await expect(MediaService.downloadMedia("m-1")).rejects.toThrow(/HTTP 502/);
  });
});

describe("MediaService.downloadAudioToCacheFile", () => {
  beforeEach(() => {
    mockFs.makeDirectoryAsync.mockResolvedValue(undefined);
    mockFs.moveAsync.mockResolvedValue(undefined);
    mockFs.deleteAsync.mockResolvedValue(undefined);
  });

  it("downloads + moves the audio file on success", async () => {
    mockFs.downloadAsync.mockResolvedValueOnce({
      status: 200,
      uri: "file:///cache/audio/m-1.tmp",
      headers: { "Content-Type": "audio/mpeg" },
    });

    const out = await MediaService.downloadAudioToCacheFile("m-1");
    expect(out).toMatch(/\.mp3$/);
    expect(mockFs.moveAsync).toHaveBeenCalledWith({
      from: "file:///cache/audio/m-1.tmp",
      to: expect.stringMatching(/\.mp3$/),
    });
  });

  it("retries on 404 then succeeds", async () => {
    mockFs.downloadAsync
      .mockResolvedValueOnce({
        status: 404,
        uri: "file:///cache/audio/m-1.tmp",
        headers: {},
      })
      .mockResolvedValueOnce({
        status: 200,
        uri: "file:///cache/audio/m-1.tmp",
        headers: { "content-type": "audio/aac" },
      });

    const out = await MediaService.downloadAudioToCacheFile("m-1");
    expect(out).toMatch(/\.aac$/);
    expect(mockFs.downloadAsync).toHaveBeenCalledTimes(2);
  });

  it("throws after 4 failed attempts on 404", async () => {
    mockFs.downloadAsync.mockResolvedValue({
      status: 404,
      uri: "file:///cache/audio/m-1.tmp",
      headers: {},
    });

    await expect(MediaService.downloadAudioToCacheFile("m-1")).rejects.toThrow(
      /HTTP 404/,
    );
    expect(mockFs.downloadAsync).toHaveBeenCalledTimes(4);
  });

  it("rejects non-audio content-types", async () => {
    mockFs.downloadAsync.mockResolvedValueOnce({
      status: 200,
      uri: "file:///cache/audio/m-1.tmp",
      headers: { "Content-Type": "text/html" },
    });
    mockFs.readAsStringAsync.mockResolvedValueOnce("<html>oops</html>");

    await expect(MediaService.downloadAudioToCacheFile("m-1")).rejects.toThrow(
      /invalid content-type/,
    );
  });
});

describe("MediaService.downloadMediaToCacheFile", () => {
  beforeEach(() => {
    mockFs.makeDirectoryAsync.mockResolvedValue(undefined);
    mockFs.moveAsync.mockResolvedValue(undefined);
    mockFs.deleteAsync.mockResolvedValue(undefined);
    mockFs.getInfoAsync.mockResolvedValue({ size: 4096, exists: true });
  });

  it("direct path: image content-type → move to final extension", async () => {
    mockFs.downloadAsync.mockResolvedValueOnce({
      status: 200,
      uri: "file:///cache/avatars/m-1.tmp",
      headers: { "Content-Type": "image/png" },
    });

    const out = await MediaService.downloadMediaToCacheFile("m-1");
    expect(out).toMatch(/\.png$/);
  });

  it("rejects when first response is non-image and no JSON envelope", async () => {
    mockFs.downloadAsync.mockResolvedValueOnce({
      status: 200,
      uri: "file:///cache/avatars/m-1.tmp",
      headers: { "Content-Type": "text/html" },
    });
    mockFs.getInfoAsync.mockResolvedValueOnce({ size: 4096, exists: true });

    await expect(MediaService.downloadMediaToCacheFile("m-1")).rejects.toThrow(
      /invalid content-type/,
    );
  });

  it("envelope path: small JSON body → fall back to stream=1 with image content", async () => {
    mockFs.getInfoAsync
      .mockResolvedValueOnce({ size: 200, exists: true })
      .mockResolvedValueOnce({ size: 4096, exists: true });
    mockFs.downloadAsync
      .mockResolvedValueOnce({
        status: 200,
        uri: "file:///cache/avatars/m-1.tmp",
        headers: { "Content-Type": "application/json" },
      })
      .mockResolvedValueOnce({
        status: 200,
        uri: "file:///cache/avatars/m-1.tmp",
        headers: { "Content-Type": "image/jpeg" },
      });
    mockFs.readAsStringAsync.mockResolvedValueOnce(
      JSON.stringify({ url: "https://signed.url/x" }),
    );

    const out = await MediaService.downloadMediaToCacheFile("m-1");
    expect(out).toMatch(/\.jpg$/);
  });

  it("envelope path: JSON has url but streamed download fails → returns parsed url", async () => {
    mockFs.getInfoAsync
      .mockResolvedValueOnce({ size: 200, exists: true })
      .mockResolvedValueOnce({ size: 4096, exists: true });
    mockFs.downloadAsync
      .mockResolvedValueOnce({
        status: 200,
        uri: "file:///cache/avatars/m-1.tmp",
        headers: { "Content-Type": "application/json" },
      })
      .mockResolvedValueOnce({
        status: 500,
        uri: "file:///cache/avatars/m-1.tmp",
        headers: {},
      });
    mockFs.readAsStringAsync.mockResolvedValueOnce(
      JSON.stringify({ url: "https://fallback.url/m-1" }),
    );

    const out = await MediaService.downloadMediaToCacheFile("m-1");
    expect(out).toBe("https://fallback.url/m-1");
  });

  it("throws on top-level download failure (non 2xx)", async () => {
    mockFs.downloadAsync.mockResolvedValueOnce({
      status: 500,
      uri: "file:///cache/avatars/m-1.tmp",
      headers: {},
    });

    await expect(MediaService.downloadMediaToCacheFile("m-1")).rejects.toThrow(
      /HTTP 500/,
    );
  });
});

describe("MediaService.uploadMedia — native fetch path", () => {
  it("native: POSTs the upload + normalises {mediaId} to {id, url, thumbnail_url}", async () => {
    if (Platform.OS === "web") return;
    const fetchSpy = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaId: "m-99",
        duration: 3,
      }),
    });
    (global as any).fetch = fetchSpy;

    const result = await MediaService.uploadMedia(
      { uri: "file:///tmp/x.mp4", name: "x.mp4", type: "video/mp4" },
      undefined,
      { context: "message", ownerId: "u-1" },
    );

    expect(result.id).toBe("m-99");
    expect(result.url).toBe("https://api.test/media/v1/m-99/blob");
    expect(result.thumbnail_url).toBe(
      "https://api.test/media/v1/m-99/thumbnail",
    );
    expect(result.duration).toBe(3);
  });

  it("native: surfaces HTTP error body.message when present", async () => {
    if (Platform.OS === "web") return;
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ message: "bad mime" }),
    });

    await expect(
      MediaService.uploadMedia({
        uri: "file:///tmp/x.bin",
        name: "x.bin",
        type: "application/zip",
      }),
    ).rejects.toMatchObject({
      message: "bad mime",
      status: 422,
    });
  });

  it("native: surfaces generic HTTP error when body is opaque", async () => {
    if (Platform.OS === "web") return;
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(
      MediaService.uploadMedia({
        uri: "file:///tmp/x.bin",
        name: "x.bin",
        type: "application/zip",
      }),
    ).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe("MediaService.uploadMedia — XHR progress path (web)", () => {
  let origXHR: typeof XMLHttpRequest;
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    origXHR = (global as any).XMLHttpRequest;
  });

  afterEach(() => {
    (global as any).XMLHttpRequest = origXHR;
    Object.defineProperty(Platform, "OS", {
      value: originalPlatform,
      configurable: true,
    });
  });

  function makeXHR(onSendBody?: (xhr: any) => void) {
    return class FakeXHR {
      status = 0;
      responseText = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      upload = { onprogress: null as ((e: any) => void) | null };
      open = jest.fn();
      setRequestHeader = jest.fn();
      send = jest.fn(() => {
        onSendBody?.(this);
      });
    };
  }

  it("resolves with normalised result on 2xx + computes progress", async () => {
    // First two fetches: blob conversion (size check + blob to put in FormData).
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        blob: async () => ({ size: 1024, type: "" }) as Blob,
      })
      .mockResolvedValueOnce({
        blob: async () => ({ size: 1024, type: "" }) as Blob,
      });

    (global as any).XMLHttpRequest = makeXHR((xhr: any) => {
      xhr.upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      });
      xhr.status = 200;
      xhr.responseText = JSON.stringify({ id: "m-xhr", url: "ignored" });
      xhr.onload?.();
    });

    const progress = jest.fn();
    const out = await MediaService.uploadMedia(
      { uri: "blob:abc", name: "x.png", type: "image/png" },
      progress,
      { context: "avatar" },
    );
    expect(out.id).toBe("m-xhr");
    expect(out.url).toBe("https://api.test/media/v1/m-xhr/blob");
    expect(progress).toHaveBeenCalledWith(50);
  });

  it("rejects with HTTP message on non-2xx", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        blob: async () => ({ size: 1024, type: "" }) as Blob,
      })
      .mockResolvedValueOnce({
        blob: async () => ({ size: 1024, type: "" }) as Blob,
      });

    (global as any).XMLHttpRequest = makeXHR((xhr: any) => {
      xhr.status = 500;
      xhr.responseText = JSON.stringify({ message: "server boom" });
      xhr.onload?.();
    });

    await expect(
      MediaService.uploadMedia(
        { uri: "blob:abc", name: "x.png", type: "image/png" },
        jest.fn(),
        { context: "avatar" },
      ),
    ).rejects.toThrow(/HTTP 500.*server boom/);
  });

  it("rejects on network error", async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        blob: async () => ({ size: 1024, type: "" }) as Blob,
      })
      .mockResolvedValueOnce({
        blob: async () => ({ size: 1024, type: "" }) as Blob,
      });

    (global as any).XMLHttpRequest = makeXHR((xhr: any) => {
      xhr.onerror?.();
    });

    await expect(
      MediaService.uploadMedia(
        { uri: "blob:abc", name: "x.png", type: "image/png" },
        jest.fn(),
        { context: "avatar" },
      ),
    ).rejects.toThrow(/Network error/);
  });
});
