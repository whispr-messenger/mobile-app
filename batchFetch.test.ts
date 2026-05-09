/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("./src/services/apiBase", () =>
  require("./src/__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);

import {
  fetchProfilesBatch,
  BATCH_PROFILES_CHUNK_SIZE,
} from "./src/services/profile/batchFetch";
import { mockResponse } from "./src/__test-utils__/mockFactories";

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

  it("flags every id of a chunk as missing on HTTP failure", async () => {
    const fetcher = jest.fn().mockResolvedValue(mockResponse({ status: 500 }));

    const result = await fetchProfilesBatch(["a", "b"], fetcher);
    expect(result.profiles).toEqual([]);
    expect(result.missing.sort()).toEqual(["a", "b"]);
  });

  it("flags every id of a chunk as missing when the fetcher throws", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("network"));

    const result = await fetchProfilesBatch(["a", "b"], fetcher);
    expect(result.profiles).toEqual([]);
    expect(result.missing.sort()).toEqual(["a", "b"]);
  });
});
