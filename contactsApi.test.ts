/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("./src/services/TokenService", () =>
  require("./src/__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("./src/services/apiBase", () =>
  require("./src/__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);

import { contactsAPI } from "./src/services/contacts/api";
import { TokenService } from "./src/services/TokenService";
import {
  installFetchMock,
  mockResponse,
} from "./src/__test-utils__/mockFactories";

const mockedToken = TokenService as any;
const BASE = "https://api.test/user/v1";
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Allow each test to prime the enrichment fetch (fetchUserById) with nulls.
const primeUserEnrichment = (count: number) => {
  for (let i = 0; i < count; i++) {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
  }
};

describe("contactsAPI.getContacts", () => {
  it("GETs /contacts and normalizes results", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: [
          {
            id: "c-1",
            ownerId: "u-owner",
            contactId: "u-1",
            nickname: "Ada",
            isFavorite: true,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );
    primeUserEnrichment(1);

    const result = await contactsAPI.getContacts();

    expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/contacts`);
    expect(result.total).toBe(1);
    expect(result.contacts[0]).toMatchObject({
      id: "c-1",
      user_id: "u-owner",
      contact_id: "u-1",
      is_favorite: true,
    });
  });

  it("unwraps a { data: [...] } envelope", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { data: [{ id: "c-1", contactId: "u-1" }] } }),
    );
    primeUserEnrichment(1);

    const result = await contactsAPI.getContacts();
    expect(result.contacts).toHaveLength(1);
  });

  it("returns an empty list when the server says 404 'no contacts'", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        status: 404,
        body: { message: "no contacts for user" },
      }),
    );

    await expect(contactsAPI.getContacts()).resolves.toEqual({
      contacts: [],
      total: 0,
    });
  });

  it("throws on any other non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 500, body: { message: "oops" } }),
    );

    await expect(contactsAPI.getContacts()).rejects.toThrow(/500/);
  });

  it("enriches contacts with user data when the profile call succeeds", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: [{ id: "c-1", contactId: "u-1" }],
      }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          id: "u-1",
          username: "ada",
          firstName: "Ada",
          profilePictureUrl: "https://cdn/x.png",
        },
      }),
    );

    const result = await contactsAPI.getContacts();
    expect((result.contacts[0] as any).contact_user).toMatchObject({
      id: "u-1",
      username: "ada",
      first_name: "Ada",
      avatar_url: "https://cdn/x.png",
    });
  });
});

describe("contactsAPI.getContact", () => {
  it("finds a contact by id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: [
          { id: "c-1", contactId: "u-1" },
          { id: "c-2", contactId: "u-2" },
        ],
      }),
    );
    primeUserEnrichment(2);

    const contact = await contactsAPI.getContact("c-2");
    expect(contact.contact_id).toBe("u-2");
  });

  it("throws when no contact matches", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));

    await expect(contactsAPI.getContact("missing")).rejects.toThrow(
      "Contact not found",
    );
  });
});

describe("contactsAPI.addContact / updateContact / deleteContact", () => {
  it("addContact POSTs contactId + nickname", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "c-1", contactId: "u-1", nickname: "A" } }),
    );

    const result = await contactsAPI.addContact({
      contactId: "u-1",
      nickname: "A",
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/contacts`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      contactId: "u-1",
      nickname: "A",
    });
    expect(result.contact_id).toBe("u-1");
  });

  it("addContact throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 409 }));
    await expect(contactsAPI.addContact({ contactId: "u-1" })).rejects.toThrow(
      "Failed to add contact",
    );
  });

  it("updateContact PATCHes the contact id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "c-1", contactId: "u-1" } }),
    );
    await contactsAPI.updateContact("c-1", { nickname: "N" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/contacts/c-1`);
    expect(init.method).toBe("PATCH");
  });

  it("deleteContact returns silently on 404 with 'contact not found'", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        status: 404,
        body: { message: "Contact not found" },
      }),
    );
    await expect(contactsAPI.deleteContact("c-1")).resolves.toBeUndefined();
  });

  it("deleteContact throws on other errors", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(contactsAPI.deleteContact("c-1")).rejects.toThrow();
  });
});

describe("contactsAPI.getContactStats", () => {
  it("computes favorite and total counts", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: [
          { id: "c-1", contactId: "u-1", isFavorite: true },
          { id: "c-2", contactId: "u-2", isFavorite: false },
        ],
      }),
    );
    primeUserEnrichment(2);

    const stats = await contactsAPI.getContactStats();
    expect(stats.total).toBe(2);
    expect(stats.favorites).toBe(1);
  });
});

describe("contactsAPI.searchUsers", () => {
  it("returns an empty list when the query is blank", async () => {
    await expect(contactsAPI.searchUsers({ username: "" })).resolves.toEqual(
      [],
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("merges username + name results and deduplicates", async () => {
    // 1st call: getContacts (for contactIds enrichment)
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));
    // 2nd call: /search/username
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u-1", username: "ada" } }),
    );
    // 3rd call: /search/name (returns same user + a new one)
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          results: [
            { id: "u-1", username: "ada" },
            { id: "u-2", username: "ada2" },
          ],
        },
      }),
    );

    const results = await contactsAPI.searchUsers({ username: "ada" });
    expect(results.map((r) => r.user.id).sort()).toEqual(["u-1", "u-2"]);
  });

  it("also calls /search/phone when the query looks like a phone number", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] })); // getContacts
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 })); // username
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 })); // name
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u-9", username: "match" } }),
    ); // phone

    const results = await contactsAPI.searchUsers({ username: "+33600000000" });
    expect(results).toHaveLength(1);
    expect(results[0].user.id).toBe("u-9");
    const phoneCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/search/phone"),
    );
    expect(phoneCall).toBeDefined();
  });
});

describe("contactsAPI.importPhoneContacts", () => {
  it("returns an empty list when no phone numbers are provided", async () => {
    await expect(contactsAPI.importPhoneContacts([])).resolves.toEqual([]);
  });

  it("uses the batch endpoint when it succeeds", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          results: [{ id: "u-1", username: "ada" }],
        },
      }),
    );

    const results = await contactsAPI.importPhoneContacts([
      { phoneNumber: "+33600000000" } as any,
    ]);
    expect(results).toHaveLength(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/search/phone/batch`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      phoneNumbers: ["+33600000000"],
    });
  });

  it("falls back to sequential lookups when the batch endpoint 404s", async () => {
    // batch call
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    // sequential calls (one per phone number)
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u-1", username: "ada" } }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u-2", username: "grace" } }),
    );

    const results = await contactsAPI.importPhoneContacts([
      { phoneNumber: "+33600000000" } as any,
      { phoneNumber: "+33700000000" } as any,
    ]);
    expect(results.map((r) => r.user.id).sort()).toEqual(["u-1", "u-2"]);
  });
});

