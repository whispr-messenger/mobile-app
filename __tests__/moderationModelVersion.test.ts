/**
 * Tests for the moderation model-version preference helpers.
 *
 * Verifies AsyncStorage hydration, persistence on set, synchronous cache
 * reads, and the listener API used by the Settings debug toggle to react to
 * external changes.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_MODERATION_MODEL,
  MODERATION_MODEL_STORAGE_KEY,
  __resetModerationModelVersionForTests,
  getModerationModelVersion,
  getModerationModelVersionSync,
  setModerationModelVersion,
  subscribeModerationModelVersion,
} from "../src/services/moderation/model-version";

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetModerationModelVersionForTests();
});

describe("moderation model-version helpers", () => {
  it("defaults to v2 when AsyncStorage has no stored value", async () => {
    const v = await getModerationModelVersion();
    expect(v).toBe(DEFAULT_MODERATION_MODEL);
    expect(v).toBe("v2");
  });

  it("hydrates from AsyncStorage when a valid value is present", async () => {
    await AsyncStorage.setItem(MODERATION_MODEL_STORAGE_KEY, "v3");
    const v = await getModerationModelVersion();
    expect(v).toBe("v3");
  });

  it("ignores garbage values in storage and keeps the default", async () => {
    await AsyncStorage.setItem(MODERATION_MODEL_STORAGE_KEY, "garbage");
    const v = await getModerationModelVersion();
    expect(v).toBe(DEFAULT_MODERATION_MODEL);
  });

  it("persists and updates the synchronous cache on set", async () => {
    await setModerationModelVersion("v3");
    expect(getModerationModelVersionSync()).toBe("v3");
    expect(await AsyncStorage.getItem(MODERATION_MODEL_STORAGE_KEY)).toBe("v3");
  });

  it("rejects invalid versions at the setter boundary", async () => {
    // @ts-expect-error — deliberately passing an invalid union member.
    await expect(setModerationModelVersion("v99")).rejects.toThrow(/Invalid/);
  });

  it("notifies subscribers when the version changes", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeModerationModelVersion(listener);

    await setModerationModelVersion("v3");
    expect(listener).toHaveBeenCalledWith("v3");

    listener.mockClear();
    unsubscribe();
    await setModerationModelVersion("v2");
    expect(listener).not.toHaveBeenCalled();
  });
});
