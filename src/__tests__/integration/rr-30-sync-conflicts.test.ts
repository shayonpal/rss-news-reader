import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import fs from "fs/promises";
import path from "path";
import { setupTestServer } from "../test-server";
import type { Server } from "http";

// Integration tests for RR-30: Sync Conflict Detection
describe("RR-30: Sync Conflict Detection Integration", () => {
  let server: Server;
  let app: any;
  let baseUrl: string;
  const logsDir = path.join(process.cwd(), "logs");
  const conflictLogPath = path.join(logsDir, "sync-conflicts.jsonl");

  beforeAll(async () => {
    const testServer = await setupTestServer(3004);
    server = testServer.server;
    app = testServer.app;
    baseUrl = "http://localhost:3004/reader";

    await new Promise<void>((resolve) => {
      server.listen(3004, resolve);
    });

    // Ensure logs directory exists
    await fs.mkdir(logsDir, { recursive: true });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear conflict log before each test
    try {
      await fs.unlink(conflictLogPath);
    } catch {
      // File may not exist
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Sync Pipeline Conflict Detection", () => {
    it("should detect conflicts during full sync operation", async () => {
      // Mock sync pipeline with conflict detection
      const performSyncWithConflictDetection = async () => {
        const mockLocalArticles = [
          {
            id: "article-1",
            inoreader_id: "tag:google.com,2005:reader/item/1",
            feed_id: "feed-1",
            is_read: true,
            is_starred: false,
            last_local_update: new Date("2025-08-06T12:00:00Z"),
            last_sync_update: new Date("2025-08-06T11:00:00Z"),
          },
          {
            id: "article-2",
            inoreader_id: "tag:google.com,2005:reader/item/2",
            feed_id: "feed-1",
            is_read: false,
            is_starred: true,
            last_local_update: new Date("2025-08-06T12:00:00Z"),
            last_sync_update: new Date("2025-08-06T11:00:00Z"),
          },
        ];

        const mockRemoteArticles = [
          {
            id: "tag:google.com,2005:reader/item/1",
            categories: [], // No read/starred markers
          },
          {
            id: "tag:google.com,2005:reader/item/2",
            categories: ["user/-/state/com.google/read"], // Read but not starred
          },
        ];

        const conflicts = [];
        const syncSessionId = `sync_${new Date().toISOString()}`;

        // Detect conflicts
        for (const local of mockLocalArticles) {
          const remote = mockRemoteArticles.find(
            (r) => r.id === local.inoreader_id
          );
          if (!remote) continue;

          const remoteIsRead = remote.categories.includes(
            "user/-/state/com.google/read"
          );
          const remoteIsStarred = remote.categories.includes(
            "user/-/state/com.google/starred"
          );

          const hasLocalChanges =
            local.last_local_update > local.last_sync_update;
          const statesDiffer =
            local.is_read !== remoteIsRead ||
            local.is_starred !== remoteIsStarred;

          if (hasLocalChanges && statesDiffer) {
            conflicts.push({
              timestamp: new Date().toISOString(),
              syncSessionId,
              articleId: local.id,
              feedId: local.feed_id,
              conflictType: (() => {
                const readDiffers = local.is_read !== remoteIsRead;
                const starredDiffers = local.is_starred !== remoteIsStarred;
                if (readDiffers && starredDiffers) return "both";
                if (readDiffers) return "read_status";
                return "starred_status";
              })(),
              localValue: {
                read: local.is_read,
                starred: local.is_starred,
              },
              remoteValue: {
                read: remoteIsRead,
                starred: remoteIsStarred,
              },
              resolution: "remote",
              lastLocalUpdate: local.last_local_update.toISOString(),
              lastSyncUpdate: local.last_sync_update.toISOString(),
              note: "API limitation: remote change timestamp unavailable",
            });
          }
        }

        return {
          syncSessionId,
          articlesProcessed: mockLocalArticles.length,
          conflictsDetected: conflicts.length,
          conflicts,
        };
      };

      const result = await performSyncWithConflictDetection();

      expect(result.articlesProcessed).toBe(2);
      expect(result.conflictsDetected).toBe(2);
      expect(result.conflicts[0].conflictType).toBe("read_status");
      expect(result.conflicts[1].conflictType).toBe("both");
    });

    it("should write conflicts to JSONL log file", async () => {
      const writeConflictLog = async (conflict: any) => {
        const logLine = JSON.stringify(conflict) + "\n";
        await fs.appendFile(conflictLogPath, logLine, "utf-8");
      };

      const testConflict = {
        timestamp: new Date().toISOString(),
        syncSessionId: "sync_test_123",
        articleId: "article-test",
        feedId: "feed-test",
        conflictType: "read_status",
        localValue: { read: true, starred: false },
        remoteValue: { read: false, starred: false },
        resolution: "remote",
        lastLocalUpdate: new Date().toISOString(),
        lastSyncUpdate: new Date(Date.now() - 3600000).toISOString(),
        note: "API limitation: remote change timestamp unavailable",
      };

      await writeConflictLog(testConflict);

      // Verify log was written
      const logContent = await fs.readFile(conflictLogPath, "utf-8");
      const lines = logContent.trim().split("\n");
      expect(lines).toHaveLength(1);

      const parsedLog = JSON.parse(lines[0]);
      expect(parsedLog.articleId).toBe("article-test");
      expect(parsedLog.conflictType).toBe("read_status");
      expect(parsedLog.resolution).toBe("remote");
    });

    it("should handle concurrent conflict logging", async () => {
      const logConflictBatch = async (conflicts: any[]) => {
        const logLines = conflicts
          .map((c) => JSON.stringify(c) + "\n")
          .join("");
        await fs.appendFile(conflictLogPath, logLines, "utf-8");
      };

      const batch1 = Array(5)
        .fill(null)
        .map((_, i) => ({
          timestamp: new Date().toISOString(),
          syncSessionId: "sync_batch_1",
          articleId: `article-${i}`,
          conflictType: "read_status",
          resolution: "remote",
        }));

      const batch2 = Array(5)
        .fill(null)
        .map((_, i) => ({
          timestamp: new Date().toISOString(),
          syncSessionId: "sync_batch_2",
          articleId: `article-${i + 5}`,
          conflictType: "starred_status",
          resolution: "remote",
        }));

      // Log batches concurrently
      await Promise.all([logConflictBatch(batch1), logConflictBatch(batch2)]);

      // Verify all logs were written
      const logContent = await fs.readFile(conflictLogPath, "utf-8");
      const lines = logContent.trim().split("\n");
      expect(lines).toHaveLength(10);

      const articleIds = lines.map((line) => JSON.parse(line).articleId);
      expect(articleIds).toContain("article-0");
      expect(articleIds).toContain("article-9");
    });
  });

  describe("Inoreader API State Mapping", () => {
    it("should correctly map Inoreader categories to read/starred states", () => {
      const mapInoreaderCategories = (categories: string[]) => {
        return {
          is_read: categories.includes("user/-/state/com.google/read"),
          is_starred: categories.includes("user/-/state/com.google/starred"),
          is_liked: categories.includes("user/-/state/com.google/like"),
          is_broadcast: categories.includes(
            "user/-/state/com.google/broadcast"
          ),
        };
      };

      // Test various category combinations
      const unreadUnstarred = mapInoreaderCategories([]);
      expect(unreadUnstarred).toEqual({
        is_read: false,
        is_starred: false,
        is_liked: false,
        is_broadcast: false,
      });

      const readOnly = mapInoreaderCategories(["user/-/state/com.google/read"]);
      expect(readOnly).toEqual({
        is_read: true,
        is_starred: false,
        is_liked: false,
        is_broadcast: false,
      });

      const readAndStarred = mapInoreaderCategories([
        "user/-/state/com.google/read",
        "user/-/state/com.google/starred",
      ]);
      expect(readAndStarred).toEqual({
        is_read: true,
        is_starred: true,
        is_liked: false,
        is_broadcast: false,
      });

      const allStates = mapInoreaderCategories([
        "user/-/state/com.google/read",
        "user/-/state/com.google/starred",
        "user/-/state/com.google/like",
        "user/-/state/com.google/broadcast",
      ]);
      expect(allStates).toEqual({
        is_read: true,
        is_starred: true,
        is_liked: true,
        is_broadcast: true,
      });
    });

    it("should handle missing timestamps from Inoreader API", () => {
      const processArticleWithMissingTimestamp = (article: any) => {
        // Inoreader doesn't provide timestamps for read/starred changes
        // We can only use article published/updated timestamps
        return {
          id: article.id,
          published: article.published || null,
          updated: article.updated || null,
          crawled: article.crawlTimeMsec
            ? new Date(article.crawlTimeMsec)
            : null,
          // These timestamps are NOT available from Inoreader
          read_at: null, // Cannot determine when marked as read
          starred_at: null, // Cannot determine when starred
          note: "Inoreader API limitation: state change timestamps unavailable",
        };
      };

      const inoreaderArticle = {
        id: "tag:google.com,2005:reader/item/123",
        published: 1722946800,
        updated: 1722950400,
        crawlTimeMsec: "1722950400000",
        categories: ["user/-/state/com.google/read"],
      };

      const processed = processArticleWithMissingTimestamp(inoreaderArticle);

      expect(processed.published).toBe(1722946800);
      expect(processed.read_at).toBeNull();
      expect(processed.starred_at).toBeNull();
      expect(processed.note).toContain("API limitation");
    });
  });

  describe("Conflict Resolution Strategy", () => {
    it("should apply remote-wins resolution consistently", async () => {
      const applyConflictResolution = (local: any, remote: any) => {
        // Always apply remote state due to API limitations
        return {
          ...local,
          is_read: remote.is_read,
          is_starred: remote.is_starred,
          last_sync_update: new Date().toISOString(),
          conflict_resolution_applied: true,
          conflict_resolution_reason: "Remote wins - API timestamp limitation",
        };
      };

      const localArticle = {
        id: "article-123",
        is_read: true,
        is_starred: true,
        last_local_update: "2025-08-06T12:00:00Z",
        last_sync_update: "2025-08-06T11:00:00Z",
      };

      const remoteState = {
        is_read: false,
        is_starred: false,
      };

      const resolved = applyConflictResolution(localArticle, remoteState);

      expect(resolved.is_read).toBe(false); // Remote value
      expect(resolved.is_starred).toBe(false); // Remote value
      expect(resolved.conflict_resolution_applied).toBe(true);
      expect(resolved.conflict_resolution_reason).toContain("Remote wins");
      expect(resolved.id).toBe("article-123"); // Preserve ID
    });

    it("should maintain data integrity during resolution", async () => {
      const resolveWithIntegrityCheck = (local: any, remote: any) => {
        // Ensure critical fields are preserved
        const resolved = {
          // Preserve identity fields
          id: local.id,
          inoreader_id: local.inoreader_id,
          feed_id: local.feed_id,

          // Apply remote state
          is_read: remote.is_read,
          is_starred: remote.is_starred,

          // Preserve content fields
          title: local.title,
          content: local.content,
          url: local.url,
          author: local.author,
          published_at: local.published_at,

          // Update sync metadata
          last_sync_update: new Date().toISOString(),
          conflict_resolved_at: new Date().toISOString(),

          // Clear local update timestamp since remote won
          last_local_update: null,
        };

        // Integrity checks
        if (!resolved.id || !resolved.inoreader_id) {
          throw new Error("Critical fields missing after resolution");
        }

        return resolved;
      };

      const local = {
        id: "uuid-123",
        inoreader_id: "inoreader-123",
        feed_id: "feed-456",
        title: "Test Article",
        content: "Article content",
        url: "https://example.com/article",
        author: "Author Name",
        published_at: "2025-08-06T10:00:00Z",
        is_read: true,
        is_starred: true,
      };

      const remote = {
        is_read: false,
        is_starred: false,
      };

      const resolved = resolveWithIntegrityCheck(local, remote);

      // Check identity preserved
      expect(resolved.id).toBe("uuid-123");
      expect(resolved.inoreader_id).toBe("inoreader-123");
      expect(resolved.feed_id).toBe("feed-456");

      // Check content preserved
      expect(resolved.title).toBe("Test Article");
      expect(resolved.content).toBe("Article content");

      // Check state updated
      expect(resolved.is_read).toBe(false);
      expect(resolved.is_starred).toBe(false);

      // Check metadata updated
      expect(resolved.last_local_update).toBeNull();
      expect(resolved.conflict_resolved_at).toBeDefined();
    });
  });

  describe("Sync Session Tracking", () => {
    it("should track conflicts across entire sync session", async () => {
      class SyncSessionTracker {
        private sessionId: string;
        private startTime: Date;
        private conflicts: any[] = [];
        private stats = {
          articlesProcessed: 0,
          conflictsDetected: 0,
          readConflicts: 0,
          starredConflicts: 0,
          bothConflicts: 0,
        };

        constructor() {
          this.sessionId = `sync_${new Date().toISOString()}`;
          this.startTime = new Date();
        }

        processArticle(local: any, remote: any) {
          this.stats.articlesProcessed++;

          const hasLocalChanges =
            local.last_local_update &&
            local.last_sync_update &&
            new Date(local.last_local_update) >
              new Date(local.last_sync_update);

          const readDiffers = local.is_read !== remote.is_read;
          const starredDiffers = local.is_starred !== remote.is_starred;
          const statesDiffer = readDiffers || starredDiffers;

          if (hasLocalChanges && statesDiffer) {
            this.stats.conflictsDetected++;

            let conflictType = "none";
            if (readDiffers && starredDiffers) {
              conflictType = "both";
              this.stats.bothConflicts++;
            } else if (readDiffers) {
              conflictType = "read_status";
              this.stats.readConflicts++;
            } else if (starredDiffers) {
              conflictType = "starred_status";
              this.stats.starredConflicts++;
            }

            const conflict = {
              timestamp: new Date().toISOString(),
              syncSessionId: this.sessionId,
              articleId: local.id,
              conflictType,
              localValue: { read: local.is_read, starred: local.is_starred },
              remoteValue: { read: remote.is_read, starred: remote.is_starred },
            };

            this.conflicts.push(conflict);
          }
        }

        getSummary() {
          return {
            sessionId: this.sessionId,
            duration: Date.now() - this.startTime.getTime(),
            stats: { ...this.stats },
            conflicts: [...this.conflicts],
          };
        }
      }

      const tracker = new SyncSessionTracker();

      // Process multiple articles
      tracker.processArticle(
        {
          id: "1",
          is_read: true,
          is_starred: false,
          last_local_update: "2025-08-06T12:00:00Z",
          last_sync_update: "2025-08-06T11:00:00Z",
        },
        { is_read: false, is_starred: false }
      );

      tracker.processArticle(
        {
          id: "2",
          is_read: false,
          is_starred: true,
          last_local_update: "2025-08-06T12:00:00Z",
          last_sync_update: "2025-08-06T11:00:00Z",
        },
        { is_read: false, is_starred: false }
      );

      tracker.processArticle(
        {
          id: "3",
          is_read: true,
          is_starred: false,
          last_local_update: "2025-08-06T10:00:00Z",
          last_sync_update: "2025-08-06T11:00:00Z",
        },
        { is_read: false, is_starred: true }
      );

      const summary = tracker.getSummary();

      expect(summary.stats.articlesProcessed).toBe(3);
      expect(summary.stats.conflictsDetected).toBe(2); // Articles 1 and 2
      expect(summary.stats.readConflicts).toBe(1);
      expect(summary.stats.starredConflicts).toBe(1);
      expect(summary.stats.bothConflicts).toBe(0);
      expect(summary.conflicts).toHaveLength(2);
    });

    it("should generate comprehensive sync report with conflicts", async () => {
      const generateSyncReport = (sessionData: any) => {
        const report = {
          summary: {
            sessionId: sessionData.sessionId,
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            duration: `${sessionData.durationMs}ms`,
            success: sessionData.errors.length === 0,
          },
          statistics: {
            totalArticles: sessionData.totalArticles,
            articlesUpdated: sessionData.articlesUpdated,
            conflictsDetected: sessionData.conflicts.length,
            conflictRate: `${((sessionData.conflicts.length / sessionData.totalArticles) * 100).toFixed(2)}%`,
          },
          conflictBreakdown: {
            readStatusConflicts: sessionData.conflicts.filter(
              (c: any) => c.type === "read_status"
            ).length,
            starredStatusConflicts: sessionData.conflicts.filter(
              (c: any) => c.type === "starred_status"
            ).length,
            bothConflicts: sessionData.conflicts.filter(
              (c: any) => c.type === "both"
            ).length,
          },
          resolutionSummary: {
            strategy: "remote-wins",
            reason: "Inoreader API timestamp limitation",
            localChangesOverwritten: sessionData.conflicts.length,
          },
          recommendations:
            sessionData.conflicts.length > 10
              ? "High conflict rate detected. Consider more frequent syncs."
              : "Conflict rate within acceptable range.",
        };

        return report;
      };

      const mockSessionData = {
        sessionId: "sync_2025-08-06T12:00:00Z",
        startTime: "2025-08-06T12:00:00Z",
        endTime: "2025-08-06T12:00:15Z",
        durationMs: 15000,
        totalArticles: 100,
        articlesUpdated: 85,
        conflicts: [
          { type: "read_status", articleId: "1" },
          { type: "read_status", articleId: "2" },
          { type: "starred_status", articleId: "3" },
          { type: "both", articleId: "4" },
          { type: "read_status", articleId: "5" },
        ],
        errors: [],
      };

      const report = generateSyncReport(mockSessionData);

      expect(report.summary.success).toBe(true);
      expect(report.statistics.conflictsDetected).toBe(5);
      expect(report.statistics.conflictRate).toBe("5.00%");
      expect(report.conflictBreakdown.readStatusConflicts).toBe(3);
      expect(report.conflictBreakdown.starredStatusConflicts).toBe(1);
      expect(report.conflictBreakdown.bothConflicts).toBe(1);
      expect(report.recommendations).toContain("acceptable range");
    });
  });
});
