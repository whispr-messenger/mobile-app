/**
 * Unit tests for offlineQueue.drainAll (WHISPR-1060).
 * AsyncStorage is mocked in-memory so we can exercise persistence without
 * hitting native code.
 */

const storage: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => storage[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete storage[key];
  }),
}));

import { offlineQueue, type QueuedMessage } from "../src/services/offlineQueue";

const makeMessage = (
  overrides: Partial<QueuedMessage> = {},
): QueuedMessage => ({
  id: `temp-${overrides.client_random ?? Date.now()}`,
  conversation_id: "conv-1",
  content: "hello",
  message_type: "text",
  client_random: overrides.client_random ?? 1,
  queued_at: "2026-04-22T00:00:00.000Z",
  ...overrides,
});

beforeEach(async () => {
  for (const key of Object.keys(storage)) delete storage[key];
});

describe("offlineQueue.drainAll (WHISPR-1060)", () => {
  it("returns zero counts when the queue is empty", async () => {
    const sendFn = jest.fn();

    const result = await offlineQueue.drainAll(sendFn);

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("sends each message exactly once and removes it from persistence on success", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 11 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 12 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 13 }));
    const sendFn = jest.fn().mockResolvedValue(undefined);

    const result = await offlineQueue.drainAll(sendFn);

    expect(sendFn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ sent: 3, failed: 0 });
    expect(await offlineQueue.getAll()).toEqual([]);
  });

  it("keeps failed messages in the queue and reports the counts", async () => {
    await offlineQueue.enqueue(
      makeMessage({ client_random: 21, content: "ok-1" }),
    );
    await offlineQueue.enqueue(
      makeMessage({ client_random: 22, content: "boom" }),
    );
    await offlineQueue.enqueue(
      makeMessage({ client_random: 23, content: "ok-3" }),
    );
    const sendFn = jest.fn(async (m: QueuedMessage) => {
      if (m.content === "boom") throw new Error("network");
    });

    const result = await offlineQueue.drainAll(sendFn);

    expect(result).toEqual({ sent: 2, failed: 1 });
    const remaining = await offlineQueue.getAll();
    expect(remaining.map((m) => m.client_random)).toEqual([22]);
  });

  it("processes messages sequentially (preserving queue order)", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 31 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 32 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 33 }));
    const order: number[] = [];
    const sendFn = jest.fn(async (m: QueuedMessage) => {
      // Small async gap to catch any accidental parallelism.
      await new Promise((resolve) => setTimeout(resolve, 0));
      order.push(m.client_random);
    });

    await offlineQueue.drainAll(sendFn);

    expect(order).toEqual([31, 32, 33]);
  });

  it("is idempotent: re-running after a full drain is a no-op", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 41 }));
    const sendFn = jest.fn().mockResolvedValue(undefined);

    await offlineQueue.drainAll(sendFn);
    await offlineQueue.drainAll(sendFn);

    expect(sendFn).toHaveBeenCalledTimes(1);
  });
});

describe("offlineQueue.drainAll concurrency lock (WHISPR-1219)", () => {
  it("rejects a concurrent invocation with skipped=true and only sends each message once", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 51 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 52 }));

    let resolveFirst: () => void = () => {};
    const sendFn = jest.fn(
      (_msg: QueuedMessage) =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    // Start the first drain — it will await sendFn for the first message.
    const first = offlineQueue.drainAll(sendFn);
    // Yield so the first drain reaches the `await sendFn(...)`.
    await Promise.resolve();
    await Promise.resolve();

    // Second drain fires while the first is in flight. It must short-circuit.
    const second = await offlineQueue.drainAll(sendFn);
    expect(second).toEqual({ sent: 0, failed: 0, skipped: true });

    // Now let the first drain finish.
    resolveFirst();
    // Resolve any remaining sendFn calls in the loop.
    sendFn.mockImplementation(() => Promise.resolve());
    const firstResult = await first;

    expect(firstResult).toEqual({ sent: 2, failed: 0 });
    // sendFn was called for each of the 2 messages — never doubled by the
    // concurrent call.
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it("releases the lock after a successful drain so the next call can run", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 61 }));
    const sendFn = jest.fn().mockResolvedValue(undefined);

    const first = await offlineQueue.drainAll(sendFn);
    expect(first).toEqual({ sent: 1, failed: 0 });

    // Re-enqueue and drain again — second call must NOT report skipped.
    await offlineQueue.enqueue(makeMessage({ client_random: 62 }));
    const second = await offlineQueue.drainAll(sendFn);
    expect(second.skipped).toBeUndefined();
    expect(second.sent).toBe(1);
  });

  it("releases the lock when sendFn throws synchronously inside the promise", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 71 }));
    // sendFn always rejects → all messages stay pending, but the lock
    // must still be released.
    const sendFn = jest.fn().mockRejectedValue(new Error("network"));
    await offlineQueue.drainAll(sendFn);

    // Subsequent drain: sendFn will succeed this time. If the lock had
    // leaked, this call would short-circuit with skipped=true.
    sendFn.mockResolvedValue(undefined);
    const result = await offlineQueue.drainAll(sendFn);
    expect(result.skipped).toBeUndefined();
    expect(result.sent).toBe(1);
  });
});

