/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  makeTokenPair,
  makeDeviceInfo,
  makeSignalKeyBundle,
} from "./src/__test-utils__/fixtures";
import {
  mockResponse,
  installFetchMock,
} from "./src/__test-utils__/mockFactories";

type AuthServiceType = typeof import("./src/services/AuthService").AuthService;

let AuthService: AuthServiceType;
let mockedToken: any;
let mockedDevice: any;
let mockedSignal: any;
let mockedEmitSessionExpired: jest.Mock;
let mockFetch: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  jest.doMock("./src/services/TokenService", () =>
    require("./src/__test-utils__/mockFactories").makeTokenServiceMock(),
  );
  jest.doMock("./src/services/DeviceService", () =>
    require("./src/__test-utils__/mockFactories").makeDeviceServiceMock(),
  );
  jest.doMock("./src/services/SignalKeyService", () =>
    require("./src/__test-utils__/mockFactories").makeSignalKeyServiceMock(),
  );
  jest.doMock("./src/services/NotificationService", () =>
    require("./src/__test-utils__/mockFactories").makeNotificationServiceMock(),
  );
  jest.doMock("./src/services/sessionEvents", () =>
    require("./src/__test-utils__/mockFactories").makeSessionEventsMock(),
  );
  jest.doMock("./src/services/apiBase", () =>
    require("./src/__test-utils__/mockFactories").makeApiBaseMock(
      "https://api.test",
    ),
  );

  AuthService = require("./src/services/AuthService").AuthService;
  mockedToken = require("./src/services/TokenService").TokenService;
  mockedDevice = require("./src/services/DeviceService").DeviceService;
  mockedSignal = require("./src/services/SignalKeyService").SignalKeyService;
  mockedEmitSessionExpired = require("./src/services/sessionEvents")
    .emitSessionExpired as jest.Mock;

  mockedToken.decodeAccessToken.mockReturnValue({
    sub: "user-1",
    deviceId: "dev-1",
    exp: 0,
  });
  mockedDevice.getDeviceInfo.mockResolvedValue(makeDeviceInfo());
  mockedSignal.generateKeyBundle.mockResolvedValue(
    makeSignalKeyBundle() as any,
  );

  mockFetch = installFetchMock();
});

describe("AuthService.requestVerification", () => {
  it("POSTs the phone number with the correct device-type header", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { verificationId: "v-1" } }),
    );

    await AuthService.requestVerification("+33600000000", "register");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/auth/v1/verify/register/request");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-device-type": "mobile",
    });
    expect(JSON.parse(init.body)).toEqual({ phoneNumber: "+33600000000" });
  });

  it("throws with status and body on a non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        status: 429,
        body: { message: "Too many requests" },
      }),
    );

    await expect(
      AuthService.requestVerification("+33600000000", "register"),
    ).rejects.toMatchObject({
      message: "Too many requests",
      status: 429,
    });
  });

  it("confirmVerification POSTs the code + verification id", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    await AuthService.confirmVerification("v-1", "1234", "login");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/auth/v1/verify/login/confirm");
    expect(JSON.parse(init.body)).toEqual({
      verificationId: "v-1",
      code: "1234",
    });
  });
});

describe("AuthService.register", () => {
  it("sends device info + key bundle and saves tokens", async () => {
    const tokens = makeTokenPair();
    mockFetch.mockResolvedValueOnce(mockResponse({ body: tokens }));

    await expect(AuthService.register("v-1")).resolves.toEqual(tokens);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/auth/v1/register");
    const body = JSON.parse(init.body);
    expect(body.verificationId).toBe("v-1");
    expect(body.deviceId).toBe("dev-1");
    expect(body.signalKeyBundle).toBeDefined();

    expect(mockedToken.saveTokens).toHaveBeenCalledWith(tokens);
  });
});

describe("AuthService.login", () => {
  it("POSTs /login and saves tokens", async () => {
    const tokens = makeTokenPair();
    mockFetch.mockResolvedValueOnce(mockResponse({ body: tokens }));

    await AuthService.login("v-2");

    expect(mockFetch.mock.calls[0][0]).toBe("https://api.test/auth/v1/login");
    expect(mockedToken.saveTokens).toHaveBeenCalledWith(tokens);
  });
});

