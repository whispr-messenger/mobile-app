/**
 * ReplyPreview — defends against null/empty content on the parent message.
 *
 * Media-only replies (photo without caption, voice notes) frequently have
 * empty/missing `content`; calling `.length` on it crashed the chat the
 * moment a user tried to read older history.
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { ReplyPreview } from "./src/components/Chat/ReplyPreview";
import { Message } from "./src/types/messaging";

jest.mock("./src/context/ThemeContext", () => ({
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

const baseMessage: Message = {
  id: "m1",
  conversation_id: "c1",
  sender_id: "u1",
  message_type: "text",
  content: "hello",
  metadata: {},
  client_random: 1,
  sent_at: new Date().toISOString(),
  is_deleted: false,
};

describe("ReplyPreview", () => {
  it("renders short text content as-is", () => {
    const { getByText } = render(<ReplyPreview replyTo={baseMessage} />);
    expect(getByText("hello")).toBeTruthy();
  });

  it("renders the deletion placeholder for tombstoned replies", () => {
    const { getByText } = render(
      <ReplyPreview
        replyTo={{ ...baseMessage, is_deleted: true, content: "" }}
      />,
    );
    expect(getByText("[Message supprimé]")).toBeTruthy();
  });

  it("does not crash when the parent media message has no content", () => {
    expect(() =>
      render(
        <ReplyPreview
          replyTo={{
            ...baseMessage,
            message_type: "media",
            // The shape that crashed: media reply with empty content from a
            // backend payload that stripped the caption.
            content: undefined as unknown as string,
          }}
        />,
      ),
    ).not.toThrow();
  });
});
