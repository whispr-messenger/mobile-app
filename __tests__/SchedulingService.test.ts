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

import { SchedulingService } from "../src/services/SchedulingService";
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

describe("SchedulingService", () => {
  it("createScheduledMessage POSTs the dto to /messages/scheduled", async () => {
    const dto = {
      conversation_id: "c1",
      content: "hi",
      scheduled_at: "2026-12-01T10:00:00Z",
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { id: "s1", ...dto } }));
    const result = await SchedulingService.createScheduledMessage(dto);
    expect(result.id).toBe("s1");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/messaging/api/v1/messages/scheduled");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(dto);
  });

  it("getScheduledMessages without params hits the bare endpoint", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));
    await SchedulingService.getScheduledMessages();
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.test/messaging/api/v1/messages/scheduled",
    );
  });

  it("getScheduledMessages serializes all params into query string", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));
    await SchedulingService.getScheduledMessages({
      conversation_id: "c1",
      status: "pending",
      limit: 10,
      offset: 5,
    });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("conversation_id=c1");
    expect(url).toContain("status=pending");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=5");
  });

  it("updateScheduledMessage uses PATCH and URL-encodes the id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "id/1", content: "x" } }),
    );
    await SchedulingService.updateScheduledMessage("id/1", { content: "x" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.test/messaging/api/v1/messages/scheduled/id%2F1",
    );
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ content: "x" });
  });

  it("cancelScheduledMessage uses DELETE", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await SchedulingService.cancelScheduledMessage("s1");
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
  });

  it("getHealth and getMetrics hit /monitoring endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ body: { status: "ok", uptime: 1, timestamp: "" } }))
      .mockResolvedValueOnce(mockResponse({ body: { total_scheduled: 1, total_sent: 0, total_failed: 0, pending_count: 1 } }));
    await SchedulingService.getHealth();
    await SchedulingService.getMetrics();
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.test/messaging/api/v1/monitoring/health",
    );
    expect(mockFetch.mock.calls[1][0]).toBe(
      "https://api.test/messaging/api/v1/monitoring/metrics",
    );
  });

  it("getQueueStats wraps a single object into an array", async () => {
    const queue = { name: "q", waiting: 1, active: 0, completed: 0, failed: 0, delayed: 0 };
    mockFetch.mockResolvedValueOnce(mockResponse({ body: queue }));
    const list = await SchedulingService.getQueueStats();
    expect(list).toEqual([queue]);
  });

  it("getQueueStats returns array as-is", async () => {
    const arr = [
      { name: "q1", waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      { name: "q2", waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
    ];
    mockFetch.mockResolvedValueOnce(mockResponse({ body: arr }));
    const list = await SchedulingService.getQueueStats();
    expect(list).toEqual(arr);
  });

  it("retries once on 401 then succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ status: 401, body: {} }))
      .mockResolvedValueOnce(mockResponse({ body: [] }));
    await SchedulingService.getScheduledMessages();
    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
  });

  it("throws when server returns 4xx with message", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 400, body: { message: "bad" } }),
    );
    await expect(
      SchedulingService.cancelScheduledMessage("x"),
    ).rejects.toThrow("bad");
  });
});
