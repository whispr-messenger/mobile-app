/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for useCallsAvailable — centralised detection of calls support.
 * Each scenario re-imports the module after redefining the env mocks so the
 * platform/environment branches are exercised independently.
 */

describe("useCallsAvailable", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function setupMocks(opts: {
    platform?: "ios" | "android" | "web";
    expoGo?: boolean;
    hasWebRtc?: boolean;
  }) {
    const platform = opts.platform ?? "ios";
    const expoGo = opts.expoGo ?? false;
    const hasWebRtc = opts.hasWebRtc ?? true;

    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: {
        executionEnvironment: expoGo ? "storeClient" : "standalone",
        appOwnership: expoGo ? "expo" : "standalone",
      },
    }));

    jest.doMock("react-native", () => ({
      Platform: { OS: platform },
      NativeModules: hasWebRtc ? { WebRTCModule: {} } : {},
    }));
  }

  it("returns available=true on a native dev build with WebRTC linked", () => {
    setupMocks({ platform: "ios", expoGo: false, hasWebRtc: true });
    const {
      getCallsAvailability,
      isCallsAvailable,
    } = require("../useCallsAvailable");

    expect(getCallsAvailability()).toEqual({ available: true, reason: null });
    expect(isCallsAvailable()).toBe(true);
  });

  it("returns reason=expo-go in Expo Go", () => {
    setupMocks({ platform: "ios", expoGo: true });
    const {
      getCallsAvailability,
      getCallsUnavailableMessage,
    } = require("../useCallsAvailable");

    const result = getCallsAvailability();
    expect(result.available).toBe(false);
    expect(result.reason).toBe("expo-go");
    expect(getCallsUnavailableMessage(result.reason)).toMatch(/Expo Go/);
  });

  it("returns reason=web on web platform", () => {
    setupMocks({ platform: "web", expoGo: false });
    const { getCallsAvailability } = require("../useCallsAvailable");

    expect(getCallsAvailability()).toEqual({
      available: false,
      reason: "web",
    });
  });

  it("returns reason=no-webrtc when native module is missing", () => {
    setupMocks({ platform: "android", expoGo: false, hasWebRtc: false });
    const { getCallsAvailability } = require("../useCallsAvailable");

    expect(getCallsAvailability()).toEqual({
      available: false,
      reason: "no-webrtc",
    });
  });

  it("provides a French fallback message for each reason", () => {
    setupMocks({ platform: "ios" });
    const { getCallsUnavailableMessage } = require("../useCallsAvailable");

    expect(getCallsUnavailableMessage("expo-go")).toContain("Expo Go");
    expect(getCallsUnavailableMessage("no-webrtc")).toContain("WebRTC");
    expect(getCallsUnavailableMessage("web")).toContain("web");
    expect(getCallsUnavailableMessage(null)).toBeTruthy();
  });
});
