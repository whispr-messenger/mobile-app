import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AuthService } from "../services/AuthService";
import { AppResetService } from "../services/AppResetService";
import { NotificationService } from "../services/NotificationService";
import { tokenRefreshScheduler } from "../services/TokenRefreshScheduler";
import { destroySharedSocket } from "../services/messaging/websocket";
import { useConversationsStore } from "../store/conversationsStore";
import { usePresenceStore } from "../store/presenceStore";
import { useModerationStore } from "../store/moderationStore";
import { useCallsStore } from "../store/callsStore";
import { onSessionExpired } from "../services/sessionEvents";
import { useBadgeSync } from "../hooks/useBadgeSync";
import { systemCallProvider } from "../services/calls/systemCallProvider";
import {
  clearResolvedMediaCache,
  setResolvedMediaCacheScope,
} from "../hooks/useResolvedMediaUrl";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  deviceId: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (userId: string, deviceId: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    userId: null,
    deviceId: null,
  });

  // On mount: validate existing session via network call
  useEffect(() => {
    AuthService.validateSession()
      .then((session) => {
        setState({
          isAuthenticated: session !== null,
          isLoading: false,
          userId: session?.userId ?? null,
          deviceId: session?.deviceId ?? null,
        });
        if (session) {
          void tokenRefreshScheduler.start();
          // Cold-start avec token persisté : initPushRegistration ne tourne
          // qu'au login/register côté AuthService, donc une rotation FCM
          // ou un registerDevice raté reste invisible jusqu'au prochain
          // signOut/signIn manuel. On re-tente ici (best-effort, swallow).
          void NotificationService.initPushRegistration(session.userId);
        }
      })
      .catch(() => {
        setState({
          isAuthenticated: false,
          isLoading: false,
          userId: null,
          deviceId: null,
        });
      });
  }, []);

  const signIn = useCallback((userId: string, deviceId: string) => {
    setResolvedMediaCacheScope(userId);
    setState({
      isAuthenticated: true,
      isLoading: false,
      userId,
      deviceId,
    });
    void tokenRefreshScheduler.start();
  }, []);

  const signOut = useCallback(async () => {
    // Stop the proactive refresh timer before tearing down the session so it
    // doesn't fire a refresh against a dead session.
    tokenRefreshScheduler.stop();

    // Tear down WebSocket before clearing auth state

    // Reset in-memory Zustand state so screens unmount with a clean slate.
    // The on-disk caches are wiped by AppResetService below, but the
    // resident state needs an explicit reset since the stores aren't
    // persisted via AsyncStorage middleware.
    useConversationsStore.getState().reset();
    usePresenceStore.getState().reset();
    useModerationStore.getState().reset();
    useCallsStore.getState().reset();
    await systemCallProvider.resetAll().catch(() => {});

    // Best-effort server-side logout. Swallow failures so the local
    // cleanup still happens if the server is unreachable.
    if (state.deviceId && state.userId) {
      await AuthService.logout(state.deviceId, state.userId).catch(() => {});
    }

    // WHISPR-1221 — sweep every per-account key under our prefixes
    // (settings, caches, queued messages, manually-unread set, profile
    // setup flag, tokens, Signal identity key, …). Allowlist preserves
    // theme + language only.
    await AppResetService.resetAppData();
    await clearResolvedMediaCache(state.userId).catch(() => {});
    setResolvedMediaCacheScope("anon");

    setState({
      isAuthenticated: false,
      isLoading: false,
      userId: null,
      deviceId: null,
    });
  }, [state.deviceId, state.userId]);

  // Listen for session-expired events emitted by service-layer 401/revocation
  // handlers. Clears local state and navigates the user back to the login
  // screen without relying on each screen to catch the error individually.
  const signOutRef = useRef(signOut);
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);
  useEffect(() => {
    const sub = onSessionExpired((payload) => {
      console.warn(
        "[AuthContext] sessionExpired event received, signing out:",
        payload,
      );
      signOutRef.current().catch(() => {
        // Best-effort: ignore errors, signOut already clears local state.
      });
    });
    return () => sub.remove();
  }, []);

  // WHISPR-1049: sync app icon badge on cold-start and auth transitions.
  useBadgeSync(state.isAuthenticated);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
