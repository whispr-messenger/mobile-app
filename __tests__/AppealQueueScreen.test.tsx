import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockState: { current: any } = {
  current: { appealQueue: [], loading: false, fetchAppealQueue: jest.fn() },
};
const mockIsStaffRef = { current: true };

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { primary: "#000", secondary: "#222", tertiary: "#333" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

jest.mock("../src/store/moderationStore", () => ({
  useModerationStore: () => mockState.current,
  useIsStaff: () => mockIsStaffRef.current,
}));

jest.mock("../src/components/Moderation/AppealCard", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    AppealCard: ({ appeal, onPress }: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>card:{appeal.id}</Text>
      </TouchableOpacity>
    ),
  };
});

import { AppealQueueScreen } from "../src/screens/Admin/AppealQueueScreen";

describe("AppealQueueScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockIsStaffRef.current = true;
    mockState.current = {
      appealQueue: [],
      loading: false,
      fetchAppealQueue: jest.fn(),
    };
  });

  it("renders 'Access denied' for non-staff", () => {
    mockIsStaffRef.current = false;
    const { getByText } = render(<AppealQueueScreen />);
    expect(getByText(/Acc\\u00e8s refus\\u00e9/)).toBeTruthy();
  });

  it("renders empty state when queue is empty", () => {
    const { getByText } = render(<AppealQueueScreen />);
    expect(getByText("Aucun appel en attente")).toBeTruthy();
  });

  it("renders the loader when loading and queue is empty", () => {
    mockState.current.loading = true;
    const { getByText } = render(<AppealQueueScreen />);
    expect(getByText("Chargement...")).toBeTruthy();
  });

  it("renders pending and under_review appeals (filters out resolved)", () => {
    mockState.current.appealQueue = [
      { id: "a1", status: "pending", createdAt: "2026-04-01" },
      { id: "a2", status: "under_review", createdAt: "2026-04-02" },
      { id: "a3", status: "accepted", createdAt: "2026-04-03" },
    ];
    const { getByText, queryByText } = render(<AppealQueueScreen />);
    expect(getByText("card:a1")).toBeTruthy();
    expect(getByText("card:a2")).toBeTruthy();
    expect(queryByText("card:a3")).toBeNull();
  });

  it("filters by appeal type via tabs", () => {
    mockState.current.appealQueue = [
      { id: "a1", status: "pending", type: "sanction", createdAt: "2026-04-01" },
      { id: "a2", status: "pending", type: "blocked_image", createdAt: "2026-04-02" },
    ];
    const { getByText, queryByText } = render(<AppealQueueScreen />);
    fireEvent.press(getByText("Sanctions"));
    expect(getByText("card:a1")).toBeTruthy();
    expect(queryByText("card:a2")).toBeNull();
    fireEvent.press(getByText("Images"));
    expect(queryByText("card:a1")).toBeNull();
    expect(getByText("card:a2")).toBeTruthy();
  });

  it("sorts appeals by oldest first (FIFO)", () => {
    mockState.current.appealQueue = [
      { id: "newer", status: "pending", createdAt: "2026-04-03" },
      { id: "older", status: "pending", createdAt: "2026-04-01" },
    ];
    const { getAllByText } = render(<AppealQueueScreen />);
    const cards = getAllByText(/^card:/);
    expect(cards[0].children[1]).toBe("older");
    expect(cards[1].children[1]).toBe("newer");
  });

  it("navigates to AppealReview when an appeal is pressed", () => {
    mockState.current.appealQueue = [
      { id: "a1", status: "pending", createdAt: "2026-04-01" },
    ];
    const { getByText } = render(<AppealQueueScreen />);
    fireEvent.press(getByText("card:a1"));
    expect(mockNavigate).toHaveBeenCalledWith("AppealReview", { appealId: "a1" });
  });

  it("shows the FIFO info bar with the count", () => {
    mockState.current.appealQueue = [
      { id: "a1", status: "pending", createdAt: "2026-04-01" },
    ];
    const { getByText } = render(<AppealQueueScreen />);
    expect(getByText(/FIFO.*1 en attente/)).toBeTruthy();
  });

  it("calls goBack when header back is pressed", () => {
    const { UNSAFE_getAllByType } = render(<AppealQueueScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
