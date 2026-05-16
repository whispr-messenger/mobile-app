/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests complémentaires pour services/messaging/api.ts qui couvrent les
 * méthodes non exercées par messagingApi.test.ts / messagingApiExtras.test.ts :
 *
 * - getConversationMembers (chemin /conversations/:id puis fallback /members)
 * - addGroupMembers / removeGroupMember / updateGroupMemberRole (succès + erreurs)
 * - createDirectConversation (contact valide / non-contact / 1ère payload échoue → fallback)
 * - createGroupConversation (succès + erreur)
 * - searchMessages (1er endpoint OK / fallback / null final)
 * - searchMessagesGlobal (succès + null)
 * - markMessageAsUnread (succès + non-OK)
 * - authenticatedFetch retry 401 → refresh OK → succès
 * - authenticatedFetch refresh fail → propage le 401
 */

jest.mock("../../TokenService", () =>
  require("../../../__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("../../AuthService", () =>
  require("../../../__test-utils__/mockFactories").makeAuthServiceMock(),
);
jest.mock("../../apiBase", () =>
  require("../../../__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);
jest.mock("../../../utils/logger", () =>
  require("../../../__test-utils__/mockFactories").makeLoggerMock(),
);

import { messagingAPI } from "../api";
import { TokenService } from "../../TokenService";
import { AuthService } from "../../AuthService";
import {
  installFetchMock,
  mockResponse,
} from "../../../__test-utils__/mockFactories";

const mockedToken = TokenService as any;
const mockedAuth = AuthService as any;
const BASE = "https://api.test/messaging/api/v1";
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
  mockedAuth.refreshTokens.mockReset().mockResolvedValue(undefined);
  mockedToken.decodeAccessToken.mockReset().mockReturnValue({ sub: "user-me" });
});

describe("authenticatedFetch refresh-on-401", () => {
  it("retries the request once when 401 then refreshTokens succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 401 }))
      .mockResolvedValueOnce(mockResponse({ body: [] }));

    const out = await messagingAPI.getConversations();
    expect(out).toEqual([]);
    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls through with the 401 when refreshTokens throws", async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: false, status: 401 }));
    mockedAuth.refreshTokens.mockRejectedValueOnce(new Error("refresh fail"));

    await expect(messagingAPI.getConversations()).rejects.toThrow(/401/);
  });
});

describe("markMessageAsUnread", () => {
  it("POSTs /messages/:id/unread on success", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await expect(
      messagingAPI.markMessageAsUnread("m-1", "c-1"),
    ).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`${BASE}/messages/m-1/unread`),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws when the backend returns non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: false, status: 500 }));
    await expect(
      messagingAPI.markMessageAsUnread("m-1", "c-1"),
    ).rejects.toThrow();
  });
});

describe("addGroupMembers / removeGroupMember / updateGroupMemberRole", () => {
  it("addGroupMembers POSTs one body per user", async () => {
    mockFetch.mockResolvedValue(mockResponse({ status: 200 }));
    await messagingAPI.addGroupMembers("c-1", ["u-1", "u-2"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      `${BASE}/conversations/c-1/members`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ user_id: "u-1" }),
      }),
    );
  });

  it("addGroupMembers surfaces a typed Error with status on failure", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 403, body: { message: "forbidden" } }),
    );
    await expect(
      messagingAPI.addGroupMembers("c-1", ["u-x"]),
    ).rejects.toMatchObject({ message: "forbidden", status: 403 });
  });

  it("removeGroupMember DELETEs the member URL", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await messagingAPI.removeGroupMember("c-1", "u-2");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/conversations/c-1/members/u-2`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("removeGroupMember does not throw on 204 even though !response.ok", async () => {
    // Per the implementation, status 204 short-circuits the throw branch.
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: false, status: 204 }));
    await expect(
      messagingAPI.removeGroupMember("c-1", "u-2"),
    ).resolves.toBeUndefined();
  });

  it("removeGroupMember throws on real HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500, body: { error: "boom" } }),
    );
    await expect(
      messagingAPI.removeGroupMember("c-1", "u-2"),
    ).rejects.toMatchObject({ status: 500, message: "boom" });
  });

  it("updateGroupMemberRole PATCHes role JSON", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 200 }));
    await messagingAPI.updateGroupMemberRole("c-1", "u-2", "admin");
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/conversations/c-1/members/u-2/role`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      }),
    );
  });

  it("updateGroupMemberRole throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 400, body: { error: "bad role" } }),
    );
    await expect(
      messagingAPI.updateGroupMemberRole("c-1", "u-2", "admin"),
    ).rejects.toMatchObject({ status: 400, message: "bad role" });
  });
});

