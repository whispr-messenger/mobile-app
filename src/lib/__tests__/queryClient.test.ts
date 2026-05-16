import {
  __resetAppQueryClientForTests,
  createAppQueryClient,
  getAppQueryClient,
} from "../queryClient";

describe("createAppQueryClient", () => {
  it("returns a fresh QueryClient with chat-tuned defaults", () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.gcTime).toBe(5 * 60_000);
    expect(defaults.queries?.retry).toBe(1);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(0);
  });

  it("returns independent instances on each call", () => {
    expect(createAppQueryClient()).not.toBe(createAppQueryClient());
  });
});

describe("getAppQueryClient", () => {
  beforeEach(() => __resetAppQueryClientForTests());

  it("returns the same singleton across calls", () => {
    const a = getAppQueryClient();
    const b = getAppQueryClient();
    expect(a).toBe(b);
  });

  it("creates a fresh singleton after reset", () => {
    const a = getAppQueryClient();
    __resetAppQueryClientForTests();
    const b = getAppQueryClient();
    expect(a).not.toBe(b);
  });
});
