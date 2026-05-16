/**
 * Tests for TokenRefreshScheduler — proactive JWT refresh before expiration.
 * Covers timer scheduling, AppState resume, stop()/start() lifecycle, and
 * behaviour when refresh fails.
 */

// ─── Mocks ───────────────────────────────────────────────────────

type AppStateStatus = "active" | "background" | "inactive";
type Listener = (s: AppStateStatus) => void;

jest.mock("react-native", () => {
  const listeners: Listener[] = [];
  return {
    __listeners: listeners,
    AppState: {
      currentState: "active" as AppStateStatus,
      addEventListener: jest.fn((_event: string, cb: Listener) => {
        listeners.push(cb);
        return {
          remove: jest.fn(() => {
            const i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
          }),
        };
      }),
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rnMock = require("react-native");
const appStateListeners: Listener[] = rnMock.__listeners;
const mockAppState = rnMock.AppState;

const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
const mockMsUntilProactiveRefresh = jest.fn<number, [string, number?]>();

jest.mock("../TokenService", () => ({
  TokenService: {
    getAccessToken: (...args: unknown[]) => mockGetAccessToken(...(args as [])),
    msUntilProactiveRefresh: (...args: unknown[]) =>
      mockMsUntilProactiveRefresh(...(args as [string, number?])),
  },
}));

const mockRefreshTokens = jest.fn<Promise<void>, []>();
jest.mock("../AuthService", () => ({
  AuthService: {
    refreshTokens: (...args: unknown[]) => mockRefreshTokens(...(args as [])),
  },
}));

import { TokenRefreshScheduler } from "../TokenRefreshScheduler";

// ─── Helpers ─────────────────────────────────────────────────────

const flushPromises = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
};

const emitAppState = (status: AppStateStatus) => {
  mockAppState.currentState = status;
  appStateListeners.forEach((cb) => cb(status));
};

beforeEach(() => {
  jest.useFakeTimers();
  appStateListeners.length = 0;
  mockAppState.currentState = "active";
  mockGetAccessToken.mockReset();
  mockMsUntilProactiveRefresh.mockReset();
  mockRefreshTokens.mockReset();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ─── Tests ───────────────────────────────────────────────────────

describe("TokenRefreshScheduler", () => {
  it("schedules a refresh at the computed lead time and reschedules after success", async () => {
    mockGetAccessToken
      .mockResolvedValueOnce("token-1")
      .mockResolvedValueOnce("token-2")
      .mockResolvedValueOnce("token-2");
    mockMsUntilProactiveRefresh
      .mockReturnValueOnce(60_000)
      .mockReturnValueOnce(120_000);
    mockRefreshTokens.mockResolvedValue(undefined);

    const scheduler = new TokenRefreshScheduler();
    await scheduler.start();

    expect(mockRefreshTokens).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60_000);
    await flushPromises();

    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    // After success, it re-reads the token and schedules the next tick.
    expect(mockMsUntilProactiveRefresh).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it("refreshes immediately when the token is already inside the refresh window", async () => {
    mockGetAccessToken
      .mockResolvedValueOnce("expiring-token")
      .mockResolvedValueOnce("new-token");
    mockMsUntilProactiveRefresh
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(120_000);
    mockRefreshTokens.mockResolvedValue(undefined);

    const scheduler = new TokenRefreshScheduler();
    await scheduler.start();
    await flushPromises();

    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("does nothing when no access token is stored", async () => {
    mockGetAccessToken.mockResolvedValue(null);

    const scheduler = new TokenRefreshScheduler();
    await scheduler.start();

    jest.advanceTimersByTime(10 * 60_000);
    await flushPromises();

    expect(mockRefreshTokens).not.toHaveBeenCalled();
    expect(mockMsUntilProactiveRefresh).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("stop() cancels the pending timer and removes the AppState listener", async () => {
    mockGetAccessToken.mockResolvedValue("token");
    mockMsUntilProactiveRefresh.mockReturnValue(60_000);

    const scheduler = new TokenRefreshScheduler();
    await scheduler.start();

    scheduler.stop();

    jest.advanceTimersByTime(5 * 60_000);
    await flushPromises();

    expect(mockRefreshTokens).not.toHaveBeenCalled();
    expect(appStateListeners.length).toBe(0);
  });

  it("skips refresh when app is backgrounded", async () => {
    mockGetAccessToken.mockResolvedValue("token");
    mockMsUntilProactiveRefresh.mockReturnValue(1_000);

    const scheduler = new TokenRefreshScheduler();
    await scheduler.start();

    emitAppState("background");

    jest.advanceTimersByTime(1_000);
    await flushPromises();

    expect(mockRefreshTokens).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("re-evaluates and refreshes on foreground resume when past the window", async () => {
    // First schedule: token expires far in the future.
    mockGetAccessToken
      .mockResolvedValueOnce("token")
      .mockResolvedValueOnce("token")
      .mockResolvedValueOnce("new-token");
    mockMsUntilProactiveRefresh
      .mockReturnValueOnce(10 * 60_000)
      // On resume, we're past the window → immediate refresh.
      .mockReturnValueOnce(0)
      // After refresh, reschedule.
      .mockReturnValueOnce(10 * 60_000);
    mockRefreshTokens.mockResolvedValue(undefined);

    const scheduler = new TokenRefreshScheduler();
    await scheduler.start();

    emitAppState("background");
    emitAppState("active");
    await flushPromises();

    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("does not crash when refreshTokens rejects and does not schedule another tick", async () => {
    mockGetAccessToken.mockResolvedValue("token");
    mockMsUntilProactiveRefresh.mockReturnValue(60_000);
    mockRefreshTokens.mockRejectedValue(new Error("SESSION_EXPIRED"));

    const scheduler = new TokenRefreshScheduler();
    await scheduler.start();

    jest.advanceTimersByTime(60_000);
    await flushPromises();

    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    // Only the initial scheduleNext read the token; no reschedule after failure.
    expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("start() is idempotent — calling twice does not double-schedule", async () => {
    mockGetAccessToken.mockResolvedValue("token");
    mockMsUntilProactiveRefresh.mockReturnValue(60_000);
    mockRefreshTokens.mockResolvedValue(undefined);

    const scheduler = new TokenRefreshScheduler();
    await scheduler.start();
    await scheduler.start();

    // Only one AppState listener was registered.
    expect(appStateListeners.length).toBe(1);

    scheduler.stop();
  });
});
