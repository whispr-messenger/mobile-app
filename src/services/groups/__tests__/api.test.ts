/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../../TokenService", () =>
  require("../../../__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("../../apiBase", () =>
  require("../../../__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);

const mockUpdateGroupMemberRole = jest.fn();
jest.mock("../../messaging/api", () => ({
  messagingAPI: {
    updateGroupMemberRole: (...args: any[]) =>
      mockUpdateGroupMemberRole(...args),
  },
}));

import { groupsAPI } from "../api";
import { TokenService } from "../../TokenService";
import {
  installFetchMock,
  mockResponse,
} from "../../../__test-utils__/mockFactories";

const mockedToken = TokenService as any;
const USER_BASE = "https://api.test/user/v1";
const MSG_BASE = "https://api.test/messaging/api/v1";

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
  mockedToken.decodeAccessToken.mockReset().mockReturnValue({ sub: "owner-1" });
  mockUpdateGroupMemberRole.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------- getGroupDetails ----------------

describe("groupsAPI.getGroupDetails", () => {
  it("returns details from the messaging conversation when type=group", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            id: "conv-1",
            type: "group",
            name: "My Group",
            metadata: {
              description: "Hello",
              created_by: "owner-1",
              picture_url: "https://cdn/x.png",
            },
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
          },
        },
      }),
    );

    const details = await groupsAPI.getGroupDetails("grp-1", "conv-1");

    expect(mockFetch.mock.calls[0][0]).toBe(`${MSG_BASE}/conversations/conv-1`);
    expect(details).toMatchObject({
      id: "grp-1",
      name: "My Group",
      description: "Hello",
      picture_url: "https://cdn/x.png",
      conversation_id: "conv-1",
    });
  });

  it("falls back to user-service /groups when conversation type is not group", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { data: { id: "conv-1", type: "direct" } } }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: [
          {
            id: "grp-1",
            name: "Fallback Group",
            ownerId: "owner-1",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );

    const details = await groupsAPI.getGroupDetails("grp-1");
    expect(details.name).toBe("Fallback Group");
  });

  it("throws when neither messaging nor user-service finds the group", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));

    await expect(groupsAPI.getGroupDetails("missing-grp")).rejects.toThrow(
      /Failed to fetch group details/,
    );
  });

  it("throws when user-service returns a list that does not contain the requested group", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: [{ id: "other-grp" }] }),
    );

    await expect(groupsAPI.getGroupDetails("grp-1")).rejects.toThrow(
      /Group not found/,
    );
  });
});

// ---------------- getGroupMembers ----------------

describe("groupsAPI.getGroupMembers", () => {
  it("resolves members from the conversation payload and enriches profiles", async () => {
    // 1. GET /conversations/:id → members embedded
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            members: [
              {
                user_id: "u-1",
                role: "admin",
                joined_at: "2026-01-01T00:00:00Z",
              },
              {
                user_id: "u-2",
                role: "member",
                joined_at: "2026-01-02T00:00:00Z",
              },
            ],
          },
        },
      }),
    );
    // 2-3. enrichissement profile pour u-1 puis u-2
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          username: "alice",
          firstName: "Alice",
          lastName: "Wonderland",
          profilePictureUrl: "https://cdn/a.png",
        },
      }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { username: "bob" } }),
    );

    const { members, total } = await groupsAPI.getGroupMembers("grp-1");

    expect(total).toBe(2);
    expect(members[0]).toMatchObject({
      user_id: "u-1",
      display_name: "Alice Wonderland",
      role: "admin",
    });
    expect(members[1]).toMatchObject({
      user_id: "u-2",
      display_name: "bob",
      role: "member",
    });
  });

  it("falls back to GET /members when the conversation payload has no members", async () => {
    // 1. GET /conversations/:id → no members
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { data: { id: "conv-1", members: [] } } }),
    );
    // 2. GET /conversations/:id/members → array
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: [{ user_id: "u-9", role: "member" }] }),
    );
    // 3. enrichissement profile
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { username: "u9" } }));

    const { members } = await groupsAPI.getGroupMembers("grp-1");
    expect(members).toHaveLength(1);
    expect(members[0].user_id).toBe("u-9");
  });

  it("uses the conversation member_user_ids fallback when nothing else works", async () => {
    // 1. GET /conversations/:id → no members object
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: { id: "conv-1", member_user_ids: ["u-7"] },
        },
      }),
    );
    // 2. GET /conversations/:id/members → empty
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));
    // 3. Fallback re-fetch of conversation by groupsAPI fallback helper
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: { data: { member_user_ids: ["u-7"] } },
      }),
    );
    // 4. profile enrichment
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { username: "u7" } }));

    const { members } = await groupsAPI.getGroupMembers("grp-1");
    expect(members.map((m) => m.user_id)).toEqual(["u-7"]);
  });

  it("handles a failed profile lookup with the default 'Utilisateur' label", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: { data: { members: [{ user_id: "u-1", role: "admin" }] } },
      }),
    );
    // profile fetch fails
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));

    const { members } = await groupsAPI.getGroupMembers("grp-1");
    expect(members[0].display_name).toBe("Utilisateur");
  });
});

