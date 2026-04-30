import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockReport: { current: any } = {
  current: {
    id: "r1",
    category: "offensive",
    status: "pending",
    reason: "Foo",
    description: "details",
    created_at: new Date().toISOString(),
    reported_user_id: "abcdefgh",
    reporter_id: "ijklmnop",
    evidence: [],
  },
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: { report: mockReport.current } }),
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

import { ReportDetailScreen } from "../src/screens/Moderation/ReportDetailScreen";

describe("ReportDetailScreen", () => {
  beforeEach(() => mockGoBack.mockClear());

  it.each([
    ["offensive", "Contenu offensant"],
    ["spam", "Spam"],
    ["nudity", "Nudité"],
    ["violence", "Violence"],
    ["harassment", "Harcèlement"],
    ["other", "Autre"],
  ])("renders the %s category as %s", (cat, label) => {
    mockReport.current = { ...mockReport.current, category: cat };
    const { getByText } = render(<ReportDetailScreen />);
    expect(getByText(label)).toBeTruthy();
  });

  it.each([
    ["pending", "En attente"],
    ["under_review", "En cours d'examen"],
    ["resolved_action", "Action prise"],
    ["resolved_dismissed", "Rejeté"],
  ])("renders the %s status as %s", (status, label) => {
    mockReport.current = { ...mockReport.current, status };
    const { getByText } = render(<ReportDetailScreen />);
    expect(getByText(label)).toBeTruthy();
  });

  it("renders the back button and triggers goBack", () => {
    mockReport.current = {
      ...mockReport.current,
      category: "offensive",
      status: "pending",
    };
    const { UNSAFE_getAllByType } = render(<ReportDetailScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(ts[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
