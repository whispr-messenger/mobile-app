/**
 * Unit tests for SocketConnection reconnection and token refresh (WHISPR-1148).
 */

// --- Mocks ---

const mockEmitSessionExpired = jest.fn();
jest.mock("../../sessionEvents", () => ({
  emitSessionExpired: (...args: any[]) => mockEmitSessionExpired(...args),
  SESSION_EXPIRED_EVENT: "whispr.session.expired",
  onSessionExpired: jest.fn(() => ({ remove: jest.fn() })),
}));

const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
const mockIsTokenExpired = jest.fn<boolean, [string]>();
jest.mock("../../TokenService", () => ({
  TokenService: {
    getAccessToken: (...args: any[]) => mockGetAccessToken(...args),
    isTokenExpired: (...args: any[]) => mockIsTokenExpired(...args),
    decodeAccessToken: jest.fn(),
  },
}));

const mockRefreshTokens = jest.fn<Promise<void>, []>();
const mockGetWsToken = jest.fn<
  Promise<{ wsToken: string; expiresIn: number }>,
  []
>();
jest.mock("../../AuthService", () => ({
  AuthService: {
    refreshTokens: (...args: any[]) => mockRefreshTokens(...args),
    getWsToken: (...args: any[]) => mockGetWsToken(...args),
  },
}));

jest.mock("../../apiBase", () => ({
  getWsBaseUrl: jest.fn(() => "ws://localhost"),
  getApiBaseUrl: jest.fn(() => "http://localhost"),
}));

