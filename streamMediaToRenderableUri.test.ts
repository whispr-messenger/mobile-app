/**
 * Tests for streamMediaToRenderableUriThrottled — the retry+concurrency
 * wrapper added to keep chat-screen image bursts below the media-service
 * short throttle (30 req/s/IP).
 *
 * We force Platform.OS = 'web' so the inner streamMediaToRenderableUri
 * goes through URL.createObjectURL instead of FileReader (FileReader is
 * not available in the jest-expo node test environment). The native
 * FileReader path is already exercised via MediaMessage.test.tsx on the
 * native preset.
 */

// useResolvedMediaUrl only imports `Platform` from "react-native"; mock just
// that so we don't drag in TurboModuleRegistry / DevMenu from the actual RN
// runtime under jest-expo (those fail to resolve outside the device).
jest.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

import {
  probeMediaUrlThrottled,
  streamMediaToRenderableUri,
  streamMediaToRenderableUriThrottled,
} from "./src/hooks/useResolvedMediaUrl";

// The wrapper calls the inner function which on web hits URL.createObjectURL.
// Make Blob round-trippable through that path in jsdom.
const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_CREATE_OBJECT_URL = (
  global as { URL?: { createObjectURL?: unknown } }
).URL?.createObjectURL;

beforeEach(() => {
  if (typeof URL !== "undefined") {
    (
      URL as unknown as { createObjectURL: (b: Blob) => string }
    ).createObjectURL = jest.fn(() => "blob:fake-stream");
  }
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  if (typeof URL !== "undefined" && ORIGINAL_CREATE_OBJECT_URL !== undefined) {
    (URL as unknown as { createObjectURL: unknown }).createObjectURL =
      ORIGINAL_CREATE_OBJECT_URL;
  }
  jest.restoreAllMocks();
});

function mockFetchSequence(
  responses: Array<{ ok: boolean; status?: number; throws?: Error }>,
): jest.Mock {
  let idx = 0;
  const m = jest.fn(async () => {
    const r = responses[Math.min(idx, responses.length - 1)];
    idx += 1;
    if (r.throws) throw r.throws;
    if (!r.ok) {
      return { ok: false, status: r.status ?? 500 } as unknown as Response;
    }
    return {
      ok: true,
      blob: async () => new Blob(["x"]),
    } as unknown as Response;
  });
  global.fetch = m as unknown as typeof fetch;
  return m;
}

describe("streamMediaToRenderableUriThrottled", () => {
  it("returns the blob URL on first-try success without retrying", async () => {
    const m = mockFetchSequence([{ ok: true }]);
    const result = await streamMediaToRenderableUriThrottled(
      "/media/v1/abc/blob",
      "token",
    );
    expect(result).toBe("blob:fake-stream");
    expect(m).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and succeeds on a later attempt", async () => {
    const m = mockFetchSequence([
      { ok: false, status: 429 },
      { ok: false, status: 429 },
      { ok: true },
    ]);
    const result = await streamMediaToRenderableUriThrottled(
      "/media/v1/abc/blob",
      "token",
    );
    expect(result).toBe("blob:fake-stream");
    expect(m).toHaveBeenCalledTimes(3);
  });

  it("retries on 503 the same way as 429", async () => {
    const m = mockFetchSequence([{ ok: false, status: 503 }, { ok: true }]);
    const result = await streamMediaToRenderableUriThrottled(
      "/media/v1/abc/blob",
      "token",
    );
    expect(result).toBe("blob:fake-stream");
    expect(m).toHaveBeenCalledTimes(2);
  });

  it("retries on a thrown network error (no HTTP marker)", async () => {
    const m = mockFetchSequence([
      { ok: false, throws: new Error("network down") },
      { ok: true },
    ]);
    const result = await streamMediaToRenderableUriThrottled(
      "/media/v1/abc/blob",
      "token",
    );
    expect(result).toBe("blob:fake-stream");
    expect(m).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on non-retryable HTTP statuses (e.g. 401)", async () => {
    const m = mockFetchSequence([{ ok: false, status: 401 }]);
    await expect(
      streamMediaToRenderableUriThrottled("/media/v1/abc/blob", "token"),
    ).rejects.toThrow(/HTTP 401/);
    expect(m).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 404", async () => {
    const m = mockFetchSequence([{ ok: false, status: 404 }]);
    await expect(
      streamMediaToRenderableUriThrottled("/media/v1/abc/blob", "token"),
    ).rejects.toThrow(/HTTP 404/);
    expect(m).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts (4) when 429 keeps coming", async () => {
    const m = mockFetchSequence([
      { ok: false, status: 429 },
      { ok: false, status: 429 },
      { ok: false, status: 429 },
      { ok: false, status: 429 },
    ]);
    await expect(
      streamMediaToRenderableUriThrottled("/media/v1/abc/blob", "token"),
    ).rejects.toThrow(/HTTP 429/);
    expect(m).toHaveBeenCalledTimes(4);
  });

  it("caps concurrent in-flight fetches at 4", async () => {
    let inFlight = 0;
    let peak = 0;
    const releasers: Array<() => void> = [];

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          releasers.push(() => {
            inFlight -= 1;
            resolve({
              ok: true,
              blob: async () => new Blob(["x"]),
            } as unknown as Response);
          });
        }),
    ) as unknown as typeof fetch;

    // Start 12 concurrent calls.
    const calls = Array.from({ length: 12 }, (_, i) =>
      streamMediaToRenderableUriThrottled(`/media/v1/${i}/blob`, "token"),
    );

    // Let the slot pool saturate.
    await new Promise<void>((r) => setTimeout(r, 30));
    expect(peak).toBe(4);
    expect(releasers).toHaveLength(4);

    // Release one at a time; each release should let one queued caller in.
    while (releasers.length > 0) {
      releasers.shift()!();
      await new Promise<void>((r) => setTimeout(r, 10));
    }

    await Promise.all(calls);
    expect(peak).toBe(4);
  }, 5_000);
});

