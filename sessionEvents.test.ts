jest.mock("react-native", () => ({
  DeviceEventEmitter: {
    emit: jest.fn(),
    addListener: jest.fn(),
  },
}));

import { DeviceEventEmitter } from "react-native";
import {
  SESSION_EXPIRED_EVENT,
  emitSessionExpired,
  onSessionExpired,
} from "./src/services/sessionEvents";

const mockedEmitter = DeviceEventEmitter as unknown as {
  emit: jest.Mock;
  addListener: jest.Mock;
};

beforeEach(() => {
  mockedEmitter.emit.mockReset();
  mockedEmitter.addListener.mockReset();
});

describe("sessionEvents", () => {
  it("exposes the expected event name", () => {
    expect(SESSION_EXPIRED_EVENT).toBe("whispr.session.expired");
  });

  it("emitSessionExpired forwards the reason in a payload object", () => {
    emitSessionExpired("refresh_failed");
    expect(mockedEmitter.emit).toHaveBeenCalledWith("whispr.session.expired", {
      reason: "refresh_failed",
    });
  });

  it("emitSessionExpired without a reason emits undefined reason", () => {
    emitSessionExpired();
    expect(mockedEmitter.emit).toHaveBeenCalledWith("whispr.session.expired", {
      reason: undefined,
    });
  });

  it("onSessionExpired subscribes to the session expiry channel", () => {
    const handler = jest.fn();
    const subscription = { remove: jest.fn() };
    mockedEmitter.addListener.mockReturnValueOnce(subscription);

    const result = onSessionExpired(handler);

    expect(mockedEmitter.addListener).toHaveBeenCalledWith(
      "whispr.session.expired",
      handler,
    );
    expect(result).toBe(subscription);
  });
});
