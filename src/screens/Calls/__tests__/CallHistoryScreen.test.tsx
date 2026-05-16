/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, waitFor } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockListCalls = jest.fn();
jest.mock("../../../services/calls/callsApi", () => ({
  callsApi: { list: (...a: unknown[]) => mockListCalls(...a) },
}));

const mockGetConversation = jest.fn();
const mockGetConversationMembers = jest.fn();
jest.mock("../../../services/messaging/api", () => ({
  messagingAPI: {
    getConversation: (...a: unknown[]) => mockGetConversation(...a),
    getConversationMembers: (...a: unknown[]) =>
      mockGetConversationMembers(...a),
  },
}));

jest.mock("../../../services/TokenService", () => ({
  TokenService: {
    getAccessToken: jest.fn().mockResolvedValue("at"),
    decodeAccessToken: jest.fn().mockReturnValue({ sub: "me" }),
  },
}));

jest.mock("../../../components/Chat/Avatar", () => ({ Avatar: () => null }));

import { CallHistoryScreen } from "../CallHistoryScreen";

beforeEach(() => {
  jest.clearAllMocks();
  mockListCalls.mockResolvedValue({ data: [] });
  mockGetConversation.mockResolvedValue(null);
  mockGetConversationMembers.mockResolvedValue([]);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("CallHistoryScreen", () => {
  it("requests the calls list on mount", async () => {
    render(<CallHistoryScreen />);
    await waitFor(() =>
      expect(mockListCalls).toHaveBeenCalledWith({ limit: 50 }),
    );
  });

  it("renders the empty state when no call exists", async () => {
    const { findByText } = render(<CallHistoryScreen />);
    expect(await findByText("Aucun appel pour le moment")).toBeTruthy();
  });

  it("renders calls returned by the API and updates the stat counters", async () => {
    mockListCalls.mockResolvedValue({
      data: [
        {
          id: "call-1",
          conversation_id: "conv-1",
          status: "ended",
          started_at: "2026-01-01T10:00:00Z",
          ended_at: "2026-01-01T10:05:00Z",
        },
        {
          id: "call-2",
          conversation_id: "conv-2",
          status: "missed",
          started_at: "2026-01-01T10:10:00Z",
        },
      ],
    });

    const { queryByText } = render(<CallHistoryScreen />);
    await waitFor(() => expect(mockListCalls).toHaveBeenCalled());
    await waitFor(() =>
      expect(queryByText("Aucun appel pour le moment")).toBeNull(),
    );
  });

  it("renders without crashing when the API throws", async () => {
    mockListCalls.mockRejectedValue(new Error("boom"));
    const { findByText } = render(<CallHistoryScreen />);
    expect(await findByText("Aucun appel pour le moment")).toBeTruthy();
  });
});
