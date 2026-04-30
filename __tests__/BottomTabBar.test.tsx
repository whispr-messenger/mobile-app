import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("../src/navigation/navigationRef", () => ({
  navigate: (...args: any[]) => mockNavigate(...args),
}));

let mockUnreadTotal = 0;
jest.mock("../src/store/conversationsStore", () => ({
  useConversationsStore: (selector: any) =>
    selector({
      conversations: [{ unread_count: mockUnreadTotal }],
    }),
}));

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: any) => children,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

import { BottomTabBar } from "../src/components/Navigation/BottomTabBar";

describe("BottomTabBar", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUnreadTotal = 0;
  });

  it("renders all tab labels", () => {
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    expect(getByText("Contacts")).toBeTruthy();
    expect(getByText("Appels")).toBeTruthy();
    expect(getByText("Discussions")).toBeTruthy();
    expect(getByText("Réglages")).toBeTruthy();
  });

  it("calls navigate when a different tab is pressed", () => {
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    fireEvent.press(getByText("Appels"));
    expect(mockNavigate).toHaveBeenCalledWith("Calls");
  });

  it("does not navigate when the active tab is pressed", () => {
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    fireEvent.press(getByText("Contacts"));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders the unread badge with the count", () => {
    mockUnreadTotal = 5;
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    expect(getByText("5")).toBeTruthy();
  });

  it("renders 99+ when unread count exceeds 99", () => {
    mockUnreadTotal = 250;
    const { getByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    expect(getByText("99+")).toBeTruthy();
  });

  it("does not render the badge when there are no unread messages", () => {
    mockUnreadTotal = 0;
    const { queryByText } = render(<BottomTabBar currentRouteName="Contacts" />);
    expect(queryByText("0")).toBeNull();
  });

  it("renders even when currentRouteName is not in the tab list (hides via opacity)", () => {
    const { getByText } = render(<BottomTabBar currentRouteName="UnknownRoute" />);
    expect(getByText("Contacts")).toBeTruthy();
  });
});
