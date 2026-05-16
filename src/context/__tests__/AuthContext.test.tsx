/**
 * Tests for AuthContext (AuthProvider + useAuth).
 *
 * Couvre:
 * - validateSession resolves with a session → state authenticated
 * - validateSession resolves null → state unauthenticated
 * - validateSession rejects → state unauthenticated
 * - signIn met les flags isAuthenticated + démarre tokenRefreshScheduler
 * - signOut: stop scheduler, reset stores, logout server, resetAppData
 * - sessionExpired event triggers signOut
 * - useAuth hors provider throw
 */

import React from "react";
import { Text } from "react-native";

const mockValidateSession = jest.fn();
const mockLogout = jest.fn();
jest.mock("../../services/AuthService", () => ({
  AuthService: {
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
  },
}));

const mockResetAppData = jest.fn(async () => {});
jest.mock("../../services/AppResetService", () => ({
  AppResetService: {
    resetAppData: () => mockResetAppData(),
  },
}));

const mockInitPushRegistration = jest.fn(async () => {});
jest.mock("../../services/NotificationService", () => ({
  NotificationService: {
    initPushRegistration: (...args: unknown[]) =>
      mockInitPushRegistration(...args),
  },
}));

const mockSchedulerStart = jest.fn(async () => {});
const mockSchedulerStop = jest.fn();
jest.mock("../../services/TokenRefreshScheduler", () => ({
  tokenRefreshScheduler: {
    start: () => mockSchedulerStart(),
    stop: () => mockSchedulerStop(),
  },
}));

const mockDestroySharedSocket = jest.fn();
jest.mock("../../services/messaging/websocket", () => ({
  destroySharedSocket: () => mockDestroySharedSocket(),
}));

const mockConversationsReset = jest.fn();
const mockPresenceReset = jest.fn();
const mockModerationReset = jest.fn();
const mockCallsReset = jest.fn();
jest.mock("../../store/conversationsStore", () => ({
  useConversationsStore: {
    getState: () => ({ reset: mockConversationsReset }),
  },
}));
jest.mock("../../store/presenceStore", () => ({
  usePresenceStore: {
    getState: () => ({ reset: mockPresenceReset }),
  },
}));
jest.mock("../../store/moderationStore", () => ({
  useModerationStore: {
    getState: () => ({ reset: mockModerationReset }),
  },
}));
jest.mock("../../store/callsStore", () => ({
  useCallsStore: {
    getState: () => ({ reset: mockCallsReset }),
  },
}));

const mockOnSessionExpired = jest.fn();
jest.mock("../../services/sessionEvents", () => ({
  onSessionExpired: (h: (p: unknown) => void) => mockOnSessionExpired(h),
}));

const mockUseBadgeSync = jest.fn();
jest.mock("../../hooks/useBadgeSync", () => ({
  useBadgeSync: (auth: boolean) => mockUseBadgeSync(auth),
}));

const mockSystemCallReset = jest.fn(async () => {});
jest.mock("../../services/calls/systemCallProvider", () => ({
  systemCallProvider: {
    resetAll: () => mockSystemCallReset(),
  },
}));

const mockClearResolvedMediaCache = jest.fn(async () => {});
const mockSetResolvedMediaCacheScope = jest.fn();
jest.mock("../../hooks/useResolvedMediaUrl", () => ({
  clearResolvedMediaCache: (...args: unknown[]) =>
    mockClearResolvedMediaCache(...args),
  setResolvedMediaCacheScope: (...args: unknown[]) =>
    mockSetResolvedMediaCacheScope(...args),
}));

import { render, waitFor, act } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../AuthContext";

beforeEach(() => {
  jest.clearAllMocks();
  // default: session expired listener registers and returns a cleanup
  mockOnSessionExpired.mockReturnValue({ remove: jest.fn() });
});

// Component that exposes the auth context as JSON text so we can assert on it.
function AuthProbe({
  onReady,
}: {
  onReady?: (auth: ReturnType<typeof useAuth>) => void;
}) {
  const auth = useAuth();
  if (onReady) onReady(auth);
  return (
    <Text testID="auth-state">
      {JSON.stringify({
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        userId: auth.userId,
        deviceId: auth.deviceId,
      })}
    </Text>
  );
}

describe("AuthProvider — bootstrap", () => {
  it("validateSession returns session → authenticated state + scheduler started + push re-registered", async () => {
    mockValidateSession.mockResolvedValueOnce({
      userId: "u-1",
      deviceId: "d-1",
    });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isAuthenticated).toBe(true);
      expect(json.isLoading).toBe(false);
      expect(json.userId).toBe("u-1");
      expect(json.deviceId).toBe("d-1");
    });

    expect(mockSchedulerStart).toHaveBeenCalled();
    expect(mockInitPushRegistration).toHaveBeenCalledWith("u-1");
  });

  it("validateSession returns null → unauthenticated state", async () => {
    mockValidateSession.mockResolvedValueOnce(null);

    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isLoading).toBe(false);
      expect(json.isAuthenticated).toBe(false);
    });

    expect(mockSchedulerStart).not.toHaveBeenCalled();
    expect(mockInitPushRegistration).not.toHaveBeenCalled();
  });

  it("validateSession rejects → unauthenticated state (errors swallowed)", async () => {
    mockValidateSession.mockRejectedValueOnce(new Error("network down"));

    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isLoading).toBe(false);
      expect(json.isAuthenticated).toBe(false);
      expect(json.userId).toBeNull();
      expect(json.deviceId).toBeNull();
    });
  });
});

