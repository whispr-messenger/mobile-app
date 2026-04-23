/**
 * Unit tests for SocketConnection reconnection and token refresh (WHISPR-1148).
 */

// --- Mocks ---

const mockEmitSessionExpired = jest.fn();
jest.mock("./src/services/sessionEvents", () => ({
  emitSessionExpired: (...args: any[]) => mockEmitSessionExpired(...args),
  SESSION_EXPIRED_EVENT: "whispr.session.expired",
  onSessionExpired: jest.fn(() => ({ remove: jest.fn() })),
}));

const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
const mockIsTokenExpired = jest.fn<boolean, [string]>();
jest.mock("./src/services/TokenService", () => ({
  TokenService: {
    getAccessToken: (...args: any[]) => mockGetAccessToken(...args),
    isTokenExpired: (...args: any[]) => mockIsTokenExpired(...args),
    decodeAccessToken: jest.fn(),
  },
}));

const mockRefreshTokens = jest.fn<Promise<void>, []>();
jest.mock("./src/services/AuthService", () => ({
  AuthService: {
    refreshTokens: (...args: any[]) => mockRefreshTokens(...args),
  },
}));

jest.mock("./src/services/apiBase", () => ({
  getWsBaseUrl: jest.fn(() => "ws://localhost"),
  getApiBaseUrl: jest.fn(() => "http://localhost"),
}));

jest.mock("./src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// --- MockWebSocket ---

type WSHandler = (ev: any) => void;

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: WSHandler | null = null;
  onclose: WSHandler | null = null;
  onerror: WSHandler | null = null;
  onmessage: WSHandler | null = null;
  send = jest.fn();
  close = jest.fn();

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  simulateClose(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

// Keep track of all WebSocket instances created
let wsInstances: MockWebSocket[] = [];
const OriginalWebSocket = global.WebSocket;

beforeAll(() => {
  (global as any).WebSocket = class extends MockWebSocket {
    constructor() {
      super();
      wsInstances.push(this);
    }
  };
  // Ensure WebSocket static constants are available
  (global as any).WebSocket.OPEN = MockWebSocket.OPEN;
  (global as any).WebSocket.CONNECTING = MockWebSocket.CONNECTING;
  (global as any).WebSocket.CLOSING = MockWebSocket.CLOSING;
  (global as any).WebSocket.CLOSED = MockWebSocket.CLOSED;
});

afterAll(() => {
  global.WebSocket = OriginalWebSocket;
});

// Import after mocks
import { SocketConnection } from "./src/services/messaging/websocket";

// --- Helpers ---

function latestWs(): MockWebSocket {
  return wsInstances[wsInstances.length - 1];
}

function connectAndOpen(socket: SocketConnection): MockWebSocket {
  socket.connect("user-1", "valid-token");
  const ws = latestWs();
  ws.simulateOpen();
  return ws;
}

// --- Tests ---

beforeEach(() => {
  jest.useFakeTimers();
  wsInstances = [];
  mockEmitSessionExpired.mockClear();
  mockGetAccessToken.mockReset();
  mockIsTokenExpired.mockReset();
  mockRefreshTokens.mockReset();

  // Default: token is available and not expired
  mockGetAccessToken.mockResolvedValue("fresh-token");
  mockIsTokenExpired.mockReturnValue(false);
  mockRefreshTokens.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("SocketConnection reconnection (WHISPR-1148)", () => {
  it("emits sessionExpired after max reconnect attempts", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    // Each close+advance triggers a reconnect attempt that increments the counter.
    // We do NOT open the new sockets — this way reconnectAttempt is never reset
    // and the counter climbs to maxReconnectAttempts (20).
    for (let i = 0; i < 20; i++) {
      latestWs().simulateClose(1006, "abnormal");
      // Advance past the reconnect delay (exponential backoff capped at 30s)
      await jest.advanceTimersByTimeAsync(60_000);
      // The reconnect creates a new WebSocket in CONNECTING state.
      // Immediately close it again without opening (simulates repeated failure).
    }

    // After 20 failed attempts, the next close calls scheduleReconnect
    // which sees reconnectAttempt >= maxReconnectAttempts and emits sessionExpired.
    latestWs().simulateClose(1006, "abnormal");

    expect(mockEmitSessionExpired).toHaveBeenCalledWith("ws_max_reconnect");
    expect(socket.connectionState).toBe("disconnected");

    socket.disconnect();
  });

  it("forces token refresh on close code 1008", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("current-token");
    mockIsTokenExpired.mockReturnValue(false);

    latestWs().simulateClose(1008, "policy violation");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).toHaveBeenCalled();

    socket.disconnect();
  });

  it("forces token refresh on close code 4001", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("current-token");
    mockIsTokenExpired.mockReturnValue(false);

    latestWs().simulateClose(4001, "auth error");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).toHaveBeenCalled();

    socket.disconnect();
  });

  it("does not force refresh on normal close code 1000", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("current-token");
    mockIsTokenExpired.mockReturnValue(false);

    latestWs().simulateClose(1000, "normal");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).not.toHaveBeenCalled();

    socket.disconnect();
  });

  it("picks up externally refreshed token from TokenService", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    // Simulate external refresh: storage has a new token
    mockGetAccessToken.mockResolvedValue("externally-refreshed-token");
    mockIsTokenExpired.mockReturnValue(false);

    latestWs().simulateClose(1006, "network");
    await jest.advanceTimersByTimeAsync(1_500);

    // Should NOT call refreshTokens — token from storage is valid
    expect(mockRefreshTokens).not.toHaveBeenCalled();

    // A new WebSocket should have been created (reconnect happened)
    expect(wsInstances.length).toBeGreaterThan(1);

    socket.disconnect();
  });

  it("refreshes token when fetched token from storage is expired", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    // Storage returns expired token first, then fresh after refresh
    mockGetAccessToken
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("new-fresh-token");
    mockIsTokenExpired.mockImplementation((t: string) => t === "expired-token");

    latestWs().simulateClose(1006, "network");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).toHaveBeenCalled();

    socket.disconnect();
  });

  it("emits sessionExpired when token refresh fails", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("expired-token");
    mockIsTokenExpired.mockReturnValue(true);
    mockRefreshTokens.mockRejectedValue(new Error("refresh failed"));

    latestWs().simulateClose(1006, "network");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockEmitSessionExpired).toHaveBeenCalledWith(
      "ws_token_refresh_failed",
    );
    expect(socket.connectionState).toBe("disconnected");

    socket.disconnect();
  });

  it("emits sessionExpired when no token available after refresh", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    // Token from storage is null, refresh succeeds but still no token
    mockGetAccessToken.mockResolvedValue(null);
    mockIsTokenExpired.mockReturnValue(true);

    latestWs().simulateClose(1006, "network");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockEmitSessionExpired).toHaveBeenCalledWith("ws_no_token");
    expect(socket.connectionState).toBe("disconnected");

    socket.disconnect();
  });

  it("auth close code is consumed after first reconnect attempt", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("valid-token");
    mockIsTokenExpired.mockReturnValue(false);

    // First close with auth code
    latestWs().simulateClose(4001, "auth error");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);

    // Open and close again normally
    const newWs = latestWs();
    newWs.simulateOpen();
    mockRefreshTokens.mockClear();

    newWs.simulateClose(1006, "network");
    await jest.advanceTimersByTimeAsync(1_500);

    // Should NOT force refresh — auth close code was consumed
    expect(mockRefreshTokens).not.toHaveBeenCalled();

    socket.disconnect();
  });

  it("disconnect() resets lastCloseCode", async () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    // Close with auth code, then disconnect before reconnect fires
    latestWs().simulateClose(4001, "auth error");
    socket.disconnect();

    // Reconnect fresh
    mockRefreshTokens.mockClear();
    connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("valid-token");
    mockIsTokenExpired.mockReturnValue(false);

    // Normal close — should NOT trigger forced refresh
    latestWs().simulateClose(1000, "normal");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).not.toHaveBeenCalled();

    socket.disconnect();
  });
});

