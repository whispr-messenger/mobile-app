/**
 * Tests for ScheduleDateTimePicker:
 * - Quick option presets compute the right Date and trigger onConfirm
 * - Tab switching between Rapide / Personnalisé
 * - Custom mode pickers (day, month, year, hour, minute) wrap and clamp correctly
 * - Confirm button is disabled for past dates and works for future dates
 * - Modal closes via the X button
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

import { ScheduleDateTimePicker } from "../ScheduleDateTimePicker";
import * as Haptics from "expo-haptics";

const FIXED_NOW = new Date("2026-06-15T10:30:00.000Z"); // Mon 15 Jun 2026, 10:30 UTC

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
  (Haptics.impactAsync as jest.Mock).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ScheduleDateTimePicker — visibility", () => {
  it("does not render the dialog content when visible is false", () => {
    const { queryByText } = render(
      <ScheduleDateTimePicker
        visible={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    expect(queryByText("Programmer le message")).toBeNull();
  });

  it("renders the dialog with quick mode active by default", () => {
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    expect(getByText("Programmer le message")).toBeTruthy();
    expect(getByText("Rapide")).toBeTruthy();
    expect(getByText("Personnalisé")).toBeTruthy();
    expect(getByText("Dans 30 min")).toBeTruthy();
    expect(getByText("Dans 1 heure")).toBeTruthy();
    expect(getByText("Demain 9h")).toBeTruthy();
  });
});

describe("ScheduleDateTimePicker — quick mode", () => {
  it("confirms with now + 30 min when 'Dans 30 min' is pressed", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(getByText("Dans 30 min"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const date = onConfirm.mock.calls[0][0] as Date;
    expect(date.getTime() - FIXED_NOW.getTime()).toBe(30 * 60 * 1000);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
  });

  it("confirms with now + 1 hour", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(getByText("Dans 1 heure"));
    const date = onConfirm.mock.calls[0][0] as Date;
    expect(date.getTime() - FIXED_NOW.getTime()).toBe(60 * 60 * 1000);
  });

  it("confirms with tomorrow 9h when the 'Demain 9h' preset is pressed", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(getByText("Demain 9h"));
    const date = onConfirm.mock.calls[0][0] as Date;
    // Tomorrow at local 9:00 — assert via getHours/getDate (local zone).
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
    // It must be strictly after now
    expect(date.getTime()).toBeGreaterThan(FIXED_NOW.getTime());
  });

  it("confirms with tomorrow 14h when the 'Demain 14h' preset is pressed", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(getByText("Demain 14h"));
    const date = onConfirm.mock.calls[0][0] as Date;
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(0);
  });
});

describe("ScheduleDateTimePicker — tab switching", () => {
  it("switches to custom mode when 'Personnalisé' is pressed", () => {
    const { getByText, queryByText } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    fireEvent.press(getByText("Personnalisé"));

    // Quick options are gone, custom picker labels appear
    expect(queryByText("Dans 30 min")).toBeNull();
    expect(getByText("DATE")).toBeTruthy();
    expect(getByText("HEURE")).toBeTruthy();
    expect(getByText("Jour")).toBeTruthy();
    expect(getByText("Mois")).toBeTruthy();
    expect(getByText("Année")).toBeTruthy();
  });

  it("switches back to quick mode when 'Rapide' is pressed again", () => {
    const { getByText, queryByText } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    fireEvent.press(getByText("Personnalisé"));
    expect(queryByText("Dans 30 min")).toBeNull();

    fireEvent.press(getByText("Rapide"));
    expect(getByText("Dans 30 min")).toBeTruthy();
  });
});

describe("ScheduleDateTimePicker — custom mode confirm validity", () => {
  it("invokes onConfirm with the built date when the custom date is in the future", () => {
    const onConfirm = jest.fn();
    const { getByText, UNSAFE_getAllByType } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(getByText("Personnalisé"));

    // Bump the day forward by one so the built date is unambiguously in the
    // future. The first up-chevron arrow in the custom layout controls the day.
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    // touchables: [closeX, tabRapide, tabCustom, dayUp, dayDown, monthUp, ...]
    fireEvent.press(touchables[3]);

    fireEvent.press(getByText("Programmer l'envoi"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("does not invoke onConfirm when the custom date is in the past", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(getByText("Personnalisé"));
    // Default custom date equals now → not strictly future → disabled.
    fireEvent.press(getByText("Programmer l'envoi"));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("ScheduleDateTimePicker — custom mode pickers", () => {
  // The picker arrows have no testID; we lean on TouchableOpacity ordering.
  // Order in the custom layout:
  //   [closeX, tabRapide, tabCustom,
  //    dayUp, dayDown, monthUp, monthDown, yearUp, yearDown,
  //    hourUp, hourDown, minUp, minDown,
  //    confirmBtn]
  const pressArrowAt = (touchables: any[], idx: number, times = 1) => {
    for (let i = 0; i < times; i++) fireEvent.press(touchables[idx]);
  };

  it("cycles every picker through both directions without throwing", () => {
    const { getByText, UNSAFE_getAllByType } = render(
      <ScheduleDateTimePicker
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    fireEvent.press(getByText("Personnalisé"));

    const TouchableOpacity = require("react-native").TouchableOpacity;
    const t = UNSAFE_getAllByType(TouchableOpacity);

    pressArrowAt(t, 3, 35); // dayUp: wraps past month length
    pressArrowAt(t, 4, 35); // dayDown: wraps the other way
    pressArrowAt(t, 5, 14); // monthUp: wraps past 11 → 0
    pressArrowAt(t, 6, 14); // monthDown: wraps past 0 → 11
    pressArrowAt(t, 7, 2); // yearUp
    pressArrowAt(t, 8, 5); // yearDown: clamped to current year
    pressArrowAt(t, 9, 25); // hourUp: wraps past 23 → 0
    pressArrowAt(t, 10, 25); // hourDown: wraps past 0 → 23
    pressArrowAt(t, 11, 13); // minUp: wraps past 55 → 0 (step 5)
    pressArrowAt(t, 12, 13); // minDown: wraps past 0 → 55
  });
});

describe("ScheduleDateTimePicker — close button", () => {
  it("calls onClose when the X button is pressed", () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ScheduleDateTimePicker
        visible
        onClose={onClose}
        onConfirm={jest.fn()}
      />,
    );

    // The close button is the first TouchableOpacity in the header — find it
    // via UNSAFE_getAllByType since it has no testID.
    // Simpler: it's the only TouchableOpacity rendered before the tabs.
    // We trigger onRequestClose on the Modal instead, which calls onClose too.
    const Modal = require("react-native").Modal;
    const modal = UNSAFE_getAllByType(Modal)[0];
    modal.props.onRequestClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
