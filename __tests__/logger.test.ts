import { logger } from "../src/utils/logger";

type MutableLogger = {
  enabled: boolean;
  minLevel: "error" | "warn" | "info" | "debug";
};

const internal = logger as unknown as MutableLogger;

describe("logger", () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  const savedEnabled = internal.enabled;
  const savedMinLevel = internal.minLevel;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
    internal.enabled = savedEnabled;
    internal.minLevel = savedMinLevel;
  });

  describe("enabled with minLevel=debug (all levels active)", () => {
    beforeEach(() => {
      internal.enabled = true;
      internal.minLevel = "debug";
    });

    it("forwards error with the provided error argument", () => {
      const err = new Error("boom");
      logger.error("Auth", "login failed", err);
      expect(errorSpy).toHaveBeenCalledWith("[Auth] ERROR: login failed", err);
    });

    it("falls back to empty string when error is undefined", () => {
      logger.error("Auth", "login failed");
      expect(errorSpy).toHaveBeenCalledWith("[Auth] ERROR: login failed", "");
    });

    it("forwards warn with data", () => {
      logger.warn("WS", "reconnecting", { attempt: 2 });
      expect(warnSpy).toHaveBeenCalledWith("[WS] WARN: reconnecting", {
        attempt: 2,
      });
    });

    it("falls back to empty string when warn data is undefined", () => {
      logger.warn("WS", "reconnecting");
      expect(warnSpy).toHaveBeenCalledWith("[WS] WARN: reconnecting", "");
    });

    it("forwards info via console.log", () => {
      logger.info("Boot", "ready", { ms: 120 });
      expect(logSpy).toHaveBeenCalledWith("[Boot] ready", { ms: 120 });
    });

    it("falls back to empty string when info data is undefined", () => {
      logger.info("Boot", "ready");
      expect(logSpy).toHaveBeenCalledWith("[Boot] ready", "");
    });

    it("forwards debug via console.log with DEBUG prefix", () => {
      logger.debug("Cache", "hit", { key: "k1" });
      expect(logSpy).toHaveBeenCalledWith("[Cache] DEBUG: hit", { key: "k1" });
    });

    it("falls back to empty string when debug data is undefined", () => {
      logger.debug("Cache", "hit");
      expect(logSpy).toHaveBeenCalledWith("[Cache] DEBUG: hit", "");
    });
  });

  describe("minLevel=error (production default)", () => {
    beforeEach(() => {
      internal.enabled = true;
      internal.minLevel = "error";
    });

    it("logs errors", () => {
      logger.error("X", "e");
      expect(errorSpy).toHaveBeenCalled();
    });

    it("does not log warn, info or debug", () => {
      logger.warn("X", "w");
      logger.info("X", "i");
      logger.debug("X", "d");
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("minLevel=warn (dev default)", () => {
    beforeEach(() => {
      internal.enabled = true;
      internal.minLevel = "warn";
    });

    it("logs errors and warnings but not info or debug", () => {
      logger.error("X", "e");
      logger.warn("X", "w");
      logger.info("X", "i");
      logger.debug("X", "d");
      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("disabled", () => {
    beforeEach(() => {
      internal.enabled = false;
      internal.minLevel = "debug";
    });

    it("does not log anything, even errors", () => {
      logger.error("X", "e");
      logger.warn("X", "w");
      logger.info("X", "i");
      logger.debug("X", "d");
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
