/**
 * MessageActionsMenu — guards on the "Modifier" entry.
 *
 * Editing only makes sense on a text message that hasn't been tombstoned by
 * the sender. Showing "Modifier" on a media bubble or on a "[Message
 * supprimé]" entry leads the user into an edit flow that the backend
 * rejects (or worse, mutates the wrong row). Lock those branches in.
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { MessageActionsMenu } from "../MessageActionsMenu";
import { MessageWithRelations } from "../../../types/messaging";

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      primary: "#fff",
      background: { primary: "#000" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#555" },
    }),
    getFontSize: () => 16,
    getLocalizedText: (k: string) => k,
  }),
}));

const baseMessage: MessageWithRelations = {
  id: "m1",
  conversation_id: "c1",
  sender_id: "u1",
  message_type: "text",
  content: "hello",
  metadata: {},
  client_random: 1,
  sent_at: new Date().toISOString(),
  is_deleted: false,
  status: "sent",
};

const renderMenu = (message: MessageWithRelations) =>
  render(
    <MessageActionsMenu
      visible
      message={message}
      isSent
      isPinned={false}
      onClose={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onReply={() => {}}
      onReact={() => {}}
      onPin={() => {}}
      onForward={() => {}}
      onReport={() => {}}
    />,
  );

describe("MessageActionsMenu — Modifier guard", () => {
  it("shows Modifier for a sent text message", () => {
    const { queryByText } = renderMenu(baseMessage);
    expect(queryByText("Modifier")).not.toBeNull();
  });

  it("hides Modifier on a media message", () => {
    const { queryByText } = renderMenu({
      ...baseMessage,
      message_type: "media",
    });
    expect(queryByText("Modifier")).toBeNull();
  });

  it("hides Modifier on a message tombstoned with delete-for-everyone", () => {
    const { queryByText } = renderMenu({
      ...baseMessage,
      is_deleted: true,
      delete_for_everyone: true,
      content: "[Message supprimé]",
    });
    expect(queryByText("Modifier")).toBeNull();
  });
});
