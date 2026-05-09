/**
 * Tests pour readReceiptsPref - cache local du toggle accuses de lecture.
 *
 * Note : AsyncStorage est mappe sur le mock officiel dans la config Jest
 * (moduleNameMapper). On manipule donc ce mock directement plutot que de
 * le re-mock localement.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  hydrateReadReceiptsPref,
  getReadReceiptsEnabled,
  setReadReceiptsEnabled,
  isReadReceiptsPrefHydrated,
  __resetReadReceiptsPrefForTests,
} from "./src/services/messaging/readReceiptsPref";

const STORAGE_KEY = "@whispr_settings_messaging";

beforeEach(async () => {
  __resetReadReceiptsPrefForTests();
  await AsyncStorage.clear();
});

describe("readReceiptsPref", () => {
  it("retourne true par defaut quand AsyncStorage est vide", async () => {
    const value = await hydrateReadReceiptsPref();
    expect(value).toBe(true);
    expect(getReadReceiptsEnabled()).toBe(true);
    expect(isReadReceiptsPrefHydrated()).toBe(true);
  });

  it("hydrate la valeur depuis le JSON stocke", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ readReceipts: false }),
    );
    const value = await hydrateReadReceiptsPref();
    expect(value).toBe(false);
    expect(getReadReceiptsEnabled()).toBe(false);
  });

  it("ignore les payloads sans champ readReceipts boolean", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ typingIndicator: false }),
    );
    const value = await hydrateReadReceiptsPref();
    expect(value).toBe(true);
  });

  it("garde le defaut true si AsyncStorage throw", async () => {
    const original = AsyncStorage.getItem;
    (AsyncStorage as { getItem: jest.Mock }).getItem = jest
      .fn()
      .mockRejectedValue(new Error("boom"));
    try {
      const value = await hydrateReadReceiptsPref();
      expect(value).toBe(true);
    } finally {
      (AsyncStorage as { getItem: typeof original }).getItem = original;
    }
  });

  it("setReadReceiptsEnabled met a jour le mirror immediatement", () => {
    setReadReceiptsEnabled(false);
    expect(getReadReceiptsEnabled()).toBe(false);
    setReadReceiptsEnabled(true);
    expect(getReadReceiptsEnabled()).toBe(true);
  });
});
