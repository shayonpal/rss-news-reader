import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { StatusChangeLogger } from "@/lib/logging/status-change-logger";

// Mock fs module
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: vi.fn(),
      readdir: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
    },
  };
});

describe("StatusChangeLogger - RR-29", () => {
  let logger: StatusChangeLogger;
  const mockLogDir = "/mock/logs";

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new StatusChangeLogger(mockLogDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Log File Creation and Writing", () => {
    it("should create log directory if it does not exist", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await logger.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(mockLogDir, { recursive: true });
    });

    it("should write JSONL formatted log entries", async () => {
      const logEntry = {
        timestamp: "2025-08-06T12:00:00Z",
        articleId: "article-123",
        feedId: "feed-456",
        action: "mark_read" as const,
        trigger: "user_click" as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: "Mozilla/5.0...",
      };

      await logger.logStatusChange(logEntry);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("status-changes.jsonl"),
        JSON.stringify(logEntry) + "\n",
        { flag: "a" }
      );
    });

    it("should validate log entry structure", () => {
      const validEntry = {
        timestamp: "2025-08-06T12:00:00Z",
        articleId: "article-123",
        feedId: "feed-456",
        action: "mark_read" as const,
        trigger: "user_click" as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: "Mozilla/5.0...",
      };

      expect(() => logger.validateLogEntry(validEntry)).not.toThrow();
    });

    it("should reject invalid log entry with missing required fields", () => {
      const invalidEntry = {
        timestamp: "2025-08-06T12:00:00Z",
        // Missing articleId, feedId, etc.
      };

      expect(() => logger.validateLogEntry(invalidEntry as any)).toThrow(
        "Missing required field"
      );
    });
  });

  describe("Batching Mechanism", () => {
    it("should batch multiple log entries for performance", async () => {
      const entries = [
        {
          timestamp: "2025-08-06T12:00:00Z",
          articleId: "article-1",
          feedId: "feed-1",
          action: "mark_read" as const,
          trigger: "auto_scroll" as const,
          previousValue: false,
          newValue: true,
          syncQueued: false,
          userAgent: "Mozilla/5.0...",
        },
        {
          timestamp: "2025-08-06T12:00:01Z",
          articleId: "article-2",
          feedId: "feed-1",
          action: "mark_read" as const,
          trigger: "auto_scroll" as const,
          previousValue: false,
          newValue: true,
          syncQueued: false,
          userAgent: "Mozilla/5.0...",
        },
      ];

      await logger.batchLogStatusChanges(entries);

      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("status-changes.jsonl"),
        entries.map((e) => JSON.stringify(e) + "\n").join(""),
        { flag: "a" }
      );
    });

    it("should flush batch when reaching maximum batch size", async () => {
      const maxBatchSize = 100;
      logger.setMaxBatchSize(maxBatchSize);

      // Add one more than max batch size
      for (let i = 0; i <= maxBatchSize; i++) {
        await logger.logStatusChange({
          timestamp: new Date().toISOString(),
          articleId: `article-${i}`,
          feedId: "feed-1",
          action: "mark_read" as const,
          trigger: "user_click" as const,
          previousValue: false,
          newValue: true,
          syncQueued: true,
          userAgent: "Mozilla/5.0...",
        });
      }

      // Should have flushed automatically
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it("should flush batch on timer expiry", async () => {
      vi.useFakeTimers();

      await logger.logStatusChange({
        timestamp: "2025-08-06T12:00:00Z",
        articleId: "article-1",
        feedId: "feed-1",
        action: "mark_read" as const,
        trigger: "user_click" as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: "Mozilla/5.0...",
      });

      // Advance timer to trigger flush
      vi.advanceTimersByTime(5000); // 5 seconds

      expect(fs.writeFile).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("7-Day Retention Policy", () => {
    it("should identify log files older than 7 days", async () => {
      const today = new Date("2025-08-06");
      const sevenDaysAgo = new Date("2025-07-30");
      const eightDaysAgo = new Date("2025-07-29");

      const mockFiles = [
        "status-changes.jsonl",
        "status-changes-2025-07-30.jsonl.gz",
        "status-changes-2025-07-29.jsonl.gz", // Should be deleted
      ];

      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);

      const filesToDelete = await logger.getExpiredLogFiles(today);

      expect(filesToDelete).toContain("status-changes-2025-07-29.jsonl.gz");
      expect(filesToDelete).not.toContain("status-changes-2025-07-30.jsonl.gz");
    });

    it("should clean up expired log files", async () => {
      const expiredFiles = ["status-changes-2025-07-29.jsonl.gz"];
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await logger.cleanupExpiredLogs();

      expect(fs.readdir).toHaveBeenCalled();
      // Specific file deletion would be tested based on the mock implementation
    });
  });

  describe("File Rotation and Archiving", () => {
    it("should rotate log file daily with date suffix", async () => {
      const yesterday = new Date("2025-08-05");
      vi.setSystemTime(yesterday);

      await logger.rotateLogFile();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("status-changes-2025-08-05.jsonl"),
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should compress rotated log files", async () => {
      // Mock compression library
      const mockZlib = vi.hoisted(() => ({
        gzip: vi.fn((data, callback) =>
          callback(null, Buffer.from("compressed"))
        ),
      }));

      vi.doMock("zlib", () => mockZlib);

      await logger.compressLogFile("status-changes-2025-08-05.jsonl");

      expect(mockZlib.gzip).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle file system write errors gracefully", async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("Disk full"));

      const logEntry = {
        timestamp: "2025-08-06T12:00:00Z",
        articleId: "article-123",
        feedId: "feed-456",
        action: "mark_read" as const,
        trigger: "user_click" as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: "Mozilla/5.0...",
      };

      // Should not throw, but log error internally
      await expect(logger.logStatusChange(logEntry)).resolves.not.toThrow();
    });

    it("should recover from corrupted log files", async () => {
      vi.mocked(fs.writeFile).mockRejectedValueOnce(
        new Error("File corrupted")
      );
      vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined);

      const logEntry = {
        timestamp: "2025-08-06T12:00:00Z",
        articleId: "article-123",
        feedId: "feed-456",
        action: "mark_read" as const,
        trigger: "user_click" as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: "Mozilla/5.0...",
      };

      await logger.logStatusChange(logEntry);

      // Should attempt recovery and retry
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe("Concurrent Write Safety", () => {
    it("should handle concurrent writes safely with locking", async () => {
      const concurrentWrites = Array.from({ length: 10 }, (_, i) =>
        logger.logStatusChange({
          timestamp: new Date().toISOString(),
          articleId: `article-${i}`,
          feedId: "feed-1",
          action: "mark_read" as const,
          trigger: "user_click" as const,
          previousValue: false,
          newValue: true,
          syncQueued: true,
          userAgent: "Mozilla/5.0...",
        })
      );

      await Promise.all(concurrentWrites);

      // All writes should complete without data corruption
      expect(fs.writeFile).toHaveBeenCalledTimes(10);
    });
  });

  describe("Environment Variable Configuration", () => {
    it("should disable logging when environment variable is set", () => {
      process.env.DISABLE_STATUS_CHANGE_LOGGING = "true";

      const disabledLogger = new StatusChangeLogger();

      expect(disabledLogger.isEnabled()).toBe(false);

      delete process.env.DISABLE_STATUS_CHANGE_LOGGING;
    });

    it("should use custom log directory from environment", () => {
      process.env.STATUS_CHANGE_LOG_DIR = "/custom/log/dir";

      const customLogger = new StatusChangeLogger();

      expect(customLogger.getLogDirectory()).toBe("/custom/log/dir");

      delete process.env.STATUS_CHANGE_LOG_DIR;
    });
  });
});