describe("AuthService.refreshTokens", () => {
  it("refreshes and saves new tokens on success", async () => {
    mockedToken.getRefreshToken.mockResolvedValue("rt");
    const tokens = makeTokenPair();
    mockFetch.mockResolvedValueOnce(mockResponse({ body: tokens }));

    await AuthService.refreshTokens();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/auth/v1/tokens/refresh");
    expect(JSON.parse(init.body)).toEqual({ refreshToken: "rt" });
    expect(mockedToken.saveTokens).toHaveBeenCalledWith(tokens);
  });

  it("dedupes concurrent refresh calls into a single network request", async () => {
    mockedToken.getRefreshToken.mockResolvedValue("rt");
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(mockResponse({ body: makeTokenPair() })),
            10,
          ),
        ),
    );

    await Promise.all([
      AuthService.refreshTokens(),
      AuthService.refreshTokens(),
      AuthService.refreshTokens(),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("emits sessionExpired and throws when there is no refresh token", async () => {
    mockedToken.getRefreshToken.mockResolvedValue(null);

    await expect(AuthService.refreshTokens()).rejects.toThrow(
      "SESSION_EXPIRED",
    );
    expect(mockedEmitSessionExpired).toHaveBeenCalledWith("no_refresh_token");
  });

  it("on 401, clears tokens, emits sessionExpired, marks session dead", async () => {
    mockedToken.getRefreshToken.mockResolvedValue("rt");
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 401, body: { message: "unauthorized" } }),
    );

    await expect(AuthService.refreshTokens()).rejects.toThrow();

    expect(mockedToken.clearTokens).toHaveBeenCalled();
    expect(mockedEmitSessionExpired).toHaveBeenCalledWith("refresh_failed");
  });

  it("once the session is dead, subsequent refreshes fast-fail without network", async () => {
    mockedToken.getRefreshToken.mockResolvedValue(null);
    await expect(AuthService.refreshTokens()).rejects.toThrow();

    mockFetch.mockClear();
    mockedEmitSessionExpired.mockClear();

    await expect(AuthService.refreshTokens()).rejects.toThrow(
      "SESSION_EXPIRED",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("after a successful login, sessionDead is reset", async () => {
    mockedToken.getRefreshToken.mockResolvedValue(null);
    await expect(AuthService.refreshTokens()).rejects.toThrow();

    mockFetch.mockResolvedValueOnce(mockResponse({ body: makeTokenPair() }));
    await AuthService.login("v");

    mockedToken.getRefreshToken.mockResolvedValue("rt");
    mockFetch.mockResolvedValueOnce(mockResponse({ body: makeTokenPair() }));
    await expect(AuthService.refreshTokens()).resolves.toBeUndefined();
  });
});

describe("AuthService.logout", () => {
  it("POSTs /logout with token and clears tokens afterwards", async () => {
    mockedToken.getAccessToken.mockResolvedValue("at");
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));

    await AuthService.logout("dev-1", "user-1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/auth/v1/logout");
    expect(init.headers.Authorization).toBe("Bearer at");
    expect(mockedToken.clearTokens).toHaveBeenCalled();
  });

  it("still clears tokens locally even when the server call fails", async () => {
    mockedToken.getAccessToken.mockResolvedValue("at");
    mockFetch.mockRejectedValueOnce(new Error("network"));

    await AuthService.logout("dev-1", "user-1");

    expect(mockedToken.clearTokens).toHaveBeenCalled();
  });
});

describe("AuthService.validateSession", () => {
  it("returns null when there is no access token", async () => {
    mockedToken.getAccessToken.mockResolvedValue(null);

    await expect(AuthService.validateSession()).resolves.toBeNull();
  });

  it("returns the decoded session when the token is valid", async () => {
    mockedToken.getAccessToken.mockResolvedValue("at");
    mockedToken.isTokenExpired.mockReturnValue(false);
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));

    await expect(AuthService.validateSession()).resolves.toEqual({
      userId: "user-1",
      deviceId: "dev-1",
    });
  });

  it("clears tokens and returns null on 401 from /device", async () => {
    mockedToken.getAccessToken.mockResolvedValue("at");
    mockedToken.isTokenExpired.mockReturnValue(false);
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 401, body: {} }));

    await expect(AuthService.validateSession()).resolves.toBeNull();
    expect(mockedToken.clearTokens).toHaveBeenCalled();
  });

  it("refreshes the token when expired and then resolves the session", async () => {
    mockedToken.getAccessToken
      .mockResolvedValueOnce("expired-at")
      .mockResolvedValueOnce("new-at");
    mockedToken.isTokenExpired.mockReturnValue(true);
    mockedToken.getRefreshToken.mockResolvedValue("rt");
    mockFetch.mockResolvedValueOnce(mockResponse({ body: makeTokenPair() }));

    await expect(AuthService.validateSession()).resolves.toEqual({
      userId: "user-1",
      deviceId: "dev-1",
    });
  });

  it("clears tokens when refresh throws for an expired session", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce("expired-at");
    mockedToken.isTokenExpired.mockReturnValue(true);
    mockedToken.getRefreshToken.mockResolvedValue(null);

    await expect(AuthService.validateSession()).resolves.toBeNull();
    expect(mockedToken.clearTokens).toHaveBeenCalled();
  });

  it("trusts the token locally on a network error", async () => {
    mockedToken.getAccessToken.mockResolvedValue("at");
    mockedToken.isTokenExpired.mockReturnValue(false);
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    await expect(AuthService.validateSession()).resolves.toEqual({
      userId: "user-1",
      deviceId: "dev-1",
    });
  });

  it("returns null when the token payload cannot be decoded", async () => {
    mockedToken.getAccessToken.mockResolvedValue("at");
    mockedToken.isTokenExpired.mockReturnValue(false);
    mockedToken.decodeAccessToken.mockReturnValue(null);
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));

    await expect(AuthService.validateSession()).resolves.toBeNull();
  });
});

describe("AuthService.getWsToken (WHISPR-1214)", () => {
  it("POSTs to /tokens/ws-token with the access token as Bearer", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce("access-bearer");
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { wsToken: "short-jwt", expiresIn: 60 } }),
    );

    const result = await AuthService.getWsToken();

    expect(result).toEqual({ wsToken: "short-jwt", expiresIn: 60 });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/auth/v1/tokens/ws-token");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer access-bearer");
  });

  it("throws a 401-tagged error when no access token is stored", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce(null);

    await expect(AuthService.getWsToken()).rejects.toMatchObject({
      message: "NO_ACCESS_TOKEN",
      status: 401,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("propagates non-OK responses with status (so the WS layer can fall back)", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce("access-bearer");
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 401, body: { message: "expired" } }),
    );

    await expect(AuthService.getWsToken()).rejects.toMatchObject({
      status: 401,
    });
  });
});
