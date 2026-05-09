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
jest.mock("./src/utils", () => ({
  normalizeUsername: jest.fn((u: string) => u.toLowerCase().trim()),
}));

import { UserService } from "./src/services/UserService";
import { TokenService } from "./src/services/TokenService";
import { AuthService } from "./src/services/AuthService";
import {
  installFetchMock,
  mockResponse,
} from "./src/__test-utils__/mockFactories";

const mockedToken = TokenService as any;
const mockedAuth = AuthService as any;
let mockFetch: jest.Mock;
const service = UserService.getInstance();

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
  mockedToken.decodeAccessToken
    .mockReset()
    .mockReturnValue({ sub: "user-1", deviceId: "dev-1", exp: 0 });
  mockedAuth.refreshTokens.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("UserService.getInstance", () => {
  it("returns the same instance on every call", () => {
    expect(UserService.getInstance()).toBe(service);
  });
});

describe("UserService.getProfile", () => {
  it("GETs /profile/me with a Bearer token and normalizes the response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          id: "u-1",
          firstName: "Ada",
          profilePictureUrl: "https://cdn/avatar.png",
        },
      }),
    );

    const result = await service.getProfile();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/user/v1/profile/me");
    expect(init.headers.Authorization).toBe("Bearer at");
    expect(result.success).toBe(true);
    expect(result.profile?.firstName).toBe("Ada");
    expect(result.profile?.profilePicture).toBe("https://cdn/avatar.png");
    expect(result.profile?.isOnline).toBe(true);
  });

  it("returns an error message on a non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));

    const result = await service.getProfile();
    expect(result.success).toBe(false);
    expect(result.message).toContain("500");
  });

  it("refreshes the token on 401 and retries once", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ status: 401 }))
      .mockResolvedValueOnce(
        mockResponse({ body: { id: "u-1", firstName: "Grace" } }),
      );

    const result = await service.getProfile();

    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it("throws with a fallback message when the fetch rejects", async () => {
    mockFetch.mockRejectedValueOnce(new Error("boom"));
    const result = await service.getProfile();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/récupérer/);
  });
});

describe("UserService.getUserProfile", () => {
  it("GETs /profile/:id with an encoded id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "other-user" } }),
    );

    const result = await service.getUserProfile("other user/with slash");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.test/user/v1/profile/other%20user%2Fwith%20slash",
    );
    expect(result.success).toBe(true);
  });

  it("maps profilePictureUrl onto profilePicture when missing", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: { id: "u", profilePictureUrl: "https://cdn/x.png" },
      }),
    );

    const result = await service.getUserProfile("u");
    expect((result.profile as any).profilePicture).toBe("https://cdn/x.png");
  });

  it("returns an auth error when there is no access token", async () => {
    mockedToken.getAccessToken.mockResolvedValue(null);
    const result = await service.getUserProfile("u");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/authentifié/);
  });
});

describe("UserService.updateProfile", () => {
  it("rejects a firstName shorter than 2 characters", async () => {
    const result = await service.updateProfile({ firstName: "a" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("2 caractères");
  });

  it("rejects a biography longer than 500 characters", async () => {
    const result = await service.updateProfile({
      biography: "x".repeat(501),
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("500");
  });

  it("PATCHes when validation passes and normalizes the response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u", firstName: "Ada" } }),
    );
    const result = await service.updateProfile({ firstName: "Ada" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/user/v1/profile/user-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ firstName: "Ada" });
    expect(result.success).toBe(true);
    expect(result.profile?.firstName).toBe("Ada");
  });

  it("extracts the server error message on failure", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        status: 400,
        body: { message: "username taken" },
      }),
    );
    const result = await service.updateProfile({ firstName: "Ada" });
    expect(result.success).toBe(false);
    expect(result.message).toBe("username taken");
  });
});

describe("UserService.updateProfilePicture", () => {
  it("PATCHes only the avatarMediaId", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { id: "u" } }));
    await service.updateProfilePicture("media-1");

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ avatarMediaId: "media-1" });
  });
});

describe("UserService.visualPreferences", () => {
  it("PATCHes visual preferences as a dedicated nested payload", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          id: "u",
          visualPreferences: {
            theme: "light",
            updatedAt: "2026-05-03T12:00:00.000Z",
          },
        },
      }),
    );

    const result = await service.updateVisualPreferences({
      theme: "light",
      updatedAt: "2026-05-03T12:00:00.000Z",
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      visualPreferences: {
        theme: "light",
        updatedAt: "2026-05-03T12:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
    expect(result.profile?.visualPreferences?.theme).toBe("light");
  });

  it("sends a custom background reset with a backend timestamp", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { id: "u" } }));
    await service.updateProfileBackground(null, null);

    const [, init] = mockFetch.mock.calls[0];
    const parsed = JSON.parse(init.body);
    expect(parsed.backgroundMediaId).toBeNull();
    expect(parsed.backgroundMediaUrl).toBeNull();
    expect(parsed.visualPreferences).toMatchObject({
      backgroundPreset: "whispr",
      backgroundMediaId: null,
      backgroundMediaUrl: null,
    });
    expect(typeof parsed.visualPreferences.updatedAt).toBe("string");
  });
});

