import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockState: { current: any } = {
  current: { reportQueue: [], loading: false, fetchReportQueue: jest.fn() },
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

jest.mock("../src/components/Moderation/ReportCard", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    ReportCard: ({ report, onPress }: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>card:{report.id}</Text>
      </TouchableOpacity>
    ),
  };
});

import { ReportQueueScreen } from "../src/screens/Admin/ReportQueueScreen";

describe("ReportQueueScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockIsStaffRef.current = true;
    mockState.current = {
      reportQueue: [],
      loading: false,
      fetchReportQueue: jest.fn(),
    };
  });

  it("renders 'Access denied' when the user is not staff", () => {
    mockIsStaffRef.current = false;
    const { getByText } = render(<ReportQueueScreen />);
    expect(getByText(/Acc\\u00e8s refus\\u00e9/)).toBeTruthy();
  });

  it("renders the loading state", () => {
    mockState.current.loading = true;
    const { getByText } = render(<ReportQueueScreen />);
    expect(getByText("Chargement...")).toBeTruthy();
  });

  it("renders empty state when no reports match filters", () => {
    const { getByText } = render(<ReportQueueScreen />);
    expect(getByText("Aucun signalement")).toBeTruthy();
  });

  it("renders pending count badge in header", () => {
    mockState.current.reportQueue = [
      { id: "r1", category: "spam", status: "pending" },
      { id: "r2", category: "spam", status: "under_review" },
      { id: "r3", category: "spam", status: "pending" },
    ];
    const { getByText } = render(<ReportQueueScreen />);
    expect(getByText("2")).toBeTruthy();
  });

  it("filters reports by status tab", () => {
    mockState.current.reportQueue = [
      { id: "r1", category: "spam", status: "pending" },
      { id: "r2", category: "spam", status: "under_review" },
    ];
    const { getByText, queryByText } = render(<ReportQueueScreen />);
    expect(getByText("card:r1")).toBeTruthy();
    expect(getByText("card:r2")).toBeTruthy();
    fireEvent.press(getByText("En attente"));
    expect(getByText("card:r1")).toBeTruthy();
    expect(queryByText("card:r2")).toBeNull();
  });

  it("toggles category picker visibility", () => {
    const { getByText, queryByText } = render(<ReportQueueScreen />);
    expect(queryByText("Toutes")).toBeNull();
    fireEvent.press(getByText(/Catégorie/));
    expect(getByText("Toutes")).toBeTruthy();
    expect(getByText("Offensant")).toBeTruthy();
  });

  it("filters by category when chip is pressed", () => {
    mockState.current.reportQueue = [
      { id: "r1", category: "spam", status: "pending" },
      { id: "r2", category: "harassment", status: "pending" },
    ];
    const { getByText, queryByText } = render(<ReportQueueScreen />);
    fireEvent.press(getByText(/Catégorie/));
    fireEvent.press(getByText("Spam"));
    expect(getByText("card:r1")).toBeTruthy();
    expect(queryByText("card:r2")).toBeNull();
  });

  it("navigates to ReportReview when a report card is pressed", () => {
    mockState.current.reportQueue = [
      { id: "r1", category: "spam", status: "pending" },
    ];
    const { getByText } = render(<ReportQueueScreen />);
    fireEvent.press(getByText("card:r1"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "ReportReview",
      expect.objectContaining({ report: expect.objectContaining({ id: "r1" }) }),
    );
  });

  it("calls goBack on header back button", () => {
    const { UNSAFE_getAllByType } = render(<ReportQueueScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
