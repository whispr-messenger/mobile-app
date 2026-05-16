import {
  ConversationListResponseSchema,
  ConversationSchema,
  MessageSchema,
  NewConversationFormSchema,
} from "../messaging";

describe("MessageSchema", () => {
  it("parses a minimal message and defaults metadata to {}", () => {
    const m = MessageSchema.parse({
      id: "m-1",
      conversation_id: "c-1",
      sender_id: "u-1",
      message_type: "text",
      content: "hi",
      client_random: 1,
      sent_at: "2026-01-01T00:00:00Z",
      is_deleted: false,
    });
    expect(m.metadata).toEqual({});
  });

  it("rejects an unknown message_type", () => {
    expect(() =>
      MessageSchema.parse({
        id: "m-1",
        conversation_id: "c-1",
        sender_id: "u-1",
        message_type: "carrier-pigeon",
        content: "hi",
        client_random: 1,
        sent_at: "2026-01-01T00:00:00Z",
        is_deleted: false,
      }),
    ).toThrow();
  });

  it("accepts client_random as a string (web platform path)", () => {
    expect(() =>
      MessageSchema.parse({
        id: "m-1",
        conversation_id: "c-1",
        sender_id: "u-1",
        message_type: "text",
        content: "hi",
        client_random: "abc",
        sent_at: "2026-01-01T00:00:00Z",
        is_deleted: false,
      }),
    ).not.toThrow();
  });
});

describe("ConversationSchema", () => {
  it("parses a direct conversation with member ids and last message", () => {
    const c = ConversationSchema.parse({
      id: "c-1",
      type: "direct",
      metadata: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      member_user_ids: ["a", "b"],
      last_message: {
        id: "m-1",
        conversation_id: "c-1",
        sender_id: "a",
        message_type: "text",
        content: "hi",
        client_random: 1,
        sent_at: "2026-01-01T00:00:00Z",
        is_deleted: false,
      },
    });
    expect(c.member_user_ids).toEqual(["a", "b"]);
    expect(c.last_message?.id).toBe("m-1");
  });

  it("rejects an unknown conversation type", () => {
    expect(() =>
      ConversationSchema.parse({
        id: "c-1",
        type: "weird",
        metadata: {},
        created_at: "x",
        updated_at: "x",
      }),
    ).toThrow();
  });
});

describe("ConversationListResponseSchema", () => {
  it("parses an empty list", () => {
    expect(() =>
      ConversationListResponseSchema.parse({ conversations: [], total: 0 }),
    ).not.toThrow();
  });
});

describe("NewConversationFormSchema", () => {
  it("requires at least one selected user", () => {
    expect(() =>
      NewConversationFormSchema.parse({ selectedUserIds: [], groupName: "" }),
    ).toThrow(/au moins un contact/);
  });

  it("accepts a single selection without group name", () => {
    expect(() =>
      NewConversationFormSchema.parse({
        selectedUserIds: ["u-1"],
        groupName: "",
      }),
    ).not.toThrow();
  });

  it("requires a group name >= 3 chars when 2+ users selected", () => {
    expect(() =>
      NewConversationFormSchema.parse({
        selectedUserIds: ["u-1", "u-2"],
        groupName: "ab",
      }),
    ).toThrow(/au moins 3 caractères/);
  });

  it("rejects a group name > 100 chars when 2+ users selected", () => {
    expect(() =>
      NewConversationFormSchema.parse({
        selectedUserIds: ["u-1", "u-2"],
        groupName: "x".repeat(101),
      }),
    ).toThrow(/100 caractères/);
  });

  it("accepts a valid group name when 2+ users selected", () => {
    expect(() =>
      NewConversationFormSchema.parse({
        selectedUserIds: ["u-1", "u-2"],
        groupName: "Project Atlas",
      }),
    ).not.toThrow();
  });
});