describe("offlineQueue.enqueue client_message_id (WHISPR-1219)", () => {
  it("auto-generates a UUID v4 client_message_id when not provided", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 81 }));
    const [persisted] = await offlineQueue.getAll();

    expect(persisted.client_message_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("preserves an explicit client_message_id passed in by the caller", async () => {
    await offlineQueue.enqueue(
      makeMessage({
        client_random: 82,
        client_message_id: "00000000-0000-4000-8000-000000000000",
      }),
    );
    const [persisted] = await offlineQueue.getAll();
    expect(persisted.client_message_id).toBe(
      "00000000-0000-4000-8000-000000000000",
    );
  });

  it("gives different UUIDs to two messages enqueued back-to-back", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 83 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 84 }));
    const [a, b] = await offlineQueue.getAll();
    expect(a.client_message_id).not.toEqual(b.client_message_id);
  });
});

describe("offlineQueue.getAll", () => {
  it("returns an empty array when nothing is persisted", async () => {
    await expect(offlineQueue.getAll()).resolves.toEqual([]);
  });

  it("returns parsed messages when storage has data", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 101 }));
    await expect(offlineQueue.getAll()).resolves.toHaveLength(1);
  });

  it("returns an empty array when persisted JSON is corrupted", async () => {
    storage["whispr.offline.message.queue"] = "not-json";
    await expect(offlineQueue.getAll()).resolves.toEqual([]);
  });
});

describe("offlineQueue.enqueue", () => {
  it("appends a new message", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 201 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 202 }));
    const all = await offlineQueue.getAll();
    expect(all.map((m) => m.client_random)).toEqual([201, 202]);
  });

  it("deduplicates by client_random", async () => {
    await offlineQueue.enqueue(
      makeMessage({ client_random: 300, content: "first" }),
    );
    await offlineQueue.enqueue(
      makeMessage({ client_random: 300, content: "second" }),
    );
    const all = await offlineQueue.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].content).toBe("first");
  });
});

describe("offlineQueue.remove", () => {
  it("removes the matching message", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 401 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 402 }));
    await offlineQueue.remove(401);
    const all = await offlineQueue.getAll();
    expect(all.map((m) => m.client_random)).toEqual([402]);
  });

  it("is a no-op when the message is not in the queue", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 501 }));
    await offlineQueue.remove(999);
    const all = await offlineQueue.getAll();
    expect(all.map((m) => m.client_random)).toEqual([501]);
  });
});

describe("offlineQueue.clearAll", () => {
  it("empties the queue entirely", async () => {
    await offlineQueue.enqueue(makeMessage({ client_random: 601 }));
    await offlineQueue.enqueue(makeMessage({ client_random: 602 }));
    await offlineQueue.clearAll();
    await expect(offlineQueue.getAll()).resolves.toEqual([]);
  });
});

describe("offlineQueue.getForConversation", () => {
  it("filters by conversation_id", async () => {
    await offlineQueue.enqueue(
      makeMessage({ client_random: 701, conversation_id: "conv-a" }),
    );
    await offlineQueue.enqueue(
      makeMessage({ client_random: 702, conversation_id: "conv-b" }),
    );
    await offlineQueue.enqueue(
      makeMessage({ client_random: 703, conversation_id: "conv-a" }),
    );

    const result = await offlineQueue.getForConversation("conv-a");
    expect(result.map((m) => m.client_random)).toEqual([701, 703]);
  });
});