jest.mock("../../../utils/logger", () => ({
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
import {
  SocketConnection,
  getSharedSocket,
  destroySharedSocket,
  createSocket,
} from "../websocket";

// --- Helpers ---

function latestWs(): MockWebSocket {
  return wsInstances[wsInstances.length - 1];
}

async function connectAndOpen(
  socket: SocketConnection,
): Promise<MockWebSocket> {
  // connect() is async since WHISPR-1214 (it awaits AuthService.getWsToken
  // before opening the WebSocket). flushMicrotasks lets the awaited
  // Promise.resolve in the mocked getWsToken settle so the WebSocket
  // constructor runs before we look it up.
  const promise = socket.connect("user-1", "valid-token");
  await promise;
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
  mockGetWsToken.mockReset();

  // Default: token is available and not expired
  mockGetAccessToken.mockResolvedValue("fresh-token");
  mockIsTokenExpired.mockReturnValue(false);
  mockRefreshTokens.mockResolvedValue(undefined);
  // WHISPR-1214: connect() pulls a short-lived ws-token before opening
  // the socket. Default to a successful fetch so existing tests behave
  // identically to before; the few new tests below exercise the failure /
  // fallback paths explicitly.
  mockGetWsToken.mockResolvedValue({
    wsToken: "ws-short-token",
    expiresIn: 60,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("SocketConnection reconnection (WHISPR-1148)", () => {
  it("emits sessionExpired after max reconnect attempts", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

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
    await connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("current-token");
    mockIsTokenExpired.mockReturnValue(false);

    latestWs().simulateClose(1008, "policy violation");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).toHaveBeenCalled();

    socket.disconnect();
  });

  it("forces token refresh on close code 4001", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("current-token");
    mockIsTokenExpired.mockReturnValue(false);

    latestWs().simulateClose(4001, "auth error");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).toHaveBeenCalled();

    socket.disconnect();
  });

  it("does not force refresh on normal close code 1000", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    mockGetAccessToken.mockResolvedValue("current-token");
    mockIsTokenExpired.mockReturnValue(false);

    latestWs().simulateClose(1000, "normal");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockRefreshTokens).not.toHaveBeenCalled();

    socket.disconnect();
  });

  it("picks up externally refreshed token from TokenService", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

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
    await connectAndOpen(socket);

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
    await connectAndOpen(socket);

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
    await connectAndOpen(socket);

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
    await connectAndOpen(socket);

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
    await connectAndOpen(socket);

    // Close with auth code, then disconnect before reconnect fires
    latestWs().simulateClose(4001, "auth error");
    socket.disconnect();

    // Reconnect fresh
    mockRefreshTokens.mockClear();
    await connectAndOpen(socket);

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
  it("connect creates a WebSocket and transitions to connected on open", async () => {
    const socket = new SocketConnection();
    expect(socket.connectionState).toBe("disconnected");
    expect(socket.isConnected()).toBe(false);

    const connectPromise = socket.connect("user-1", "token-1");
    expect(socket.connectionState).toBe("connecting");
    await connectPromise;

    latestWs().simulateOpen();
    expect(socket.connectionState).toBe("connected");
    expect(socket.isConnected()).toBe(true);

    socket.disconnect();
  });

  it("connect is a no-op if already connected", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);
    const countBefore = wsInstances.length;

    socket.connect("user-1", "token-1");
    expect(wsInstances.length).toBe(countBefore);

    socket.disconnect();
  });

  it("disconnect sets state to disconnected and clears socket", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    socket.disconnect();
    expect(socket.connectionState).toBe("disconnected");
    expect(socket.isConnected()).toBe(false);
  });

  it("connectionState listeners are notified on state changes", async () => {
    const socket = new SocketConnection();
    const states: string[] = [];
    socket.addConnectionStateListener((s) => states.push(s));

    await socket.connect("user-1", "token-1");
    latestWs().simulateOpen();
    latestWs().simulateClose(1000, "normal");

    expect(states).toContain("connecting");
    expect(states).toContain("connected");
    expect(states).toContain("reconnecting");

    socket.disconnect();
  });

  it("removeConnectionStateListener stops notifications", async () => {
    const socket = new SocketConnection();
    const states: string[] = [];
    const remove = socket.addConnectionStateListener((s) => states.push(s));

    await socket.connect("user-1", "token-1");
    remove();
    latestWs().simulateOpen();

    // Only "connecting" captured before removal
    expect(states).toEqual(["connecting"]);

    socket.disconnect();
  });

  it("channel join/on/off/push/leave work without errors", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    const ch = socket.channel("test:topic");
    ch.join();

    const handler = jest.fn();
    ch.on("event", handler);
    ch.push("event", { data: 1 });
    ch.off("event", handler);
    ch.leave();

    socket.disconnect();
  });

  it("channel leave is ref-counted: phx_leave only on last consumer", async () => {
    const socket = new SocketConnection();
    const ws = await connectAndOpen(socket);

    // 2 consumers (ex ChatScreen + ConversationsListScreen) prennent la
    // meme entree user channel via socket.channel(...).
    const consumerA = socket.channel("user:42");
    const consumerB = socket.channel("user:42");
    consumerA.join();
    consumerB.join();

    // reset des sends pour ne compter que les phx_leave qui suivent
    ws.send.mockClear();

    // premier leave : ref count > 0, pas de phx_leave
    consumerA.leave();
    let leaveCalls = ws.send.mock.calls.filter((call: any[]) => {
      const parsed = JSON.parse(call[0]);
      return parsed[3] === "phx_leave" && parsed[2] === "user:42";
    });
    expect(leaveCalls.length).toBe(0);

    // dernier consumer : phx_leave envoye au serveur
    consumerB.leave();
    leaveCalls = ws.send.mock.calls.filter((call: any[]) => {
      const parsed = JSON.parse(call[0]);
      return parsed[3] === "phx_leave" && parsed[2] === "user:42";
    });
    expect(leaveCalls.length).toBe(1);

    socket.disconnect();
  });

  it("channel join queues as pending if socket is not open", async () => {
    const socket = new SocketConnection();
    await socket.connect("user-1", "token-1");
    // Socket is CONNECTING, not OPEN

    const ch = socket.channel("test:topic");
    const result = ch.join();

    // Should resolve with pending status
    expect(result).resolves.toEqual({ status: "pending" });

    socket.disconnect();
  });

  it("onmessage dispatches to channel callbacks with snake_case keys", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    const ch = socket.channel("room:1");
    ch.join();

    const handler = jest.fn();
    ch.on("new_message", handler);

    // Simulate a v2 message frame
    const ws = latestWs();
    ws.onmessage?.({
      data: JSON.stringify([
        null,
        "1",
        "room:1",
        "new_message",
        { userId: "u1", messageText: "hello" },
      ]),
    });

    expect(handler).toHaveBeenCalledWith({
      user_id: "u1",
      message_text: "hello",
    });

    socket.disconnect();
  });

  it("onmessage handles phx_reply and marks channel as joined", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    socket.channel("room:1");

    const ws = latestWs();
    ws.onmessage?.({
      data: JSON.stringify([
        null,
        "1",
        "room:1",
        "phx_reply",
        { status: "ok" },
      ]),
    });

    // No error thrown — phx_reply handled internally
    socket.disconnect();
  });

  it("onmessage handles phx_error by marking channel as not joined", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    socket.channel("room:1");

    const ws = latestWs();
    // First mark as joined
    ws.onmessage?.({
      data: JSON.stringify([
        null,
        "1",
        "room:1",
        "phx_reply",
        { status: "ok" },
      ]),
    });
    // Then crash
    ws.onmessage?.({
      data: JSON.stringify([null, "2", "room:1", "phx_error", {}]),
    });

    socket.disconnect();
  });

  it("onmessage handles phx_close by marking channel as not joined", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    socket.channel("room:1");

    const ws = latestWs();
    ws.onmessage?.({
      data: JSON.stringify([null, "1", "room:1", "phx_close", {}]),
    });

    socket.disconnect();
  });

  it("onmessage ignores unparseable frames", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    const ws = latestWs();
    // Should not throw
    ws.onmessage?.({ data: "not json{{{" });
    ws.onmessage?.({ data: JSON.stringify({ no: "topic" }) });

    socket.disconnect();
  });

  it("heartbeat sends periodic messages when connected", async () => {
    const socket = new SocketConnection();
    const ws = await connectAndOpen(socket);

    // Advance past heartbeat interval (30s)
    jest.advanceTimersByTime(31_000);

    expect(ws.send).toHaveBeenCalled();
    const lastCall = ws.send.mock.calls[ws.send.mock.calls.length - 1][0];
    const parsed = JSON.parse(lastCall);
    expect(parsed[3]).toBe("heartbeat");

    socket.disconnect();
  });

  it("onerror logs but does not crash", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    const ws = latestWs();
    // Should not throw
    ws.onerror?.({ message: "test error" });

    socket.disconnect();
  });

  it("onopen rejoins existing channels after reconnect", async () => {
    const socket = new SocketConnection();
    const ws = await connectAndOpen(socket);

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

  it("v1 message format is also parsed", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

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

// ============================================================
// Coverage: singleton helpers & edge-case branches
// ============================================================

describe("Singleton helpers", () => {
  afterEach(() => {
    destroySharedSocket();
  });

  it("getSharedSocket returns the same instance on repeated calls", () => {
    const a = getSharedSocket();
    const b = getSharedSocket();
    expect(a).toBe(b);
  });

  it("destroySharedSocket disconnects and clears the singleton", async () => {
    const s = getSharedSocket();
    await s.connect("u1", "t1");
    const ws = latestWs();
    ws.simulateOpen();

    destroySharedSocket();

    expect(ws.close).toHaveBeenCalled();
    // After destroy, getSharedSocket returns a fresh instance
    const fresh = getSharedSocket();
    expect(fresh).not.toBe(s);
  });

  it("destroySharedSocket is safe to call when no socket exists", () => {
    // Should not throw
    destroySharedSocket();
    destroySharedSocket();
  });

  it("createSocket returns a new SocketConnection each time", () => {
    const a = createSocket();
    const b = createSocket();
    expect(a).not.toBe(b);
    expect(a).toBeInstanceOf(SocketConnection);
  });
});

describe("Edge-case branches", () => {
  let socket: SocketConnection;

  beforeEach(() => {
    jest.useFakeTimers();
    wsInstances = [];
    mockEmitSessionExpired.mockClear();
    mockGetAccessToken.mockReset();
    mockIsTokenExpired.mockReset();
    mockRefreshTokens.mockReset();
    socket = new SocketConnection();
  });

  afterEach(() => {
    socket.disconnect();
    jest.useRealTimers();
  });

  it("pending topics are joined when the socket opens", async () => {
    // Create a channel and join BEFORE the socket is open → becomes pending
    await socket.connect("user-1", "tok");
    const ws = latestWs();
    // Socket is still CONNECTING — join should queue as pending
    const ch = socket.channel("room:pending");
    ch.join();

    // Now open the socket — pending topic should be joined via sendJoin
    ws.simulateOpen();

    // The send calls include the pending topic join
    const joinCalls = ws.send.mock.calls.filter((call: any[]) => {
      const parsed = JSON.parse(call[0]);
      return parsed[3] === "phx_join" && parsed[2] === "room:pending";
    });
    expect(joinCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("bad callback in onmessage is silently caught", async () => {
    const ws = await connectAndOpen(socket);
    const badCb = jest.fn(() => {
      throw new Error("boom");
    });
    const goodCb = jest.fn();

    const ch = socket.channel("room:1");
    ch.join();
    ch.on("msg", badCb);
    ch.on("msg", goodCb);

    ws.onmessage?.({
      data: JSON.stringify([null, "1", "room:1", "msg", { x: 1 }]),
    });

    expect(badCb).toHaveBeenCalled();
    expect(goodCb).toHaveBeenCalledWith({ x: 1 });
  });

  it("onclose sets disconnected when shouldReconnect is false", async () => {
    const ws = await connectAndOpen(socket);

    const stateChanges: string[] = [];
    socket.addConnectionStateListener((s) => stateChanges.push(s));

    // Call disconnect which sets shouldReconnect=false
    socket.disconnect();

    // State should end at disconnected (not reconnecting)
    expect(socket.connectionState).toBe("disconnected");
  });

  it("onclose after disconnect goes to disconnected, not reconnecting", async () => {
    // Connect and open normally
    const ws = await connectAndOpen(socket);

    // Reach into socket to set shouldReconnect = false without closing
    // by calling disconnect which also fires close. Instead, we connect
    // then the server closes the connection while shouldReconnect is false.
    // To make shouldReconnect false before close: use the max-reconnect path.
    // Simpler: connect, open, then externally set shouldReconnect via disconnect
    // BUT disconnect also closes. So we must observe the state transition.

    const states: string[] = [];
    socket.addConnectionStateListener((s) => states.push(s));

    // disconnect() sets shouldReconnect=false then calls socket.close()
    // The mock close() doesn't fire onclose, so we manually fire it after
    socket.disconnect();
    // Manually trigger onclose as the mock doesn't
    ws.onclose?.({ code: 1000, reason: "normal" });

    // Should be disconnected, not reconnecting
    expect(states).toContain("disconnected");
    expect(states).not.toContain("reconnecting");
  });
});

describe("WS short-lived token (WHISPR-1214)", () => {
  it("fetches a fresh ws-token before opening the WebSocket", async () => {
    const socket = new SocketConnection();
    await socket.connect("user-1", "long-access-token");

    expect(mockGetWsToken).toHaveBeenCalledTimes(1);
    socket.disconnect();
  });

  it("puts the ws-token (NOT the access token) in the URL query string", async () => {
    const observedUrls: string[] = [];
    const PrevWS = (global as any).WebSocket;
    (global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super();
        observedUrls.push(url);
        wsInstances.push(this);
      }
    };
    Object.assign((global as any).WebSocket, {
      OPEN: MockWebSocket.OPEN,
      CONNECTING: MockWebSocket.CONNECTING,
      CLOSING: MockWebSocket.CLOSING,
      CLOSED: MockWebSocket.CLOSED,
    });

    try {
      mockGetWsToken.mockResolvedValueOnce({
        wsToken: "ws-jwt-60s",
        expiresIn: 60,
      });

      const socket = new SocketConnection();
      await socket.connect("user-1", "long-access-token");

      expect(observedUrls).toHaveLength(1);
      expect(observedUrls[0]).toContain("token=ws-jwt-60s");
      expect(observedUrls[0]).not.toContain("long-access-token");

      socket.disconnect();
    } finally {
      (global as any).WebSocket = PrevWS;
    }
  });

  it("falls back to the access token when /tokens/ws-token errors out", async () => {
    const observedUrls: string[] = [];
    const PrevWS = (global as any).WebSocket;
    (global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super();
        observedUrls.push(url);
        wsInstances.push(this);
      }
    };
    Object.assign((global as any).WebSocket, {
      OPEN: MockWebSocket.OPEN,
      CONNECTING: MockWebSocket.CONNECTING,
      CLOSING: MockWebSocket.CLOSING,
      CLOSED: MockWebSocket.CLOSED,
    });

    try {
      mockGetWsToken.mockRejectedValueOnce(
        new Error("backend not yet rolled out"),
      );

      const socket = new SocketConnection();
      await socket.connect("user-1", "fallback-access-token");

      // Fallback is the access token passed in by the caller — keeps chat
      // online during the auth-service rollout window.
      expect(observedUrls[0]).toContain("token=fallback-access-token");

      socket.disconnect();
    } finally {
      (global as any).WebSocket = PrevWS;
    }
  });

  it("re-fetches a ws-token on every reconnect (60s lifetime, can't reuse)", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);
    expect(mockGetWsToken).toHaveBeenCalledTimes(1);

    latestWs().simulateClose(1006, "network");
    await jest.advanceTimersByTimeAsync(1_500);

    expect(mockGetWsToken).toHaveBeenCalledTimes(2);
    socket.disconnect();
  });
});

describe("SocketConnection reconnect jitter (WHISPR-1395)", () => {
  it("applies a random jitter so successive reconnect delays differ", async () => {
    // on capture les delays passes a setTimeout par scheduleReconnect en
    // espionnant globalThis.setTimeout.
    const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    const delays: number[] = [];
    for (let i = 0; i < 10; i++) {
      latestWs().simulateClose(1006, "network");
      // recupere le dernier delay scheduled, ignore le 0 du token refresh
      const lastCall =
        setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1];
      if (lastCall && typeof lastCall[1] === "number" && lastCall[1] > 0) {
        delays.push(lastCall[1] as number);
      }
      await jest.advanceTimersByTimeAsync(60_000);
    }

    // au moins 5 valeurs distinctes prouvent que le jitter est applique
    // (sans jitter on aurait toujours min(2^n * base, 30000))
    const unique = new Set(delays);
    expect(unique.size).toBeGreaterThanOrEqual(5);

    // chaque delay doit rester dans la fenetre [0.5x, 1.0x] du base capped
    delays.forEach((d) => {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(30_000);
    });

    setTimeoutSpy.mockRestore();
    socket.disconnect();
  });
});

describe("SocketConnection fatal close codes (WHISPR-1395)", () => {
  it("limits reconnect attempts to 3 after close code 1011", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    // premier close avec code fatal 1011 (server internal error)
    latestWs().simulateClose(1011, "internal server error");

    // 3 tentatives max apres un fatal : on les enchaine
    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(60_000);
      const ws = latestWs();
      // re-close sans open pour incrementer reconnectAttempt
      if (ws && ws.readyState !== MockWebSocket.CLOSED) {
        ws.simulateClose(1011, "internal server error");
      }
    }

    // au tour suivant, on doit avoir emit sessionExpired (max atteint)
    expect(mockEmitSessionExpired).toHaveBeenCalledWith("ws_max_reconnect");
    expect(socket.connectionState).toBe("disconnected");

    socket.disconnect();
  });

  it("limits reconnect attempts to 3 after close code 1010", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    latestWs().simulateClose(1010, "mandatory extension");

    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(60_000);
      const ws = latestWs();
      if (ws && ws.readyState !== MockWebSocket.CLOSED) {
        ws.simulateClose(1010, "mandatory extension");
      }
    }

    expect(mockEmitSessionExpired).toHaveBeenCalledWith("ws_max_reconnect");
    socket.disconnect();
  });

  it("does not lower the reconnect limit on non-fatal codes (1006)", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    // close 1006 = network blip, pas fatal
    for (let i = 0; i < 5; i++) {
      latestWs().simulateClose(1006, "network");
      await jest.advanceTimersByTimeAsync(60_000);
    }

    // 5 closes 1006 < 20 limite par defaut => pas encore d expiration
    expect(mockEmitSessionExpired).not.toHaveBeenCalledWith("ws_max_reconnect");
    socket.disconnect();
  });

  it("restores the default reconnect limit on a successful reopen", async () => {
    const socket = new SocketConnection();
    await connectAndOpen(socket);

    // close fatal 1011 => limite baissee a 3
    latestWs().simulateClose(1011, "internal server error");
    await jest.advanceTimersByTimeAsync(60_000);

    // la reconnect cree un nouveau ws, on le ouvre = success
    latestWs().simulateOpen();

    // ensuite enchainer 5 closes 1006 ne doit pas declencher max_reconnect
    for (let i = 0; i < 5; i++) {
      latestWs().simulateClose(1006, "network");
      await jest.advanceTimersByTimeAsync(60_000);
    }

    expect(mockEmitSessionExpired).not.toHaveBeenCalledWith("ws_max_reconnect");
    socket.disconnect();
  });
});
