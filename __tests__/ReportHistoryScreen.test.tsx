import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockState: { current: any } = {
  current: { myReports: [], loading: false, fetchMyReports: jest.fn() },
};

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
}));

import { ReportHistoryScreen } from "../src/screens/Moderation/ReportHistoryScreen";

describe("ReportHistoryScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockState.current = {
      myReports: [],
      loading: false,
      fetchMyReports: jest.fn(),
    };
  });

  it("calls fetchMyReports on mount", () => {
    const fetchMyReports = jest.fn();
    mockState.current = { myReports: [], loading: false, fetchMyReports };
    render(<ReportHistoryScreen />);
    expect(fetchMyReports).toHaveBeenCalled();
  });

  it("renders the loading state", () => {
    mockState.current.loading = true;
    const { getByText } = render(<ReportHistoryScreen />);
    expect(getByText("Chargement...")).toBeTruthy();
  });

  it("renders the empty state when there are no reports", () => {
    const { getByText } = render(<ReportHistoryScreen />);
    expect(getByText("Aucun signalement soumis")).toBeTruthy();
  });

  it("renders reports with their category and status badges", () => {
    mockState.current.myReports = [
      {
        id: "r1",
        category: "spam",
        status: "pending",
        reported_user_id: "abcdefgh1234",
        created_at: new Date().toISOString(),
      },
      {
        id: "r2",
        category: "harassment",
        status: "resolved_action",
        reported_user_id: "ijklmnop5678",
        created_at: new Date().toISOString(),
      },
    ];
    const { getByText } = render(<ReportHistoryScreen />);
    expect(getByText("Spam")).toBeTruthy();
    expect(getByText("Harcèlement")).toBeTruthy();
    expect(getByText("En attente")).toBeTruthy();
    expect(getByText("Action prise")).toBeTruthy();
  });

  it("navigates to ReportDetail when a report is tapped", () => {
    mockState.current.myReports = [
      {
        id: "r1",
        category: "spam",
        status: "pending",
        reported_user_id: "abcdefgh",
        created_at: new Date().toISOString(),
      },
    ];
    const { getByText } = render(<ReportHistoryScreen />);
    fireEvent.press(getByText("Spam"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "ReportDetail",
      expect.objectContaining({ report: expect.objectContaining({ id: "r1" }) }),
    );
  });

  it("calls goBack when the back button is pressed", () => {
    const { UNSAFE_getAllByType } = render(<ReportHistoryScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
