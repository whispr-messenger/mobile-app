/**
 * Resolve the recipient user IDs of a conversation, deduped and excluding
 * the current user.
 *
 * In-memory sources (member_user_ids, members, conversationMembers) can be
 * stale or empty just after a conversation is opened — especially in 1v1
 * conversations bootstrapped from a contact tap. Always fetch the fresh
 * member list from the server in parallel with the caller's other work,
 * and merge it on top of the in-memory candidates so that the result is
 * authoritative by the time it is consumed.
 *
 * If both the in-memory candidates and the server fetch fail to produce
 * any IDs, the caller gets back an empty array — surface a user-visible
 * error in that case rather than silently dropping the share.
 */
export interface InMemoryMemberSources {
  /** Conversation as currently held in component state. */
  conversation?: {
    member_user_ids?: string[] | null;
    members?: Array<{ user_id: string }> | null;
  } | null;
  /** Conversations cache from the global store. */
  allConversations?: Array<{
    id: string;
    member_user_ids?: string[] | null;
  }>;
  /** Members previously fetched and held in component state. */
  conversationMembers?: Array<{ id: string }>;
  /** Conversation ID used to look up the cache hit in allConversations. */
  conversationId: string;
}

export interface ResolveMembersOptions {
  /** Current user's ID — always filtered out of the result. */
  selfId: string;
  /**
   * Optional server fetcher used by resolveConversationMemberIdsNow.
   * resolveConversationMemberIds takes the promise directly so callers
   * can start it earlier (in parallel with upload).
   */
  fetchMembers?: (conversationId: string) => Promise<Array<{ id: string }>>;
}

export interface ResolveMembersResult {
  /** Final deduped IDs, excluding self. */
  memberIds: string[];
  /** True iff fetchMembers was actually called and resolved successfully. */
  fetched: boolean;
}

function collectInMemoryIds(sources: InMemoryMemberSources): string[] {
  const {
    conversation,
    allConversations,
    conversationMembers,
    conversationId,
  } = sources;
  const ids: string[] = [];
  if (Array.isArray(conversation?.member_user_ids)) {
    ids.push(...(conversation!.member_user_ids as string[]));
  }
  const cached = allConversations?.find((c) => c.id === conversationId);
  if (Array.isArray(cached?.member_user_ids)) {
    ids.push(...(cached!.member_user_ids as string[]));
  }
  if (Array.isArray(conversation?.members)) {
    ids.push(...conversation!.members!.map((m) => m.user_id).filter(Boolean));
  }
  if (Array.isArray(conversationMembers)) {
    ids.push(...conversationMembers.map((m) => m.id));
  }
  return ids;
}

/**
 * Resolve recipient member IDs by ALWAYS calling the server fetcher in
 * parallel with whatever the caller is doing, then merging on top of the
 * in-memory candidates. The promise returned by fetchMembers should be
 * created BEFORE the caller awaits any other long-running work (e.g. an
 * upload) so that the network round-trip is hidden behind that latency.
 */
export async function resolveConversationMemberIds(
  sources: InMemoryMemberSources,
  fetchPromise: Promise<Array<{ id: string }>>,
  options: ResolveMembersOptions,
): Promise<ResolveMembersResult> {
  const inMemory = collectInMemoryIds(sources);

  let fetchedIds: string[] = [];
  let fetched = false;
  try {
    const members = await fetchPromise;
    if (Array.isArray(members)) {
      fetchedIds = members.map((m) => m.id).filter(Boolean);
      fetched = true;
    }
  } catch {
    // Network/server failure — fall back silently to in-memory IDs.
    // The caller will still get a non-empty list when the cache is warm.
  }

  const merged = [...fetchedIds, ...inMemory]
    .filter((id): id is string => Boolean(id))
    .filter((id) => id !== options.selfId);

  return {
    memberIds: Array.from(new Set(merged)),
    fetched,
  };
}

/**
 * Convenience wrapper that creates the fetch promise itself. Use
 * resolveConversationMemberIds directly when you want to start the fetch
 * earlier (in parallel with another long-running operation).
 */
export async function resolveConversationMemberIdsNow(
  sources: InMemoryMemberSources,
  options: ResolveMembersOptions & {
    fetchMembers: (conversationId: string) => Promise<Array<{ id: string }>>;
  },
): Promise<ResolveMembersResult> {
  return resolveConversationMemberIds(
    sources,
    options.fetchMembers(sources.conversationId),
    options,
  );
}
