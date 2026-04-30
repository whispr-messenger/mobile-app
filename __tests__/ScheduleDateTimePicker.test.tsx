import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

import { ScheduleDateTimePicker } from "../src/components/Chat/ScheduleDateTimePicker";

describe("ScheduleDateTimePicker", () => {
  it("renders header in 'Rapide' mode by default", () => {
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(getByText("Programmer le message")).toBeTruthy();
    expect(getByText("Rapide")).toBeTruthy();
    expect(getByText("Personnalisé")).toBeTruthy();
    expect(getByText("Dans 30 min")).toBeTruthy();
  });

  it("calls onConfirm with a future date when a quick option is tapped", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(getByText("Dans 30 min"));
    expect(onConfirm).toHaveBeenCalled();
    const date = onConfirm.mock.calls[0][0] as Date;
    expect(date.getTime()).toBeGreaterThan(Date.now());
  });

  it.each([
    ["Demain 9h", 9],
    ["Demain 14h", 14],
  ])("returns the correct hour for %s", (label, hour) => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(getByText(label));
    const date = onConfirm.mock.calls[0][0] as Date;
    expect(date.getHours()).toBe(hour);
  });

  it("switches to 'Personnalisé' mode", () => {
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    fireEvent.press(getByText("Personnalisé"));
    // Verify some custom-mode-only content shows up (preview text contains "à")
    expect(getByText(/à \d{2}:\d{2}/)).toBeTruthy();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ScheduleDateTimePicker
        visible={true}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    // First touchable is the close button in the header
    fireEvent.press(ts[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
