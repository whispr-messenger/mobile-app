import {
  AddContactFormSchema,
  BlockedUserListResponseSchema,
  BlockedUserSchema,
  ContactListResponseSchema,
  ContactSchema,
  EditContactFormSchema,
} from "../contact";

describe("ContactSchema", () => {
  it("parses a contact with an embedded user join", () => {
    const c = ContactSchema.parse({
      id: "c-1",
      user_id: "owner",
      contact_id: "u-1",
      nickname: "Ali",
      is_favorite: true,
      added_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      contact_user: { id: "u-1", username: "alice" },
    });
    expect(c.contact_user?.username).toBe("alice");
  });

  it("defaults is_favorite to false when missing", () => {
    const c = ContactSchema.parse({
      id: "c-1",
      user_id: "owner",
      contact_id: "u-1",
      added_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(c.is_favorite).toBe(false);
  });
});

describe("ContactListResponseSchema", () => {
  it("parses a list response with total", () => {
    const r = ContactListResponseSchema.parse({
      contacts: [],
      total: 0,
    });
    expect(r.total).toBe(0);
  });

  it("rejects a negative total", () => {
    expect(() =>
      ContactListResponseSchema.parse({ contacts: [], total: -1 }),
    ).toThrow();
  });
});

describe("BlockedUserSchema / BlockedUserListResponseSchema", () => {
  it("parses a blocked user payload", () => {
    const b = BlockedUserSchema.parse({
      id: "b-1",
      user_id: "owner",
      blocked_user_id: "u-9",
      reason: "harassment",
      blocked_at: "2026-01-01T00:00:00Z",
    });
    expect(b.blocked_user_id).toBe("u-9");
  });

  it("parses a blocked-list response", () => {
    expect(() =>
      BlockedUserListResponseSchema.parse({ blocked: [], total: 0 }),
    ).not.toThrow();
  });
});

describe("AddContactFormSchema", () => {
  it("accepts a valid payload", () => {
    expect(() =>
      AddContactFormSchema.parse({ contactId: "u-1", nickname: "" }),
    ).not.toThrow();
  });

  it("rejects an empty contactId", () => {
    expect(() =>
      AddContactFormSchema.parse({ contactId: "", nickname: "" }),
    ).toThrow(/Sélectionnez/);
  });

  it("rejects a nickname > 50 chars", () => {
    expect(() =>
      AddContactFormSchema.parse({
        contactId: "u-1",
        nickname: "a".repeat(51),
      }),
    ).toThrow(/50 caractères/);
  });
});

describe("EditContactFormSchema", () => {
  it("accepts a valid payload", () => {
    expect(() =>
      EditContactFormSchema.parse({ nickname: "Ali", isFavorite: true }),
    ).not.toThrow();
  });

  it("rejects a nickname > 50 chars", () => {
    expect(() =>
      EditContactFormSchema.parse({
        nickname: "a".repeat(51),
        isFavorite: false,
      }),
    ).toThrow();
  });
});
