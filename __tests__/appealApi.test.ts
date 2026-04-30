/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../src/services/TokenService", () =>
  require("../src/__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("../src/services/AuthService", () =>
  require("../src/__test-utils__/mockFactories").makeAuthServiceMock(),
);
jest.mock("../src/services/apiBase", () =>
  require("../src/__test-utils__/mockFactories").makeApiBaseMock("https://api.test"),
);

// Disable the dev-only short-circuit BEFORE importing so the network branch
// runs (the constant is evaluated at module load time).
(global as any).__DEV__ = false;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { submitModerationAppeal } = require("../src/services/moderation/appealApi") as typeof import("../src/services/moderation/appealApi");

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

describe("submitModerationAppeal (network branch)", () => {
  // Note: When MOCK_MODERATION_APPEAL_SUCCESS is true (the default in __DEV__)
  // the function short-circuits without calling fetch. We test both branches.

  it("posts JSON to /moderation/appeal/:id with Authorization", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { appealId: "APP-1", status: "received" } }),
    );

    const res = await submitModerationAppeal({
      decisionId: "decision-1",
      reason: "context_incomplete",
      description: "  more context  ",
      attachmentFileName: "a.png",
    });
    expect(res).toEqual({ appealId: "APP-1", status: "received" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/api/v1/moderation/appeal/decision-1");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer at");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      reason: "context_incomplete",
      description: "more context",
      attachment_filename: "a.png",
    });
  });

  it("falls back to id when no appealId is in the response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "alt-id", status: "queued" } }),
    );
    const res = await submitModerationAppeal({
      decisionId: "d2",
      reason: "false_report",
      description: "x",
    });
    expect(res.appealId).toBe("alt-id");
    expect(res.status).toBe("queued");
  });

  it("uses decisionId when neither appealId nor id present", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    const res = await submitModerationAppeal({
      decisionId: "d3",
      reason: "misclassification",
      description: "x",
    });
    expect(res.appealId).toBe("d3");
    expect(res.status).toBe("received");
  });

  it("throws an Error with status when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 422, body: { message: "invalid" } }),
    );
    await expect(
      submitModerationAppeal({
        decisionId: "d",
        reason: "other",
        description: "x",
      }),
    ).rejects.toMatchObject({ message: "invalid", status: 422 });
  });

  it("retries once on 401", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ status: 401, body: {} }))
      .mockResolvedValueOnce(
        mockResponse({ body: { appealId: "OK", status: "received" } }),
      );
    const res = await submitModerationAppeal({
      decisionId: "d",
      reason: "other",
      description: "x",
    });
    expect(res.appealId).toBe("OK");
    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
  });
});
