import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isDebugMode, debugLog, debugTiming } from "./debug";

describe("Debug Utilities", () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  describe("isDebugMode", () => {
    it("should return true in development environment", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(isDebugMode()).toBe(true);
    });

    it("should return false in production environment", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(isDebugMode()).toBe(false);
    });

    it("should return false in test environment", () => {
      vi.stubEnv("NODE_ENV", "test");
      expect(isDebugMode()).toBe(false);
    });
  });

  describe("debugLog", () => {
    it("should log in development mode", () => {
      vi.stubEnv("NODE_ENV", "development");
      debugLog("test message", { data: 123 });

      expect(consoleLogSpy).toHaveBeenCalledWith("[DEBUG]", "test message", {
        data: 123,
      });
    });

    it("should not log in production mode", () => {
      vi.stubEnv("NODE_ENV", "production");
      debugLog("test message");

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should handle multiple arguments", () => {
      vi.stubEnv("NODE_ENV", "development");
      debugLog("msg1", "msg2", 123, { key: "value" });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[DEBUG]",
        "msg1",
        "msg2",
        123,
        { key: "value" }
      );
    });
  });

  describe("debugTiming", () => {
    it("should log timing in development mode", () => {
      vi.stubEnv("NODE_ENV", "development");
      const startTime = performance.now() - 123.456;

      debugTiming("Test Operation", startTime);

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toMatch(/^\[TIMING\] Test Operation: \d+\.\d{2}ms$/);
    });

    it("should not log timing in production mode", () => {
      vi.stubEnv("NODE_ENV", "production");
      const startTime = performance.now();

      debugTiming("Test Operation", startTime);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
