/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("./src/services/TokenService", () =>
  require("./src/__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("./src/services/AuthService", () =>
  require("./src/__test-utils__/mockFactories").makeAuthServiceMock(),
);
jest.mock("./src/services/apiBase", () =>
  require("./src/__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);
jest.mock("./src/utils/logger", () =>
  require("./src/__test-utils__/mockFactories").makeLoggerMock(),
);

import {
  messagingAPI,
  mapBackendAttachment,
  invalidateUserInfoCache,
} from "./src/services/messaging/api";
import { TokenService } from "./src/services/TokenService";
import { AuthService } from "./src/services/AuthService";
import {
  installFetchMock,
  mockResponse,
} from "./src/__test-utils__/mockFactories";

const mockedToken = TokenService as any;
const mockedAuth = AuthService as any;
const BASE = "https://api.test/messaging/api/v1";
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = installFetchMock();
  mockedToken.getAccessToken.mockReset().mockResolvedValue("at");
  mockedAuth.refreshTokens.mockReset().mockResolvedValue(undefined);
  invalidateUserInfoCache();
});

// ---------------------------------------------------------------------------
// mapBackendAttachment (pure function)
// ---------------------------------------------------------------------------

describe("mapBackendAttachment", () => {
  it("prefers the media-service /blob proxy when media_id is available", () => {
    const mapped = mapBackendAttachment({
      id: "a-1",
      media_id: "m-1",
      mime_type: "image/png",
    });
    expect(mapped.metadata.media_url).toBe(
      "https://api.test/media/v1/m-1/blob",
    );
    expect(mapped.metadata.thumbnail_url).toBe(
      "https://api.test/media/v1/m-1/thumbnail",
    );
    expect(mapped.media_type).toBe("image");
  });

  it("falls back to a reachable file_url when no media_id exists", () => {
    const mapped = mapBackendAttachment({
      id: "a-1",
      file_url: "https://cdn.example.com/video.mp4",
      mime_type: "video/mp4",
    });
    expect(mapped.metadata.media_url).toBe("https://cdn.example.com/video.mp4");
    expect(mapped.media_type).toBe("video");
  });

  it("rejects unreachable kubernetes URLs", () => {
    const mapped = mapBackendAttachment({
      id: "a-1",
      file_url: "http://api.svc.cluster.local/audio.mp3",
      mime_type: "audio/mpeg",
    });
    expect(mapped.metadata.media_url).toBeUndefined();
    expect(mapped.media_type).toBe("audio");
  });

  it("defaults media_type to file for unknown MIME types", () => {
    const mapped = mapBackendAttachment({ id: "a-1", mime_type: "foo/bar" });
    expect(mapped.media_type).toBe("file");
  });

  it("uses the explicit file_type field when set", () => {
    const mapped = mapBackendAttachment({
      id: "a-1",
      file_type: "audio",
      mime_type: "application/octet-stream",
    });
    expect(mapped.media_type).toBe("audio");
  });

  it("falls back to fallbackMessageId when the attachment has no message_id", () => {
    const mapped = mapBackendAttachment({ id: "a-1" }, "msg-42");
    expect(mapped.message_id).toBe("msg-42");
  });

  it("preserves audio duration metadata from the backend payload", () => {
    const mapped = mapBackendAttachment({
      id: "a-1",
      media_id: "m-1",
      file_type: "audio",
      mime_type: "audio/mp4",
      metadata: { duration: 17 },
    });
    expect(mapped.metadata.duration).toBe(17);
  });

  it("extracts media_id from a media-service blob URL when the backend omits it", () => {
    const mapped = mapBackendAttachment({
      id: "a-1",
      file_url: "https://api.test/media/v1/media-real-123/blob",
      mime_type: "audio/mp4",
      file_type: "audio",
    });
    expect(mapped.media_id).toBe("media-real-123");
    expect(mapped.metadata.media_url).toBe(
      "https://api.test/media/v1/media-real-123/blob",
    );
  });
});

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

describe("messagingAPI.getConversations", () => {
  it("GETs /conversations and returns an array", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { data: [{ id: "c-1" }, { id: "c-2" }] } }),
    );

    const result = await messagingAPI.getConversations();
    expect(result).toHaveLength(2);
    expect(
      (mockFetch.mock.calls[0][0] as string).startsWith(
        `${BASE}/conversations`,
      ),
    ).toBe(true);
  });

  it("appends query params when provided", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));

    await messagingAPI.getConversations({
      include_archived: true,
      limit: 50,
      offset: 10,
    });

    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain("include_archived=true");
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=10");
  });

  it("returns an empty array when the server returns a non-array shape", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { unexpected: true } }),
    );
    await expect(messagingAPI.getConversations()).resolves.toEqual([]);
  });

  it("throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(messagingAPI.getConversations()).rejects.toThrow(/500/);
  });
});

