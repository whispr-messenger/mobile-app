import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockState: { current: any } = {
  current: { mySanctions: [], loading: false, fetchMySanctions: jest.fn() },
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

import { MySanctionsScreen } from "../src/screens/Moderation/MySanctionsScreen";

describe("MySanctionsScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockState.current = {
      mySanctions: [],
      loading: false,
      fetchMySanctions: jest.fn(),
    };
  });

  it("calls fetchMySanctions on mount", () => {
    const fetchMySanctions = jest.fn();
    mockState.current = { mySanctions: [], loading: false, fetchMySanctions };
    render(<MySanctionsScreen />);
    expect(fetchMySanctions).toHaveBeenCalled();
  });

  it("renders the loading state", () => {
    mockState.current.loading = true;
    const { getByText } = render(<MySanctionsScreen />);
    expect(getByText("Chargement...")).toBeTruthy();
  });

  it("renders the empty state when there are no sanctions", () => {
    const { getByText } = render(<MySanctionsScreen />);
    expect(getByText("Aucune sanction")).toBeTruthy();
    expect(getByText("Votre compte est en règle")).toBeTruthy();
  });

  it("renders sanctions and their state badges", () => {
    mockState.current.mySanctions = [
      {
        id: "s1",
        type: "warning",
        reason: "Insulte",
        createdAt: new Date().toISOString(),
        expiresAt: null,
        active: true,
      },
      {
        id: "s2",
        type: "temp_ban",
        reason: "Spam",
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        active: false,
      },
    ];
    const { getByText } = render(<MySanctionsScreen />);
    expect(getByText("Avertissement")).toBeTruthy();
    expect(getByText("Suspension temporaire")).toBeTruthy();
    expect(getByText("Active")).toBeTruthy();
    expect(getByText("Levée")).toBeTruthy();
  });

  it("navigates to SanctionNotice when a sanction is tapped", () => {
    mockState.current.mySanctions = [
      {
        id: "s1",
        type: "warning",
        reason: "x",
        createdAt: new Date().toISOString(),
        expiresAt: null,
        active: true,
      },
    ];
    const { getByText } = render(<MySanctionsScreen />);
    fireEvent.press(getByText("Avertissement"));
    expect(mockNavigate).toHaveBeenCalledWith("SanctionNotice", {
      sanctionId: "s1",
    });
  });

  it("calls goBack when the back button is pressed", () => {
    const { UNSAFE_getAllByType } = render(<MySanctionsScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
