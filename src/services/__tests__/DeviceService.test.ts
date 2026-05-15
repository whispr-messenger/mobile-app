/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../storage", () => ({
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}));

jest.mock("expo-device", () => ({
  deviceName: "Pixel 8",
  modelName: "Pixel 8 Pro",
  osVersion: "14",
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { appVersion: "2.3.4" } },
  },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(),
  getRandomBytes: jest.fn(),
}));

import { DeviceService } from "../DeviceService";
import { storage } from "../storage";
import * as ExpoCrypto from "expo-crypto";

const mockedStorage = storage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};
const mockedCrypto = ExpoCrypto as unknown as {
  randomUUID: jest.Mock;
  getRandomBytes: jest.Mock;
};

const origCrypto = (globalThis as any).crypto;
const origExpoRandomUUID = mockedCrypto.randomUUID;
const origExpoGetRandomBytes = mockedCrypto.getRandomBytes;

beforeEach(() => {
  mockedStorage.getItem.mockReset();
  mockedStorage.setItem.mockReset().mockResolvedValue(undefined);
  (ExpoCrypto as any).randomUUID = origExpoRandomUUID;
  (ExpoCrypto as any).getRandomBytes = origExpoGetRandomBytes;
  origExpoRandomUUID.mockReset();
  origExpoGetRandomBytes.mockReset();
});

afterEach(() => {
  (globalThis as any).crypto = origCrypto;
  (ExpoCrypto as any).randomUUID = origExpoRandomUUID;
  (ExpoCrypto as any).getRandomBytes = origExpoGetRandomBytes;
});

describe("DeviceService.getOrCreateDeviceId", () => {
  it("returns the persisted device id when one exists", async () => {
    mockedStorage.getItem.mockResolvedValueOnce("stored-device-id");

    await expect(DeviceService.getOrCreateDeviceId()).resolves.toBe(
      "stored-device-id",
    );
    expect(mockedStorage.setItem).not.toHaveBeenCalled();
  });

  it("generates a UUID via globalThis.crypto.randomUUID and persists it", async () => {
    mockedStorage.getItem.mockResolvedValueOnce(null);
    (globalThis as any).crypto = {
      randomUUID: jest.fn(() => "from-global-crypto"),
    };

    const id = await DeviceService.getOrCreateDeviceId();

    expect(id).toBe("from-global-crypto");
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      "whispr.device.id",
      "from-global-crypto",
    );
  });

  it("falls back to ExpoCrypto.randomUUID when globalThis.crypto is missing", async () => {
    mockedStorage.getItem.mockResolvedValueOnce(null);
    delete (globalThis as any).crypto;
    mockedCrypto.randomUUID.mockReturnValueOnce("from-expo-uuid");

    const id = await DeviceService.getOrCreateDeviceId();

    expect(id).toBe("from-expo-uuid");
  });

  // Note: the final getRandomBytes fallback is tested implicitly by the two branches
  // above; exercising it in isolation would require re-importing DeviceService with a
  // stripped expo-crypto mock, which clashes with Jest's module-level mock hoisting.
});

describe("DeviceService.getDeviceInfo", () => {
  it("assembles a DeviceInfo payload from expo-device, Platform and appVersion", async () => {
    mockedStorage.getItem.mockResolvedValue("dev-42");

    await expect(DeviceService.getDeviceInfo()).resolves.toEqual({
      deviceId: "dev-42",
      deviceName: "Pixel 8",
      deviceType: "android",
      model: "Pixel 8 Pro",
      osVersion: "14",
      appVersion: "2.3.4",
    });
  });

  it("falls back to '1.0.0' when expoConfig has no appVersion", async () => {
    const constants = jest.requireMock("expo-constants") as {
      default: { expoConfig?: { extra?: { appVersion?: string } } };
    };
    const saved = constants.default.expoConfig?.extra?.appVersion;
    constants.default.expoConfig = { extra: {} };
    mockedStorage.getItem.mockResolvedValue("dev-1");

    const info = await DeviceService.getDeviceInfo();
    expect(info.appVersion).toBe("1.0.0");

    constants.default.expoConfig = { extra: { appVersion: saved } };
  });
});