describe("UserService.updateUsername", () => {
  it("rejects usernames shorter than 3 characters", async () => {
    const result = await service.updateUsername("ab");
    expect(result.success).toBe(false);
    expect(result.message).toContain("3 caractères");
  });

  it("rejects usernames that contain invalid characters", async () => {
    const result = await service.updateUsername("Bad-Name");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/lettres/);
  });

  it("rejects usernames longer than 20 characters", async () => {
    const result = await service.updateUsername("a".repeat(21));
    expect(result.success).toBe(false);
    expect(result.message).toContain("20");
  });

  it("PATCHes with the normalized username on success", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { id: "u" } }));
    await service.updateUsername("Ada_99");

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ username: "ada_99" });
  });
});

describe("UserService.getPrivacySettings", () => {
  it("falls back to sensible defaults when the server omits fields", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    const result = await service.getPrivacySettings();

    expect(result.success).toBe(true);
    expect(result.settings).toMatchObject({
      profilePictureVisibility: "everyone",
      phoneNumberSearch: "everyone",
      searchVisibility: true,
    });
  });

  it("reads back values from the new snake-case backend", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          profilePicturePrivacy: "contacts",
          firstNamePrivacy: "nobody",
          searchByUsername: false,
          searchByPhone: "contacts",
        },
      }),
    );
    const result = await service.getPrivacySettings();
    expect(result.settings?.profilePictureVisibility).toBe("contacts");
    expect(result.settings?.firstNameVisibility).toBe("nobody");
    expect(result.settings?.searchVisibility).toBe(false);
    expect(result.settings?.phoneNumberSearch).toBe("contacts");
  });

  it("reads the lastSeen, onlineStatus and groupAdd fields", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          lastSeenPrivacy: "contacts",
          onlineStatus: "nobody",
          groupAddPermission: "contacts",
        },
      }),
    );
    const result = await service.getPrivacySettings();
    expect(result.settings?.lastSeenVisibility).toBe("contacts");
    expect(result.settings?.onlineStatusVisibility).toBe("nobody");
    expect(result.settings?.groupAddPermission).toBe("contacts");
  });

  it("returns an error on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    const result = await service.getPrivacySettings();
    expect(result.success).toBe(false);
  });
});

describe("UserService.updatePrivacySettings", () => {
  it("maps the client-side privacy payload to the backend shape", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    await service.updatePrivacySettings({
      profilePictureVisibility: "contacts",
      firstNameVisibility: "everyone",
      lastNameVisibility: "nobody",
      biographyVisibility: "everyone",
      lastSeenVisibility: "contacts",
      onlineStatusVisibility: "nobody",
      groupAddPermission: "contacts",
      searchVisibility: true,
      phoneNumberSearch: "nobody",
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      profilePicturePrivacy: "contacts",
      firstNamePrivacy: "everyone",
      lastNamePrivacy: "nobody",
      biographyPrivacy: "everyone",
      lastSeenPrivacy: "contacts",
      onlineStatus: "nobody",
      groupAddPermission: "contacts",
      searchByPhone: false,
      searchByUsername: true,
    });
  });
});

describe("UserService.changePhoneNumber", () => {
  it("rejects obviously invalid phone numbers", async () => {
    const result = await service.changePhoneNumber("123");
    expect(result.success).toBe(false);
  });

  it("rejects non-French formatted numbers", async () => {
    const result = await service.changePhoneNumber("+441234567890");
    expect(result.success).toBe(false);
  });

  it("accepts a valid French number and PATCHes", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u", phoneNumber: "+33600000000" } }),
    );
    const result = await service.changePhoneNumber("+33600000000");

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ phoneNumber: "+33600000000" });
    expect(result.success).toBe(true);
  });
});

describe("UserService.bootstrapAccount", () => {
  it("POSTs the userId + phoneNumber and reports success", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    const result = await service.bootstrapAccount("u", "+33600000000");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/user/v1/account/bootstrap");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      userId: "u",
      phoneNumber: "+33600000000",
    });
    expect(result.success).toBe(true);
  });

  it("reports failure on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 503 }));
    const result = await service.bootstrapAccount("u", "+33600000000");
    expect(result.success).toBe(false);
  });

  it("reports failure when the fetch rejects", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const result = await service.bootstrapAccount("u", "+33600000000");
    expect(result.success).toBe(false);
  });
});

describe("UserService.authFetch guards", () => {
  it("throws when no access token is available", async () => {
    mockedToken.getAccessToken.mockResolvedValue(null);
    const result = await service.getProfile();
    expect(result.success).toBe(false);
  });

  it("throws when the access token cannot be decoded", async () => {
    mockedToken.decodeAccessToken.mockReturnValue(null);
    const result = await service.getProfile();
    expect(result.success).toBe(false);
  });
});
