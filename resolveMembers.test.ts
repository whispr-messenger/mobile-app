import {
  resolveConversationMemberIds,
  resolveConversationMemberIdsNow,
} from "./src/utils/resolveMembers";

describe("resolveConversationMemberIds", () => {
  const baseOpts = { selfId: "self" };

  it("returns the fetched IDs when in-memory sources are empty", async () => {
    const fetched = Promise.resolve([{ id: "alice" }, { id: "bob" }]);
    const result = await resolveConversationMemberIds(
      {
        conversation: null,
        allConversations: [],
        conversationMembers: [],
        conversationId: "conv1",
      },
      fetched,
      baseOpts,
    );

    expect(result.fetched).toBe(true);
    expect(result.memberIds.sort()).toEqual(["alice", "bob"]);
  });

  it("filters out self from the merged set", async () => {
    const fetched = Promise.resolve([{ id: "self" }, { id: "alice" }]);
    const result = await resolveConversationMemberIds(
      {
        conversation: { member_user_ids: ["self", "bob"] },
        allConversations: [],
        conversationMembers: [],
        conversationId: "conv1",
      },
      fetched,
      baseOpts,
    );

    expect(result.memberIds.sort()).toEqual(["alice", "bob"]);
  });

  it("dedupes IDs across all four sources", async () => {
    const fetched = Promise.resolve([{ id: "alice" }]);
    const result = await resolveConversationMemberIds(
      {
        conversation: {
          member_user_ids: ["alice", "bob"],
          members: [{ user_id: "alice" }, { user_id: "carol" }],
        },
        allConversations: [
          { id: "conv1", member_user_ids: ["bob", "dan"] },
          { id: "conv2", member_user_ids: ["should-be-ignored"] },
        ],
        conversationMembers: [{ id: "alice" }, { id: "eve" }],
        conversationId: "conv1",
      },
      fetched,
      baseOpts,
    );

    expect(result.memberIds.sort()).toEqual([
      "alice",
      "bob",
      "carol",
      "dan",
      "eve",
    ]);
  });

  it("falls back to in-memory IDs when the fetch promise rejects", async () => {
    const fetched = Promise.reject(new Error("offline"));
    const result = await resolveConversationMemberIds(
      {
        conversation: { member_user_ids: ["alice", "bob"] },
        allConversations: [],
        conversationMembers: [],
        conversationId: "conv1",
      },
      fetched,
      baseOpts,
    );

    expect(result.fetched).toBe(false);
    expect(result.memberIds.sort()).toEqual(["alice", "bob"]);
  });

  it("returns an empty array when both server fetch and in-memory sources are empty", async () => {
    const fetched = Promise.resolve([]);
    const result = await resolveConversationMemberIds(
      {
        conversation: null,
        allConversations: [],
        conversationMembers: [],
        conversationId: "conv1",
      },
      fetched,
      baseOpts,
    );

    expect(result.fetched).toBe(true);
    expect(result.memberIds).toEqual([]);
  });

  it("strips empty / falsy IDs", async () => {
    const fetched = Promise.resolve([{ id: "" }, { id: "alice" }]);
    const result = await resolveConversationMemberIds(
      {
        conversation: { member_user_ids: ["", "bob"] },
        allConversations: [],
        conversationMembers: [],
        conversationId: "conv1",
      },
      fetched,
      baseOpts,
    );

    expect(result.memberIds.sort()).toEqual(["alice", "bob"]);
  });
});

describe("resolveConversationMemberIdsNow", () => {
  it("calls fetchMembers with the conversation ID", async () => {
    const fetchMembers = jest
      .fn()
      .mockResolvedValue([{ id: "alice" }, { id: "bob" }]);

    const result = await resolveConversationMemberIdsNow(
      {
        conversation: null,
        allConversations: [],
        conversationMembers: [],
        conversationId: "conv1",
      },
      { selfId: "self", fetchMembers },
    );

    expect(fetchMembers).toHaveBeenCalledWith("conv1");
    expect(result.memberIds.sort()).toEqual(["alice", "bob"]);
  });
});
