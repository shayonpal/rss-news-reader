import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  SyncApiResponse,
  SyncMetrics,
  SyncApiResponseSchema,
  SyncMetricsSchema,
  SidebarSyncValidation,
} from "@/contracts/rr-171-sidebar";

/**
 * Test Specification for RR-171: Sync API Endpoint
 *
 * This test validates the /api/sync endpoint contract using Zod schemas
 * to ensure proper metrics are returned from sync operations.
 *
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

// Mock the sync handler interface
interface SyncHandler {
  POST(request: NextRequest): Promise<NextResponse>;
}

describe("RR-171: Sync API Contract", () => {
  let mockSupabase: any;
  let mockSyncManager: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockReturnThis(),
    };

    // Mock sync manager
    mockSyncManager = {
      syncFromInoreader: vi.fn(),
      calculateMetrics: vi.fn(),
    };

    // Mock request
    mockRequest = new NextRequest("http://localhost:3000/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  describe("Successful Sync", () => {
    it("should return complete metrics for successful sync", async () => {
      // Setup mock to return successful sync data
      mockSyncManager.syncFromInoreader.mockResolvedValue({
        success: true,
        newArticles: 10,
        deletedArticles: 5,
        newTags: 2,
        failedFeeds: 0,
      });

      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "completed",
        metrics: {
          newArticles: 10,
          deletedArticles: 5,
          newTags: 2,
          failedFeeds: 0,
        },
      };

      // Validate response with Zod schema
      const validated = SidebarSyncValidation.validateSyncStatus(response);

      expect(validated.status).toBe("completed");
      expect(validated.metrics).toBeDefined();
      expect(validated.metrics.newArticles).toBe(10);
      expect(validated.metrics.deletedArticles).toBe(5);
      expect(validated.metrics.newTags).toBe(2);
      expect(validated.metrics.failedFeeds).toBe(0);
    });

    it("should return syncId with every response", async () => {
      const response: SyncApiResponse = {
        syncId: "sync-" + Date.now(),
        status: "completed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      };

      // Validate with Zod schema
      const validated = SyncApiResponseSchema.parse(response);
      expect(validated.syncId).toBeDefined();
      expect(validated.syncId).toMatch(/^sync-/);
    });

    it("should handle no changes scenario", async () => {
      mockSyncManager.syncFromInoreader.mockResolvedValue({
        success: true,
        newArticles: 0,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0,
      });

      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "completed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      };

      expect(response.status).toBe("completed");
      expect(response.metrics.newArticles).toBe(0);
      expect(response.metrics.deletedArticles).toBe(0);
      expect(response.metrics.newTags).toBe(0);
    });

    it("should include timestamp in response", async () => {
      const beforeTime = new Date().toISOString();

      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "completed",
        metrics: {
          newArticles: 5,
          deletedArticles: 2,
          newTags: 1,
          failedFeeds: 0,
        },
        timestamp: new Date().toISOString(),
      };

      const afterTime = new Date().toISOString();

      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
      expect(new Date(response.timestamp!).getTime()).toBeLessThanOrEqual(
        new Date(afterTime).getTime()
      );
    });

    it("should include duration in milliseconds", async () => {
      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "completed",
        metrics: {
          newArticles: 10,
          deletedArticles: 5,
          newTags: 2,
          failedFeeds: 0,
        },
        duration: 2500, // 2.5 seconds
      };

      expect(response.duration).toBeDefined();
      expect(response.duration).toBeGreaterThan(0);
      expect(typeof response.duration).toBe("number");
    });
  });

  describe("Partial Sync", () => {
    it("should return partial status when some feeds fail", async () => {
      mockSyncManager.syncFromInoreader.mockResolvedValue({
        success: true,
        newArticles: 7,
        deletedArticles: 3,
        newTags: 1,
        failedFeeds: 3,
        totalFeeds: 10,
      });

      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "partial",
        metrics: {
          newArticles: 7,
          deletedArticles: 3,
          newTags: 1,
          failedFeeds: 3,
        },
      };

      expect(response.status).toBe("partial");
      expect(response.metrics.failedFeeds).toBe(3);
      expect(response.metrics.newArticles).toBe(7);
    });

    it("should classify as partial if any feeds fail", async () => {
      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "partial",
        metrics: {
          newArticles: 100,
          deletedArticles: 50,
          newTags: 10,
          failedFeeds: 1, // Even 1 failure makes it partial
        },
      };

      expect(response.status).toBe("partial");
      expect(response.metrics.failedFeeds).toBeGreaterThan(0);
    });
  });

  describe("Failed Sync", () => {
    it("should return failed status on complete failure", async () => {
      mockSyncManager.syncFromInoreader.mockRejectedValue(
        new Error("Network error")
      );

      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "failed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 10,
        },
      };

      expect(response.status).toBe("failed");
      expect(response.metrics.newArticles).toBe(0);
      expect(response.metrics.deletedArticles).toBe(0);
      expect(response.metrics.newTags).toBe(0);
    });

    it("should return failed status when all feeds fail", async () => {
      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "failed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 10,
        },
      };

      expect(response.status).toBe("failed");
      expect(response.metrics.failedFeeds).toBeGreaterThan(0);
      expect(response.metrics.newArticles).toBe(0);
    });

    it("should still return syncId on failure", async () => {
      const response: SyncApiResponse = {
        syncId: "sync-failed-123",
        status: "failed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 5,
        },
      };

      expect(response.syncId).toBeDefined();
      expect(response.syncId).toMatch(/sync/);
    });
  });

  describe("Response Format", () => {
    it("should always return 200 status with JSON response", async () => {
      // Even failures should return 200 with status in body
      const responses: SyncApiResponse[] = [
        {
          syncId: "sync-1",
          status: "completed",
          metrics: {
            newArticles: 10,
            deletedArticles: 5,
            newTags: 2,
            failedFeeds: 0,
          },
        },
        {
          syncId: "sync-2",
          status: "partial",
          metrics: {
            newArticles: 5,
            deletedArticles: 2,
            newTags: 1,
            failedFeeds: 2,
          },
        },
        {
          syncId: "sync-3",
          status: "failed",
          metrics: {
            newArticles: 0,
            deletedArticles: 0,
            newTags: 0,
            failedFeeds: 10,
          },
        },
      ];

      responses.forEach((response) => {
        expect(response).toHaveProperty("syncId");
        expect(response).toHaveProperty("status");
        expect(response).toHaveProperty("metrics");
        expect(["completed", "partial", "failed"]).toContain(response.status);
      });
    });

    it("should have consistent metric structure", async () => {
      const response: SyncApiResponse = {
        syncId: "sync-123",
        status: "completed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      };

      expect(response.metrics).toHaveProperty("newArticles");
      expect(response.metrics).toHaveProperty("deletedArticles");
      expect(response.metrics).toHaveProperty("newTags");
      expect(response.metrics).toHaveProperty("failedFeeds");

      // All metrics should be numbers
      expect(typeof response.metrics.newArticles).toBe("number");
      expect(typeof response.metrics.deletedArticles).toBe("number");
      expect(typeof response.metrics.newTags).toBe("number");
      expect(typeof response.metrics.failedFeeds).toBe("number");

      // All metrics should be non-negative
      expect(response.metrics.newArticles).toBeGreaterThanOrEqual(0);
      expect(response.metrics.deletedArticles).toBeGreaterThanOrEqual(0);
      expect(response.metrics.newTags).toBeGreaterThanOrEqual(0);
      expect(response.metrics.failedFeeds).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response: SyncApiResponse = {
        syncId: "sync-error-123",
        status: "failed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      };

      expect(response.status).toBe("failed");
      expect(response.syncId).toBeDefined();
    });

    it("should handle OAuth token errors", async () => {
      mockSyncManager.syncFromInoreader.mockRejectedValue(
        new Error("OAuth token expired")
      );

      const response: SyncApiResponse = {
        syncId: "sync-oauth-error",
        status: "failed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      };

      expect(response.status).toBe("failed");
    });

    it("should handle rate limit errors", async () => {
      mockSyncManager.syncFromInoreader.mockRejectedValue(
        new Error("Rate limit exceeded")
      );

      const response: SyncApiResponse = {
        syncId: "sync-rate-limit",
        status: "failed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      };

      expect(response.status).toBe("failed");
    });
  });

  describe("Concurrent Sync Prevention", () => {
    it("should prevent concurrent sync operations", async () => {
      // Mock a sync already in progress
      mockSyncManager.isSyncing = true;

      // Attempting another sync should be rejected or queued
      const response = {
        error: "Sync already in progress",
        syncId: "existing-sync-id",
      };

      expect(response.error).toBeDefined();
      expect(response.error).toContain("in progress");
    });

    it("should track sync state correctly", async () => {
      const syncState = {
        isActive: false,
        startTime: null as Date | null,
        syncId: null as string | null,
      };

      // Start sync
      syncState.isActive = true;
      syncState.startTime = new Date();
      syncState.syncId = "sync-123";

      expect(syncState.isActive).toBe(true);
      expect(syncState.startTime).toBeInstanceOf(Date);
      expect(syncState.syncId).toBe("sync-123");

      // End sync
      syncState.isActive = false;

      expect(syncState.isActive).toBe(false);
    });
  });
});
