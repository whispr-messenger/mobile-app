import { QueryClient } from "@tanstack/react-query";

/**
 * Single project-wide QueryClient. Defaults tuned for a chat app:
 *
 * - `staleTime: 30s` — most lists (contacts, conversations, group members)
 *   change rarely enough that hammering the API on every focus is wasteful.
 *   Override per-query when stricter freshness is required.
 * - `gcTime: 5min` — keep evicted query data around long enough that going
 *   back to a previously visited screen is instant.
 * - `retry: 1` — one retry catches transient network blips without stalling
 *   the UI when the user is genuinely offline.
 * - `refetchOnWindowFocus: false` — RN apps don't have window focus the way
 *   the web does; AppState changes are handled explicitly elsewhere.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * Lazy singleton — the app uses one client for its whole lifetime, but tests
 * call `createAppQueryClient()` directly to get a fresh, isolated instance.
 */
let _appQueryClient: QueryClient | undefined;
export function getAppQueryClient(): QueryClient {
  if (!_appQueryClient) {
    _appQueryClient = createAppQueryClient();
  }
  return _appQueryClient;
}

/** Test-only: reset the singleton between tests to avoid cross-test cache leaks. */
export function __resetAppQueryClientForTests(): void {
  _appQueryClient = undefined;
}
