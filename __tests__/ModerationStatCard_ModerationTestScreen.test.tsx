import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

import { ModerationStatCard } from "../src/components/Moderation/ModerationStatCard";

describe("ModerationStatCard", () => {
  it("renders the count and the label", () => {
    const { getByText } = render(
      <ModerationStatCard
        icon="alert-circle"
        count={42}
        label="Reports"
        color="#FE7A5C"
      />,
    );
    expect(getByText("42")).toBeTruthy();
    expect(getByText("Reports")).toBeTruthy();
  });

  it("becomes a TouchableOpacity when onPress is provided", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ModerationStatCard
        icon="alert-circle"
        count={1}
        label="One"
        color="#FFF"
        onPress={onPress}
      />,
    );
    fireEvent.press(getByText("One"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders as a non-touchable View when no onPress", () => {
    const { UNSAFE_queryByType } = render(
      <ModerationStatCard
        icon="alert-circle"
        count={0}
        label="Zero"
        color="#FFF"
      />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    expect(UNSAFE_queryByType(TouchableOpacity)).toBeNull();
  });
});

// ─── ModerationTestScreen ────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));

const mockLaunch = jest.fn();
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: (...args: any[]) => mockLaunch(...args),
}));

const mockGate = jest.fn();
jest.mock("../src/services/moderation", () => ({
  tfjsService: {
    gate: (...args: any[]) => mockGate(...args),
  },
}));

import { ModerationTestScreen } from "../src/screens/Debug/ModerationTestScreen";

describe("ModerationTestScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockLaunch.mockReset();
    mockGate.mockReset();
  });

  it("renders the screen", () => {
    const { getByText } = render(<ModerationTestScreen />);
    expect(getByText("TFJS Moderation Test")).toBeTruthy();
    expect(getByText("Pick Image")).toBeTruthy();
    expect(getByText("Open appeal flow mock")).toBeTruthy();
  });

  it("navigates to ModerationDecision with the mock parameters when pressed", () => {
    const { getByText } = render(<ModerationTestScreen />);
    fireEvent.press(getByText("Open appeal flow mock"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "ModerationDecision",
      expect.objectContaining({ decisionId: "WH-8902" }),
    );
  });

  it("calls goBack when the back button is pressed", () => {
    const { UNSAFE_getAllByType } = render(<ModerationTestScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