// ---------------- getGroupStats ----------------

describe("groupsAPI.getGroupStats", () => {
  it("returns counts based on conversation members and embedded message_count", async () => {
    // 1. fetchConversationMembers → GET /conversations/:id
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            id: "conv-1",
            members: [
              { user_id: "u-1", role: "admin" },
              { user_id: "u-2", role: "member" },
              { user_id: "u-3", role: "owner" },
            ],
            messageCount: 42,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-05T00:00:00Z",
          },
        },
      }),
    );
    // 2. extra GET /conversations/:id triggered by getGroupStats
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            id: "conv-1",
            members: [
              { user_id: "u-1", role: "admin" },
              { user_id: "u-2", role: "member" },
              { user_id: "u-3", role: "owner" },
            ],
            messageCount: 42,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-05T00:00:00Z",
          },
        },
      }),
    );

    const stats = await groupsAPI.getGroupStats("grp-1");
    expect(stats.memberCount).toBe(3);
    expect(stats.adminCount).toBe(2); // admin + owner
    expect(stats.messageCount).toBe(42);
    expect(stats.createdAt).toBe("2026-01-01T00:00:00Z");
    expect(stats.lastActivity).toBe("2026-01-05T00:00:00Z");
  });

  it("falls back to paginating /messages when conversation has no embedded count", async () => {
    // 1. fetchConversationMembers
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: { id: "conv-1", members: [{ user_id: "u-1", role: "admin" }] },
        },
      }),
    );
    // 2. re-fetch conversation for stats path
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            id: "conv-1",
            members: [{ user_id: "u-1", role: "admin" }],
            // no messageCount
          },
        },
      }),
    );
    // 3. GET /messages page 0 with meta.total
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { data: [], meta: { total: 17 } } }),
    );

    const stats = await groupsAPI.getGroupStats("grp-1");
    expect(stats.messageCount).toBe(17);
    expect(stats.adminCount).toBe(1);
  });

  it("throws when the conversation cannot be fetched", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));

    await expect(groupsAPI.getGroupStats("grp-1")).rejects.toThrow(
      /Failed to fetch conversation for group stats/,
    );
  });
});

// ---------------- getGroupLogs (stub) ----------------

describe("groupsAPI.getGroupLogs", () => {
  it("returns an empty list until the backend endpoint exists", async () => {
    const result = await groupsAPI.getGroupLogs("grp-1");
    expect(result).toEqual({ logs: [], total: 0 });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------- getGroupSettings ----------------

describe("groupsAPI.getGroupSettings", () => {
  it("returns defaults when the conversation cannot be fetched", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));

    const settings = await groupsAPI.getGroupSettings("grp-1");
    expect(settings).toEqual({
      message_permission: "all_members",
      media_permission: "all_members",
      mention_permission: "all_members",
      add_members_permission: "admins_only",
      moderation_level: "light",
      content_filter_enabled: false,
      join_approval_required: false,
    });
  });

  it("normalizes settings nested under metadata.group_settings", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            metadata: {
              group_settings: {
                message_permission: "moderators_plus",
                media_permission: "admins_only",
                moderation_level: "strict",
                content_filter_enabled: true,
                join_approval_required: true,
              },
            },
          },
        },
      }),
    );

    const settings = await groupsAPI.getGroupSettings("grp-1");
    expect(settings.message_permission).toBe("moderators_plus");
    expect(settings.media_permission).toBe("admins_only");
    expect(settings.moderation_level).toBe("strict");
    expect(settings.content_filter_enabled).toBe(true);
    expect(settings.join_approval_required).toBe(true);
  });

  it("accepts camelCase variants from metadata", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            metadata: {
              messagePermission: "moderators_plus",
              moderationLevel: "medium",
            },
          },
        },
      }),
    );

    const settings = await groupsAPI.getGroupSettings("grp-1");
    expect(settings.message_permission).toBe("moderators_plus");
    expect(settings.moderation_level).toBe("medium");
  });

  it("ignores unknown permission values and falls back to defaults", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            metadata: {
              group_settings: {
                message_permission: "garbage",
                moderation_level: "yolo",
              },
            },
          },
        },
      }),
    );

    const settings = await groupsAPI.getGroupSettings("grp-1");
    expect(settings.message_permission).toBe("all_members");
    expect(settings.moderation_level).toBe("light");
  });
});

// ---------------- updateGroupSettings ----------------

