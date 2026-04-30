import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockRouteParams: { current: any } = { current: {} };

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams.current }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

import { ModerationDecisionScreen } from "../src/screens/Moderation/ModerationDecisionScreen";

describe("ModerationDecisionScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockRouteParams.current = {};
  });

  it("renders with default placeholder values when no route params", () => {
    const { getByText } = render(<ModerationDecisionScreen />);
    expect(getByText("Décision de modération")).toBeTruthy();
    expect(getByText("Avertissement")).toBeTruthy();
    expect(getByText("Spam")).toBeTruthy();
  });

  it("renders custom values from route params", () => {
    mockRouteParams.current = {
      decisionId: "X1",
      sanctionType: "Suspension",
      reasonLabel: "Harcèlement",
      incidentDate: "1 Jan 2025",
      deadlineDate: "15 Jan 2025",
      reference: "X1",
    };
    const { getByText } = render(<ModerationDecisionScreen />);
    expect(getByText("Suspension")).toBeTruthy();
    expect(getByText("Harcèlement")).toBeTruthy();
    expect(getByText("REF #X1")).toBeTruthy();
  });

  it("navigates to ModerationAppealForm when 'Contester' is pressed", () => {
    mockRouteParams.current = { decisionId: "D1" };
    const { getByText } = render(<ModerationDecisionScreen />);
    fireEvent.press(getByText("Contester"));
    expect(mockNavigate).toHaveBeenCalledWith("ModerationAppealForm", {
      decisionId: "D1",
    });
  });

  it("calls goBack when 'Fermer' is pressed", () => {
    const { getByText } = render(<ModerationDecisionScreen />);
    fireEvent.press(getByText("Fermer"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("calls goBack when the header back button is pressed", () => {
    const { UNSAFE_getAllByType } = render(<ModerationDecisionScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
