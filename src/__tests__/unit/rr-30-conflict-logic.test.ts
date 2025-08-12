import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unit tests for RR-30: Sync Conflict Detection Logic
describe("RR-30: Sync Conflict Detection Logic", () => {
  let mockSupabase: any;
  let mockTime: Date;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTime = new Date("2025-08-06T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockTime);

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      single: vi.fn(),
      update: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Conflict Detection Functions", () => {
    it("should detect when local changes exist", () => {
      const hasLocalChanges = (article: any) => {
        if (!article.last_local_update || !article.last_sync_update) {
          return false;
        }
        return (
          new Date(article.last_local_update) >
          new Date(article.last_sync_update)
        );
      };

      const articleWithLocalChanges = {
        last_local_update: "2025-08-06T12:00:00Z",
        last_sync_update: "2025-08-06T11:00:00Z",
      };

      const articleWithoutLocalChanges = {
        last_local_update: "2025-08-06T11:00:00Z",
        last_sync_update: "2025-08-06T12:00:00Z",
      };

      expect(hasLocalChanges(articleWithLocalChanges)).toBe(true);
      expect(hasLocalChanges(articleWithoutLocalChanges)).toBe(false);
      expect(hasLocalChanges({})).toBe(false);
    });

    it("should detect when states differ between local and remote", () => {
      const statesDiffer = (local: any, remote: any) => {
        return (
          local.is_read !== remote.is_read ||
          local.is_starred !== remote.is_starred
        );
      };

      const localArticle = { is_read: true, is_starred: false };
      const remoteMatchingArticle = { is_read: true, is_starred: false };
      const remoteDifferentArticle = { is_read: false, is_starred: false };
      const remoteStarredArticle = { is_read: true, is_starred: true };

      expect(statesDiffer(localArticle, remoteMatchingArticle)).toBe(false);
      expect(statesDiffer(localArticle, remoteDifferentArticle)).toBe(true);
      expect(statesDiffer(localArticle, remoteStarredArticle)).toBe(true);
    });

    it("should identify conflict type correctly", () => {
      const getConflictType = (local: any, remote: any): string => {
        const readDiffers = local.is_read !== remote.is_read;
        const starredDiffers = local.is_starred !== remote.is_starred;

        if (readDiffers && starredDiffers) return "both";
        if (readDiffers) return "read_status";
        if (starredDiffers) return "starred_status";
        return "none";
      };

      expect(
        getConflictType(
          { is_read: true, is_starred: false },
          { is_read: false, is_starred: false }
        )
      ).toBe("read_status");

      expect(
        getConflictType(
          { is_read: true, is_starred: false },
          { is_read: true, is_starred: true }
        )
      ).toBe("starred_status");

      expect(
        getConflictType(
          { is_read: true, is_starred: false },
          { is_read: false, is_starred: true }
        )
      ).toBe("both");

      expect(
        getConflictType(
          { is_read: true, is_starred: false },
          { is_read: true, is_starred: false }
        )
      ).toBe("none");
    });

    it("should only detect conflicts when local changes exist AND states differ", () => {
      const detectConflict = (local: any, remote: any): boolean => {
        const hasLocalChanges =
          local.last_local_update &&
          local.last_sync_update &&
          new Date(local.last_local_update) > new Date(local.last_sync_update);
        const statesDiffer =
          local.is_read !== remote.is_read ||
          local.is_starred !== remote.is_starred;

        return hasLocalChanges && statesDiffer;
      };

      // Conflict: local changes exist and states differ
      const conflict1 = detectConflict(
        {
          is_read: true,
          is_starred: false,
          last_local_update: "2025-08-06T12:00:00Z",
          last_sync_update: "2025-08-06T11:00:00Z",
        },
        { is_read: false, is_starred: false }
      );
      expect(conflict1).toBe(true);

      // No conflict: states differ but no local changes
      const conflict2 = detectConflict(
        {
          is_read: true,
          is_starred: false,
          last_local_update: "2025-08-06T10:00:00Z",
          last_sync_update: "2025-08-06T11:00:00Z",
        },
        { is_read: false, is_starred: false }
      );
      expect(conflict2).toBe(false);

      // No conflict: local changes exist but states match
      const conflict3 = detectConflict(
        {
          is_read: true,
          is_starred: false,
          last_local_update: "2025-08-06T12:00:00Z",
          last_sync_update: "2025-08-06T11:00:00Z",
        },
        { is_read: true, is_starred: false }
      );
      expect(conflict3).toBe(false);
    });
  });

  describe("Conflict Log Generation", () => {
    it("should generate proper conflict log entry", () => {
      const generateConflictLog = (
        local: any,
        remote: any,
        syncSessionId: string
      ) => {
        const conflictType = (() => {
          const readDiffers = local.is_read !== remote.is_read;
          const starredDiffers = local.is_starred !== remote.is_starred;
          if (readDiffers && starredDiffers) return "both";
          if (readDiffers) return "read_status";
          if (starredDiffers) return "starred_status";
          return "none";
        })();

        return {
          timestamp: new Date().toISOString(),
          syncSessionId,
          articleId: local.id,
          feedId: local.feed_id,
          conflictType,
          localValue: {
            read: local.is_read,
            starred: local.is_starred,
          },
          remoteValue: {
            read: remote.is_read,
            starred: remote.is_starred,
          },
          resolution: "remote", // Always remote wins due to API limitation
          lastLocalUpdate: local.last_local_update,
          lastSyncUpdate: local.last_sync_update,
          note: "API limitation: remote change timestamp unavailable",
        };
      };

      const localArticle = {
        id: "article-123",
        feed_id: "feed-456",
        is_read: true,
        is_starred: false,
        last_local_update: "2025-08-06T12:00:00Z",
        last_sync_update: "2025-08-06T11:00:00Z",
      };

      const remoteArticle = {
        is_read: false,
        is_starred: true,
      };

      const logEntry = generateConflictLog(
        localArticle,
        remoteArticle,
        "sync_2025-08-06_12:00:00"
      );

      expect(logEntry.articleId).toBe("article-123");
      expect(logEntry.feedId).toBe("feed-456");
      expect(logEntry.conflictType).toBe("both");
      expect(logEntry.localValue).toEqual({ read: true, starred: false });
      expect(logEntry.remoteValue).toEqual({ read: false, starred: true });
      expect(logEntry.resolution).toBe("remote");
      expect(logEntry.note).toContain("API limitation");
    });

    it("should handle missing timestamps gracefully", () => {
      const generateSafeConflictLog = (local: any, remote: any) => {
        return {
          timestamp: new Date().toISOString(),
          articleId: local.id || "unknown",
          conflictType: "state_difference",
          localValue: {
            read: local.is_read || false,
            starred: local.is_starred || false,
          },
          remoteValue: {
            read: remote.is_read || false,
            starred: remote.is_starred || false,
          },
          lastLocalUpdate: local.last_local_update || null,
          lastSyncUpdate: local.last_sync_update || null,
          note: "Partial data available",
        };
      };

      const incompleteLocal = { id: "article-999", is_read: true };
      const incompleteRemote = { is_starred: true };

      const logEntry = generateSafeConflictLog(
        incompleteLocal,
        incompleteRemote
      );

      expect(logEntry.articleId).toBe("article-999");
      expect(logEntry.localValue.starred).toBe(false); // Default value
      expect(logEntry.remoteValue.read).toBe(false); // Default value
      expect(logEntry.lastLocalUpdate).toBeNull();
    });
  });

  describe("Conflict Resolution", () => {
    it("should always resolve in favor of remote due to API limitations", () => {
      const resolveConflict = (local: any, remote: any) => {
        // Due to Inoreader API not providing timestamps,
        // we cannot determine true conflict timing
        // Therefore, remote always wins to maintain consistency
        return {
          resolution: "remote" as const,
          resolvedValue: {
            is_read: remote.is_read,
            is_starred: remote.is_starred,
          },
          reason: "API limitation: cannot determine remote change timing",
        };
      };

      const local = { is_read: true, is_starred: true };
      const remote = { is_read: false, is_starred: false };

      const resolution = resolveConflict(local, remote);

      expect(resolution.resolution).toBe("remote");
      expect(resolution.resolvedValue).toEqual({
        is_read: false,
        is_starred: false,
      });
      expect(resolution.reason).toContain("API limitation");
    });

    it("should track resolution statistics", () => {
      class ConflictTracker {
        private stats = {
          totalConflicts: 0,
          readConflicts: 0,
          starredConflicts: 0,
          bothConflicts: 0,
          resolutions: { local: 0, remote: 0 },
        };

        trackConflict(conflictType: string, resolution: "local" | "remote") {
          this.stats.totalConflicts++;

          switch (conflictType) {
            case "read_status":
              this.stats.readConflicts++;
              break;
            case "starred_status":
              this.stats.starredConflicts++;
              break;
            case "both":
              this.stats.bothConflicts++;
              break;
          }

          this.stats.resolutions[resolution]++;
        }

        getStats() {
          return { ...this.stats };
        }
      }

      const tracker = new ConflictTracker();

      tracker.trackConflict("read_status", "remote");
      tracker.trackConflict("starred_status", "remote");
      tracker.trackConflict("both", "remote");
      tracker.trackConflict("read_status", "remote");

      const stats = tracker.getStats();

      expect(stats.totalConflicts).toBe(4);
      expect(stats.readConflicts).toBe(2);
      expect(stats.starredConflicts).toBe(1);
      expect(stats.bothConflicts).toBe(1);
      expect(stats.resolutions.remote).toBe(4);
      expect(stats.resolutions.local).toBe(0);
    });
  });

  describe("Sync Session Management", () => {
    it("should generate unique sync session IDs", () => {
      const generateSyncSessionId = () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        return `sync_${timestamp}`;
      };

      const id1 = generateSyncSessionId();

      vi.advanceTimersByTime(1000);

      const id2 = generateSyncSessionId();

      expect(id1).toMatch(/^sync_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
      expect(id2).toMatch(/^sync_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
      expect(id1).not.toBe(id2);
    });

    it("should track conflicts per sync session", () => {
      interface SyncSession {
        id: string;
        startTime: Date;
        conflicts: any[];
        endTime?: Date;
      }

      class SyncSessionManager {
        private currentSession: SyncSession | null = null;

        startSession(): string {
          const sessionId = `sync_${new Date().toISOString()}`;
          this.currentSession = {
            id: sessionId,
            startTime: new Date(),
            conflicts: [],
          };
          return sessionId;
        }

        addConflict(conflict: any) {
          if (!this.currentSession) {
            throw new Error("No active sync session");
          }
          this.currentSession.conflicts.push(conflict);
        }

        endSession() {
          if (!this.currentSession) {
            throw new Error("No active sync session");
          }
          this.currentSession.endTime = new Date();
          const summary = {
            sessionId: this.currentSession.id,
            duration:
              this.currentSession.endTime.getTime() -
              this.currentSession.startTime.getTime(),
            conflictCount: this.currentSession.conflicts.length,
            conflicts: this.currentSession.conflicts,
          };
          this.currentSession = null;
          return summary;
        }
      }

      const manager = new SyncSessionManager();

      const sessionId = manager.startSession();
      expect(sessionId).toContain("sync_");

      manager.addConflict({ articleId: "123", type: "read_status" });
      manager.addConflict({ articleId: "456", type: "starred_status" });

      vi.advanceTimersByTime(5000);

      const summary = manager.endSession();

      expect(summary.sessionId).toBe(sessionId);
      expect(summary.conflictCount).toBe(2);
      expect(summary.duration).toBe(5000);
      expect(summary.conflicts).toHaveLength(2);
    });
  });

  describe("Batch Conflict Processing", () => {
    it("should process multiple conflicts efficiently", () => {
      const processConflictBatch = (articles: any[]) => {
        const conflicts = [];
        const sessionId = `sync_${new Date().toISOString()}`;

        for (const { local, remote } of articles) {
          const hasLocalChanges =
            local.last_local_update &&
            local.last_sync_update &&
            new Date(local.last_local_update) >
              new Date(local.last_sync_update);

          const statesDiffer =
            local.is_read !== remote.is_read ||
            local.is_starred !== remote.is_starred;

          if (hasLocalChanges && statesDiffer) {
            conflicts.push({
              articleId: local.id,
              sessionId,
              conflictDetected: true,
            });
          }
        }

        return {
          totalProcessed: articles.length,
          conflictsFound: conflicts.length,
          conflicts,
        };
      };

      const testBatch = [
        {
          local: {
            id: "1",
            is_read: true,
            is_starred: false,
            last_local_update: "2025-08-06T12:00:00Z",
            last_sync_update: "2025-08-06T11:00:00Z",
          },
          remote: { is_read: false, is_starred: false },
        },
        {
          local: {
            id: "2",
            is_read: false,
            is_starred: true,
            last_local_update: "2025-08-06T10:00:00Z",
            last_sync_update: "2025-08-06T11:00:00Z",
          },
          remote: { is_read: false, is_starred: false },
        },
        {
          local: {
            id: "3",
            is_read: true,
            is_starred: true,
            last_local_update: "2025-08-06T12:00:00Z",
            last_sync_update: "2025-08-06T11:00:00Z",
          },
          remote: { is_read: false, is_starred: false },
        },
      ];

      const result = processConflictBatch(testBatch);

      expect(result.totalProcessed).toBe(3);
      expect(result.conflictsFound).toBe(2); // Articles 1 and 3
      expect(result.conflicts[0].articleId).toBe("1");
      expect(result.conflicts[1].articleId).toBe("3");
    });

    it("should handle empty batches gracefully", () => {
      const processConflictBatch = (articles: any[]) => {
        if (!articles || articles.length === 0) {
          return {
            totalProcessed: 0,
            conflictsFound: 0,
            conflicts: [],
          };
        }
        // Process normally...
        return {
          totalProcessed: articles.length,
          conflictsFound: 0,
          conflicts: [],
        };
      };

      expect(processConflictBatch([])).toEqual({
        totalProcessed: 0,
        conflictsFound: 0,
        conflicts: [],
      });

      expect(processConflictBatch(null as any)).toEqual({
        totalProcessed: 0,
        conflictsFound: 0,
        conflicts: [],
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle null/undefined articles gracefully", () => {
      const safeConflictDetection = (local: any, remote: any) => {
        try {
          if (!local || !remote) {
            return { hasConflict: false, error: "Missing article data" };
          }

          const hasLocalChanges =
            local.last_local_update &&
            local.last_sync_update &&
            new Date(local.last_local_update) >
              new Date(local.last_sync_update);

          const statesDiffer =
            (local.is_read ?? false) !== (remote.is_read ?? false) ||
            (local.is_starred ?? false) !== (remote.is_starred ?? false);

          return {
            hasConflict: hasLocalChanges && statesDiffer,
            error: null,
          };
        } catch (error) {
          return {
            hasConflict: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      };

      expect(safeConflictDetection(null, { is_read: true })).toEqual({
        hasConflict: false,
        error: "Missing article data",
      });

      expect(safeConflictDetection({ is_read: true }, null)).toEqual({
        hasConflict: false,
        error: "Missing article data",
      });

      expect(safeConflictDetection(undefined, undefined)).toEqual({
        hasConflict: false,
        error: "Missing article data",
      });
    });

    it("should handle invalid date formats", () => {
      const parseTimestamp = (timestamp: any): Date | null => {
        if (!timestamp) return null;

        try {
          const date = new Date(timestamp);
          return isNaN(date.getTime()) ? null : date;
        } catch {
          return null;
        }
      };

      expect(parseTimestamp("2025-08-06T12:00:00Z")).toBeInstanceOf(Date);
      expect(parseTimestamp("invalid-date")).toBeNull();
      expect(parseTimestamp(null)).toBeNull();
      expect(parseTimestamp(undefined)).toBeNull();
      expect(parseTimestamp(12345)).toBeInstanceOf(Date); // Unix timestamp
    });
  });

  describe("Performance Optimization", () => {
    it("should cache conflict detection results within same sync", () => {
      class ConflictCache {
        private cache = new Map<string, boolean>();
        private hitCount = 0;
        private missCount = 0;

        checkConflict(articleId: string, checker: () => boolean): boolean {
          if (this.cache.has(articleId)) {
            this.hitCount++;
            return this.cache.get(articleId)!;
          }

          this.missCount++;
          const result = checker();
          this.cache.set(articleId, result);
          return result;
        }

        getStats() {
          return {
            hitCount: this.hitCount,
            missCount: this.missCount,
            cacheSize: this.cache.size,
            hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
          };
        }

        clear() {
          this.cache.clear();
          this.hitCount = 0;
          this.missCount = 0;
        }
      }

      const cache = new ConflictCache();

      // First check - miss
      cache.checkConflict("article-1", () => true);

      // Second check same article - hit
      cache.checkConflict("article-1", () => true);

      // Third check same article - hit
      cache.checkConflict("article-1", () => true);

      // Different article - miss
      cache.checkConflict("article-2", () => false);

      const stats = cache.getStats();

      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(2);
      expect(stats.cacheSize).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it("should batch log writes for efficiency", () => {
      class LogBuffer {
        private buffer: any[] = [];
        private maxSize = 100;
        private flushCallback: (items: any[]) => void;

        constructor(flushCallback: (items: any[]) => void) {
          this.flushCallback = flushCallback;
        }

        add(item: any) {
          this.buffer.push(item);

          if (this.buffer.length >= this.maxSize) {
            this.flush();
          }
        }

        flush() {
          if (this.buffer.length === 0) return;

          this.flushCallback([...this.buffer]);
          this.buffer = [];
        }

        getBufferSize() {
          return this.buffer.length;
        }
      }

      const writtenBatches: any[] = [];
      const buffer = new LogBuffer((items) => {
        writtenBatches.push(items);
      });

      // Add items below threshold
      for (let i = 0; i < 50; i++) {
        buffer.add({ id: i });
      }

      expect(writtenBatches).toHaveLength(0);
      expect(buffer.getBufferSize()).toBe(50);

      // Add items to exceed threshold
      for (let i = 50; i < 100; i++) {
        buffer.add({ id: i });
      }

      expect(writtenBatches).toHaveLength(1);
      expect(writtenBatches[0]).toHaveLength(100);
      expect(buffer.getBufferSize()).toBe(0);

      // Manual flush remaining items
      buffer.add({ id: 100 });
      buffer.flush();

      expect(writtenBatches).toHaveLength(2);
      expect(writtenBatches[1]).toHaveLength(1);
    });
  });
});
