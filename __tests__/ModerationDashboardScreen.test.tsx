import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockState: { current: any } = {
  current: {
    stats: null,
    reportQueue: [],
    appealQueue: [],
    loading: false,
    fetchStats: jest.fn(),
    fetchReportQueue: jest.fn(),
    fetchAppealQueue: jest.fn(),
  },
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

jest.mock("../src/services/moderation/moderationApi", () => ({
  sanctionsAPI: {
    getAllActive: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("../src/components/Moderation/ModerationStatCard", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    ModerationStatCard: ({ label, count, onPress }: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{`${label}:${count}`}</Text>
      </TouchableOpacity>
    ),
  };
});

import { ModerationDashboardScreen } from "../src/screens/Admin/ModerationDashboardScreen";

describe("ModerationDashboardScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockIsStaffRef.current = true;
    mockState.current = {
      stats: null,
      reportQueue: [],
      appealQueue: [],
      loading: false,
      fetchStats: jest.fn(),
      fetchReportQueue: jest.fn(),
      fetchAppealQueue: jest.fn(),
    };
  });

  it("renders 'Access denied' for non-staff", () => {
    mockIsStaffRef.current = false;
    const { getByText } = render(<ModerationDashboardScreen />);
    expect(getByText(/Acc\\u00e8s refus\\u00e9/)).toBeTruthy();
  });

  it("renders the title and the stat cards", () => {
    mockState.current.stats = {
      pending: 3,
      resolved_today: 10,
      by_category: {},
    };
    mockState.current.appealQueue = [{ status: "pending" }, { status: "accepted" }];
    const { getByText } = render(<ModerationDashboardScreen />);
    expect(getByText("Modération")).toBeTruthy();
    expect(getByText("Signalements en attente:3")).toBeTruthy();
    expect(getByText("Appels en attente:1")).toBeTruthy();
    expect(getByText("Résolus aujourd'hui:10")).toBeTruthy();
  });

  it("shows the loader when loading and no stats", () => {
    mockState.current.loading = true;
    const { UNSAFE_queryByType } = render(<ModerationDashboardScreen />);
    const ActivityIndicator = require("react-native").ActivityIndicator;
    expect(UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();
  });

  it("renders by_category breakdown when stats include it", () => {
    mockState.current.stats = {
      pending: 5,
      resolved_today: 0,
      by_category: { spam: 3, harassment: 2 },
    };
    const { getByText } = render(<ModerationDashboardScreen />);
    expect(getByText("Par catégorie")).toBeTruthy();
    expect(getByText("spam")).toBeTruthy();
    expect(getByText("harassment")).toBeTruthy();
  });

  it("navigates to ReportQueue when the stat card is pressed", () => {
    mockState.current.stats = { pending: 1, resolved_today: 0 };
    const { getByText } = render(<ModerationDashboardScreen />);
    fireEvent.press(getByText("Signalements en attente:1"));
    expect(mockNavigate).toHaveBeenCalledWith("ReportQueue");
  });

  it("navigates to AppealQueue when the appeals stat card is pressed", () => {
    mockState.current.appealQueue = [{ status: "pending" }];
    const { getByText } = render(<ModerationDashboardScreen />);
    fireEvent.press(getByText("Appels en attente:1"));
    expect(mockNavigate).toHaveBeenCalledWith("AppealQueue");
  });

  it("calls fetchStats and other fetchers on mount", async () => {
    const fetchStats = jest.fn();
    const fetchReportQueue = jest.fn();
    const fetchAppealQueue = jest.fn();
    mockState.current = {
      ...mockState.current,
      fetchStats,
      fetchReportQueue,
      fetchAppealQueue,
    };
    render(<ModerationDashboardScreen />);
    await waitFor(() => {
      expect(fetchStats).toHaveBeenCalled();
      expect(fetchReportQueue).toHaveBeenCalled();
      expect(fetchAppealQueue).toHaveBeenCalled();
    });
  });

  it("calls goBack when header back is pressed", () => {
    const { UNSAFE_getAllByType } = render(<ModerationDashboardScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