describe("createDirectConversation", () => {
  it("throws when no access token", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce(null);
    await expect(messagingAPI.createDirectConversation("u-2")).rejects.toThrow(
      /Authentication required/,
    );
  });

  it("throws when contacts fetch returns network null", async () => {
    // First fetch (contacts) -> rejects entirely.
    mockFetch.mockRejectedValueOnce(new Error("net down"));
    await expect(messagingAPI.createDirectConversation("u-2")).rejects.toThrow(
      /réseau/,
    );
  });

  it("rejects when contacts list does not include the target user", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: { data: { contacts: [{ contact_id: "someone-else" }] } },
      }),
    );
    await expect(messagingAPI.createDirectConversation("u-2")).rejects.toThrow(
      /amis avec cet utilisateur/,
    );
  });

  it("creates the conversation when contact is valid (first payload)", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({ body: { data: [{ contactId: "u-2" }] } }),
      )
      .mockResolvedValueOnce(mockResponse({ body: { id: "c-direct" } }));
    const out = await messagingAPI.createDirectConversation("u-2");
    expect(out).toMatchObject({ id: "c-direct" });
  });

  it("falls back to the legacy payload shape when first attempt 400s", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({ body: { data: [{ contact_id: "u-2" }] } }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 400 }))
      .mockResolvedValueOnce(mockResponse({ body: { id: "c-fallback" } }));

    const out = await messagingAPI.createDirectConversation("u-2");
    expect(out).toMatchObject({ id: "c-fallback" });
  });

  it("surfaces final error with status when both shapes fail", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({ body: { data: [{ contactId: "u-2" }] } }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 400 }))
      .mockResolvedValueOnce(
        mockResponse({ ok: false, status: 500, body: { message: "boom" } }),
      );

    await expect(
      messagingAPI.createDirectConversation("u-2"),
    ).rejects.toMatchObject({ status: 500, message: "boom" });
  });

  it("tolerates 404 'no contacts' on the contacts call", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "no contacts here",
        json: async () => ({}),
      } as any)
      .mockResolvedValueOnce(mockResponse({ body: { id: "c-x" } }));
    // user-not-in-contacts → second branch (non-contact) throws *before* the
    // POST happens, since items=[] does not include u-2.
    await expect(messagingAPI.createDirectConversation("u-2")).rejects.toThrow(
      /amis/,
    );
  });
});

describe("createGroupConversation", () => {
  it("POSTs the group payload and unwraps the response", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { id: "c-grp" } }));
    const out = await messagingAPI.createGroupConversation("Squad", [
      "u-1",
      "u-2",
    ]);
    expect(out).toMatchObject({ id: "c-grp" });

    const [, init] = mockFetch.mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent.type).toBe("group");
    expect(sent.name).toBe("Squad");
    // current user (user-me) is prepended; duplicates filtered.
    expect(sent.user_ids).toEqual(["user-me", "u-1", "u-2"]);
  });

  it("throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: false, status: 500 }));
    await expect(
      messagingAPI.createGroupConversation("X", ["u-1"]),
    ).rejects.toThrow(/Failed to create group conversation/);
  });
});

describe("searchMessages (conversation-scoped)", () => {
  it("returns the array when the first endpoint shape works", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: [{ id: "m-1" }, { id: "m-2" }] }),
    );
    const out = await messagingAPI.searchMessages("c-1", "hello");
    expect(out).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`${BASE}/messages/search?conversation_id=c-1`),
      expect.anything(),
    );
  });

  it("falls back to the second URL shape after a 404", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(mockResponse({ body: [{ id: "m-3" }] }));
    const out = await messagingAPI.searchMessages("c-1", "hi");
    expect(out).toEqual([{ id: "m-3" }]);
  });

  it("returns null when all endpoints fail with non-recoverable status", async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: false, status: 500 }));
    const out = await messagingAPI.searchMessages("c-1", "x");
    expect(out).toBeNull();
  });

  it("returns null after exhausting fallbacks on 404", async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: false, status: 404 }));
    const out = await messagingAPI.searchMessages("c-1", "x");
    expect(out).toBeNull();
  });
});

describe("searchMessagesGlobal", () => {
  it("returns the parsed array on success", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [{ id: "m-99" }] }));
    const out = await messagingAPI.searchMessagesGlobal("foo", {
      limit: 25,
      offset: 0,
    });
    expect(out).toEqual([{ id: "m-99" }]);
  });

  it("returns null on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: false, status: 503 }));
    const out = await messagingAPI.searchMessagesGlobal("foo");
    expect(out).toBeNull();
  });

  it("returns null when fetch itself throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const out = await messagingAPI.searchMessagesGlobal("foo");
    expect(out).toBeNull();
  });
});

describe("getConversationMembers", () => {
  it("returns [] when both /conversations/:id and /members are empty", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ body: { id: "c-1" } })) // getConversation
      .mockResolvedValueOnce(mockResponse({ body: [] })); // members fallback
    const out = await messagingAPI.getConversationMembers("c-1");
    expect(out).toEqual([]);
  });

  it("uses members from /conversations/:id when populated and enriches via /profile", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({
          body: {
            id: "c-1",
            members: [
              { userId: "u-1", role: "owner" },
              { userId: "u-2", role: "moderator" },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: {
            firstName: "Alice",
            lastName: "Wonder",
            username: "ali",
            profilePictureUrl: "https://avatar/1.jpg",
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: {
            firstName: "Bob",
            lastName: "",
            username: "bobby",
          },
        }),
      );

    const out = await messagingAPI.getConversationMembers("c-1");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: "u-1",
      role: "admin",
      display_name: "Alice Wonder",
      avatar_url: "https://avatar/1.jpg",
    });
    expect(out[1]).toMatchObject({
      id: "u-2",
      role: "moderator",
      display_name: "Bob",
    });
  });

  it("falls back to 'Utilisateur' when profile lookup fails", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({
          body: { id: "c-1", members: [{ userId: "u-1", role: "member" }] },
        }),
      )
      .mockRejectedValueOnce(new Error("net err"));

    const out = await messagingAPI.getConversationMembers("c-1");
    expect(out[0]).toMatchObject({
      id: "u-1",
      role: "member",
      display_name: "Utilisateur",
    });
  });

  it("falls back to /members when /conversations/:id throws", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 500 })) // getConversation throws
      .mockResolvedValueOnce(
        mockResponse({ body: [{ userId: "u-9", role: "admin" }] }),
      ) // /members
      .mockResolvedValueOnce(
        mockResponse({ body: { firstName: "Carol", lastName: "C" } }),
      ); // /profile

    const out = await messagingAPI.getConversationMembers("c-1");
    expect(out).toHaveLength(1);
    expect(out[0].display_name).toBe("Carol C");
  });
});