describe("messagingAPI.getConversation / deleteConversation", () => {
  it("getConversation GETs a specific conversation id", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { id: "c-1" } }));

    const result = await messagingAPI.getConversation("c-1");
    expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/conversations/c-1`);
    expect(result).toMatchObject({ id: "c-1" });
  });

  it("getConversation throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    await expect(messagingAPI.getConversation("c-1")).rejects.toThrow();
  });

  it("deleteConversation DELETEs the endpoint", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await messagingAPI.deleteConversation("c-1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/conversations/c-1`);
    expect(init.method).toBe("DELETE");
  });

  it("deleteConversation throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(messagingAPI.deleteConversation("c-1")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Archive / unarchive / archived listing
// ---------------------------------------------------------------------------

const VALID_UUID = "12345678-1234-1234-1234-123456789012";

describe("messagingAPI.archiveConversation", () => {
  it("POSTs /conversations/:id/archive", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 200, body: {} }));
    await messagingAPI.archiveConversation(VALID_UUID);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/conversations/${VALID_UUID}/archive`);
    expect(init.method).toBe("POST");
  });

  it("rejects malformed UUIDs without hitting the network", async () => {
    await expect(
      messagingAPI.archiveConversation("not-a-uuid"),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("propagates the backend error message and status on 422", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        status: 422,
        body: { error: "Conversation is already archived" },
      }),
    );

    await expect(
      messagingAPI.archiveConversation(VALID_UUID),
    ).rejects.toMatchObject({
      status: 422,
      message: "Conversation is already archived",
    });
  });

  it("propagates 404", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 404, body: { error: "Conversation not found" } }),
    );
    await expect(
      messagingAPI.archiveConversation(VALID_UUID),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("messagingAPI.unarchiveConversation", () => {
  it("DELETEs /conversations/:id/archive", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 200, body: {} }));
    await messagingAPI.unarchiveConversation(VALID_UUID);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/conversations/${VALID_UUID}/archive`);
    expect(init.method).toBe("DELETE");
  });

  it("rejects malformed UUIDs without hitting the network", async () => {
    await expect(
      messagingAPI.unarchiveConversation("nope"),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("propagates 422 (not archived)", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        status: 422,
        body: { error: "Conversation is not archived" },
      }),
    );
    await expect(
      messagingAPI.unarchiveConversation(VALID_UUID),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("messagingAPI.getArchivedConversations", () => {
  it("GETs /conversations/archived and snake-cases the camelCase listing", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          data: [
            {
              id: "c-1",
              type: "direct",
              isArchived: true,
              isPinned: false,
              isMuted: false,
              insertedAt: "2026-04-01T00:00:00Z",
              updatedAt: "2026-04-02T00:00:00Z",
            },
          ],
          meta: {
            count: 1,
            limit: 50,
            offset: 0,
            hasMore: false,
            userId: "u-1",
          },
        },
      }),
    );

    const result = await messagingAPI.getArchivedConversations({
      limit: 50,
      offset: 0,
    });

    expect(result.data).toHaveLength(1);
    expect((result.data[0] as any).is_archived).toBe(true);
    expect((result.data[0] as any).inserted_at).toBe("2026-04-01T00:00:00Z");
    expect(result.meta).toEqual({
      count: 1,
      limit: 50,
      offset: 0,
      has_more: false,
      user_id: "u-1",
    });
  });

  it("appends limit and offset query params when provided", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { data: [], meta: {} } }),
    );

    await messagingAPI.getArchivedConversations({ limit: 25, offset: 50 });

    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain("limit=25");
    expect(url).toContain("offset=50");
  });

  it("returns an empty page with sensible defaults when meta is missing", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));

    const result = await messagingAPI.getArchivedConversations();
    expect(result.data).toEqual([]);
    expect(result.meta.has_more).toBe(false);
    expect(result.meta.limit).toBe(50);
  });

  it("throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(messagingAPI.getArchivedConversations()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

describe("messagingAPI.getMessages", () => {
  it("GETs /conversations/:id/messages with optional params", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: [{ id: "m-1" }, { id: "m-2" }] }),
    );
    const result = await messagingAPI.getMessages("c-1", {
      limit: 20,
      before: "cursor",
    });

    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain(`${BASE}/conversations/c-1/messages`);
    expect(url).toContain("limit=20");
    expect(url).toContain("before=cursor");
    expect(result).toHaveLength(2);
  });

  it("maps backend attachments onto each message", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: [
          {
            id: "m-1",
            attachments: [
              {
                id: "a-1",
                media_id: "mid-1",
                mime_type: "image/jpeg",
              },
            ],
          },
        ],
      }),
    );

    const result = await messagingAPI.getMessages("c-1");
    expect((result[0] as any).attachments[0].metadata.media_url).toBe(
      "https://api.test/media/v1/mid-1/blob",
    );
  });
});

