/**
 * Tests for MediaMessage — specifically the `useResolvedMediaUrl` hook that
 * turns /media/v1/:id/blob proxy URLs into something <Image> can render.
 *
 * Behaviour covered:
 * - fast path: reachable presigned URL is forwarded as-is
 * - fallback: unreachable presigned URL triggers a `?stream=1` bytes fetch
 *   that gets materialised as a blob:/ data: URI
 * - error: blob fetch failures surface as `error=true`
 */

import React from "react";
import { render, waitFor } from "@testing-library/react-native";

const mockGetAccessToken = jest.fn();
jest.mock("./src/services/TokenService", () => ({
  TokenService: { getAccessToken: (...a: any[]) => mockGetAccessToken(...a) },
}));

// Simple deterministic theme provider.
jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      primary: "#fff",
      background: { secondary: "#000" },
      text: { primary: "#fff", secondary: "#aaa" },
    }),
  }),
}));

// expo-av is imported via try/catch — stub the module so the require resolves
jest.mock(
  "expo-av",
  () => ({ Video: () => null, ResizeMode: { COVER: "cover" } }),
  { virtual: true },
);

import { MediaMessage } from "./src/components/Chat/MediaMessage";

const originalFetch = global.fetch;

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
  headers: { get: () => "application/octet-stream" },
  blob: async () =>
    new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue("tok");
  (global as any).URL.createObjectURL = jest.fn(() => "blob:fake");
  (global as any).URL.revokeObjectURL = jest.fn();
  // Force the web path: URL.createObjectURL is the cleanest fixture and
  // FileReader is not always available in the jest-expo native environment.
  const Platform = require("react-native").Platform;
  Platform.OS = "web";
});

afterAll(() => {
  global.fetch = originalFetch;
});

const mediaUrl = "https://whispr.devzeyu.com/media/v1/abc/blob";

describe("MediaMessage useResolvedMediaUrl (WHISPR-1216)", () => {
  it(
    "always streams via /blob?stream=1 — never exposes the presigned URL",
    async () => {
      const presigned =
        "https://minio.whispr.devzeyu.com/bucket/x.jpg?X-Amz-Signature=deadbeef";
      const fetchSpy = jest.fn().mockImplementation((url: string) => {
        if (url.includes("stream=1")) return Promise.resolve(mockFetchBytes());
        return Promise.resolve(mockFetchJson({ url: presigned }));
      });
      (global as any).fetch = fetchSpy;

      const { toJSON } = render(<MediaMessage uri={mediaUrl} type="image" />);

      await waitFor(
        () => {
          const tree = JSON.stringify(toJSON());
          expect(tree).toContain("blob:fake");
        },
        { timeout: 10000 },
      );

      // The presigned URL must NEVER appear in the rendered tree — that's
      // the regression this ticket is preventing.
      const tree = JSON.stringify(toJSON());
      expect(tree).not.toContain(presigned);
      expect(tree).not.toContain("X-Amz-Signature");

      // The bytes were fetched through the authenticated stream endpoint.
      const streamCall = fetchSpy.mock.calls.find(([u]: [string]) =>
        u.includes("stream=1"),
      );
      expect(streamCall).toBeDefined();
      expect(streamCall![1].headers.Authorization).toBe("Bearer tok");
    },
    15000,
  );

  it(
    "ignores response.url on the legacy 302 redirect path (no presign leak)",
    async () => {
      // Simulate a media-service that still returns a 302 to a presigned
      // URL — fetch follows the redirect and exposes the target via
      // response.url. The hook must NOT use it.
      const presignedRedirectTarget =
        "https://minio.whispr.devzeyu.com/bucket/x.jpg?X-Amz-Signature=foo";
      const fetchSpy = jest.fn().mockImplementation((url: string) => {
        if (url.includes("stream=1")) return Promise.resolve(mockFetchBytes());
        return Promise.resolve({
          ok: true,
          // post-redirect URL — historically the hook would lift this.
          url: presignedRedirectTarget,
          // Non-JSON content-type → legacy 302 path
          headers: { get: () => "image/jpeg" },
        });
      });
      (global as any).fetch = fetchSpy;

      const { toJSON } = render(<MediaMessage uri={mediaUrl} type="image" />);

      await waitFor(() => {
        expect(JSON.stringify(toJSON())).toContain("blob:fake");
      });

      const tree = JSON.stringify(toJSON());
      expect(tree).not.toContain(presignedRedirectTarget);
      expect(tree).not.toContain("X-Amz-Signature");
    },
    15000,
  );

  it("treats {url:null} as 'no media' without falling back to a stream fetch", async () => {
    const fetchSpy = jest.fn().mockImplementation(() =>
      Promise.resolve(mockFetchJson({ url: null })),
    );
    (global as any).fetch = fetchSpy;

    render(<MediaMessage uri={mediaUrl} type="image" />);

    // Give the async resolver a tick to settle.
    await new Promise((r) => setTimeout(r, 50));

    // No `?stream=1` request — null URL is legitimate, not an error.
    expect(
      fetchSpy.mock.calls.some(([u]: [string]) => u.includes("stream=1")),
    ).toBe(false);
  });

  it("sets error state when the JSON probe fetch fails with HTTP 500", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      url: "",
      headers: { get: () => null },
    });
    (global as any).fetch = fetchSpy;

    const { findByText } = render(<MediaMessage uri={mediaUrl} type="image" />);
    expect(await findByText("Échec du chargement")).toBeTruthy();
  });
});
