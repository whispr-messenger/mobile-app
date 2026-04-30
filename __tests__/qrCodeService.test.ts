/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../src/services/TokenService", () =>
  require("../src/__test-utils__/mockFactories").makeTokenServiceMock(),
);

jest.mock("../src/services/UserService", () => ({
  UserService: {
    getInstance: jest.fn(),
  },
}));

import { qrCodeService, QRCodeService } from "../src/services/qrCode/qrCodeService";
import { TokenService } from "../src/services/TokenService";
import { UserService } from "../src/services/UserService";

const mockedToken = TokenService as any;
const mockedUserService = UserService as any;

beforeEach(() => {
  mockedToken.getAccessToken.mockReset();
  mockedToken.decodeAccessToken.mockReset();
  mockedUserService.getInstance.mockReset();
});

describe("QRCodeService.generateContactQRCode", () => {
  it("URL-encodes the userId", () => {
    expect(qrCodeService.generateContactQRCode("a/b")).toBe(
      "whispr://contact/add?userId=a%2Fb",
    );
  });
});

describe("QRCodeService.parseQRCodeData", () => {
  it("parses a whispr:// URI with userId param", () => {
    expect(qrCodeService.parseQRCodeData("whispr://contact/add?userId=abc")).toEqual({
      type: "contact",
      userId: "abc",
    });
  });

  it("URL-decodes the userId param", () => {
    expect(
      qrCodeService.parseQRCodeData("whispr://contact/add?userId=a%2Fb"),
    ).toEqual({ type: "contact", userId: "a/b" });
  });

  it("parses a JSON contact payload", () => {
    const json = JSON.stringify({ type: "contact", userId: "u-1" });
    expect(qrCodeService.parseQRCodeData(json)).toEqual({
      type: "contact",
      userId: "u-1",
    });
  });

  it("returns null for invalid JSON", () => {
    expect(qrCodeService.parseQRCodeData("{not-json")).toBeNull();
  });

  it("accepts a bare UUID as userId", () => {
    expect(
      qrCodeService.parseQRCodeData("550e8400-e29b-41d4-a716-446655440000"),
    ).toEqual({ type: "contact", userId: "550e8400-e29b-41d4-a716-446655440000" });
  });

  it("returns null for unrelated strings", () => {
    expect(qrCodeService.parseQRCodeData("hello")).toBeNull();
  });

  it("returns null for whispr:// without userId", () => {
    expect(qrCodeService.parseQRCodeData("whispr://contact/add")).toBeNull();
  });

  it("trims whitespace before parsing", () => {
    expect(
      qrCodeService.parseQRCodeData("  whispr://contact/add?userId=x  "),
    ).toEqual({ type: "contact", userId: "x" });
  });
});

describe("QRCodeService.extractUserId", () => {
  it("returns the userId from a parseable QR string", () => {
    expect(qrCodeService.extractUserId("whispr://contact/add?userId=abc")).toBe(
      "abc",
    );
  });

  it("returns null when not parseable", () => {
    expect(qrCodeService.extractUserId("nope")).toBeNull();
  });
});

describe("QRCodeService.getCurrentUserId", () => {
  it("uses sub from JWT when available", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce("at");
    mockedToken.decodeAccessToken.mockReturnValueOnce({ sub: "user-1" });
    expect(await qrCodeService.getCurrentUserId()).toBe("user-1");
  });

  it("falls back to user profile when token missing", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce(null);
    mockedUserService.getInstance.mockReturnValueOnce({
      getProfile: jest.fn().mockResolvedValue({
        success: true,
        profile: { id: "user-2" },
      }),
    });
    expect(await qrCodeService.getCurrentUserId()).toBe("user-2");
  });

  it("returns null when profile lookup fails", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce(null);
    mockedUserService.getInstance.mockReturnValueOnce({
      getProfile: jest.fn().mockResolvedValue({ success: false }),
    });
    expect(await qrCodeService.getCurrentUserId()).toBeNull();
  });

  it("returns null when an error is thrown", async () => {
    mockedToken.getAccessToken.mockRejectedValueOnce(new Error("boom"));
    expect(await qrCodeService.getCurrentUserId()).toBeNull();
  });
});

describe("QRCodeService.generateMyQRCode", () => {
  it("returns null when no userId could be resolved", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce(null);
    mockedUserService.getInstance.mockReturnValueOnce({
      getProfile: jest.fn().mockResolvedValue({ success: false }),
    });
    expect(await qrCodeService.generateMyQRCode()).toBeNull();
  });

  it("returns a contact URI when userId is resolved", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce("at");
    mockedToken.decodeAccessToken.mockReturnValueOnce({ sub: "abc" });
    expect(await qrCodeService.generateMyQRCode()).toBe(
      "whispr://contact/add?userId=abc",
    );
  });
});

describe("QRCodeService singleton", () => {
  it("getInstance returns the same instance", () => {
    expect(QRCodeService.getInstance()).toBe(QRCodeService.getInstance());
  });
});
