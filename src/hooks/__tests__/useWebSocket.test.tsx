/**
 * Tests pour useWebSocket - symetrie WhatsApp punitive accuses de lecture.
 *
 * Verifie que :
 * - markAsRead skip le push WS quand le toggle est OFF
 * - le handler delivery_status filtre "read" quand le toggle est OFF
 * - le handler message_unread est ignore quand le toggle est OFF
 * - le handler message_unread appelle applyMessageUnread quand le toggle est ON
 */

const mockChannelPush = jest.fn();
const mockChannelOn = jest.fn();
const mockChannelOff = jest.fn();
const mockChannelJoin = jest.fn();
const mockChannelLeave = jest.fn();
const mockIsConnected = jest.fn(() => true);
const mockChannel = {
  push: mockChannelPush,
  on: mockChannelOn,
  off: mockChannelOff,
  join: mockChannelJoin,
  leave: mockChannelLeave,
};
const mockSocket = {
  channel: jest.fn(() => mockChannel),
  isConnected: mockIsConnected,
  connect: jest.fn(),
  connectionState: "connected" as const,
  addConnectionStateListener: jest.fn(() => () => {}),
};

jest.mock("../mobile-app/src/services/messaging/websocket", () => ({
  getSharedSocket: () => mockSocket,
}));
// re-mock via relative path used by the hook
jest.mock("./src/services/messaging/websocket", () => ({
  getSharedSocket: () => mockSocket,
}));

const mockApplyMessageUnread = jest.fn();
jest.mock("./src/store/conversationsStore", () => ({
  useConversationsStore: {
    getState: () => ({
      applyMessageUnread: mockApplyMessageUnread,
    }),
  },
}));

jest.mock("./src/store/presenceStore", () => ({
  usePresenceStore: {
    getState: () => ({
      applyPresenceDiff: jest.fn(),
      setPresenceState: jest.fn(),
    }),
  },
}));

jest.mock("./src/store/callsStore", () => ({
  useCallsStore: {
    getState: () => ({
      setIncoming: jest.fn(),
      reset: jest.fn(),
      incoming: null,
      active: null,
    }),
  },
}));

jest.mock("./src/navigation/navigationRef", () => ({
  navigate: jest.fn(),
  navigationRef: {
    isReady: () => false,
    getCurrentRoute: () => null,
  },
}));

jest.mock("./src/services/calls/systemCallProvider", () => ({
  buildIncomingCallPresentation: jest.fn(),
  systemCallProvider: {
    isSupported: () => false,
    showIncomingCall: jest.fn(),
    endCall: jest.fn(),
  },
}));

jest.mock("./src/hooks/useCallsAvailable", () => ({
  isCallsAvailable: () => true,
}));

const mockGetReadReceiptsEnabled = jest.fn(() => true);
jest.mock("./src/services/messaging/readReceiptsPref", () => ({
  getReadReceiptsEnabled: () => mockGetReadReceiptsEnabled(),
}));

import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { useWebSocket } from "./src/hooks/useWebSocket";

beforeEach(() => {
  mockChannelPush.mockClear();
  mockChannelOn.mockClear();
  mockChannelOff.mockClear();
  mockChannelJoin.mockClear();
  mockChannelLeave.mockClear();
  mockIsConnected.mockClear();
  mockIsConnected.mockReturnValue(true);
  mockApplyMessageUnread.mockClear();
  mockGetReadReceiptsEnabled.mockReset();
  mockGetReadReceiptsEnabled.mockReturnValue(true);
});

const baseOptions = {
  userId: "user-1",
  token: "token-abc",
};

describe("useWebSocket - markAsRead", () => {
  it("push message_read sur le canal quand toggle ON", () => {
    mockGetReadReceiptsEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useWebSocket(baseOptions));

    act(() => {
      result.current.markAsRead("conv-1", "msg-42");
    });

    expect(mockChannelPush).toHaveBeenCalledWith("message_read", {
      message_id: "msg-42",
    });
  });

  it("skip le push quand toggle OFF (symetrie punitive)", () => {
    mockGetReadReceiptsEnabled.mockReturnValue(false);
    const { result } = renderHook(() => useWebSocket(baseOptions));

    act(() => {
      result.current.markAsRead("conv-1", "msg-42");
    });

    expect(mockChannelPush).not.toHaveBeenCalled();
  });
});

