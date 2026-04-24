/* eslint-disable @typescript-eslint/no-explicit-any */

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

import { cacheService } from "./src/services/messaging/cache";
import type { Conversation } from "./src/types/messaging";

const makeConversation = (id: string): Conversation =>
  ({
    id,
    type: "direct",
    name: `Conv ${id}`,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }) as unknown as Conversation;

beforeEach(() => {
  for (const k of Object.keys(storage)) delete storage[k];
  jest.useRealTimers();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("cacheService.saveConversations", () => {
  it("writes the conversation list and a timestamp to AsyncStorage", async () => {
    const conversations = [makeConversation("c-1"), makeConversation("c-2")];

    await cacheService.saveConversations(conversations);

    expect(JSON.parse(storage["whispr.conversations.cache"])).toHaveLength(2);
    expect(
      Number(storage["whispr.conversations.cache.timestamp"]),
    ).toBeLessThanOrEqual(Date.now());
  });
});

describe("cacheService.getConversations", () => {
  it("returns null when the cache is empty", async () => {
    await expect(cacheService.getConversations()).resolves.toBeNull();
  });

  it("returns the parsed conversations when the cache is fresh", async () => {
    await cacheService.saveConversations([makeConversation("c-1")]);

    const result = await cacheService.getConversations();
    expect(result).toHaveLength(1);
    expect(result?.[0].id).toBe("c-1");
  });

  it("returns null when the cache is older than 5 minutes", async () => {
    await cacheService.saveConversations([makeConversation("c-1")]);
    // Backdate the timestamp beyond the 5 min TTL
    storage["whispr.conversations.cache.timestamp"] = String(
      Date.now() - 6 * 60 * 1000,
    );

    await expect(cacheService.getConversations()).resolves.toBeNull();
  });

  it("returns null when the cached JSON is corrupted", async () => {
    storage["whispr.conversations.cache"] = "not-valid-json";
    storage["whispr.conversations.cache.timestamp"] = String(Date.now());

    await expect(cacheService.getConversations()).resolves.toBeNull();
  });
});

describe("cacheService.clearCache", () => {
  it("removes both cache keys", async () => {
    await cacheService.saveConversations([makeConversation("c-1")]);
    await cacheService.clearCache();

    expect(storage["whispr.conversations.cache"]).toBeUndefined();
    expect(storage["whispr.conversations.cache.timestamp"]).toBeUndefined();
  });
});
