import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthService } from '../services/AuthService';
import { TokenService } from '../services/TokenService';
import { destroySharedSocket } from '../services/messaging/websocket';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  }, []);

  const signOut = useCallback(async () => {
    // Tear down WebSocket before clearing auth state
    destroySharedSocket();

    if (state.deviceId && state.userId) {
      await AuthService.logout(state.deviceId, state.userId);
    } else {
      await TokenService.clearTokens();
    }
    setState({
      isAuthenticated: false,
      isLoading: false,
      userId: null,
      deviceId: null,
    });
  }, [state.deviceId, state.userId]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