describe("groupsAPI.updateGroupSettings", () => {
  it("PUTs merged settings into conversation metadata and returns refreshed settings", async () => {
    // 1. initial GET /conversations/:id (extract current settings)
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            metadata: {
              group_settings: {
                message_permission: "all_members",
                media_permission: "all_members",
              },
              description: "preserve me",
            },
          },
        },
      }),
    );
    // 2. PUT /conversations/:id
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));
    // 3. refetch /conversations/:id
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            metadata: {
              group_settings: {
                message_permission: "admins_only",
                media_permission: "all_members",
              },
            },
          },
        },
      }),
    );

    const result = await groupsAPI.updateGroupSettings("grp-1", {
      message_permission: "admins_only",
    });

    expect(result.message_permission).toBe("admins_only");
    // PUT call (call 2) — body must merge updates and preserve metadata
    const putCall = mockFetch.mock.calls[1];
    expect(putCall[1].method).toBe("PUT");
    const body = JSON.parse(putCall[1].body);
    expect(body.metadata.description).toBe("preserve me");
    expect(body.metadata.group_settings.message_permission).toBe("admins_only");
  });

  it("throws when the initial conversation fetch returns no payload", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));

    await expect(
      groupsAPI.updateGroupSettings("grp-1", { moderation_level: "strict" }),
    ).rejects.toThrow(/Impossible de charger la conversation/);
  });

  it("throws when the PUT fails", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { data: { metadata: {} } } }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 403, textBody: "forbidden" }),
    );

    await expect(
      groupsAPI.updateGroupSettings("grp-1", { moderation_level: "strict" }),
    ).rejects.toThrow(/Impossible de mettre a jour les parametres \(403\)/);
  });
});

// ---------------- addMembers ----------------

describe("groupsAPI.addMembers", () => {
  it("POSTs each user to /conversations/:id/members and returns enriched members", async () => {
    // Per user: 1 POST add + 1 GET profile
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } })); // add u-1
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: { username: "u1", firstName: "User", lastName: "One" },
      }),
    );
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } })); // add u-2
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { username: "u2" } }));

    const result = await groupsAPI.addMembers("grp-1", ["u-1", "u-2"]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      user_id: "u-1",
      display_name: "User One",
    });
    expect(result[1]).toMatchObject({
      user_id: "u-2",
      display_name: "u2",
    });

    const addCalls = mockFetch.mock.calls.filter(
      (c) => c[1]?.method === "POST",
    );
    expect(addCalls).toHaveLength(2);
    expect(JSON.parse(addCalls[0][1].body)).toEqual({ user_id: "u-1" });
  });

  it("throws when adding a member fails", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 403 }));

    await expect(groupsAPI.addMembers("grp-1", ["u-1"])).rejects.toThrow(
      /Failed to add member u-1/,
    );
  });
});

// ---------------- removeMember ----------------

describe("groupsAPI.removeMember", () => {
  it("DELETEs /conversations/:id/members/:userId", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    await groupsAPI.removeMember("grp-1", "u-9", "conv-1");

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe(`${MSG_BASE}/conversations/conv-1/members/u-9`);
    expect(call[1].method).toBe("DELETE");
  });

  it("attaches the HTTP status on the thrown error", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 403, body: { error: "forbidden" } }),
    );

    let caught: any;
    try {
      await groupsAPI.removeMember("grp-1", "u-9");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toBe("forbidden");
    expect(caught.status).toBe(403);
  });
});

// ---------------- transferAdmin ----------------

describe("groupsAPI.transferAdmin", () => {
  it("promotes the new user to admin and demotes the current owner", async () => {
    mockUpdateGroupMemberRole.mockResolvedValue(undefined);

    await groupsAPI.transferAdmin("grp-1", "u-2", "conv-1");

    expect(mockUpdateGroupMemberRole).toHaveBeenNthCalledWith(
      1,
      "conv-1",
      "u-2",
      "admin",
    );
    expect(mockUpdateGroupMemberRole).toHaveBeenNthCalledWith(
      2,
      "conv-1",
      "owner-1",
      "member",
    );
  });

  it("does not demote when transferring to the current owner", async () => {
    mockUpdateGroupMemberRole.mockResolvedValue(undefined);

    await groupsAPI.transferAdmin("grp-1", "owner-1");

    expect(mockUpdateGroupMemberRole).toHaveBeenCalledTimes(1);
  });
});

// ---------------- updateGroup ----------------

