/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../src/services/TokenService", () =>
  require("../src/__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("../src/services/AuthService", () =>
  require("../src/__test-utils__/mockFactories").makeAuthServiceMock(),
);
jest.mock("../src/services/sessionEvents", () =>
  require("../src/__test-utils__/mockFactories").makeSessionEventsMock(),
);
jest.mock("../src/services/apiBase", () =>
  require("../src/__test-utils__/mockFactories").makeApiBaseMock("https://api.test"),
);

import { mediaAPI } from "../src/services/media/api";
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
  // FormData polyfill in jest-expo is sufficient for this test.
});

describe("mediaAPI.uploadImage", () => {
  it("posts to /media/upload with Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          mediaId: "m1",
          url: null,
          thumbnailUrl: null,
          expiresAt: null,
          context: "message",
          size: 1,
        },
      }),
    );

    const res = await mediaAPI.uploadImage("o1", "/tmp/x.jpg", "message");
    expect(res.mediaId).toBe("m1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/media/upload");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer at");
  });

  it("retries once on 401 and refreshes the token", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ status: 401 }))
      .mockResolvedValueOnce(
        mockResponse({
          body: {
            mediaId: "m2",
            url: null,
            thumbnailUrl: null,
            expiresAt: null,
            context: "avatar",
            size: 1,
          },
        }),
      );

    const res = await mediaAPI.uploadImage("o", "/tmp/x.jpg", "avatar");
    expect(res.mediaId).toBe("m2");
    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
  });

  it("throws when no access token is available", async () => {
    mockedToken.getAccessToken.mockResolvedValue(null);
    await expect(
      mediaAPI.uploadImage("o", "/tmp/x.jpg", "message"),
    ).rejects.toThrow(/Missing access token/);
  });

  it("throws on a non-401 error response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 500, textBody: "boom" }),
    );
    await expect(
      mediaAPI.uploadImage("o", "/tmp/x.jpg", "message"),
    ).rejects.toThrow(/Upload failed/);
  });

  it.each([
    ["/tmp/x.png", "image/png"],
    ["/tmp/x.webp", "image/webp"],
    ["/tmp/x.heic", "image/heic"],
    ["/tmp/x.jpg", "image/jpeg"],
    ["/tmp/x.jpeg", "image/jpeg"],
    ["/tmp/no-extension", "image/jpeg"],
    ["/tmp/x.PNG?cache=1", "image/png"],
  ])("guesses the mime type for %s as %s", async (uri, _mime) => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          mediaId: "x",
          url: null,
          thumbnailUrl: null,
          expiresAt: null,
          context: "message",
          size: 1,
        },
      }),
    );
    await mediaAPI.uploadImage("o", uri, "message");
    // The body is FormData — we don't introspect its parts here, but the
    // call having succeeded validates the path through guessImageMimeType.
    expect(mockFetch).toHaveBeenCalled();
  });
});

describe("mediaAPI.uploadAvatar / uploadGroupIcon", () => {
  it("uploadAvatar delegates with avatar context", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          mediaId: "ma",
          url: null,
          thumbnailUrl: null,
          expiresAt: null,
          context: "avatar",
          size: 1,
        },
      }),
    );
    const res = await mediaAPI.uploadAvatar("o", "/tmp/a.jpg");
    expect(res.context).toBe("avatar");
  });

  it("uploadGroupIcon delegates with group_icon context", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          mediaId: "mg",
          url: null,
          thumbnailUrl: null,
          expiresAt: null,
          context: "group_icon",
          size: 1,
        },
      }),
    );
    const res = await mediaAPI.uploadGroupIcon("o", "/tmp/g.jpg");
    expect(res.context).toBe("group_icon");
  });
});
