import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockRouteParams: { current: any } = {
  current: { appealId: "A1", decisionId: "D1", status: "received" },
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams.current }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

import { ModerationAppealSubmittedScreen } from "../src/screens/Moderation/ModerationAppealSubmittedScreen";

describe("ModerationAppealSubmittedScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockRouteParams.current = {
      appealId: "A1",
      decisionId: "D1",
      status: "received",
    };
  });

  it("renders the success heading and appeal number", () => {
    const { getByText } = render(<ModerationAppealSubmittedScreen />);
    expect(getByText("Demande envoyée")).toBeTruthy();
    expect(getByText(/A1/)).toBeTruthy();
  });

  it("formats 'received' status as 'REÇUE'", () => {
    const { getAllByText } = render(<ModerationAppealSubmittedScreen />);
    expect(getAllByText("REÇUE").length).toBeGreaterThan(0);
  });

  it("formats unknown status as upper-case with underscores → spaces", () => {
    mockRouteParams.current = {
      appealId: "A1",
      decisionId: "D1",
      status: "in_review",
    };
    const { getByText } = render(<ModerationAppealSubmittedScreen />);
    expect(getByText("IN REVIEW")).toBeTruthy();
  });

  it("falls back to 'REÇUE' when no status is provided", () => {
    mockRouteParams.current = { appealId: "A1", decisionId: "D1" };
    const { getAllByText } = render(<ModerationAppealSubmittedScreen />);
    expect(getAllByText("REÇUE").length).toBeGreaterThan(0);
  });

  it("navigates to ModerationDecision when 'Suivre ma contestation' is pressed", () => {
    const { getByText } = render(<ModerationAppealSubmittedScreen />);
    fireEvent.press(getByText("Suivre ma contestation"));
    expect(mockNavigate).toHaveBeenCalledWith("ModerationDecision", {
      decisionId: "D1",
      reference: "D1",
    });
  });

  it("navigates back to ConversationsList from secondary button", () => {
    const { getByText } = render(<ModerationAppealSubmittedScreen />);
    fireEvent.press(getByText("Retour à la conversation"));
    expect(mockNavigate).toHaveBeenCalledWith("ConversationsList");
  });

  it("calls goBack when header back button is pressed", () => {
    const { UNSAFE_getAllByType } = render(<ModerationAppealSubmittedScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
