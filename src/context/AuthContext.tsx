import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthService } from "../services/AuthService";
import { TokenService } from "../services/TokenService";
import { profileSetupFlag } from "../services/profileSetupFlag";
import { tokenRefreshScheduler } from "../services/TokenRefreshScheduler";
import { destroySharedSocket } from "../services/messaging/websocket";
import { useConversationsStore } from "../store/conversationsStore";
import { usePresenceStore } from "../store/presenceStore";
import { useModerationStore } from "../store/moderationStore";
import { useCallsStore } from "../store/callsStore";
import { cacheService } from "../services/messaging/cache";
import { offlineQueue } from "../services/offlineQueue";
import { onSessionExpired } from "../services/sessionEvents";
import { useBadgeSync } from "../hooks/useBadgeSync";

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
    destroySharedSocket();

    // Reset stores and caches to prevent data leaking between users
    useConversationsStore.getState().reset();
    usePresenceStore.getState().reset();
    useModerationStore.getState().reset();
    useCallsStore.getState().reset();
    await cacheService.clearCache();
    await offlineQueue.clearAll();
    await AsyncStorage.removeItem("@whispr/manually_unread_ids");
    await profileSetupFlag.clear();

    if (state.deviceId && state.userId) {
      await AuthService.logout(state.deviceId, state.userId);
    } else {
      await TokenService.clearTokens();
    }
    // Drop the per-device Signal identity private key — it is bound to the
    // session that just ended and must not leak into the next account.
    await TokenService.clearIdentityPrivateKey();
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
