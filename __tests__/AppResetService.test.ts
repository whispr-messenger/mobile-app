/* eslint-disable @typescript-eslint/no-explicit-any */

const mockGetAllKeys = jest.fn<Promise<string[]>, []>();
const mockMultiRemove = jest.fn<Promise<void>, [string[]]>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getAllKeys: (...args: any[]) => mockGetAllKeys(...args),
    multiRemove: (...args: any[]) => mockMultiRemove(...args),
  },
}));

const mockClearAll = jest.fn<Promise<void>, []>();
jest.mock("../src/services/TokenService", () => ({
  TokenService: {
    clearAll: (...args: any[]) => mockClearAll(...args),
  },
}));

import { AppResetService } from "../src/services/AppResetService";

beforeEach(() => {
  mockGetAllKeys.mockReset();
  mockMultiRemove.mockReset();
  mockClearAll.mockReset();
  mockMultiRemove.mockResolvedValue(undefined);
  mockClearAll.mockResolvedValue(undefined);
});

describe("AppResetService.resetAppData (WHISPR-1221)", () => {
  it("removes every whispr-prefixed key, preserves theme/language, ignores third-party keys", async () => {
    mockGetAllKeys.mockResolvedValue([
      // ours — all should be removed
      "whispr.profile.v1",
      "whispr.conversations.cache",
      "whispr.conversations.cache.timestamp",
      "whispr.offline.message.queue",
      "whispr.device.id",
      "whispr.signal.identityKeyPrivate",
      "whispr.auth.accessToken",
      "@whispr/manually_unread_ids",
      "@whispr/profile_setup_done",
      "@whispr/pending_avatar_media_id:user-123",
      "@whispr_settings_app",
      "@whispr_settings_messaging",
      "@whispr_settings_notifications",
      "@whispr_settings_privacy",
      "@whispr_settings_security",
      // preserved
      "whispr.globalSettings.v1",
      // third-party — must NOT be touched
      "expo-storage:abc",
      "metro-cache-key",
      "RCTFollowPropertyAccessKey",
    ]);

    await AppResetService.resetAppData();

    expect(mockMultiRemove).toHaveBeenCalledTimes(1);
    const removed = mockMultiRemove.mock.calls[0][0].sort();
    expect(removed).not.toContain("whispr.globalSettings.v1");
    expect(removed).not.toContain("expo-storage:abc");
    expect(removed).not.toContain("metro-cache-key");
    expect(removed).not.toContain("RCTFollowPropertyAccessKey");
    expect(removed).toContain("@whispr_settings_privacy");
    expect(removed).toContain("@whispr/manually_unread_ids");
    expect(removed).toContain("whispr.signal.identityKeyPrivate");
    expect(removed).toContain("whispr.auth.accessToken");
    expect(removed).toContain("whispr.offline.message.queue");
    expect(removed).toContain("@whispr/pending_avatar_media_id:user-123");
  });

  it("calls TokenService.clearAll() to wipe SecureStore-backed values", async () => {
    mockGetAllKeys.mockResolvedValue([]);

    await AppResetService.resetAppData();

    expect(mockClearAll).toHaveBeenCalledTimes(1);
  });

  it("skips multiRemove when no owned keys exist (avoids the empty-array warning)", async () => {
    mockGetAllKeys.mockResolvedValue([
      "expo-storage:abc",
      "RCTFollowPropertyAccessKey",
    ]);

    await AppResetService.resetAppData();

    expect(mockMultiRemove).not.toHaveBeenCalled();
    expect(mockClearAll).toHaveBeenCalledTimes(1);
  });

  it("still wipes tokens when AsyncStorage.getAllKeys throws", async () => {
    mockGetAllKeys.mockRejectedValue(new Error("storage broken"));

    await AppResetService.resetAppData();

    // Failure on the bulk-remove path must not block the secure-store cleanup.
    expect(mockClearAll).toHaveBeenCalledTimes(1);
    expect(mockMultiRemove).not.toHaveBeenCalled();
  });

  it("preserves keys with tricky prefixes that overlap whispr (defense in depth)", async () => {
    mockGetAllKeys.mockResolvedValue([
      // looks like ours but isn't (no prefix match: starts with "wh", not "whispr.")
      "whisperGarden",
      "whispr",
    ]);

    await AppResetService.resetAppData();

    // "whispr" alone has no dot/at-suffix — should be skipped (prefix is "whispr.").
    if (mockMultiRemove.mock.calls.length > 0) {
      const removed = mockMultiRemove.mock.calls[0][0];
      expect(removed).not.toContain("whisperGarden");
      expect(removed).not.toContain("whispr");
    }
  });
});
