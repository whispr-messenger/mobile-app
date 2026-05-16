/**
 * Tests for the useResolvedMediaUrl hook + the pure helpers it exposes
 * (uriNeedsAuthResolution, setResolvedMediaCacheScope, clearResolvedMediaCache,
 * prefetchResolvedMediaUris).
 *
 * Stream/probe helpers are already covered by streamMediaToRenderableUri.test.ts;
 * this file focuses on the iOS code path (Platform.OS !== "web"), which is the
 * default jest-expo native preset.
 */

// Factory must inline (babel hoists jest.mock above top-level vars).
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
  cacheDirectory: "file:///cache/",
  deleteAsync: jest.fn(async () => {}),
  makeDirectoryAsync: jest.fn(async () => {}),
  downloadAsync: jest.fn(),
  moveAsync: jest.fn(async () => {}),
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(async () => {}),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFs = require("expo-file-system/legacy") as {
  documentDirectory: string;
  cacheDirectory: string;
  deleteAsync: jest.Mock;
  makeDirectoryAsync: jest.Mock;
  downloadAsync: jest.Mock;
  moveAsync: jest.Mock;
  getInfoAsync: jest.Mock;
  readAsStringAsync: jest.Mock;
  writeAsStringAsync: jest.Mock;
};

jest.mock("../../services/TokenService", () => ({
  TokenService: {
    getAccessToken: jest.fn(),
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react-native";
import {
  useResolvedMediaUrl,
  uriNeedsAuthResolution,
  setResolvedMediaCacheScope,
  clearResolvedMediaCache,
  prefetchResolvedMediaUris,
} from "../useResolvedMediaUrl";
import { TokenService } from "../../services/TokenService";

const mockGetAccessToken = TokenService.getAccessToken as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue("token-xyz");
  mockFs.getInfoAsync.mockResolvedValue({ exists: false });
  mockFs.downloadAsync.mockResolvedValue({
    headers: { "Content-Type": "image/jpeg" },
  });
  setResolvedMediaCacheScope("u-1");
});

describe("uriNeedsAuthResolution", () => {
  it.each([
    ["/blob URL", "https://api/media/v1/abc/blob", true],
    ["/thumbnail URL", "https://api/media/v1/abc/thumbnail", true],
    ["unrelated CDN", "https://cdn/whatever.jpg", false],
    ["undefined", undefined, false],
    ["empty string", "", false],
  ])("%s → %s", (_label, input, expected) => {
    expect(uriNeedsAuthResolution(input as string | undefined)).toBe(expected);
  });
});

describe("setResolvedMediaCacheScope + clearResolvedMediaCache", () => {
  it("sanitizes unsafe characters and truncates", async () => {
    setResolvedMediaCacheScope("user-1 special?chars*éà");
    await clearResolvedMediaCache();
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/whispr-media-cache\/user-1_special_chars___$/),
      { idempotent: true },
    );
  });

  it("falls back to 'anon' for empty/null/whitespace scope", async () => {
    setResolvedMediaCacheScope("");
    await clearResolvedMediaCache();
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/whispr-media-cache\/anon$/),
      { idempotent: true },
    );

    mockFs.deleteAsync.mockClear();
    setResolvedMediaCacheScope(null);
    await clearResolvedMediaCache();
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/whispr-media-cache\/anon$/),
      { idempotent: true },
    );
  });

  it("clearResolvedMediaCache(scope) overrides the current scope", async () => {
    setResolvedMediaCacheScope("u-1");
    await clearResolvedMediaCache("u-2");
    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/whispr-media-cache\/u-2$/),
      { idempotent: true },
    );
  });

  it("swallows deleteAsync errors", async () => {
    mockFs.deleteAsync.mockRejectedValueOnce(new Error("FS error"));
    await expect(clearResolvedMediaCache("u-1")).resolves.toBeUndefined();
  });
});

