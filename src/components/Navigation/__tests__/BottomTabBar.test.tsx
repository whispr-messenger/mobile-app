/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-blur", () => {
  const React = require("react");
  return {
    BlurView: ({ children }: { children: React.ReactNode }) =>
      React.createElement("blur-view", null, children),
  };
});

const mockSwitchToRootTab = jest.fn();
jest.mock("../../../navigation/navigationRef", () => ({
  switchToRootTab: (...args: unknown[]) => mockSwitchToRootTab(...args),
}));

let mockUnreadTotal = 0;
let mockIncoming: unknown = null;
let mockIsStaff = false;
let mockReportQueue: unknown[] = [];
let mockAppealQueue: unknown[] = [];
let mockPendingAppeals: Record<string, { status: string }> = {};
let mockBottomTabHidden = false;

jest.mock("../../../store/conversationsStore", () => ({
  useConversationsStore: (selector: (s: any) => any) =>
    selector({
      conversations:
        mockUnreadTotal > 0 ? [{ unread_count: mockUnreadTotal }] : [],
    }),
}));
jest.mock("../../../store/callsStore", () => ({
  useCallsStore: (selector: (s: any) => any) =>
    selector({ incoming: mockIncoming }),
}));
jest.mock("../../../store/uiStore", () => ({
  useUIStore: (selector: (s: any) => any) =>
    selector({ bottomTabBarHidden: mockBottomTabHidden }),
}));
jest.mock("../../../store/moderationStore", () => ({
  useModerationStore: (selector: (s: any) => any) =>
    selector({
      reportQueue: mockReportQueue,
      appealQueue: mockAppealQueue,
      pendingAppeals: mockPendingAppeals,
    }),
  useIsStaff: () => mockIsStaff,
}));

import { BottomTabBar } from "../BottomTabBar";

beforeEach(() => {
  mockSwitchToRootTab.mockReset();
  mockUnreadTotal = 0;
  mockIncoming = null;
  mockIsStaff = false;
  mockReportQueue = [];
  mockAppealQueue = [];
  mockPendingAppeals = {};
  mockBottomTabHidden = false;
});

describe("BottomTabBar — render", () => {
  it("renders the four tab labels", () => {
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    expect(getByText("Contacts")).toBeTruthy();
    expect(getByText("Appels")).toBeTruthy();
    expect(getByText("Discussions")).toBeTruthy();
    expect(getByText("Réglages")).toBeTruthy();
  });
});

describe("BottomTabBar — badges", () => {
  it("renders the unread chats count when > 0", () => {
    mockUnreadTotal = 7;
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    expect(getByText("7")).toBeTruthy();
  });

  it("caps the unread badge at 99+", () => {
    mockUnreadTotal = 200;
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    expect(getByText("99+")).toBeTruthy();
  });

  it("renders an incoming call badge of 1 when calls.incoming is set", () => {
    mockIncoming = { id: "call-1" };
    const { getAllByText } = render(
      <BottomTabBar currentRouteName="Contacts" />,
    );
    // A "1" should appear at least once (the calls badge).
    expect(getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the pending-appeals count when at least one appeal is pending", () => {
    mockPendingAppeals = {
      a: { status: "pending" },
      b: { status: "approved" },
      c: { status: "pending" },
    };
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    expect(getByText("2")).toBeTruthy();
  });
});

describe("BottomTabBar — tab press", () => {
  it("dispatches switchToRootTab with the target route name", () => {
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    fireEvent.press(getByText("Réglages"));
    expect(mockSwitchToRootTab).toHaveBeenCalledWith("Settings");
  });

  it("does not dispatch when the active tab is pressed again", () => {
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    fireEvent.press(getByText("Contacts"));
    expect(mockSwitchToRootTab).not.toHaveBeenCalled();
  });
});

describe("BottomTabBar — visibility", () => {
  it("renders the labels regardless of visibility (the pill stays mounted)", () => {
    mockBottomTabHidden = true;
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    // Labels are still rendered — only opacity is animated to 0.
    expect(getByText("Contacts")).toBeTruthy();
  });

  it("treats unknown routes as non-tab pages", () => {
    const { getByText } = render(
      <BottomTabBar currentRouteName="ChatScreen" />,
    );
    // Still mounted, still rendering the labels (UI stays constant).
    expect(getByText("Contacts")).toBeTruthy();
  });
});
