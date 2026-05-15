import React from "react";
import { render, act } from "@testing-library/react-native";
import { InAppNotificationProvider } from "./src/providers/InAppNotificationProvider";
import type { Message } from "./src/types/messaging";

let capturedOptions: any;
const mockApplyNewMessage = jest.fn();
const mockGetAccessToken = jest.fn();
const mockCurrentRoute = jest.fn();

jest.mock("./src/hooks/useWebSocket", () => ({
  useWebSocket: (options: any) => {
    capturedOptions = options;
    return { connectionState: "connected" };
  },
}));

jest.mock("./src/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    userId: "user-1",
    deviceId: "device-1",
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock("./src/services/TokenService", () => ({
  TokenService: {
    getAccessToken: () => mockGetAccessToken(),
  },
}));

jest.mock("./src/store/conversationsStore", () => ({
  useConversationsStore: (selector: any) =>
    selector({ applyNewMessage: mockApplyNewMessage }),
}));

jest.mock("./src/navigation/navigationRef", () => ({
  navigationRef: {
    getCurrentRoute: () => mockCurrentRoute(),
  },
}));

jest.mock("./src/components/Toast/Toast", () => (props: any) => {
  const { Text } = require("react-native");
  return props.visible ? <Text>{props.message}</Text> : null;
});

const { Text } = require("react-native");

const incomingMessage: Message = {
  id: "msg-1",
  conversation_id: "conv-1",
  sender_id: "user-2",
  message_type: "text",
  content: "hello",
  metadata: {},
  client_random: 1,
  sent_at: "2026-05-14T10:00:00Z",
  is_deleted: false,
};

describe("InAppNotificationProvider", () => {
  beforeEach(() => {
    capturedOptions = undefined;
    mockApplyNewMessage.mockClear();
    mockGetAccessToken.mockReset();
    mockGetAccessToken.mockResolvedValue("token-1");
    mockCurrentRoute.mockReset();
    mockCurrentRoute.mockReturnValue({ name: "Conversations" });
  });

  it("shows a global toast and updates conversations for an incoming message outside the active chat", async () => {
    const screen = render(
      <InAppNotificationProvider>
        <Text>App</Text>
      </InAppNotificationProvider>,
    );

    await act(async () => {});

    act(() => {
      capturedOptions.onNewMessage(incomingMessage);
    });

    expect(mockApplyNewMessage).toHaveBeenCalledWith(incomingMessage, "user-1");
    expect(screen.getByText("Nouveau message")).toBeTruthy();
  });

  it("updates conversations but hides the toast for the active chat", async () => {
    mockCurrentRoute.mockReturnValue({
      name: "Chat",
      params: { conversationId: "conv-1" },
    });

    const screen = render(
      <InAppNotificationProvider>
        <Text>App</Text>
      </InAppNotificationProvider>,
    );

    await act(async () => {});

    act(() => {
      capturedOptions.onNewMessage(incomingMessage);
    });

    expect(mockApplyNewMessage).toHaveBeenCalledWith(incomingMessage, "user-1");
    expect(screen.queryByText("Nouveau message")).toBeNull();
  });

  it("updates conversations but hides the toast for messages sent by the current user", async () => {
    const ownMessage = {
      ...incomingMessage,
      id: "msg-own",
      sender_id: "user-1",
    };

    const screen = render(
      <InAppNotificationProvider>
        <Text>App</Text>
      </InAppNotificationProvider>,
    );

    await act(async () => {});

    act(() => {
      capturedOptions.onNewMessage(ownMessage);
    });

    expect(mockApplyNewMessage).toHaveBeenCalledWith(ownMessage, "user-1");
    expect(screen.queryByText("Nouveau message")).toBeNull();
  });
});
