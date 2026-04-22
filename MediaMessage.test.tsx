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

describe("MediaMessage useResolvedMediaUrl", () => {
  it("uses the presigned URL directly when it is publicly reachable", async () => {
    const fetchSpy = jest.fn().mockImplementation((url: string) => {
      if (url.includes("stream=1")) return Promise.resolve(mockFetchBytes());
      return Promise.resolve(
        mockFetchJson({ url: "https://cdn.example.com/x.jpg" }),
      );
    });
    (global as any).fetch = fetchSpy;

    const { toJSON } = render(<MediaMessage uri={mediaUrl} type="image" />);

    await waitFor(() => {
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain("https://cdn.example.com/x.jpg");
    });
    // Only the JSON roundtrip — never hit ?stream=1.
    expect(
      fetchSpy.mock.calls.some(([url]: [string]) => url.includes("stream=1")),
    ).toBe(false);
  });

  it("falls back to ?stream=1 bytes when the presigned URL is cluster-internal", async () => {
    const fetchSpy = jest.fn().mockImplementation((url: string) => {
      if (url.includes("stream=1")) return Promise.resolve(mockFetchBytes());
      return Promise.resolve(
        mockFetchJson({
          url: "http://minio.minio.svc.cluster.local:9000/bucket/x?sig=1",
        }),
      );
    });
    (global as any).fetch = fetchSpy;

    const { toJSON } = render(<MediaMessage uri={mediaUrl} type="image" />);

    await waitFor(() => {
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain("blob:fake");
    });

    // A ?stream=1 request was made with the Bearer token
    const streamCall = fetchSpy.mock.calls.find(([url]: [string]) =>
      url.includes("stream=1"),
    );
    expect(streamCall).toBeDefined();
    expect(streamCall![0]).toContain("stream=1");
    expect(streamCall![1].headers.Authorization).toBe("Bearer tok");
  });

  it("sets error state when both the JSON and the stream fetch fail", async () => {
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
