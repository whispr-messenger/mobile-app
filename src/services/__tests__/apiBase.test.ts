/**
 * @jest-environment node
 */

const mockConstants = {
  expoConfig: { extra: {} as { apiBaseUrl?: string } } as {
    extra?: { apiBaseUrl?: string };
  } | null,
  manifest: null as { extra?: { apiBaseUrl?: string } } | null,
  manifest2: null as { extra?: { apiBaseUrl?: string } } | null,
};

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: mockConstants,
}));

const FALLBACK_DEV = "https://whispr.devzeyu.com";

describe("getApiBaseUrl", () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;
  const originalEnv = process.env.EXPO_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    mockConstants.expoConfig = { extra: {} };
    mockConstants.manifest = null;
    mockConstants.manifest2 = null;
  });

  afterAll(() => {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalEnv;
    }
  });

  it("uses EXPO_PUBLIC_API_BASE_URL when set, regardless of mode", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://from-env.test";
    (global as { __DEV__?: boolean }).__DEV__ = false;
    const { getApiBaseUrl } = require("../apiBase");
    expect(getApiBaseUrl()).toBe("https://from-env.test");
  });

  it("uses Constants.expoConfig.extra.apiBaseUrl when set", () => {
    mockConstants.expoConfig = {
      extra: { apiBaseUrl: "https://from-constants.test" },
    };
    (global as { __DEV__?: boolean }).__DEV__ = false;
    const { getApiBaseUrl } = require("../apiBase");
    expect(getApiBaseUrl()).toBe("https://from-constants.test");
  });

  it("falls back to whispr.devzeyu.com in dev when no source resolves", () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    const { getApiBaseUrl } = require("../apiBase");
    expect(getApiBaseUrl()).toBe(FALLBACK_DEV);
  });

  it("throws in production when no source resolves (no roadmvn fallback)", () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    const { getApiBaseUrl } = require("../apiBase");
    expect(() => getApiBaseUrl()).toThrow(/API base URL not configured/);
  });

  it("strips trailing slashes", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test///";
    (global as { __DEV__?: boolean }).__DEV__ = false;
    const { getApiBaseUrl } = require("../apiBase");
    expect(getApiBaseUrl()).toBe("https://api.test");
  });
});