describe("useResolvedMediaUrl — pass-through paths", () => {
  it("undefined uri → resolvedUri='' + loading=false (no network)", async () => {
    const { result } = renderHook(() => useResolvedMediaUrl(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resolvedUri).toBe("");
    expect(mockGetAccessToken).not.toHaveBeenCalled();
  });

  it("non-/media URI is forwarded verbatim", async () => {
    const { result } = renderHook(() =>
      useResolvedMediaUrl("https://cdn/img.jpg"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resolvedUri).toBe("https://cdn/img.jpg");
    expect(mockGetAccessToken).not.toHaveBeenCalled();
  });

  it("clearing the uri after resolving resets state", async () => {
    const { result, rerender } = renderHook(
      ({ uri }: { uri: string | undefined }) => useResolvedMediaUrl(uri),
      { initialProps: { uri: "https://cdn/img.jpg" } },
    );
    await waitFor(() =>
      expect(result.current.resolvedUri).toBe("https://cdn/img.jpg"),
    );
    rerender({ uri: undefined });
    await waitFor(() => expect(result.current.resolvedUri).toBe(""));
  });
});

describe("useResolvedMediaUrl — auth-resolved native path", () => {
  it("downloads through writeDiskCache and exposes the file URI", async () => {
    mockFs.downloadAsync.mockResolvedValueOnce({
      headers: { "Content-Type": "image/jpeg" },
    });

    const { result } = renderHook(() =>
      useResolvedMediaUrl("https://api/media/v1/abc/blob"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(false);
    expect(result.current.resolvedUri).toMatch(/\.jpg$/);
    expect(mockFs.downloadAsync).toHaveBeenCalledWith(
      expect.stringContaining("stream=1"),
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-xyz",
        }),
      }),
    );
  });

  it("surfaces error when download throws", async () => {
    mockFs.downloadAsync.mockRejectedValueOnce(new Error("net down"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useResolvedMediaUrl("https://api/media/v1/err/blob"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    warnSpy.mockRestore();
  });

  it("reads disk cache when meta + file are both fresh", async () => {
    mockFs.getInfoAsync.mockResolvedValue({ exists: true });
    const meta = {
      fileUri: "file:///cache/whispr-media-cache/u-1/abc.jpg",
      storedAt: Date.now(),
    };
    mockFs.readAsStringAsync.mockResolvedValue(JSON.stringify(meta));

    const { result } = renderHook(() =>
      useResolvedMediaUrl("https://api/media/v1/cached/blob"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFs.readAsStringAsync).toHaveBeenCalled();
  });

  it("invalidates a stale (TTL expired) disk-cached entry", async () => {
    mockFs.getInfoAsync.mockResolvedValue({ exists: true });
    mockFs.readAsStringAsync.mockResolvedValue(
      JSON.stringify({
        fileUri: "file:///cache/whispr-media-cache/u-1/old.jpg",
        storedAt: 0, // long expired
      }),
    );

    renderHook(() => useResolvedMediaUrl("https://api/media/v1/stale/blob"));
    await waitFor(() =>
      expect(mockFs.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining("old.jpg"),
        { idempotent: true },
      ),
    );
  });

  it("invalidates a .bin cache entry (legacy)", async () => {
    mockFs.getInfoAsync.mockResolvedValue({ exists: true });
    mockFs.readAsStringAsync.mockResolvedValue(
      JSON.stringify({
        fileUri: "file:///cache/whispr-media-cache/u-1/abc.bin",
        storedAt: Date.now(),
      }),
    );

    renderHook(() => useResolvedMediaUrl("https://api/media/v1/bin/blob"));
    await waitFor(() =>
      expect(mockFs.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining(".bin"),
        { idempotent: true },
      ),
    );
  });

  it("malformed meta JSON falls through to fresh download", async () => {
    mockFs.getInfoAsync.mockResolvedValueOnce({ exists: true });
    mockFs.readAsStringAsync.mockResolvedValueOnce("not-json");

    const { result } = renderHook(() =>
      useResolvedMediaUrl("https://api/media/v1/badjson/blob"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFs.downloadAsync).toHaveBeenCalled();
  });

  it("works when TokenService has no access token (anonymous)", async () => {
    mockGetAccessToken.mockResolvedValueOnce(null);
    mockFs.downloadAsync.mockResolvedValueOnce({
      headers: { "Content-Type": "image/png" },
    });
    const { result } = renderHook(() =>
      useResolvedMediaUrl("https://api/media/v1/anon/blob"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFs.downloadAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      }),
    );
  });

  it("does not surface AbortError as error when unmounted", async () => {
    let resolveDownload: ((v: unknown) => void) | undefined;
    mockFs.downloadAsync.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveDownload = res;
        }),
    );

    const { result, unmount } = renderHook(() =>
      useResolvedMediaUrl("https://api/media/v1/long/blob"),
    );
    act(() => unmount());
    // Now resolve the download — the hook should ignore the result.
    resolveDownload?.({ headers: { "Content-Type": "image/jpeg" } });
    // Tick microtasks
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.error).toBe(false);
  });
});

describe("prefetchResolvedMediaUris", () => {
  it("dedupes URIs and skips non-auth-resolved ones", async () => {
    mockFs.downloadAsync.mockResolvedValue({
      headers: { "Content-Type": "image/jpeg" },
    });

    await prefetchResolvedMediaUris([
      "https://api/media/v1/x/blob",
      "https://api/media/v1/x/blob", // dup
      "https://cdn/skip.jpg", // not auth-resolved
      undefined,
      null,
      "  ", // whitespace
      "https://api/media/v1/y/thumbnail",
    ]);

    expect(mockFs.downloadAsync).toHaveBeenCalledTimes(2);
  });

  it("swallows errors from individual downloads", async () => {
    mockFs.downloadAsync.mockRejectedValue(new Error("boom"));
    await expect(
      prefetchResolvedMediaUris(["https://api/media/v1/x/blob"]),
    ).resolves.toBeUndefined();
  });
});