describe("messagingAPI.sendMessage", () => {
  it("POSTs the message body to the conversation", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { id: "m-1" } }));

    await messagingAPI.sendMessage("c-1", {
      content: "hi",
      message_type: "text",
      client_random: 7,
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/conversations/c-1/messages`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      content: "hi",
      message_type: "text",
      client_random: 7,
      metadata: undefined,
      reply_to_id: undefined,
    });
  });

  it("throws on non-OK", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(
      messagingAPI.sendMessage("c-1", {
        content: "hi",
        message_type: "text",
        client_random: 1,
      }),
    ).rejects.toThrow();
  });
});

describe("messagingAPI.editMessage / deleteMessage / forwardMessage", () => {
  it("editMessage PUTs with new content", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "m-1", content: "new" } }),
    );
    await messagingAPI.editMessage("m-1", "c-1", "new");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/messages/m-1`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      content: "new",
      conversation_id: "c-1",
    });
  });

  it("deleteMessage DELETEs with delete_for_everyone flag", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await messagingAPI.deleteMessage("m-1", "c-1", true);

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("delete_for_everyone=true");
    expect(String(url)).toContain("conversation_id=c-1");
    expect(init.method).toBe("DELETE");
  });

  it("forwardMessage POSTs an array of conversation_ids", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: [{ id: "m-2" }, { id: "m-3" }] }),
    );
    const result = await messagingAPI.forwardMessage("m-1", ["c-a", "c-b"]);
    expect(result).toHaveLength(2);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/messages/m-1/forward`);
    expect(JSON.parse(init.body)).toEqual({
      conversation_ids: ["c-a", "c-b"],
    });
  });

  it("forwardMessage returns an empty array when the server returns a non-array", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: {} }));
    await expect(messagingAPI.forwardMessage("m-1", ["c-1"])).resolves.toEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------------------
// Reactions / Pins / Attachments
// ---------------------------------------------------------------------------

describe("messagingAPI.addReaction / removeReaction / getMessageReactions", () => {
  it("addReaction POSTs user_id + reaction", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await messagingAPI.addReaction("m-1", "u-1", "👍");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/messages/m-1/reactions`);
    expect(JSON.parse(init.body)).toEqual({
      user_id: "u-1",
      reaction: "👍",
    });
  });

  it("addReaction throws with status and body on failure", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 400, body: { message: "too many" } }),
    );
    await expect(
      messagingAPI.addReaction("m-1", "u-1", "👍"),
    ).rejects.toMatchObject({ message: "too many", status: 400 });
  });

  it("removeReaction DELETEs with user_id in query string", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await messagingAPI.removeReaction("m-1", "u-1", "👍");

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("user_id=u-1");
  });

  it("getMessageReactions returns empty reactions on 404", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    await expect(messagingAPI.getMessageReactions("m-1")).resolves.toEqual({
      reactions: [],
    });
  });

  it("getMessageReactions throws on other non-OK statuses", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));
    await expect(messagingAPI.getMessageReactions("m-1")).rejects.toThrow();
  });
});

