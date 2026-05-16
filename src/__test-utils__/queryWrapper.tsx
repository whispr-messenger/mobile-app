import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Build a fresh QueryClient + Provider wrapper for `renderHook`.
 * `retry: false` makes failure assertions deterministic (no exponential
 * backoff between retries during tests).
 */
export function makeQueryWrapper(): {
  client: QueryClient;
  wrapper: React.FC<{ children: React.ReactNode }>;
} {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