describe("AuthProvider — signIn / signOut", () => {
  it("signIn flips authenticated + sets media cache scope + starts scheduler", async () => {
    mockValidateSession.mockResolvedValueOnce(null);

    let captured: ReturnType<typeof useAuth> | null = null;
    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe onReady={(a) => (captured = a)} />
      </AuthProvider>,
    );

    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isLoading).toBe(false);
    });

    await act(async () => {
      captured!.signIn("u-2", "d-2");
    });

    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isAuthenticated).toBe(true);
      expect(json.userId).toBe("u-2");
      expect(json.deviceId).toBe("d-2");
    });

    expect(mockSetResolvedMediaCacheScope).toHaveBeenCalledWith("u-2");
    expect(mockSchedulerStart).toHaveBeenCalled();
  });

  it("signOut tears down scheduler, resets stores, calls server logout, resets app data", async () => {
    mockValidateSession.mockResolvedValueOnce({
      userId: "u-3",
      deviceId: "d-3",
    });
    mockLogout.mockResolvedValueOnce(undefined);

    let captured: ReturnType<typeof useAuth> | null = null;
    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe onReady={(a) => (captured = a)} />
      </AuthProvider>,
    );

    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await captured!.signOut();
    });

    expect(mockSchedulerStop).toHaveBeenCalled();
    expect(mockConversationsReset).toHaveBeenCalled();
    expect(mockPresenceReset).toHaveBeenCalled();
    expect(mockModerationReset).toHaveBeenCalled();
    expect(mockCallsReset).toHaveBeenCalled();
    expect(mockSystemCallReset).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledWith("d-3", "u-3");
    expect(mockResetAppData).toHaveBeenCalled();
    expect(mockClearResolvedMediaCache).toHaveBeenCalledWith("u-3");
    expect(mockSetResolvedMediaCacheScope).toHaveBeenCalledWith("anon");

    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isAuthenticated).toBe(false);
      expect(json.userId).toBeNull();
      expect(json.deviceId).toBeNull();
    });
  });

  it("signOut swallows logout errors and still clears local state", async () => {
    mockValidateSession.mockResolvedValueOnce({
      userId: "u-4",
      deviceId: "d-4",
    });
    mockLogout.mockRejectedValueOnce(new Error("server unreachable"));

    let captured: ReturnType<typeof useAuth> | null = null;
    const { getByTestId } = render(
      <AuthProvider>
        <AuthProbe onReady={(a) => (captured = a)} />
      </AuthProvider>,
    );
    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await captured!.signOut();
    });

    expect(mockResetAppData).toHaveBeenCalled();
    await waitFor(() => {
      const json = JSON.parse(
        getByTestId("auth-state").props.children as string,
      );
      expect(json.isAuthenticated).toBe(false);
    });
  });

  it("signOut without prior session skips server logout (no userId/deviceId)", async () => {
    mockValidateSession.mockResolvedValueOnce(null);

    let captured: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <AuthProbe onReady={(a) => (captured = a)} />
      </AuthProvider>,
    );
    await waitFor(() => expect(captured).not.toBeNull());

    await act(async () => {
      await captured!.signOut();
    });

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockResetAppData).toHaveBeenCalled();
  });
});

describe("AuthProvider — sessionExpired event", () => {
  it("registers a session-expired listener and triggers signOut on event", async () => {
    mockValidateSession.mockResolvedValueOnce({
      userId: "u-5",
      deviceId: "d-5",
    });
    let registered: ((p: unknown) => void) | null = null;
    const removeFn = jest.fn();
    mockOnSessionExpired.mockImplementation((h) => {
      registered = h;
      return { remove: removeFn };
    });
    mockLogout.mockResolvedValueOnce(undefined);
    // Silence the warn() emitted by AuthContext when the event fires.
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { unmount } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(registered).not.toBeNull());

    await act(async () => {
      registered!({ reason: "401" });
      // give the chained promise a tick
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSchedulerStop).toHaveBeenCalled();
    expect(mockResetAppData).toHaveBeenCalled();

    unmount();
    expect(removeFn).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    function Bad() {
      useAuth();
      return null;
    }
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/AuthProvider/);
    errSpy.mockRestore();
  });

  it("passes the current isAuthenticated to useBadgeSync", async () => {
    mockValidateSession.mockResolvedValueOnce({
      userId: "u-6",
      deviceId: "d-6",
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockUseBadgeSync).toHaveBeenCalledWith(true);
    });
  });
});
