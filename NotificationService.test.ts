/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("./src/services/TokenService", () =>
  require("./src/__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("./src/services/AuthService", () =>
  require("./src/__test-utils__/mockFactories").makeAuthServiceMock(),
);
jest.mock("./src/services/DeviceService", () =>
  require("./src/__test-utils__/mockFactories").makeDeviceServiceMock(),
);
jest.mock("./src/services/apiBase", () =>
  require("./src/__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);

import { NotificationService } from "./src/services/NotificationService";
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

describe("NotificationService.getBadge", () => {
  it("returns the unread_count from the response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { unread_count: 7 } }),
    );

    await expect(NotificationService.getBadge()).resolves.toBe(7);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/notification/api/v1/badge");
  });

  it("defaults to 0 when unread_count is missing or not a number", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    await expect(NotificationService.getBadge()).resolves.toBe(0);
  });
});

describe("NotificationService.getSettings / updateSettings", () => {
  it("GETs the settings for a user", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { push_enabled: true } }),
    );

    const result = await NotificationService.getSettings("user 1/x");

    expect(mockFetch.mock.calls[0][0] as string).toBe(
      "https://api.test/notification/api/settings/user%201%2Fx",
    );
    expect(result).toEqual({ push_enabled: true });
  });

  it("PUTs the partial settings payload", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { push_enabled: false } }),
    );

    await NotificationService.updateSettings("u1", { push_enabled: false });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/notification/api/settings/u1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ push_enabled: false });
  });
});

describe("NotificationService.muteConversation", () => {
  it("POSTs with duration when provided", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await NotificationService.muteConversation("c-1", 3600);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.test/notification/api/conversations/c-1/mute",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ duration: 3600 });
  });

  it("POSTs an empty body when no duration is provided (indefinite mute)", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await NotificationService.muteConversation("c-1");

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({});
  });
});

describe("NotificationService.unmuteConversation", () => {
  it("DELETEs the mute endpoint", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await NotificationService.unmuteConversation("c-1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.test/notification/api/conversations/c-1/mute",
    );
    expect(init.method).toBe("DELETE");
  });
});

describe("NotificationService.registerDevice / unregisterDevice", () => {
  it("POSTs the token with device_id, platform, app_version", async () => {
    const mockedDevice = require("./src/services/DeviceService")
      .DeviceService as any;
    mockedDevice.getOrCreateDeviceId.mockResolvedValue("dev-xyz");
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));

    await NotificationService.registerDevice({
      token: "fcm-tok",
      platform: "android",
      appVersion: "1.2.3",
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/notification/api/v1/devices");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      device_id: "dev-xyz",
      fcm_token: "fcm-tok",
      platform: "android",
      app_version: "1.2.3",
    });
  });

  it("DELETEs /api/v1/devices/:deviceId", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));

    await NotificationService.unregisterDevice("dev-1/2");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/notification/api/v1/devices/dev-1%2F2");
    expect(init.method).toBe("DELETE");
  });
});

describe("NotificationService 401 retry & error handling", () => {
  it("refreshes the token on 401 and retries once", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ status: 401 }))
      .mockResolvedValueOnce(mockResponse({ body: { unread_count: 1 } }));

    await expect(NotificationService.getBadge()).resolves.toBe(1);
    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
  });

  it("propagates an error with status on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 500, body: { message: "crash" } }),
    );

    await expect(NotificationService.getBadge()).rejects.toMatchObject({
      message: "crash",
      status: 500,
    });
  });

  it("falls back to 'HTTP <status>' when the error body has no message", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 503 }));
    await expect(NotificationService.getBadge()).rejects.toThrow("HTTP 503");
  });
});