describe("probeMediaUrlThrottled", () => {
  it("returns the response on first-try 2xx", async () => {
    const m = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ url: "https://example.test/x" }),
    }));
    global.fetch = m as unknown as typeof fetch;
    const res = await probeMediaUrlThrottled("/media/v1/abc/thumbnail", {});
    expect(res.status).toBe(200);
    expect(m).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and resolves once a 200 lands", async () => {
    let n = 0;
    global.fetch = jest.fn(async () => {
      n += 1;
      if (n < 3) {
        return { ok: false, status: 429 } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ url: null }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const res = await probeMediaUrlThrottled("/media/v1/abc/thumbnail", {});
    expect(res.status).toBe(200);
    expect(n).toBe(3);
  });

  it("returns the 429 response after maxAttempts (does NOT throw)", async () => {
    let n = 0;
    global.fetch = jest.fn(async () => {
      n += 1;
      return { ok: false, status: 429 } as unknown as Response;
    }) as unknown as typeof fetch;
    const res = await probeMediaUrlThrottled("/media/v1/abc/thumbnail", {});
    expect(res.status).toBe(429);
    expect(n).toBe(4);
  });

  it("does NOT retry on non-retryable status (404)", async () => {
    const m = jest.fn(async () => ({
      ok: false,
      status: 404,
    }));
    global.fetch = m as unknown as typeof fetch;
    const res = await probeMediaUrlThrottled("/media/v1/abc/thumbnail", {});
    expect(res.status).toBe(404);
    expect(m).toHaveBeenCalledTimes(1);
  });

  it("propagates a thrown network error (no Response to return)", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(
      probeMediaUrlThrottled("/media/v1/abc/thumbnail", {}),
    ).rejects.toThrow(/offline/);
  });
});

describe("fetch abort signal propagation", () => {
  it("propage le signal abort du caller au fetch (stream)", async () => {
    const fetchMock = jest.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          const sig = init?.signal;
          if (!sig) return;
          const onAbort = () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          };
          if (sig.aborted) onAbort();
          else sig.addEventListener("abort", onAbort);
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    // on appelle la version non-throttled pour eviter les retries qui
    // multiplient les calls fetch et brouillent l'assertion
    const controller = new AbortController();
    const pending = streamMediaToRenderableUri(
      "/media/v1/abc/blob",
      "token",
      controller.signal,
    );
    // simule un unmount du composant pendant que le fetch est en l'air
    setTimeout(() => controller.abort(), 5);
    await expect(pending).rejects.toThrow(/abort/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callInit = fetchMock.mock.calls[0][1] as
      | { signal?: AbortSignal }
      | undefined;
    expect(callInit?.signal).toBeDefined();
  });

  it("propage le signal abort du caller au fetch (probe)", async () => {
    const fetchMock = jest.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          const sig = init?.signal;
          if (!sig) return;
          const onAbort = () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          };
          if (sig.aborted) onAbort();
          else sig.addEventListener("abort", onAbort);
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const controller = new AbortController();
    const pending = probeMediaUrlThrottled(
      "/media/v1/abc/thumbnail",
      {},
      controller.signal,
    );
    setTimeout(() => controller.abort(), 5);
    await expect(pending).rejects.toThrow(/abort/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("declenche un abort apres le timeout interne sur le stream", async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          const sig = init?.signal;
          if (!sig) return;
          const onAbort = () => {
            const err = new Error("aborted by timeout");
            err.name = "AbortError";
            reject(err);
          };
          if (sig.aborted) onAbort();
          else sig.addEventListener("abort", onAbort);
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    // version non-throttled pour eviter les retries qui consommeraient
    // chacun un timeout 15s
    const pending = streamMediaToRenderableUri(
      "/media/v1/abc/blob",
      "token",
    );
    // catch en avance pour eviter unhandled rejection avant l'advance timers
    const settled = pending.catch((err) => err);
    // avance le temps au-dela du timeout interne 15s
    await jest.advanceTimersByTimeAsync(16_000);
    const result = await settled;
    expect(result).toBeInstanceOf(Error);
    expect(String(result)).toMatch(/abort/i);
    jest.useRealTimers();
  });
});
