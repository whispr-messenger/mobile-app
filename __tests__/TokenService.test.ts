jest.mock("../src/services/storage", () => ({
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}));

import { TokenService } from "../src/services/TokenService";
import { storage } from "../src/services/storage";
import { makeJwt, makeExpiredJwt } from "../src/__test-utils__/fixtures";

const mockedStorage = storage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  deleteItem: jest.Mock;
};

beforeEach(() => {
  mockedStorage.getItem.mockReset().mockResolvedValue(null);
  mockedStorage.setItem.mockReset().mockResolvedValue(undefined);
  mockedStorage.deleteItem.mockReset().mockResolvedValue(undefined);
});

describe("TokenService.saveTokens", () => {
  it("persists both tokens in storage", async () => {
    await TokenService.saveTokens({
      accessToken: "at",
      refreshToken: "rt",
    });

    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      "whispr.auth.accessToken",
      "at",
    );
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      "whispr.auth.refreshToken",
      "rt",
    );
  });
});

describe("TokenService get/clear tokens", () => {
  it("getAccessToken reads from storage", async () => {
    mockedStorage.getItem.mockResolvedValueOnce("token-value");
    await expect(TokenService.getAccessToken()).resolves.toBe("token-value");
    expect(mockedStorage.getItem).toHaveBeenCalledWith(
      "whispr.auth.accessToken",
    );
  });

  it("getRefreshToken reads from storage", async () => {
    mockedStorage.getItem.mockResolvedValueOnce("refresh");
    await expect(TokenService.getRefreshToken()).resolves.toBe("refresh");
    expect(mockedStorage.getItem).toHaveBeenCalledWith(
      "whispr.auth.refreshToken",
    );
  });

  it("clearTokens deletes both token keys", async () => {
    await TokenService.clearTokens();
    expect(mockedStorage.deleteItem).toHaveBeenCalledWith(
      "whispr.auth.accessToken",
    );
    expect(mockedStorage.deleteItem).toHaveBeenCalledWith(
      "whispr.auth.refreshToken",
    );
  });
});

describe("TokenService identity key", () => {
  it("saveIdentityPrivateKey writes to the identity key slot", async () => {
    await TokenService.saveIdentityPrivateKey("base64key");
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      "whispr.signal.identityKeyPrivate",
      "base64key",
    );
  });

  it("getIdentityPrivateKey reads from the identity key slot", async () => {
    mockedStorage.getItem.mockResolvedValueOnce("k");
    await expect(TokenService.getIdentityPrivateKey()).resolves.toBe("k");
    expect(mockedStorage.getItem).toHaveBeenCalledWith(
      "whispr.signal.identityKeyPrivate",
    );
  });

  it("clearIdentityPrivateKey deletes the identity key slot", async () => {
    await TokenService.clearIdentityPrivateKey();
    expect(mockedStorage.deleteItem).toHaveBeenCalledWith(
      "whispr.signal.identityKeyPrivate",
    );
  });

  it("clearAll deletes tokens and identity key in parallel", async () => {
    await TokenService.clearAll();
    expect(mockedStorage.deleteItem).toHaveBeenCalledWith(
      "whispr.auth.accessToken",
    );
    expect(mockedStorage.deleteItem).toHaveBeenCalledWith(
      "whispr.auth.refreshToken",
    );
    expect(mockedStorage.deleteItem).toHaveBeenCalledWith(
      "whispr.signal.identityKeyPrivate",
    );
  });
});

describe("TokenService.decodeAccessToken", () => {
  it("decodes a well-formed JWT payload", () => {
    const token = makeJwt({ sub: "u-1", deviceId: "d-1", exp: 42 });
    const payload = TokenService.decodeAccessToken(token);
    expect(payload).toMatchObject({ sub: "u-1", deviceId: "d-1", exp: 42 });
  });

  it("returns null on a malformed JWT (wrong part count)", () => {
    expect(TokenService.decodeAccessToken("not.a.jwt.really")).toBeNull();
    expect(TokenService.decodeAccessToken("only-one-segment")).toBeNull();
  });

  it("returns null when the payload section is not valid base64url JSON", () => {
    expect(TokenService.decodeAccessToken("a.!!!.c")).toBeNull();
  });
});

describe("TokenService.isTokenExpired", () => {
  it("returns false for a token with exp in the future beyond the 60s buffer", () => {
    const token = makeJwt({
      sub: "u",
      deviceId: "d",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(TokenService.isTokenExpired(token)).toBe(false);
  });

  it("returns true for a token with exp in the past", () => {
    expect(TokenService.isTokenExpired(makeExpiredJwt())).toBe(true);
  });

  it("returns true within the 60s expiry buffer", () => {
    const token = makeJwt({
      sub: "u",
      deviceId: "d",
      exp: Math.floor(Date.now() / 1000) + 30,
    });
    expect(TokenService.isTokenExpired(token)).toBe(true);
  });

  it("returns true when the token is unparseable", () => {
    expect(TokenService.isTokenExpired("garbage")).toBe(true);
  });
});