describe("contactsAPI.getUserPreviewById", () => {
  it("returns null when the user cannot be fetched", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));

    await expect(contactsAPI.getUserPreviewById("u-1")).resolves.toBeNull();
  });

  it("returns the enriched search result on success", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u-1", username: "ada" } }),
    );
    // getContacts call
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: [{ id: "c-1", contactId: "u-1" }] }),
    );
    primeUserEnrichment(1);

    const result = await contactsAPI.getUserPreviewById("u-1");
    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("u-1");
    expect(result?.is_contact).toBe(true);
  });
});

describe("contactsAPI.getContactRequests / send / accept / refuse", () => {
  it("getContactRequests returns an empty array on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(contactsAPI.getContactRequests()).resolves.toEqual([]);
  });

  it("getContactRequests parses requester/recipient embeds", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: [
          {
            id: "r-1",
            requesterId: "u-1",
            recipientId: "u-2",
            status: "pending",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            requester: { id: "u-1", username: "ada" },
            recipient: { id: "u-2", username: "grace" },
          },
        ],
      }),
    );

    const result = await contactsAPI.getContactRequests();
    expect(result).toHaveLength(1);
    expect(result[0].requester_user?.username).toBe("ada");
    expect(result[0].recipient_user?.username).toBe("grace");
  });

  it("sendContactRequest POSTs with contactId and returns the normalized request", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          id: "r-1",
          requesterId: "u-1",
          recipientId: "u-2",
          status: "pending",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      }),
    );

    const result = await contactsAPI.sendContactRequest("u-2");
    expect(result.id).toBe("r-1");
    expect(result.recipient_id).toBe("u-2");

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ contactId: "u-2" });
  });

  it("sendContactRequest throws with status on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 409, body: { message: "already exists" } }),
    );

    await expect(contactsAPI.sendContactRequest("u-2")).rejects.toMatchObject({
      message: "already exists",
      status: 409,
    });
  });

  it("acceptContactRequest PATCHes /accept", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          id: "r-1",
          requesterId: "u-1",
          recipientId: "u-2",
          status: "accepted",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      }),
    );
    await contactsAPI.acceptContactRequest("r-1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/contact-requests/r-1/accept`);
    expect(init.method).toBe("PATCH");
  });

  it("refuseContactRequest PATCHes /reject", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          id: "r-1",
          requesterId: "u-1",
          recipientId: "u-2",
          status: "rejected",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      }),
    );
    await contactsAPI.refuseContactRequest("r-1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/contact-requests/r-1/reject`);
    expect(init.method).toBe("PATCH");
  });
});

describe("contactsAPI blocking", () => {
  it("getBlockedUsers returns an empty list on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(contactsAPI.getBlockedUsers()).resolves.toEqual({
      blocked: [],
      total: 0,
    });
  });

  it("getBlockedUsers normalizes camelCase payloads", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: [
          {
            id: "b-1",
            blockerId: "u-self",
            blockedId: "u-other",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    const { blocked, total } = await contactsAPI.getBlockedUsers();
    expect(total).toBe(1);
    expect(blocked[0].blocked_user_id).toBe("u-other");
  });

  it("blockUser POSTs blockedId and returns the normalized record", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          id: "b-1",
          blockerId: "u-self",
          blockedId: "u-other",
          createdAt: "2026-01-01T00:00:00Z",
        },
      }),
    );

    const result = await contactsAPI.blockUser("u-other");
    expect(result.blocked_user_id).toBe("u-other");

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ blockedId: "u-other" });
  });

  it("blockUser throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(contactsAPI.blockUser("u-other")).rejects.toThrow(
      "Failed to block user",
    );
  });

  it("unblockUser DELETEs /blocked-users/:id", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await contactsAPI.unblockUser("u-other");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/blocked-users/u-other`);
    expect(init.method).toBe("DELETE");
  });

  it("unblockUser throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(contactsAPI.unblockUser("u-other")).rejects.toThrow(
      "Failed to unblock user",
    );
  });
});

describe("contactsAPI auth headers", () => {
  it("omits Authorization when no access token is available", async () => {
    mockedToken.getAccessToken.mockResolvedValue(null);
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));

    await contactsAPI.getContacts();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers?.Authorization).toBeUndefined();
  });
});