describe("useWebSocket - delivery_status filter", () => {
  function getRegisteredHandler(eventName: string): (data: any) => void {
    const entry = mockChannelOn.mock.calls.find((c) => c[0] === eventName);
    if (!entry) throw new Error(`handler ${eventName} not registered`);
    return entry[1];
  }

  it("propage delivery_status read quand toggle ON", () => {
    mockGetReadReceiptsEnabled.mockReturnValue(true);
    const onDeliveryStatus = jest.fn();
    renderHook(() => useWebSocket({ ...baseOptions, onDeliveryStatus }));

    const handler = getRegisteredHandler("delivery_status");
    handler({ message_id: "msg-1", status: "read" });
    expect(onDeliveryStatus).toHaveBeenCalledWith("msg-1", "read");
  });

  it("ignore delivery_status read quand toggle OFF", () => {
    mockGetReadReceiptsEnabled.mockReturnValue(false);
    const onDeliveryStatus = jest.fn();
    renderHook(() => useWebSocket({ ...baseOptions, onDeliveryStatus }));

    const handler = getRegisteredHandler("delivery_status");
    handler({ message_id: "msg-1", status: "read" });
    expect(onDeliveryStatus).not.toHaveBeenCalled();
  });

  it("laisse passer sent et delivered meme quand toggle OFF", () => {
    mockGetReadReceiptsEnabled.mockReturnValue(false);
    const onDeliveryStatus = jest.fn();
    renderHook(() => useWebSocket({ ...baseOptions, onDeliveryStatus }));

    const handler = getRegisteredHandler("delivery_status");
    handler({ message_id: "msg-1", status: "delivered" });
    handler({ message_id: "msg-2", status: "sent" });
    expect(onDeliveryStatus).toHaveBeenCalledTimes(2);
    expect(onDeliveryStatus).toHaveBeenNthCalledWith(1, "msg-1", "delivered");
    expect(onDeliveryStatus).toHaveBeenNthCalledWith(2, "msg-2", "sent");
  });
});

describe("useWebSocket - message_unread handler", () => {
  function getRegisteredHandler(eventName: string): (data: any) => void {
    const entry = mockChannelOn.mock.calls.find((c) => c[0] === eventName);
    if (!entry) throw new Error(`handler ${eventName} not registered`);
    return entry[1];
  }

  it("appelle applyMessageUnread sur le store quand toggle ON", () => {
    mockGetReadReceiptsEnabled.mockReturnValue(true);
    renderHook(() => useWebSocket(baseOptions));

    const handler = getRegisteredHandler("message_unread");
    handler({ message_id: "msg-7", conversation_id: "conv-9" });

    expect(mockApplyMessageUnread).toHaveBeenCalledWith({
      messageId: "msg-7",
      conversationId: "conv-9",
    });
  });

  it("ignore l event quand toggle OFF (symetrie punitive)", () => {
    mockGetReadReceiptsEnabled.mockReturnValue(false);
    renderHook(() => useWebSocket(baseOptions));

    const handler = getRegisteredHandler("message_unread");
    handler({ message_id: "msg-7", conversation_id: "conv-9" });

    expect(mockApplyMessageUnread).not.toHaveBeenCalled();
  });

  it("ignore les payloads incomplets", () => {
    mockGetReadReceiptsEnabled.mockReturnValue(true);
    renderHook(() => useWebSocket(baseOptions));

    const handler = getRegisteredHandler("message_unread");
    handler({ message_id: "msg-7" });
    handler({ conversation_id: "conv-9" });
    handler({});

    expect(mockApplyMessageUnread).not.toHaveBeenCalled();
  });
});

describe("useWebSocket - user channel leave on unmount", () => {
  it("appelle channel.leave() au cleanup pour relacher le ref count", () => {
    const { unmount } = renderHook(() => useWebSocket(baseOptions));

    expect(mockChannelLeave).not.toHaveBeenCalled();
    unmount();
    expect(mockChannelLeave).toHaveBeenCalled();
  });
});
