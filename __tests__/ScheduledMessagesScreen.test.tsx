import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { conversationId: "c1" } }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

jest.mock("../src/utils/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockGetScheduled = jest.fn();
const mockCancelScheduled = jest.fn();
jest.mock("../src/services/SchedulingService", () => ({
  SchedulingService: {
    getScheduledMessages: (...args: any[]) => mockGetScheduled(...args),
    cancelScheduledMessage: (id: string) => mockCancelScheduled(id),
  },
}));

import { Alert } from "react-native";
import { ScheduledMessagesScreen } from "../src/screens/Chat/ScheduledMessagesScreen";

const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

describe("ScheduledMessagesScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    alertSpy.mockClear();
    mockGetScheduled.mockReset();
    mockCancelScheduled.mockReset();
  });

  it("renders empty state when there are no messages", async () => {
    mockGetScheduled.mockResolvedValueOnce([]);
    const { findByText } = render(<ScheduledMessagesScreen />);
    expect(await findByText("Aucun message programmé")).toBeTruthy();
  });

  it("renders pending count in header subtitle", async () => {
    mockGetScheduled.mockResolvedValueOnce([
      {
        id: "m1",
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
        content: "Hello",
        status: "pending",
      },
    ]);
    const { findByText } = render(<ScheduledMessagesScreen />);
    await findByText("Hello");
    expect(await findByText("1 en attente")).toBeTruthy();
  });

  it.each([
    ["pending", "En attente"],
    ["sent", "Envoyé"],
    ["failed", "Échoué"],
    ["cancelled", "Annulé"],
  ])("renders the %s status label as %s", async (status, label) => {
    mockGetScheduled.mockResolvedValueOnce([
      {
        id: "m1",
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
        content: "x",
        status,
      },
    ]);
    const { findByText } = render(<ScheduledMessagesScreen />);
    expect(await findByText(label)).toBeTruthy();
  });

  it("renders 'Aujourd'hui à HH:MM' for messages today", async () => {
    const today = new Date();
    today.setHours(today.getHours() + 1);
    mockGetScheduled.mockResolvedValueOnce([
      {
        id: "m1",
        scheduled_at: today.toISOString(),
        content: "x",
        status: "pending",
      },
    ]);
    const { findByText } = render(<ScheduledMessagesScreen />);
    await findByText(/Aujourd'hui à/);
  });

  it("renders 'Demain à HH:MM' for messages tomorrow", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    mockGetScheduled.mockResolvedValueOnce([
      {
        id: "m1",
        scheduled_at: tomorrow.toISOString(),
        content: "x",
        status: "pending",
      },
    ]);
    const { findByText } = render(<ScheduledMessagesScreen />);
    await findByText(/Demain à/);
  });

  it("opens confirmation when cancel is pressed for a pending message", async () => {
    mockGetScheduled.mockResolvedValueOnce([
      {
        id: "m1",
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
        content: "x".repeat(120),
        status: "pending",
      },
    ]);
    const { findByText } = render(<ScheduledMessagesScreen />);
    fireEvent.press(await findByText("Annuler"));
    expect(alertSpy).toHaveBeenCalled();
  });

  it("calls cancelScheduledMessage when confirmed", async () => {
    mockGetScheduled.mockResolvedValueOnce([
      {
        id: "m1",
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
        content: "x",
        status: "pending",
      },
    ]);
    mockCancelScheduled.mockResolvedValueOnce(undefined);
    const { findByText } = render(<ScheduledMessagesScreen />);
    fireEvent.press(await findByText("Annuler"));
    const buttons = alertSpy.mock.calls[0][2] as any[];
    const confirm = buttons?.find((b) => b.style === "destructive");
    await act(async () => {
      await confirm?.onPress?.();
    });
    expect(mockCancelScheduled).toHaveBeenCalledWith("m1");
  });

  it("calls goBack when header back is pressed", async () => {
    mockGetScheduled.mockResolvedValueOnce([]);
    const { findByText, UNSAFE_getAllByType } = render(<ScheduledMessagesScreen />);
    await findByText("Aucun message programmé");
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
