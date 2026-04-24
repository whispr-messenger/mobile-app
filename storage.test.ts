/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { storage } from "./src/services/storage";

const mockedSecureStore = SecureStore as unknown as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

describe("storage on native platforms", () => {
  beforeEach(() => {
    (Platform as { OS: string }).OS = "ios";
    mockedSecureStore.getItemAsync.mockReset().mockResolvedValue(null);
    mockedSecureStore.setItemAsync.mockReset().mockResolvedValue(undefined);
    mockedSecureStore.deleteItemAsync.mockReset().mockResolvedValue(undefined);
  });

  it("delegates getItem to SecureStore.getItemAsync", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce("value-1");

    await expect(storage.getItem("key-1")).resolves.toBe("value-1");
    expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith("key-1");
  });

  it("delegates setItem to SecureStore.setItemAsync", async () => {
    await storage.setItem("key-1", "value-1");
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      "key-1",
      "value-1",
    );
  });

  it("delegates deleteItem to SecureStore.deleteItemAsync", async () => {
    await storage.deleteItem("key-1");
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith("key-1");
  });
});

describe("storage on web", () => {
  let getItemSpy: jest.SpyInstance;
  let setItemSpy: jest.SpyInstance;
  let removeItemSpy: jest.SpyInstance;

  beforeEach(() => {
    (Platform as { OS: string }).OS = "web";
    mockedSecureStore.getItemAsync.mockReset();
    mockedSecureStore.setItemAsync.mockReset();
    mockedSecureStore.deleteItemAsync.mockReset();

    (global as any).window = (global as any).window ?? {};
    (global as any).window.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    getItemSpy = jest.spyOn(window.localStorage, "getItem");
    setItemSpy = jest.spyOn(window.localStorage, "setItem");
    removeItemSpy = jest.spyOn(window.localStorage, "removeItem");
  });

  afterEach(() => {
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it("reads from window.localStorage", async () => {
    getItemSpy.mockReturnValueOnce("web-value");
    await expect(storage.getItem("key-1")).resolves.toBe("web-value");
    expect(getItemSpy).toHaveBeenCalledWith("key-1");
    expect(mockedSecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it("writes to window.localStorage", async () => {
    await storage.setItem("key-1", "value-1");
    expect(setItemSpy).toHaveBeenCalledWith("key-1", "value-1");
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("removes from window.localStorage", async () => {
    await storage.deleteItem("key-1");
    expect(removeItemSpy).toHaveBeenCalledWith("key-1");
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("returns null when localStorage.getItem throws", async () => {
    getItemSpy.mockImplementationOnce(() => {
      throw new Error("SecurityError");
    });
    await expect(storage.getItem("key-1")).resolves.toBeNull();
  });

  it("swallows errors in setItem", async () => {
    setItemSpy.mockImplementationOnce(() => {
      throw new Error("QuotaExceeded");
    });
    await expect(storage.setItem("key-1", "value-1")).resolves.toBeUndefined();
  });

  it("swallows errors in deleteItem", async () => {
    removeItemSpy.mockImplementationOnce(() => {
      throw new Error("SecurityError");
    });
    await expect(storage.deleteItem("key-1")).resolves.toBeUndefined();
  });
});
