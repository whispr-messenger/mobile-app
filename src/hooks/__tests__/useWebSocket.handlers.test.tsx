/**
 * Tests complémentaires pour useWebSocket :
 * - user channel handlers : new_message / message_created, message_deleted, conversation_*,
 *   incoming_call, call_ended, inbox:new
 * - joinConversationChannel : all conversation-scope handlers (typing, message_updated,
 *   message_deleted, delivery_status, presence_diff/state, reaction_added/removed)
 * - sendMessage / sendTyping / markAsRead happy + disconnected paths
 * - bail-out quand options.userId/token vides
 * - mute-only (early return), pas de socket
 */

const mockChannelPush = jest.fn();
const mockChannelOn = jest.fn();
const mockChannelOff = jest.fn();
const mockChannelJoin = jest.fn();
const mockChannelLeave = jest.fn();
const mockIsConnected = jest.fn(() => true);
const mockConnectionStateListeners: ((s: string) => void)[] = [];

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
  addConnectionStateListener: jest.fn((cb: (s: string) => void) => {
    mockConnectionStateListeners.push(cb);
    return () => {
      const i = mockConnectionStateListeners.indexOf(cb);
      if (i >= 0) mockConnectionStateListeners.splice(i, 1);
    };
  }),
};

jest.mock("../../services/messaging/websocket", () => ({
  getSharedSocket: () => mockSocket,
}));

const mockApplyMessageUnread = jest.fn();
jest.mock("../../store/conversationsStore", () => ({
  useConversationsStore: {
    getState: () => ({
      applyMessageUnread: mockApplyMessageUnread,
    }),
  },
}));

const mockApplyPresenceDiff = jest.fn();
const mockSetPresenceState = jest.fn();
jest.mock("../../store/presenceStore", () => ({
  usePresenceStore: {
    getState: () => ({
      applyPresenceDiff: mockApplyPresenceDiff,
      setPresenceState: mockSetPresenceState,
    }),
  },
}));

const mockSetIncoming = jest.fn();
const mockCallsReset = jest.fn();
let mockIncomingValue: unknown = null;
const mockActive: unknown = null;
jest.mock("../../store/callsStore", () => ({
  useCallsStore: {
    getState: () => ({
      setIncoming: mockSetIncoming,
      reset: mockCallsReset,
      get incoming() {
        return mockIncomingValue;
      },
      active: mockActive,
    }),
  },
}));

const mockInboxAddNew = jest.fn();
jest.mock("../../store/inboxStore", () => ({
  useInboxStore: {
    getState: () => ({
      addNew: mockInboxAddNew,
    }),
  },
}));

const mockNavigate = jest.fn();
let mockCurrentRoute: { name: string } | null = null;
jest.mock("../../navigation/navigationRef", () => ({
  navigate: (...a: unknown[]) => mockNavigate(...a),
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => mockCurrentRoute,
  },
}));

const mockSystemShow = jest.fn();
const mockSystemEnd = jest.fn();
let mockSystemIsSupported = false;
jest.mock("../../services/calls/systemCallProvider", () => ({
  buildIncomingCallPresentation: jest.fn((c: unknown) => c),
  systemCallProvider: {
    isSupported: () => mockSystemIsSupported,
    showIncomingCall: (...a: unknown[]) => mockSystemShow(...a),
    endCall: (...a: unknown[]) => mockSystemEnd(...a),
  },
}));

let mockCallsAvailable = true;
jest.mock("../useCallsAvailable", () => ({
  isCallsAvailable: () => mockCallsAvailable,
}));

const mockReadReceiptsEnabled = jest.fn(() => true);
jest.mock("../../services/messaging/readReceiptsPref", () => ({
  getReadReceiptsEnabled: () => mockReadReceiptsEnabled(),
}));

import { renderHook, act } from "@testing-library/react-native";
import { useWebSocket } from "../useWebSocket";
import { AppState } from "react-native";

beforeEach(() => {
  jest.clearAllMocks();
  mockIsConnected.mockReturnValue(true);
  mockReadReceiptsEnabled.mockReturnValue(true);
  mockIncomingValue = null;
  mockCurrentRoute = null;
  mockSystemIsSupported = false;
  mockCallsAvailable = true;
  // Make AppState.currentState mutable for the incoming_call test.
  Object.defineProperty(AppState, "currentState", {
    value: "active",
    configurable: true,
    writable: true,
  });
});

const baseOptions = { userId: "user-1", token: "token-abc" };

