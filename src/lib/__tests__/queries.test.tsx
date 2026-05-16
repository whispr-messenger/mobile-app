/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock("../../services/TokenService", () =>
  require("../../__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("../../services/sessionEvents", () => ({
  emitSessionExpired: jest.fn(),
}));

import { renderHook, waitFor } from "@testing-library/react-native";
import { z } from "zod";
import { useAuthenticatedMutation, useAuthenticatedQuery } from "../queries";
import { TokenService } from "../../services/TokenService";
import {
  installFetchMock,
  mockResponse,
} from "../../__test-utils__/mockFactories";
import { makeQueryWrapper } from "../../__test-utils__/queryWrapper";

const mockedToken = TokenService as any;

const jsonResponse = (body: unknown, status = 200) => {
  const res = mockResponse({ status, body });
  (res as any).headers = {
    get: (k: string) =>
      k.toLowerCase() === "content-type" ? "application/json" : null,
  };
  return res;
};

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
});

describe("useAuthenticatedQuery", () => {
  it("fetches the URL and exposes the typed payload", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "u-1" }));
    const { wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAuthenticatedQuery<{ id: string }>({
          queryKey: ["x"],
          url: "https://api.test/x",
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "u-1" });
  });

  it("validates the response with the supplied Zod schema", async () => {
    const Schema = z.object({ id: z.string(), age: z.number() });
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "u-1", age: 42 }));
    const { wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAuthenticatedQuery({
          queryKey: ["x"],
          url: "https://api.test/x",
          schema: Schema,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "u-1", age: 42 });
  });

  it("propagates a Zod validation error as a query failure", async () => {
    const Schema = z.object({ id: z.string(), age: z.number() });
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "u-1" })); // missing age
    const { wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAuthenticatedQuery({
          queryKey: ["x"],
          url: "https://api.test/x",
          schema: Schema,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("respects enabled:false", async () => {
    const { wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAuthenticatedQuery<{ id: string }>({
          queryKey: ["x"],
          url: "https://api.test/x",
          enabled: false,
        }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useAuthenticatedMutation", () => {
  it("invokes request() to compute URL+options and returns parsed payload", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, id: "c-1" }));
    const { wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAuthenticatedMutation<{ name: string }, { ok: boolean; id: string }>(
          {
            request: (vars) => ({
              url: "https://api.test/contacts",
              options: { method: "POST", body: JSON.stringify(vars) },
            }),
          },
        ),
      { wrapper },
    );

    const data = await result.current.mutateAsync({ name: "Alice" });

    expect(mockFetch.mock.calls[0][0]).toBe("https://api.test/contacts");
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      name: "Alice",
    });
    expect(data).toEqual({ ok: true, id: "c-1" });
    await waitFor(() =>
      expect(result.current.data).toEqual({ ok: true, id: "c-1" }),
    );
  });

  it("validates mutation response with a Zod schema", async () => {
    const Schema = z.object({ ok: z.boolean(), id: z.string() });
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, id: "c-1" }));
    const { wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAuthenticatedMutation<void, { ok: boolean; id: string }>({
          request: () => ({
            url: "https://api.test/c",
            options: { method: "POST" },
          }),
          schema: Schema,
        }),
      { wrapper },
    );

    const data = await result.current.mutateAsync(undefined as any);
    expect(data).toEqual({ ok: true, id: "c-1" });
  });

  it("surfaces an HttpError on non-2xx", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "bad" }, 400));
    const { wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAuthenticatedMutation<void, unknown>({
          request: () => ({
            url: "https://api.test/c",
            options: { method: "POST" },
          }),
        }),
      { wrapper },
    );

    await expect(result.current.mutateAsync(undefined as any)).rejects.toThrow(
      /HTTP 400/,
    );
  });
});
