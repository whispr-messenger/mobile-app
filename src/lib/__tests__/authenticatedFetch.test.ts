/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock("../../services/TokenService", () =>
  require("../../__test-utils__/mockFactories").makeTokenServiceMock(),
);

const mockEmitSessionExpired = jest.fn();
jest.mock("../../services/sessionEvents", () => ({
  emitSessionExpired: (...args: unknown[]) => mockEmitSessionExpired(...args),
}));

import { authenticatedFetch, HttpError } from "../authenticatedFetch";
import { TokenService } from "../../services/TokenService";
import {
  installFetchMock,
  mockResponse,
} from "../../__test-utils__/mockFactories";

const mockedToken = TokenService as any;

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
  mockEmitSessionExpired.mockReset();
});

const jsonResponse = (body: unknown, status = 200) => {
  const res = mockResponse({ status, body });
  // mockResponse doesn't ship a headers object — wire one in for the
  // content-type sniffing in authenticatedFetch.
  (res as any).headers = {
    get: (key: string) =>
      key.toLowerCase() === "content-type" ? "application/json" : null,
  };
  return res;
};

const textResponse = (text: string, status = 200) => {
  const res = mockResponse({ status, textBody: text });
  (res as any).headers = {
    get: (key: string) =>
      key.toLowerCase() === "content-type" ? "text/plain" : null,
  };
  return res;
};

describe("authenticatedFetch", () => {
  it("injects Authorization Bearer header when a token is available", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await authenticatedFetch("https://api.test/u");

    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer at");
  });

  it("omits the Authorization header when no token is available", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await authenticatedFetch("https://api.test/u");

    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("uses an injected getToken override when provided (test seam)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const getToken = jest.fn().mockResolvedValue("override");

    await authenticatedFetch("https://api.test/u", { getToken });

    expect(getToken).toHaveBeenCalled();
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer override",
    );
    expect(mockedToken.getAccessToken).not.toHaveBeenCalled();
  });

  it("defaults Content-Type to application/json when a body is provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await authenticatedFetch("https://api.test/u", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
    });

    expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("does not override an explicit Content-Type", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await authenticatedFetch("https://api.test/u", {
      method: "POST",
      body: "rawform",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("parses a JSON response body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ hello: "world" }));

    const data = await authenticatedFetch<{ hello: string }>(
      "https://api.test/u",
    );

    expect(data).toEqual({ hello: "world" });
  });

  it("returns text when the response is not JSON", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("plain body"));

    const data = await authenticatedFetch<string>("https://api.test/u");

    expect(data).toBe("plain body");
  });

  it("throws HttpError carrying status + body on a non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "nope" }, 500));

    let caught: any;
    try {
      await authenticatedFetch("https://api.test/u");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(HttpError);
    expect(caught.status).toBe(500);
    expect(caught.body).toEqual({ message: "nope" });
  });

  it("emits sessionExpired on a 401 response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "unauth" }, 401));

    await expect(authenticatedFetch("https://api.test/u")).rejects.toThrow();

    expect(mockEmitSessionExpired).toHaveBeenCalledWith(
      "authenticated_fetch_401",
    );
  });

  it("does not emit sessionExpired on other 4xx codes", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "bad" }, 400));

    await expect(authenticatedFetch("https://api.test/u")).rejects.toThrow();

    expect(mockEmitSessionExpired).not.toHaveBeenCalled();
  });
});
