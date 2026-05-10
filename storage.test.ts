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

describe("storage on web (must not be reachable)", () => {
  beforeEach(() => {
    (Platform as { OS: string }).OS = "web";
    mockedSecureStore.getItemAsync.mockReset();
    mockedSecureStore.setItemAsync.mockReset();
    mockedSecureStore.deleteItemAsync.mockReset();
  });

  // WHISPR-1399 - Metro doit resolver storage.web.ts (vault chiffre).
  // Si on tombe sur ce module sur web, c est une mauvaise resolution
  // et la cle d identite Signal finirait en clair en localStorage.
  it("throws on getItem to force the .web variant", async () => {
    await expect(storage.getItem("key-1")).rejects.toThrow(/storage\.web\.ts/i);
    expect(mockedSecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it("throws on setItem to force the .web variant", async () => {
    await expect(storage.setItem("key-1", "value-1")).rejects.toThrow(
      /storage\.web\.ts/i,
    );
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("throws on deleteItem to force the .web variant", async () => {
    await expect(storage.deleteItem("key-1")).rejects.toThrow(
      /storage\.web\.ts/i,
    );
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
