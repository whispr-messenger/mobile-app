import { filterAndSortContacts } from "../contactsFilter";
import type { Contact } from "../../types/contact";

const makeContact = (overrides: Partial<Contact> & { id: string }): Contact =>
  ({
    id: overrides.id,
    user_id: "me",
    contact_id: `u-${overrides.id}`,
    nickname: undefined,
    is_favorite: false,
    added_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as Contact;

describe("filterAndSortContacts", () => {
  it("returns an empty list when the input is empty", () => {
    expect(filterAndSortContacts([], "", "name", false)).toEqual([]);
  });

  it("filters to favorites when showFavoritesOnly is true", () => {
    const contacts = [
      makeContact({ id: "1", is_favorite: true }),
      makeContact({ id: "2", is_favorite: false }),
    ];
    const result = filterAndSortContacts(contacts, "", "name", true);
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("matches the search query case-insensitively across multiple fields", () => {
    const contacts = [
      makeContact({
        id: "1",
        nickname: "Ada",
        contact_user: {
          id: "u1",
          username: "ada42",
        } as Contact["contact_user"],
      }),
      makeContact({
        id: "2",
        contact_user: {
          id: "u2",
          first_name: "Grace",
          last_name: "Hopper",
        } as Contact["contact_user"],
      }),
    ];
    expect(
      filterAndSortContacts(contacts, "ada", "name", false).map((c) => c.id),
    ).toEqual(["1"]);
    expect(
      filterAndSortContacts(contacts, "HOPPER", "name", false).map((c) => c.id),
    ).toEqual(["2"]);
  });

  it("sorts by name in French collation by default", () => {
    const contacts = [
      makeContact({ id: "1", nickname: "Émile" }),
      makeContact({ id: "2", nickname: "Alice" }),
      makeContact({ id: "3", nickname: "Zoé" }),
    ];
    const result = filterAndSortContacts(contacts, "", "name", false);
    expect(result.map((c) => c.nickname)).toEqual(["Alice", "Émile", "Zoé"]);
  });

  it("sorts by added_at descending", () => {
    const contacts = [
      makeContact({ id: "1", added_at: "2026-01-01T00:00:00Z" }),
      makeContact({ id: "2", added_at: "2026-02-01T00:00:00Z" }),
      makeContact({ id: "3", added_at: "2025-12-01T00:00:00Z" }),
    ];
    const result = filterAndSortContacts(contacts, "", "added_at", false);
    expect(result.map((c) => c.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by favorites with name as tiebreaker", () => {
    const contacts = [
      makeContact({ id: "1", nickname: "Bob", is_favorite: false }),
      makeContact({ id: "2", nickname: "Alice", is_favorite: true }),
      makeContact({ id: "3", nickname: "Zack", is_favorite: true }),
    ];
    const result = filterAndSortContacts(contacts, "", "favorites", false);
    expect(result.map((c) => c.nickname)).toEqual(["Alice", "Zack", "Bob"]);
  });

  it("does not mutate the input array", () => {
    const input: Contact[] = [
      makeContact({ id: "1", nickname: "Zoe" }),
      makeContact({ id: "2", nickname: "Alice" }),
    ];
    const snapshot = input.map((c) => c.id);
    filterAndSortContacts(input, "", "name", false);
    expect(input.map((c) => c.id)).toEqual(snapshot);
  });
});
