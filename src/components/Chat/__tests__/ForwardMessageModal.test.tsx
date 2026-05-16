/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../Avatar", () => ({ Avatar: () => null }));

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
    }),
  }),
}));

import { ForwardMessageModal } from "../ForwardMessageModal";
import type { Conversation } from "../../../types/messaging";

const baseConv = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: overrides.id ?? "c-1",
  type: overrides.type ?? "direct",
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  is_active: true,
  display_name: overrides.display_name ?? "Alice",
  ...overrides,
});

const baseProps = {
  visible: true,
  conversations: [baseConv({ id: "c-1", display_name: "Alice" })],
  currentConversationId: "current",
  sending: false,
  onClose: jest.fn(),
  onSelect: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("ForwardMessageModal", () => {
  it("renders the title and the conversation list", () => {
    const { getByText } = render(<ForwardMessageModal {...baseProps} />);
    expect(getByText("Transférer vers")).toBeTruthy();
    expect(getByText("Alice")).toBeTruthy();
  });

  it("excludes the current conversation from the list", () => {
    const { queryByText } = render(
      <ForwardMessageModal
        {...baseProps}
        conversations={[
          baseConv({ id: "current", display_name: "Self" }),
          baseConv({ id: "c-2", display_name: "Bob" }),
        ]}
      />,
    );
    expect(queryByText("Self")).toBeNull();
    expect(queryByText("Bob")).toBeTruthy();
  });

  it("excludes inactive conversations", () => {
    const { queryByText } = render(
      <ForwardMessageModal
        {...baseProps}
        conversations={[
          baseConv({ id: "c-1", display_name: "Alice", is_active: false }),
        ]}
      />,
    );
    expect(queryByText("Alice")).toBeNull();
    expect(queryByText("Aucune conversation disponible")).toBeTruthy();
  });

  it("filters by typed query (case insensitive on display_name)", () => {
    const { getByPlaceholderText, queryByText } = render(
      <ForwardMessageModal
        {...baseProps}
        conversations={[
          baseConv({ id: "c-1", display_name: "Alice" }),
          baseConv({ id: "c-2", display_name: "Bob" }),
        ]}
      />,
    );
    fireEvent.changeText(getByPlaceholderText(/Rechercher/i), "ali");
    expect(queryByText("Alice")).toBeTruthy();
    expect(queryByText("Bob")).toBeNull();
  });

  it("toggles selection and dispatches onSelect with the chosen ids", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <ForwardMessageModal
        {...baseProps}
        conversations={[
          baseConv({ id: "c-1", display_name: "Alice" }),
          baseConv({ id: "c-2", display_name: "Bob" }),
        ]}
        onSelect={onSelect}
      />,
    );
    fireEvent.press(getByText("Alice"));
    fireEvent.press(getByText("Bob"));
    fireEvent.press(getByText(/Transférer \(2\)/));

    expect(onSelect).toHaveBeenCalledWith(["c-1", "c-2"]);
  });

  it("does not call onSelect when nothing is selected", () => {
    const onSelect = jest.fn();
    const { queryByText } = render(
      <ForwardMessageModal {...baseProps} onSelect={onSelect} />,
    );
    // Without selection the button label is "Transférer" without count.
    const btn = queryByText("Transférer");
    if (btn) fireEvent.press(btn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders the spinner state while sending without crashing", () => {
    // Selection toggling is disabled while sending, so onSelect is unreachable
    // from the UI in this state. We just verify rendering doesn't throw.
    const { getByText } = render(
      <ForwardMessageModal {...baseProps} sending />,
    );
    expect(getByText("Transférer vers")).toBeTruthy();
  });
});