function getHandler(eventName: string): (data: unknown) => void {
  const entry = mockChannelOn.mock.calls.find((c) => c[0] === eventName);
  if (!entry) throw new Error(`handler ${eventName} not registered`);
  return entry[1];
}

describe("useWebSocket — user channel handlers", () => {
  it("new_message + message_created → onNewMessage avec message.id valide", () => {
    const onNewMessage = jest.fn();
    renderHook(() => useWebSocket({ ...baseOptions, onNewMessage }));

    getHandler("new_message")({ id: "m1", content: "hi" });
    getHandler("message_created")({ message: { id: "m2", content: "yo" } });
    // payload sans id → ignoré
    getHandler("new_message")({ content: "no id" });

    expect(onNewMessage).toHaveBeenCalledTimes(2);
    expect(onNewMessage).toHaveBeenNthCalledWith(1, {
      id: "m1",
      content: "hi",
    });
    expect(onNewMessage).toHaveBeenNthCalledWith(2, {
      id: "m2",
      content: "yo",
    });
  });

  it("message_deleted user channel forwards id or message_id with deleteForEveryone=true", () => {
    const onMessageDeleted = jest.fn();
    renderHook(() => useWebSocket({ ...baseOptions, onMessageDeleted }));

    getHandler("message_deleted")({ id: "m1", conversation_id: "c1" });
    getHandler("message_deleted")({ message_id: "m2", conversation_id: "c1" });
    getHandler("message_deleted")({ conversation_id: "c1" }); // no id → ignored

    expect(onMessageDeleted).toHaveBeenCalledTimes(2);
    expect(onMessageDeleted).toHaveBeenNthCalledWith(1, "m1", true);
    expect(onMessageDeleted).toHaveBeenNthCalledWith(2, "m2", true);
  });

  it("conversation_summaries handles array, { conversations }, { summaries } shapes", () => {
    const onConversationSummaries = jest.fn();
    renderHook(() => useWebSocket({ ...baseOptions, onConversationSummaries }));

    getHandler("conversation_summaries")([{ id: "c1" }]);
    getHandler("conversation_summaries")({ conversations: [{ id: "c2" }] });
    getHandler("conversation_summaries")({ summaries: [{ id: "c3" }] });
    getHandler("conversation_summaries")({}); // no array → no call

    expect(onConversationSummaries).toHaveBeenCalledTimes(3);
  });

  it("conversation_archived forwards id + archived flag", () => {
    const onConversationArchived = jest.fn();
    renderHook(() => useWebSocket({ ...baseOptions, onConversationArchived }));

    getHandler("conversation_archived")({
      conversation_id: "c1",
      archived: true,
    });
    getHandler("conversation_archived")({
      conversation_id: "c2",
      archived: false,
    });
    // bad payload → ignored
    getHandler("conversation_archived")({ conversation_id: "c3" });
    getHandler("conversation_archived")({ archived: true });

    expect(onConversationArchived).toHaveBeenCalledTimes(2);
    expect(onConversationArchived).toHaveBeenNthCalledWith(1, "c1", true);
    expect(onConversationArchived).toHaveBeenNthCalledWith(2, "c2", false);
  });

  it("incoming_call pushes to store and navigates when calls available", () => {
    mockIncomingValue = {
      callId: "call-1",
      initiatorId: "u-other",
      conversationId: "c1",
      type: "audio",
    };
    renderHook(() => useWebSocket(baseOptions));

    getHandler("incoming_call")({
      call_id: "call-1",
      initiator_id: "u-other",
      conversation_id: "c1",
      type: "audio",
      caller_name: "Bob",
    });

    expect(mockSetIncoming).toHaveBeenCalledWith({
      callId: "call-1",
      initiatorId: "u-other",
      conversationId: "c1",
      type: "audio",
      displayName: "Bob",
    });
    expect(mockNavigate).toHaveBeenCalledWith("IncomingCall");
  });

  it("incoming_call shows CallKit when app backgrounded and system supported", () => {
    mockSystemIsSupported = true;
    Object.defineProperty(AppState, "currentState", {
      value: "background",
      configurable: true,
      writable: true,
    });
    mockIncomingValue = {
      callId: "call-1",
      initiatorId: "u-other",
      conversationId: "c1",
      type: "video",
    };

    renderHook(() => useWebSocket(baseOptions));
    getHandler("incoming_call")({
      call_id: "call-1",
      initiator_id: "u-other",
      conversation_id: "c1",
      type: "video",
      initiator_name: "Alice",
    });

    expect(mockSystemShow).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("incoming_call ignored when calls feature disabled", () => {
    mockCallsAvailable = false;
    renderHook(() => useWebSocket(baseOptions));
    getHandler("incoming_call")({
      call_id: "call-1",
      initiator_id: "u-other",
      conversation_id: "c1",
      type: "audio",
    });
    expect(mockSetIncoming).not.toHaveBeenCalled();
  });

  it("incoming_call ignored when payload missing call_id", () => {
    renderHook(() => useWebSocket(baseOptions));
    getHandler("incoming_call")({});
    expect(mockSetIncoming).not.toHaveBeenCalled();
  });

  it("call_ended resets calls store and navigates away from InCall screen", () => {
    mockIncomingValue = { callId: "call-99" };
    mockCurrentRoute = { name: "InCall" };
    renderHook(() => useWebSocket(baseOptions));

    getHandler("call_ended")({});

    expect(mockSystemEnd).toHaveBeenCalledWith("call-99", 2);
    expect(mockCallsReset).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("ConversationsList");
  });

  it("call_ended no-ops when neither incoming nor active call", () => {
    renderHook(() => useWebSocket(baseOptions));
    getHandler("call_ended")({});
    expect(mockSystemEnd).not.toHaveBeenCalled();
    expect(mockCallsReset).toHaveBeenCalled();
  });

  it("inbox:new adds an item to the inbox store when id present", () => {
    renderHook(() => useWebSocket(baseOptions));
    getHandler("inbox:new")({ id: "ix1" });
    getHandler("inbox:new")({}); // ignored
    expect(mockInboxAddNew).toHaveBeenCalledTimes(1);
  });
});

describe("useWebSocket — joinConversationChannel handlers", () => {
  it("registers conversation handlers and returns a cleanup function", () => {
    const onTyping = jest.fn();
    const onMessageUpdated = jest.fn();
    const onDeliveryStatus = jest.fn();
    const onMessageDeleted = jest.fn();
    const onPresenceUpdate = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket({
        ...baseOptions,
        onTyping,
        onMessageUpdated,
        onDeliveryStatus,
        onMessageDeleted,
        onPresenceUpdate,
      }),
    );

    let handle:
      | ReturnType<typeof result.current.joinConversationChannel>
      | undefined;
    act(() => {
      handle = result.current.joinConversationChannel("conv-42");
    });
    expect(handle).toBeDefined();
    expect(handle!.channel).toBeDefined();

    // Find the conversation-channel handlers (registered AFTER user-channel ones).
    function getConvHandler(name: string) {
      const calls = mockChannelOn.mock.calls.filter((c) => c[0] === name);
      return calls[calls.length - 1][1];
    }

    getConvHandler("user_typing")({ user_id: "u-2", typing: true });
    expect(onTyping).toHaveBeenCalledWith("u-2", true);

    getConvHandler("message_updated")({ message: { id: "m1", content: "x" } });
    expect(onMessageUpdated).toHaveBeenCalled();

    getConvHandler("message_deleted")({ id: "m1", conversation_id: "conv-42" });
    expect(onMessageDeleted).toHaveBeenCalledWith("m1", true);

    getConvHandler("delivery_status")({
      message_id: "m1",
      status: "delivered",
    });
    expect(onDeliveryStatus).toHaveBeenCalledWith("m1", "delivered");

    getConvHandler("presence_diff")({
      joins: { "u-3": {} },
      leaves: { "u-4": {} },
    });
    expect(mockApplyPresenceDiff).toHaveBeenCalledWith(["u-3"], ["u-4"]);
    expect(onPresenceUpdate).toHaveBeenCalledWith("u-3", true);
    expect(onPresenceUpdate).toHaveBeenCalledWith("u-4", false);

    getConvHandler("presence_state")({ "u-5": {} });
    expect(mockSetPresenceState).toHaveBeenCalledWith(["u-5"]);
    expect(onPresenceUpdate).toHaveBeenCalledWith("u-5", true);

    // cleanup unregisters
    act(() => {
      handle!.cleanup();
    });
    expect(mockChannelOff).toHaveBeenCalled();
  });

  it("reaction_added supports the new wrapped shape and the legacy flat shape", () => {
    const onReactionAdded = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket({ ...baseOptions, onReactionAdded }),
    );
    act(() => {
      result.current.joinConversationChannel("conv-1");
    });

    function getConvHandler(name: string) {
      const calls = mockChannelOn.mock.calls.filter((c) => c[0] === name);
      return calls[calls.length - 1][1];
    }

    // new shape
    getConvHandler("reaction_added")({
      message_id: "m1",
      reaction: { user_id: "u-2", reaction: "👍" },
    });
    // legacy shape
    getConvHandler("reaction_added")({
      message_id: "m2",
      user_id: "u-3",
      reaction: "❤️",
    });
    // invalid shape
    getConvHandler("reaction_added")({ message_id: "m3" });

    expect(onReactionAdded).toHaveBeenCalledTimes(2);
    expect(onReactionAdded).toHaveBeenNthCalledWith(1, {
      message_id: "m1",
      user_id: "u-2",
      reaction: "👍",
    });
    expect(onReactionAdded).toHaveBeenNthCalledWith(2, {
      message_id: "m2",
      user_id: "u-3",
      reaction: "❤️",
    });
  });

  it("reaction_removed supports new (reaction_id) and legacy shapes", () => {
    const onReactionRemoved = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket({ ...baseOptions, onReactionRemoved }),
    );
    act(() => {
      result.current.joinConversationChannel("conv-1");
    });

    function getConvHandler(name: string) {
      const calls = mockChannelOn.mock.calls.filter((c) => c[0] === name);
      return calls[calls.length - 1][1];
    }

    // legacy { user_id, reaction: string }
    getConvHandler("reaction_removed")({
      message_id: "m1",
      user_id: "u-2",
      reaction: "👍",
    });
    // new { reaction_id }
    getConvHandler("reaction_removed")({
      message_id: "m2",
      reaction_id: "rxn-42",
    });
    // invalid
    getConvHandler("reaction_removed")({ message_id: "m3" });

    expect(onReactionRemoved).toHaveBeenCalledTimes(2);
    expect(onReactionRemoved).toHaveBeenNthCalledWith(2, {
      message_id: "m2",
      user_id: "",
      reaction: "rxn-42",
    });
  });

  it("delivery_status conversation channel filters 'read' when toggle OFF", () => {
    mockReadReceiptsEnabled.mockReturnValue(false);
    const onDeliveryStatus = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket({ ...baseOptions, onDeliveryStatus }),
    );
    act(() => {
      result.current.joinConversationChannel("conv-1");
    });

    function getConvHandler(name: string) {
      const calls = mockChannelOn.mock.calls.filter((c) => c[0] === name);
      return calls[calls.length - 1][1];
    }

    getConvHandler("delivery_status")({ message_id: "m1", status: "read" });
    getConvHandler("delivery_status")({ message_id: "m2", status: "sent" });

    expect(onDeliveryStatus).toHaveBeenCalledTimes(1);
    expect(onDeliveryStatus).toHaveBeenCalledWith("m2", "sent");
  });
});