describe("groupsAPI.updateGroup", () => {
  it("uses messaging conversation route when conversationId is provided and best-effort syncs user-service", async () => {
    // 1. GET /conversations/:id (current metadata)
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            id: "conv-1",
            metadata: { description: "old" },
          },
        },
      }),
    );
    // 2. PUT /conversations/:id — response is the updated conversation
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: {
            id: "conv-1",
            name: "Renamed",
            metadata: { description: "new" },
          },
        },
      }),
    );
    // 3. PATCH /user-service (best-effort sync)
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    const result = await groupsAPI.updateGroup(
      "grp-1",
      { name: "Renamed", description: "new" },
      "conv-1",
    );

    expect(result.name).toBe("Renamed");
    expect(result.description).toBe("new");
  });

  it("uses user-service PATCH when no conversationId is provided", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          id: "grp-1",
          name: "Renamed",
          description: "new",
          ownerId: "owner-1",
        },
      }),
    );

    const result = await groupsAPI.updateGroup("grp-1", { name: "Renamed" });
    expect(result.name).toBe("Renamed");

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe(`${USER_BASE}/groups/owner-1/grp-1`);
    expect(call[1].method).toBe("PATCH");
  });

  it("throws when the user-service PATCH fails without conversation fallback", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));

    await expect(groupsAPI.updateGroup("grp-1", { name: "x" })).rejects.toThrow(
      /Failed to update group/,
    );
  });
});

// ---------------- leaveGroup ----------------

describe("groupsAPI.leaveGroup", () => {
  it("POSTs to /conversations/:id/leave when the user leaves themselves", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    await groupsAPI.leaveGroup("grp-1");

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe(`${MSG_BASE}/conversations/grp-1/leave`);
    expect(call[1].method).toBe("POST");
  });

  it("treats HTTP 204 as success", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));

    await expect(groupsAPI.leaveGroup("grp-1")).resolves.toBeUndefined();
  });

  it("falls back to DELETE /members/:id when leave endpoint is 404", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    await groupsAPI.leaveGroup("grp-1");

    expect(mockFetch.mock.calls[1][1].method).toBe("DELETE");
    expect(mockFetch.mock.calls[1][0]).toBe(
      `${MSG_BASE}/conversations/grp-1/members/owner-1`,
    );
  });

  it("attaches the HTTP status on the error when leave fails with non-fallback status", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 500, body: { error: "boom" } }),
    );

    let caught: any;
    try {
      await groupsAPI.leaveGroup("grp-1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(500);
    expect(caught.message).toBe("boom");
  });

  it("sends an explicit error message when an admin removal returns 403", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } })); // leave attempt — won't apply since memberId !== current
    // Actually for `userId` !== current: it skips the leave branch and goes
    // directly to DELETE /members/:userId
    // → only one fetch call

    let caught: any;
    try {
      await groupsAPI.leaveGroup("grp-1", "u-other");
      // The current fetch above is consumed by DELETE; reset and re-mock
    } catch (err) {
      caught = err;
    }
    // No throw here since fetch returned ok — re-test the 403 path properly:

    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 403, body: { error: "nope" } }),
    );
    try {
      await groupsAPI.leaveGroup("grp-1", "u-other");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(403);
    expect(caught.message).toMatch(/administrateurs/);
  });
});

// ---------------- deleteGroup ----------------

describe("groupsAPI.deleteGroup", () => {
  it("DELETEs the user-service group endpoint and returns on 2xx", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    await groupsAPI.deleteGroup("grp-1");

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe(`${USER_BASE}/groups/owner-1/grp-1`);
    expect(call[1].method).toBe("DELETE");
  });

  it("treats HTTP 204 as success", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await expect(groupsAPI.deleteGroup("grp-1")).resolves.toBeUndefined();
  });

  it("falls back to deleting the messaging conversation on 404 when conversationId is provided", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    await groupsAPI.deleteGroup("grp-1", "conv-1");

    expect(mockFetch.mock.calls[1][0]).toBe(`${MSG_BASE}/conversations/conv-1`);
    expect(mockFetch.mock.calls[1][1].method).toBe("DELETE");
  });

  it("throws when both the user-service and messaging delete fail", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));

    await expect(groupsAPI.deleteGroup("grp-1", "conv-1")).rejects.toThrow(
      /Failed to delete group conversation/,
    );
  });

  it("throws on non-404 errors with no fallback", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 403 }));

    await expect(groupsAPI.deleteGroup("grp-1")).rejects.toThrow(
      /Failed to delete group/,
    );
  });
});

// ---------------- auth header propagation ----------------

describe("auth headers", () => {
  it("includes Bearer token in every authenticated call", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));

    await groupsAPI.leaveGroup("grp-1");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer at");
  });

  it("omits the Authorization header when no token is available", async () => {
    // removeMember only calls getAuthHeaders (not getOwnerId), so a null token
    // produces empty headers without raising "Not authenticated".
    mockedToken.getAccessToken.mockResolvedValue(null);
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));

    await groupsAPI.removeMember("grp-1", "u-9", "conv-1");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws when getOwnerId cannot decode the token", async () => {
    mockedToken.getAccessToken.mockResolvedValueOnce(null);

    await expect(groupsAPI.deleteGroup("grp-1")).rejects.toThrow(
      /Not authenticated/,
    );
  });
});
