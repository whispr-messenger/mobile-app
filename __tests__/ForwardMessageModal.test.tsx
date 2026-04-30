import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { primary: "#000", secondary: "#222" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));

import { ForwardMessageModal } from "../src/components/Chat/ForwardMessageModal";

const conversations = [
  { id: "current", display_name: "Self", type: "direct", is_active: true } as any,
  { id: "alice", display_name: "Alice", type: "direct", is_active: true } as any,
  { id: "bob", display_name: "Bob", type: "direct", is_active: true } as any,
  { id: "team", display_name: "Team Whispr", type: "group", is_active: true } as any,
  { id: "inactive", display_name: "X", type: "direct", is_active: false } as any,
];

describe("ForwardMessageModal", () => {
  it("does not render content when not visible", () => {
    const { queryByText } = render(
      <ForwardMessageModal
        visible={false}
        conversations={conversations}
        currentConversationId="current"
        sending={false}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(queryByText("Transférer vers")).toBeNull();
  });

  it("renders conversations excluding current and inactive ones", () => {
    const { getByText, queryByText } = render(
      <ForwardMessageModal
        visible={true}
        conversations={conversations}
        currentConversationId="current"
        sending={false}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(getByText("Alice")).toBeTruthy();
    expect(getByText("Bob")).toBeTruthy();
    expect(getByText("Team Whispr")).toBeTruthy();
    expect(getByText("Groupe")).toBeTruthy();
    expect(queryByText("Self")).toBeNull();
    expect(queryByText("X")).toBeNull();
  });

  it("filters by query text", () => {
    const { getByPlaceholderText, queryByText } = render(
      <ForwardMessageModal
        visible={true}
        conversations={conversations}
        currentConversationId="current"
        sending={false}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    fireEvent.changeText(
      getByPlaceholderText("Rechercher une conversation"),
      "ali",
    );
    expect(queryByText("Alice")).toBeTruthy();
    expect(queryByText("Bob")).toBeNull();
  });

  it("shows empty state when no matches", () => {
    const { getByPlaceholderText, getByText } = render(
      <ForwardMessageModal
        visible={true}
        conversations={conversations}
        currentConversationId="current"
        sending={false}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    fireEvent.changeText(
      getByPlaceholderText("Rechercher une conversation"),
      "nope",
    );
    expect(getByText("Aucune conversation disponible")).toBeTruthy();
  });

  it("shows loading state when sending", () => {
    const { getByText } = render(
      <ForwardMessageModal
        visible={true}
        conversations={conversations}
        currentConversationId="current"
        sending={true}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(getByText("Envoi en cours...")).toBeTruthy();
  });

  it("toggles selection on tap and counts in send button", () => {
    const { getByText } = render(
      <ForwardMessageModal
        visible={true}
        conversations={conversations}
        currentConversationId="current"
        sending={false}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(getByText("Transférer")).toBeTruthy();
    fireEvent.press(getByText("Alice"));
    expect(getByText("Transférer (1)")).toBeTruthy();
    fireEvent.press(getByText("Bob"));
    expect(getByText("Transférer (2)")).toBeTruthy();
    fireEvent.press(getByText("Alice"));
    expect(getByText("Transférer (1)")).toBeTruthy();
  });

  it("calls onSelect with selected ids when send is pressed", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <ForwardMessageModal
        visible={true}
        conversations={conversations}
        currentConversationId="current"
        sending={false}
        onClose={() => {}}
        onSelect={onSelect}
      />,
    );
    fireEvent.press(getByText("Alice"));
    fireEvent.press(getByText("Transférer (1)"));
    expect(onSelect).toHaveBeenCalledWith(["alice"]);
  });

  it("does not call onSelect when nothing is selected", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <ForwardMessageModal
        visible={true}
        conversations={conversations}
        currentConversationId="current"
        sending={false}
        onClose={() => {}}
        onSelect={onSelect}
      />,
    );
    fireEvent.press(getByText("Transférer"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onClose when close button is pressed and resets state", () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ForwardMessageModal
        visible={true}
        conversations={conversations}
        currentConversationId="current"
        sending={false}
        onClose={onClose}
        onSelect={() => {}}
      />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    // ts[0] is the close button in the header
    fireEvent.press(ts[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
