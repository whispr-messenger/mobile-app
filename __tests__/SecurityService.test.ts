/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../src/services/TokenService", () =>
  require("../src/__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("../src/services/AuthService", () =>
  require("../src/__test-utils__/mockFactories").makeAuthServiceMock(),
);
jest.mock("../src/services/DeviceService", () =>
  require("../src/__test-utils__/mockFactories").makeDeviceServiceMock(),
);
jest.mock("../src/services/apiBase", () =>
  require("../src/__test-utils__/mockFactories").makeApiBaseMock("https://api.test"),
);

import {
  TwoFactorAuthService,
  DeviceManagerService,
  SignalKeysService,
} from "../src/services/SecurityService";
import { TokenService } from "../src/services/TokenService";
import { AuthService } from "../src/services/AuthService";
import {
  installFetchMock,
  mockResponse,
} from "../src/__test-utils__/mockFactories";

const mockedToken = TokenService as any;
const mockedAuth = AuthService as any;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
  mockedAuth.refreshTokens.mockReset().mockResolvedValue(undefined);
});

describe("TwoFactorAuthService", () => {
  it("setup hits /2fa/setup with POST", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { secret: "S", qr_code_url: "u" } }),
    );
    const res = await TwoFactorAuthService.setup();
    expect(res.secret).toBe("S");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/auth/v1/2fa/setup");
    expect(init.method).toBe("POST");
    expect(init.headers["x-device-type"]).toBe("mobile");
    expect(init.headers["Authorization"]).toBe("Bearer at");
  });

  it("enable sends the code in body", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await TwoFactorAuthService.enable("123456");
    const init = mockFetch.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ code: "123456" });
  });

  it("verify returns tokens from server", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { access_token: "a", refresh_token: "r" } }),
    );
    const res = await TwoFactorAuthService.verify("000000");
    expect(res).toEqual({ access_token: "a", refresh_token: "r" });
  });

  it("disable hits the disable endpoint", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await TwoFactorAuthService.disable("000000");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.test/auth/v1/2fa/disable",
    );
  });

  it("generateBackupCodes returns codes from server", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { backup_codes: ["a", "b"] } }),
    );
    const res = await TwoFactorAuthService.generateBackupCodes();
    expect(res.backup_codes).toEqual(["a", "b"]);
  });

  it("getStatus returns the status payload", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { enabled: true } }));
    const status = await TwoFactorAuthService.getStatus();
    expect(status.enabled).toBe(true);
  });

  it("does NOT send Authorization header when no token", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    await TwoFactorAuthService.getStatus();
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("retries once on 401 by calling refreshTokens", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ status: 401, body: {} }))
      .mockResolvedValueOnce(mockResponse({ body: { enabled: false } }));
    const res = await TwoFactorAuthService.getStatus();
    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
    expect(res.enabled).toBe(false);
  });

  it("does not retry indefinitely on 401", async () => {
    mockFetch.mockResolvedValue(mockResponse({ status: 401, body: { message: "no" } }));
    mockedAuth.refreshTokens.mockResolvedValue(undefined);
    await expect(TwoFactorAuthService.getStatus()).rejects.toThrow();
    // Original + 1 retry only
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws an Error with status when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 400, body: { message: "bad code" } }),
    );
    await expect(TwoFactorAuthService.enable("xx")).rejects.toMatchObject({
      message: "bad code",
    });
  });

  it("throws with HTTP status fallback when body has no message", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500, body: {} }));
    await expect(TwoFactorAuthService.getStatus()).rejects.toThrow("HTTP 500");
  });
});

describe("DeviceManagerService", () => {
  it("listDevices wraps a single device into an array", async () => {
    const single = {
      id: "d1",
      name: "iPhone",
      platform: "ios",
      last_active: "now",
      is_current: true,
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ body: single }));
    const list = await DeviceManagerService.listDevices();
    expect(list).toEqual([single]);
  });

  it("listDevices returns an array as-is", async () => {
    const arr = [{ id: "1" }, { id: "2" }];
    mockFetch.mockResolvedValueOnce(mockResponse({ body: arr }));
    const list = await DeviceManagerService.listDevices();
    expect(list).toEqual(arr);
  });

  it("revokeDevice URL-encodes the deviceId", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await DeviceManagerService.revokeDevice("a/b");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.test/auth/v1/device/a%2Fb",
    );
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("SignalKeysService", () => {
  it("getKeyBundle URL-encodes both ids", async () => {
    const bundle = {
      identity_key: "ik",
      signed_prekey: { key_id: 1, public_key: "p", signature: "s" },
      one_time_prekeys: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ body: bundle }));
    const res = await SignalKeysService.getKeyBundle("user/1", "dev/1");
    expect(res).toEqual(bundle);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.test/auth/v1/signal/keys/user%2F1/devices/dev%2F1",
    );
  });

  it("uploadSignedPrekey reshapes the body to camelCase", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await SignalKeysService.uploadSignedPrekey({
      key_id: 7,
      public_key: "pk",
      signature: "sig",
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ keyId: 7, publicKey: "pk", signature: "sig" });
  });

  it("uploadPrekeys reshapes each entry to camelCase", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await SignalKeysService.uploadPrekeys([
      { key_id: 1, public_key: "a" },
      { key_id: 2, public_key: "b" },
    ]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      preKeys: [
        { keyId: 1, publicKey: "a" },
        { keyId: 2, publicKey: "b" },
      ],
    });
  });

  it("getHealth returns the JSON body", async () => {
    const health = {
      prekeys_remaining: 50,
      signed_prekey_age_days: 10,
      needs_replenishment: false,
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ body: health }));
    const res = await SignalKeysService.getHealth();
    expect(res).toEqual(health);
  });
});
