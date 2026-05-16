/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../../apiBase", () =>
  require("../../../__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);

import { fetchProfilesBatch, BATCH_PROFILES_CHUNK_SIZE } from "../batchFetch";
import { mockResponse } from "../../../__test-utils__/mockFactories";

describe("fetchProfilesBatch", () => {
  it("dedupes ids and posts a single batch", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      mockResponse({
        body: {
          profiles: [{ id: "u-1" }, { id: "u-2" }],
          missing: [],
        },
      }),
    );

    const result = await fetchProfilesBatch<{ id: string }>(
      ["u-1", "u-2", "u-1", ""],
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.test/user/v1/profiles/batch");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ ids: ["u-1", "u-2"] });
    expect(result.profiles).toHaveLength(2);
    expect(result.missing).toHaveLength(0);
  });

  it("returns empty payload without calling fetcher when ids is empty", async () => {
    const fetcher = jest.fn();
    const result = await fetchProfilesBatch([], fetcher);
    expect(result).toEqual({ profiles: [], missing: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("splits ids in chunks of 100 and aggregates results", async () => {
    const ids = Array.from(
      { length: BATCH_PROFILES_CHUNK_SIZE + 50 },
      (_, i) => `u-${i}`,
    );
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          body: {
            profiles: ids
              .slice(0, BATCH_PROFILES_CHUNK_SIZE)
              .map((id) => ({ id })),
            missing: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: {
            profiles: ids
              .slice(BATCH_PROFILES_CHUNK_SIZE)
              .map((id) => ({ id })),
            missing: ["u-extra"],
          },
        }),
      );

    const result = await fetchProfilesBatch<{ id: string }>(ids, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.profiles).toHaveLength(ids.length);
    expect(result.missing).toEqual(["u-extra"]);
  });

  it("fallback per-id sur erreur HTTP batch : recupere les profils valides", async () => {
    // 1er appel = batch -> 400, 2e et 3e = per-id -> reussite pour "a", echec pour "b"
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 400 })) // batch fail
      .mockResolvedValueOnce(mockResponse({ body: { id: "a" }, status: 200 })) // per-id "a" ok
      .mockResolvedValueOnce(mockResponse({ status: 404 })); // per-id "b" not found

    const result = await fetchProfilesBatch<{ id: string }>(
      ["a", "b"],
      fetcher,
    );

    // doit avoir tente le batch (1 fois) puis 2 per-id
    expect(fetcher).toHaveBeenCalledTimes(3);
    // "a" recupere, "b" missing
    expect(result.profiles).toHaveLength(1);
    expect((result.profiles[0] as any).id).toBe("a");
    expect(result.missing).toEqual(["b"]);
  });

  it("fallback per-id sur erreur reseau batch : tous missing si per-id echoue aussi", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("network"));

    const result = await fetchProfilesBatch(["a", "b"], fetcher);
    expect(result.profiles).toEqual([]);
    expect(result.missing.sort()).toEqual(["a", "b"]);
  });

  it("fallback per-id : batch 400 puis per-id tous ok", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 400 }))
      .mockResolvedValueOnce(mockResponse({ body: { id: "x" }, status: 200 }))
      .mockResolvedValueOnce(mockResponse({ body: { id: "y" }, status: 200 }));

    const result = await fetchProfilesBatch<{ id: string }>(
      ["x", "y"],
      fetcher,
    );
    expect(result.profiles).toHaveLength(2);
    expect(result.missing).toHaveLength(0);
  });
});
