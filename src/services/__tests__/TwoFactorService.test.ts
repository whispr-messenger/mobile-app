/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("./src/services/TokenService", () =>
  require("./src/__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("./src/services/AuthService", () =>
  require("./src/__test-utils__/mockFactories").makeAuthServiceMock(),
);
jest.mock("./src/services/apiBase", () =>
  require("./src/__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);

import { TwoFactorService } from "./src/services/TwoFactorService";
import { TokenService } from "./src/services/TokenService";
import { AuthService } from "./src/services/AuthService";
import {
  installFetchMock,
  mockResponse,
} from "./src/__test-utils__/mockFactories";

const mockedToken = TokenService as any;
const mockedAuth = AuthService as any;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
  mockedAuth.refreshTokens.mockReset().mockResolvedValue(undefined);
});

describe("TwoFactorService basic endpoints", () => {
  const cases: [string, () => Promise<unknown>, string, string][] = [
    [
      "getStatus",
      () => TwoFactorService.getStatus(),
      "https://api.test/auth/v1/2fa/status",
      "GET",
    ],
    [
      "setup",
      () => TwoFactorService.setup(),
      "https://api.test/auth/v1/2fa/setup",
      "POST",
    ],
    [
      "getRemainingBackupCodes",
      () => TwoFactorService.getRemainingBackupCodes(),
      "https://api.test/auth/v1/2fa/backup-codes/remaining",
      "GET",
    ],
  ];

  it.each(cases)(
    "%s calls the expected endpoint",
    async (_, call, url, method) => {
      mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
      await call();
      const [actualUrl, init] = mockFetch.mock.calls[0];
      expect(actualUrl).toBe(url);
      if (method !== "GET") expect(init.method).toBe(method);
      expect(init.headers.Authorization).toBe("Bearer at");
      expect(init.headers["x-device-type"]).toBe("mobile");
    },
  );
});

describe("TwoFactorService body-bearing endpoints", () => {
  const cases: [string, (t: string) => Promise<unknown>, string][] = [
    ["enable", (t) => TwoFactorService.enable(t), "/2fa/enable"],
    ["disable", (t) => TwoFactorService.disable(t), "/2fa/disable"],
    [
      "getBackupCodes",
      (t) => TwoFactorService.getBackupCodes(t),
      "/2fa/backup-codes",
    ],
    [
      "regenerateBackupCodes",
      (t) => TwoFactorService.regenerateBackupCodes(t),
      "/2fa/backup-codes/regenerate",
    ],
  ];

  it.each(cases)("%s POSTs the token in the body", async (_, call, path) => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    await call("my-code");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`https://api.test/auth/v1${path}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: "my-code" });
  });
});

describe("TwoFactorService 401 auto-retry", () => {
  it("retries exactly once after refreshing tokens on 401", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ status: 401 }))
      .mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    await expect(TwoFactorService.getStatus()).resolves.toEqual({ ok: true });

    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a second time when the retry also returns 401", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ status: 401, body: { message: "still unauth" } }),
    );

    await expect(TwoFactorService.getStatus()).rejects.toMatchObject({
      status: 401,
    });
    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls through to the 401 error when refreshTokens itself throws", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 401 }));
    mockedAuth.refreshTokens.mockRejectedValueOnce(new Error("dead"));

    await expect(TwoFactorService.getStatus()).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("TwoFactorService response handling", () => {
  it("returns undefined on 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await expect(TwoFactorService.disable("t")).resolves.toBeUndefined();
  });

  it("uses the body.message when the server returns an error object", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        status: 400,
        body: { message: "invalid code" },
      }),
    );

    await expect(TwoFactorService.enable("bad")).rejects.toMatchObject({
      message: "invalid code",
      status: 400,
    });
  });

  it("falls back to 'HTTP <status>' when the error body is empty", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        status: 500,
        body: undefined,
      }),
    );

    await expect(TwoFactorService.enable("x")).rejects.toThrow("HTTP 500");
  });

  it("omits the Authorization header when there is no access token", async () => {
    mockedToken.getAccessToken.mockResolvedValue(null);
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));

    await TwoFactorService.getStatus();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});