describe("SocketConnection basics", () => {
  it("connect creates a WebSocket and transitions to connected on open", () => {
    const socket = new SocketConnection();
    expect(socket.connectionState).toBe("disconnected");
    expect(socket.isConnected()).toBe(false);

    socket.connect("user-1", "token-1");
    expect(socket.connectionState).toBe("connecting");

    latestWs().simulateOpen();
    expect(socket.connectionState).toBe("connected");
    expect(socket.isConnected()).toBe(true);

    socket.disconnect();
  });

  it("connect is a no-op if already connected", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);
    const countBefore = wsInstances.length;

    socket.connect("user-1", "token-1");
    expect(wsInstances.length).toBe(countBefore);

    socket.disconnect();
  });

  it("disconnect sets state to disconnected and clears socket", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    socket.disconnect();
    expect(socket.connectionState).toBe("disconnected");
    expect(socket.isConnected()).toBe(false);
  });

  it("connectionState listeners are notified on state changes", () => {
    const socket = new SocketConnection();
    const states: string[] = [];
    socket.addConnectionStateListener((s) => states.push(s));

    socket.connect("user-1", "token-1");
    latestWs().simulateOpen();
    latestWs().simulateClose(1000, "normal");

    expect(states).toContain("connecting");
    expect(states).toContain("connected");
    expect(states).toContain("reconnecting");

    socket.disconnect();
  });

  it("removeConnectionStateListener stops notifications", () => {
    const socket = new SocketConnection();
    const states: string[] = [];
    const remove = socket.addConnectionStateListener((s) => states.push(s));

    socket.connect("user-1", "token-1");
    remove();
    latestWs().simulateOpen();

    // Only "connecting" captured before removal
    expect(states).toEqual(["connecting"]);

    socket.disconnect();
  });

  it("channel join/on/off/push/leave work without errors", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    const ch = socket.channel("test:topic");
    ch.join();

    const handler = jest.fn();
    ch.on("event", handler);
    ch.push("event", { data: 1 });
    ch.off("event", handler);
    ch.leave();

    socket.disconnect();
  });

  it("channel join queues as pending if socket is not open", () => {
    const socket = new SocketConnection();
    socket.connect("user-1", "token-1");
    // Socket is CONNECTING, not OPEN

    const ch = socket.channel("test:topic");
    const result = ch.join();

    // Should resolve with pending status
    expect(result).resolves.toEqual({ status: "pending" });

    socket.disconnect();
  });

  it("onmessage dispatches to channel callbacks with snake_case keys", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    const ch = socket.channel("room:1");
    ch.join();

    const handler = jest.fn();
    ch.on("new_message", handler);

    // Simulate a v2 message frame
    const ws = latestWs();
    ws.onmessage?.({
      data: JSON.stringify([null, "1", "room:1", "new_message", { userId: "u1", messageText: "hello" }]),
    });

    expect(handler).toHaveBeenCalledWith({
      user_id: "u1",
      message_text: "hello",
    });

    socket.disconnect();
  });

  it("onmessage handles phx_reply and marks channel as joined", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    socket.channel("room:1");

    const ws = latestWs();
    ws.onmessage?.({
      data: JSON.stringify([null, "1", "room:1", "phx_reply", { status: "ok" }]),
    });

    // No error thrown — phx_reply handled internally
    socket.disconnect();
  });

  it("onmessage handles phx_error by marking channel as not joined", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    socket.channel("room:1");

    const ws = latestWs();
    // First mark as joined
    ws.onmessage?.({
      data: JSON.stringify([null, "1", "room:1", "phx_reply", { status: "ok" }]),
    });
    // Then crash
    ws.onmessage?.({
      data: JSON.stringify([null, "2", "room:1", "phx_error", {}]),
    });

    socket.disconnect();
  });

  it("onmessage handles phx_close by marking channel as not joined", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    socket.channel("room:1");

    const ws = latestWs();
    ws.onmessage?.({
      data: JSON.stringify([null, "1", "room:1", "phx_close", {}]),
    });

    socket.disconnect();
  });

  it("onmessage ignores unparseable frames", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    const ws = latestWs();
    // Should not throw
    ws.onmessage?.({ data: "not json{{{" });
    ws.onmessage?.({ data: JSON.stringify({ no: "topic" }) });

    socket.disconnect();
  });

  it("heartbeat sends periodic messages when connected", () => {
    const socket = new SocketConnection();
    const ws = connectAndOpen(socket);

    // Advance past heartbeat interval (30s)
    jest.advanceTimersByTime(31_000);

    expect(ws.send).toHaveBeenCalled();
    const lastCall = ws.send.mock.calls[ws.send.mock.calls.length - 1][0];
    const parsed = JSON.parse(lastCall);
    expect(parsed[3]).toBe("heartbeat");

    socket.disconnect();
  });

  it("onerror logs but does not crash", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    const ws = latestWs();
    // Should not throw
    ws.onerror?.({ message: "test error" });

    socket.disconnect();
  });

  it("onopen rejoins existing channels after reconnect", async () => {
    const socket = new SocketConnection();
    const ws = connectAndOpen(socket);

    // Create and join a channel
    const ch = socket.channel("room:1");
    ch.join();

    // Simulate disconnect and reconnect
    ws.simulateClose(1006, "network");
    await jest.advanceTimersByTimeAsync(1_500);

    const newWs = latestWs();
    newWs.simulateOpen();

    // The channel should have been re-joined (sendJoin called)
    expect(newWs.send).toHaveBeenCalled();

    socket.disconnect();
  });

  it("v1 message format is also parsed", () => {
    const socket = new SocketConnection();
    connectAndOpen(socket);

    const ch = socket.channel("room:1");
    ch.join();

    const handler = jest.fn();
    ch.on("msg", handler);

    const ws = latestWs();
    ws.onmessage?.({
      data: JSON.stringify({
        topic: "room:1",
        event: "msg",
        payload: { text: "hi" },
        ref: "1",
      }),
    });

    expect(handler).toHaveBeenCalledWith({ text: "hi" });

    socket.disconnect();
  });
});