describe("messagingAPI pins & attachments", () => {
  it("pinMessage POSTs /pin with conversation_id", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await messagingAPI.pinMessage("c-1", "m-1");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/messages/m-1/pin`);
    expect(JSON.parse(init.body)).toEqual({ conversation_id: "c-1" });
  });

  it("unpinMessage DELETEs /pin with conversation_id query", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await messagingAPI.unpinMessage("c-1", "m-1");
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("conversation_id=c-1");
  });

  it("getPinnedMessages returns empty on 404", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    await expect(messagingAPI.getPinnedMessages("c-1")).resolves.toEqual([]);
  });

  it("getAttachments returns empty on 404", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 404 }));
    await expect(messagingAPI.getAttachments("m-1")).resolves.toEqual([]);
  });

  it("addAttachment POSTs the attachment payload", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await messagingAPI.addAttachment("m-1", { foo: "bar" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BASE}/messages/m-1/attachments`);
    expect(JSON.parse(init.body)).toEqual({ foo: "bar" });
  });
});

// ---------------------------------------------------------------------------
// User info cache
// ---------------------------------------------------------------------------

describe("messagingAPI.getUserInfo cache", () => {
  it("caches a successful profile fetch for subsequent calls", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u-1", username: "ada" } }),
    );

    const a = await messagingAPI.getUserInfo("u-1");
    const b = await messagingAPI.getUserInfo("u-1");

    expect(a).toEqual(b);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent requests into a single fetch", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { id: "u-1", username: "ada" } }),
    );

    const [a, b, c] = await Promise.all([
      messagingAPI.getUserInfo("u-1"),
      messagingAPI.getUserInfo("u-1"),
      messagingAPI.getUserInfo("u-1"),
    ]);

    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("invalidateUserInfoCache(id) forces a re-fetch", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({ body: { id: "u-1", username: "first" } }),
      )
      .mockResolvedValueOnce(
        mockResponse({ body: { id: "u-1", username: "second" } }),
      );

    await messagingAPI.getUserInfo("u-1");
    invalidateUserInfoCache("u-1");
    await messagingAPI.getUserInfo("u-1");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("invalidateUserInfoCache() clears the whole cache", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({ body: { id: "u-1", username: "ada" } }),
      )
      .mockResolvedValueOnce(
        mockResponse({ body: { id: "u-1", username: "ada" } }),
      );

    await messagingAPI.getUserInfo("u-1");
    invalidateUserInfoCache();
    await messagingAPI.getUserInfo("u-1");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("caches null with a short TTL on 429 (refetches after 30s)", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-09T12:00:00Z"));
    try {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ status: 429 }))
        .mockResolvedValueOnce(
          mockResponse({ body: { id: "u-1", username: "ada" } }),
        );

      const first = await messagingAPI.getUserInfo("u-1");
      expect(first).toBeNull();
      // dans la fenetre 30s : sert le cache, pas de retry storm
      const cached = await messagingAPI.getUserInfo("u-1");
      expect(cached).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // apres 30s + 1s, le cache short-TTL expire et on refetch
      jest.setSystemTime(new Date("2026-05-09T12:00:31Z"));
      const second = await messagingAPI.getUserInfo("u-1");
      expect(second).toMatchObject({ id: "u-1" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps the standard 5-min TTL for non-429 errors (e.g. 500)", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-09T12:00:00Z"));
    try {
      mockFetch.mockResolvedValueOnce(mockResponse({ status: 500 }));

      const first = await messagingAPI.getUserInfo("u-1");
      expect(first).toBeNull();

      // a 31s, le cache 5min tient toujours, pas de refetch
      jest.setSystemTime(new Date("2026-05-09T12:00:31Z"));
      const stillCached = await messagingAPI.getUserInfo("u-1");
      expect(stillCached).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// authenticatedFetch 401 auto-retry
// ---------------------------------------------------------------------------

describe("authenticatedFetch 401 retry", () => {
  it("retries once after AuthService.refreshTokens on 401", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ status: 401 }))
      .mockResolvedValueOnce(mockResponse({ body: { id: "c-1" } }));

    const result = await messagingAPI.getConversation("c-1");
    expect(mockedAuth.refreshTokens).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: "c-1" });
  });

  it("propagates the 401 when refresh itself throws", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 401 }));
    mockedAuth.refreshTokens.mockRejectedValueOnce(new Error("dead"));

    await expect(messagingAPI.getConversation("c-1")).rejects.toThrow();
  });
});
