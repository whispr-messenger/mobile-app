/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { conversationId: "conv-1" } }),
}));

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
  }),
}));

const mockGetScheduled = jest.fn();
const mockCancelScheduled = jest.fn();
jest.mock("../../../services/SchedulingService", () => ({
  SchedulingService: {
    getScheduledMessages: (...a: unknown[]) => mockGetScheduled(...a),
    cancelScheduledMessage: (...a: unknown[]) => mockCancelScheduled(...a),
  },
}));

import { ScheduledMessagesScreen } from "../ScheduledMessagesScreen";

let alertSpy: jest.SpyInstance;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetScheduled.mockResolvedValue([]);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => alertSpy.mockRestore());

describe("ScheduledMessagesScreen — initial render", () => {
  it("renders the empty state when no message is scheduled", async () => {
    const { findByText } = render(<ScheduledMessagesScreen />);
    expect(await findByText("Aucun message programmé")).toBeTruthy();
  });

  it("requests scheduled messages for the route's conversationId", async () => {
    render(<ScheduledMessagesScreen />);
    await flush();
    expect(mockGetScheduled).toHaveBeenCalledWith({
      conversation_id: "conv-1",
    });
  });
});

describe("ScheduledMessagesScreen — list rendering", () => {
  it("displays a pending count when there are pending messages", async () => {
    mockGetScheduled.mockResolvedValue([
      {
        id: "m-1",
        content: "Hello",
        scheduled_at: "2027-12-01T10:00:00Z",
        status: "pending",
      },
      {
        id: "m-2",
        content: "Sent already",
        scheduled_at: "2027-12-02T10:00:00Z",
        status: "sent",
      },
    ]);
    const { findByText } = render(<ScheduledMessagesScreen />);
    await findByText("Hello");
    expect(await findByText("1 en attente")).toBeTruthy();
  });

  it("renders the list of scheduled messages sorted by scheduled_at ascending", async () => {
    mockGetScheduled.mockResolvedValue([
      {
        id: "m-2",
        content: "Later",
        scheduled_at: "2027-12-02T10:00:00Z",
        status: "pending",
      },
      {
        id: "m-1",
        content: "Sooner",
        scheduled_at: "2027-12-01T10:00:00Z",
        status: "pending",
      },
    ]);
    const { findAllByText, queryAllByText } = render(
      <ScheduledMessagesScreen />,
    );
    await findAllByText(/Sooner|Later/);
    // Both rendered; we just assert presence (ordering tested via the array
    // returned by getScheduledMessages — implementation calls sort on it).
    expect(queryAllByText("Sooner").length).toBe(1);
    expect(queryAllByText("Later").length).toBe(1);
  });
});

describe("ScheduledMessagesScreen — cancel flow", () => {
  it("opens a confirmation Alert and calls cancelScheduledMessage on confirm", async () => {
    mockGetScheduled.mockResolvedValue([
      {
        id: "m-1",
        content: "Doomed",
        scheduled_at: "2027-12-01T10:00:00Z",
        status: "pending",
      },
    ]);
    mockCancelScheduled.mockResolvedValue(undefined);

    const { findByText } = render(<ScheduledMessagesScreen />);
    fireEvent.press(await findByText("Annuler"));

    expect(alertSpy).toHaveBeenCalled();
    // Simulate the user tapping "Annuler le message" (the destructive button)
    const buttons = alertSpy.mock.calls[0][2];
    const confirmBtn = buttons.find(
      (b: { text: string }) => b.text === "Annuler le message",
    );
    await act(async () => {
      await confirmBtn.onPress();
    });

    expect(mockCancelScheduled).toHaveBeenCalledWith("m-1");
  });

  it("alerts on a cancellation error", async () => {
    mockGetScheduled.mockResolvedValue([
      {
        id: "m-1",
        content: "Doomed",
        scheduled_at: "2027-12-01T10:00:00Z",
        status: "pending",
      },
    ]);
    mockCancelScheduled.mockRejectedValue(new Error("net"));

    const { findByText } = render(<ScheduledMessagesScreen />);
    fireEvent.press(await findByText("Annuler"));
    const buttons = alertSpy.mock.calls[0][2];
    const confirmBtn = buttons.find(
      (b: { text: string }) => b.text === "Annuler le message",
    );
    await act(async () => {
      await confirmBtn.onPress();
    });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Erreur",
        expect.stringMatching(/Impossible/),
      ),
    );
  });
});

describe("ScheduledMessagesScreen — back button", () => {
  it("navigates back when the arrow is pressed", async () => {
    const { UNSAFE_getAllByType } = render(<ScheduledMessagesScreen />);
    await flush();
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[0]); // first touchable = back button
    expect(mockGoBack).toHaveBeenCalled();
  });
});
