import { buildConversationPreviewSnippet } from "../conversationPreview";

describe("buildConversationPreviewSnippet", () => {
  const baseConversation = {
    id: "conv-1",
    type: "direct" as const,
    metadata: {},
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
    is_active: true,
  };

  it("returns a placeholder when there is no last message", () => {
    expect(
      buildConversationPreviewSnippet({
        conversation: baseConversation as any,
        currentUserId: "me",
      }),
    ).toEqual({
      body: "Pas encore de messages",
      isPlaceholder: true,
    });
  });

  it("prefixes own direct messages with Vous", () => {
    expect(
      buildConversationPreviewSnippet({
        conversation: {
          ...baseConversation,
          last_message: {
            id: "msg-1",
            conversation_id: "conv-1",
            sender_id: "me",
            message_type: "text",
            content: "Salut toi",
            metadata: {},
            client_random: 1,
            sent_at: "2026-05-01T10:00:00.000Z",
            is_deleted: false,
          },
        } as any,
        currentUserId: "me",
      }),
    ).toEqual({
      prefix: "Vous",
      body: "Salut toi",
      isPlaceholder: false,
    });
  });

  it("prefixes group messages with the sender name", () => {
    expect(
      buildConversationPreviewSnippet({
        conversation: {
          ...baseConversation,
          type: "group",
          last_message: {
            id: "msg-2",
            conversation_id: "conv-1",
            sender_id: "user-2",
            message_type: "text",
            content: "On arrive",
            metadata: {},
            client_random: 1,
            sent_at: "2026-05-01T10:00:00.000Z",
            is_deleted: false,
          },
        } as any,
        currentUserId: "me",
        senderLabel: "Gabriel",
      }),
    ).toEqual({
      prefix: "Gabriel",
      body: "On arrive",
      isPlaceholder: false,
    });
  });

  it("formats media messages with their media type", () => {
    expect(
      buildConversationPreviewSnippet({
        conversation: {
          ...baseConversation,
          last_message: {
            id: "msg-3",
            conversation_id: "conv-1",
            sender_id: "user-2",
            message_type: "media",
            content: "Photo",
            metadata: { media_type: "image" },
            client_random: 1,
            sent_at: "2026-05-01T10:00:00.000Z",
            is_deleted: false,
          },
        } as any,
        currentUserId: "me",
      }),
    ).toEqual({
      body: "Photo",
      isPlaceholder: false,
    });
  });

  it("uses the link preview title when the message only contains an URL", () => {
    expect(
      buildConversationPreviewSnippet({
        conversation: {
          ...baseConversation,
          last_message: {
            id: "msg-4",
            conversation_id: "conv-1",
            sender_id: "user-2",
            message_type: "text",
            content: "https://youtu.be/eOtnJbuOEoo",
            metadata: {
              link_preview: {
                url: "https://youtu.be/eOtnJbuOEoo",
                title: "Video YouTube",
                siteName: "YouTube",
              },
            },
            client_random: 1,
            sent_at: "2026-05-01T10:00:00.000Z",
            is_deleted: false,
          },
        } as any,
        currentUserId: "me",
      }),
    ).toEqual({
      body: "Video YouTube",
      isPlaceholder: false,
    });
  });

  it("returns Message supprime for deleted messages", () => {
    expect(
      buildConversationPreviewSnippet({
        conversation: {
          ...baseConversation,
          last_message: {
            id: "msg-5",
            conversation_id: "conv-1",
            sender_id: "user-2",
            message_type: "text",
            content: "",
            metadata: {},
            client_random: 1,
            sent_at: "2026-05-01T10:00:00.000Z",
            is_deleted: true,
          },
        } as any,
        currentUserId: "me",
      }),
    ).toEqual({
      body: "Message supprimé",
      isPlaceholder: false,
    });
  });
});
