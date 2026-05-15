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

import { getFavoriteIds, toggleFavorite } from "../favorites";

beforeEach(() => {
  for (const k of Object.keys(storage)) delete storage[k];
});

describe("getFavoriteIds", () => {
  it("returns an empty set when storage is empty", async () => {
    const ids = await getFavoriteIds();
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(0);
  });

  it("parses the stored JSON array into a Set", async () => {
    storage["whispr_favorite_contacts"] = JSON.stringify(["a", "b", "c"]);
    const ids = await getFavoriteIds();
    expect(Array.from(ids).sort()).toEqual(["a", "b", "c"]);
  });

  it("returns an empty set when the stored JSON is corrupted", async () => {
    storage["whispr_favorite_contacts"] = "{not json";
    const ids = await getFavoriteIds();
    expect(ids.size).toBe(0);
  });
});

describe("toggleFavorite", () => {
  it("adds a new id and returns true", async () => {
    const newState = await toggleFavorite("c-1");
    expect(newState).toBe(true);
    expect(JSON.parse(storage["whispr_favorite_contacts"])).toEqual(["c-1"]);
  });

  it("removes an existing id and returns false", async () => {
    storage["whispr_favorite_contacts"] = JSON.stringify(["c-1", "c-2"]);
    const newState = await toggleFavorite("c-1");
    expect(newState).toBe(false);
    expect(JSON.parse(storage["whispr_favorite_contacts"])).toEqual(["c-2"]);
  });

  it("is idempotent across two toggles", async () => {
    await toggleFavorite("c-1");
    const back = await toggleFavorite("c-1");
    expect(back).toBe(false);
    expect(JSON.parse(storage["whispr_favorite_contacts"])).toEqual([]);
  });
});
