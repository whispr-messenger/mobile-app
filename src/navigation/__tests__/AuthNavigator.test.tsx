/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AuthNavigator is a thick orchestrator (15+ screen imports, 6 effects, 3
 * routing branches). We don't try to render every screen — instead we stub
 * each screen as a tagged <View />, mock every external dep, and assert on
 * which initialRoute the Stack.Navigator receives for each auth/profile
 * state combination.
 */

const stubScreen = (name: string) => {
  const React = require("react");
  const { Text } = require("react-native");
  return () => React.createElement(Text, null, `screen:${name}`);
};

// The Navigator stub never renders the actual screen components — it only
// exposes the structural props (initialRouteName + the registered names) so
// our assertions can read them via UNSAFE_root traversal. This sidesteps the
// "useNavigation outside NavigationContainer" error that real screen imports
// would trigger.
jest.mock("@react-navigation/stack", () => {
  const React = require("react");
  return {
    createStackNavigator: () => ({
      Navigator: ({ children, initialRouteName }: any) =>
        React.createElement("stack-navigator", { initialRouteName }, children),
      // Don't render `component` — only register the screen name.
      Screen: ({ name }: any) => React.createElement("stack-screen", { name }),
    }),
  };
});

const mockSplashStub = jest.fn(() => null);
jest.mock("../../screens/SplashScreen/SplashScreen", () => ({
  SplashScreen: () => {
    mockSplashStub();
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, "splash");
  },
}));

const mockUseAuth = jest.fn();
jest.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../hooks/useOfflineQueueDrainer", () => ({
  useOfflineQueueDrainer: jest.fn(),
}));

const mockFetchMyRole = jest.fn();
jest.mock("../../store/moderationStore", () => ({
  useModerationStore: (selector: any) =>
    selector({ fetchMyRole: mockFetchMyRole }),
}));

jest.mock("../../store/conversationsStore", () => ({
  useConversationsStore: (selector: any) =>
    selector({
      conversations: [],
      hydrateConversations: jest.fn(),
      hydrateMessages: jest.fn(),
    }),
}));

const mockProfileGet = jest.fn().mockResolvedValue("1"); // "1"=done, "0"=pending, null=unknown
jest.mock("../../services/profileSetupFlag", () => ({
  profileSetupFlag: {
    get: (...args: unknown[]) => mockProfileGet(...args),
    markPending: jest.fn(),
    markDone: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock("../../services/contacts/api", () => ({
  contactsAPI: {
    getContacts: jest.fn().mockResolvedValue({ contacts: [], total: 0 }),
  },
}));
jest.mock("../../services/TokenService", () => ({
  TokenService: { getAccessToken: jest.fn().mockResolvedValue("at") },
}));
jest.mock("../../services/UserService", () => ({
  UserService: {
    getInstance: () => ({
      getProfile: jest.fn().mockResolvedValue({ success: true, profile: {} }),
    }),
  },
}));
jest.mock("../../services/NotificationService", () => ({
  NotificationService: { initPushRegistration: jest.fn() },
}));
jest.mock("../../services/calls/systemCallProvider", () => ({
  systemCallProvider: {
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("../../services/calls/callNotificationBridge", () => ({
  initCallNotificationBridge: jest.fn(() => () => undefined),
}));
jest.mock("../../hooks/useCallsAvailable", () => ({
  isCallsAvailable: () => false,
}));
jest.mock("../../hooks/useResolvedMediaUrl", () => ({
  prefetchResolvedMediaUris: jest.fn(),
}));
jest.mock("../../services/messaging/api", () => ({
  messagingAPI: {
    listConversations: jest
      .fn()
      .mockResolvedValue({ conversations: [], total: 0 }),
    listMessages: jest.fn().mockResolvedValue({ messages: [] }),
  },
}));
jest.mock("../../services/messaging/cache", () => ({
  cacheService: {
    loadConversations: jest.fn().mockResolvedValue([]),
    loadMessages: jest.fn().mockResolvedValue([]),
  },
}));

import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { AuthNavigator } from "../AuthNavigator";

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockProfileGet.mockResolvedValue("1");
});

afterEach(() => {
  jest.useRealTimers();
});

const findStackNavigator = (root: any) => {
  // The fake-renderer tree exposes our custom `stack-navigator` host element.
  // Walk down until we find one or return null.
  let queue: any[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (node?.type === "stack-navigator") return node;
    if (node?.children) queue.push(...node.children);
  }
  return null;
};

describe("AuthNavigator routing", () => {
  it("renders the SplashScreen while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      userId: null,
    });
    const { getByText } = render(<AuthNavigator />);
    expect(getByText("splash")).toBeTruthy();
  });

  it("renders the SplashScreen until the minimum 2s delay elapses", async () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      userId: null,
    });
    const { getByText, queryByText } = render(<AuthNavigator />);
    expect(getByText("splash")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2100);
    });
    await flush();

    // After splash min elapses + isAuthenticated=false → Welcome route
    await waitFor(() => expect(queryByText("splash")).toBeNull());
  });

  it("uses Welcome as initial route for an unauthenticated session", async () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      userId: null,
    });
    const { UNSAFE_root } = render(<AuthNavigator />);

    act(() => {
      jest.advanceTimersByTime(2100);
    });
    await flush();

    const nav = findStackNavigator(UNSAFE_root);
    expect(nav?.props.initialRouteName).toBe("Welcome");
  });

  it("uses ConversationsList as initial route for an authenticated session whose profile is complete", async () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      userId: "u-1",
    });
    mockProfileGet.mockResolvedValue("1");
    const { UNSAFE_root } = render(<AuthNavigator />);

    act(() => {
      jest.advanceTimersByTime(2100);
    });
    await flush();
    await flush();

    const nav = findStackNavigator(UNSAFE_root);
    expect(nav?.props.initialRouteName).toBe("ConversationsList");
  });

  it("uses ProfileSetup as initial route when the profile setup flag is still pending", async () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      userId: "u-1",
    });
    mockProfileGet.mockResolvedValue("0");

    const { UNSAFE_root } = render(<AuthNavigator />);

    act(() => {
      jest.advanceTimersByTime(2100);
    });
    await flush();
    await flush();

    const nav = findStackNavigator(UNSAFE_root);
    expect(nav?.props.initialRouteName).toBe("ProfileSetup");
  });

  it("triggers fetchMyRole from moderationStore on first authenticated render", async () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      userId: "u-1",
    });
    render(<AuthNavigator />);
    await flush();

    expect(mockFetchMyRole).toHaveBeenCalled();
  });
});
