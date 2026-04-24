/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock factories for jest.mock() — pass these directly to jest.mock(path, factory).
// Stays out of the runtime bundle (src/__test-utils__ is test-only).

export const makeTokenServiceMock = () => ({
  TokenService: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    saveTokens: jest.fn(),
    clearTokens: jest.fn(),
    clearAll: jest.fn(),
    isTokenExpired: jest.fn(),
    decodeAccessToken: jest.fn(),
    saveIdentityPrivateKey: jest.fn(),
    getIdentityPrivateKey: jest.fn(),
    clearIdentityPrivateKey: jest.fn(),
  },
});

export const makeLoggerMock = () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
});

export const makeApiBaseMock = (base = "https://api.test") => ({
  getApiBaseUrl: jest.fn(() => base),
  getWsBaseUrl: jest.fn(() => base.replace(/^https?/, "ws")),
});

export const makeAuthServiceMock = () => ({
  AuthService: {
    refreshTokens: jest.fn(),
    requestVerification: jest.fn(),
    confirmVerification: jest.fn(),
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    validateSession: jest.fn(),
  },
});

export const makeDeviceServiceMock = () => ({
  DeviceService: {
    getOrCreateDeviceId: jest.fn(),
    getDeviceInfo: jest.fn(),
  },
});

export const makeSignalKeyServiceMock = () => ({
  SignalKeyService: {
    generateKeyBundle: jest.fn(),
  },
});

export const makeNotificationServiceMock = () => ({
  NotificationService: {
    getBadge: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    muteConversation: jest.fn(),
    unmuteConversation: jest.fn(),
    registerDevice: jest.fn().mockResolvedValue(undefined),
    unregisterDevice: jest.fn().mockResolvedValue(undefined),
    initPushRegistration: jest.fn().mockResolvedValue(undefined),
    tearDownPushRegistration: jest.fn(),
  },
});

export const makeSessionEventsMock = () => ({
  SESSION_EXPIRED_EVENT: "whispr.session.expired",
  emitSessionExpired: jest.fn(),
  onSessionExpired: jest.fn(() => ({ remove: jest.fn() })),
});

// ---- fetch mock helpers ----

export type MockResponseInit<T = unknown> = {
  ok?: boolean;
  status?: number;
  body?: T;
  textBody?: string;
};

export const mockResponse = <T>(init: MockResponseInit<T> = {}): Response => {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    json: async () => {
      if (init.body !== undefined) return init.body;
      if (init.textBody !== undefined) return JSON.parse(init.textBody);
      return {};
    },
    text: async () =>
      init.textBody ??
      (init.body === undefined ? "" : JSON.stringify(init.body)),
  } as unknown as Response;
};

export const installFetchMock = (): jest.Mock => {
  const fn = jest.fn();
  (global as any).fetch = fn;
  return fn;
};

// ---- in-memory AsyncStorage backing store ----

export const makeAsyncStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    store,
    mock: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        for (const k of Object.keys(store)) delete store[k];
      }),
    },
  };
};