describe("useWebSocket — send actions", () => {
  it("sendMessage pushes new_message with default messageType 'text'", () => {
    const { result } = renderHook(() => useWebSocket(baseOptions));
    act(() => {
      result.current.sendMessage("conv-1", "hello");
    });
    expect(mockChannelPush).toHaveBeenCalledWith(
      "new_message",
      expect.objectContaining({
        conversation_id: "conv-1",
        content: "hello",
        message_type: "text",
      }),
    );
  });

  it("sendMessage no-op when socket disconnected", () => {
    mockIsConnected.mockReturnValue(false);
    const { result } = renderHook(() => useWebSocket(baseOptions));
    act(() => {
      result.current.sendMessage("conv-1", "x");
    });
    expect(mockChannelPush).not.toHaveBeenCalledWith(
      "new_message",
      expect.anything(),
    );
  });

  it("sendTyping pushes user_typing", () => {
    const { result } = renderHook(() => useWebSocket(baseOptions));
    act(() => {
      result.current.sendTyping("conv-1", true);
    });
    expect(mockChannelPush).toHaveBeenCalledWith("user_typing", {
      typing: true,
    });
  });

  it("sendTyping no-op when socket disconnected", () => {
    mockIsConnected.mockReturnValue(false);
    const { result } = renderHook(() => useWebSocket(baseOptions));
    act(() => {
      result.current.sendTyping("conv-1", true);
    });
    expect(mockChannelPush).not.toHaveBeenCalled();
  });

  it("markAsRead no-op when socket disconnected (even toggle ON)", () => {
    mockIsConnected.mockReturnValue(false);
    const { result } = renderHook(() => useWebSocket(baseOptions));
    act(() => {
      result.current.markAsRead("conv-1", "m1");
    });
    expect(mockChannelPush).not.toHaveBeenCalled();
  });
});

describe("useWebSocket — guards", () => {
  it("does not connect when userId or token empty", () => {
    renderHook(() => useWebSocket({ userId: "", token: "" }));
    // The hook returns early, so no user channel was joined
    expect(mockChannelJoin).not.toHaveBeenCalled();
  });
});
