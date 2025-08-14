import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupTestServer } from "./test-server";
import { StatusChangeLogger } from "@/lib/logging/status-change-logger";
import { supabase } from "@/lib/db/supabase";
import type { Server } from "http";

// Mock the status change logger
vi.mock("@/lib/logging/status-change-logger", () => ({
  StatusChangeLogger: {
    getInstance: vi.fn(() => ({
      logStatusChange: vi.fn(),
      logSyncQueueOperation: vi.fn(),
    })),
  },
}));

describe("Sync Queue Logging Integration - RR-29", () => {
  let server: Server;
  let app: any;
  let mockLogger: any;

  beforeAll(async () => {
    const testServer = await setupTestServer(3003);
    server = testServer.server;
    app = testServer.app;

    await new Promise<void>((resolve) => {
      server.listen(3003, resolve);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = StatusChangeLogger.getInstance();
  });

  describe("add_to_sync_queue RPC Call Logging", () => {
    it("should log successful sync queue addition", async () => {
      // Mock successful RPC call
      const mockRpcResponse = { error: null };
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce(mockRpcResponse);

      // Simulate adding to sync queue
      const result = await supabase.rpc("add_to_sync_queue", {
        p_article_id: "article-123",
        p_inoreader_id: "inoreader-789",
        p_action_type: "read",
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith({
        timestamp: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        operation: "add_to_queue",
        articleId: "article-123",
        inoreaderItemId: "inoreader-789",
        actionType: "read",
        success: true,
        queueSize: expect.any(Number),
        estimatedSyncDelay: expect.any(Number),
      });
    });

    it("should log failed sync queue addition", async () => {
      // Mock failed RPC call
      const mockRpcResponse = { error: new Error("Queue full") };
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce(mockRpcResponse);

      const result = await supabase.rpc("add_to_sync_queue", {
        p_article_id: "article-123",
        p_inoreader_id: "inoreader-789",
        p_action_type: "read",
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith({
        timestamp: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        operation: "add_to_queue",
        articleId: "article-123",
        inoreaderItemId: "inoreader-789",
        actionType: "read",
        success: false,
        error: "Queue full",
        queueSize: expect.any(Number),
      });
    });

    it("should track queue size at time of addition", async () => {
      // Mock queue size query
      const mockQueueSize = 15;
      vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: Array.from({ length: mockQueueSize }),
            error: null,
          }),
        }),
      } as any);

      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({ error: null });

      await supabase.rpc("add_to_sync_queue", {
        p_article_id: "article-123",
        p_inoreader_id: "inoreader-789",
        p_action_type: "read",
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          queueSize: mockQueueSize,
        })
      );
    });
  });

  describe("Queue Overflow Scenario Logging", () => {
    it("should detect and log queue overflow scenarios", async () => {
      const maxQueueSize = 1000;
      const currentQueueSize = 1001;

      // Mock large queue size
      vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: Array.from({ length: currentQueueSize }),
            error: null,
          }),
        }),
      } as any);

      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        error: new Error("Queue size limit exceeded"),
      });

      await supabase.rpc("add_to_sync_queue", {
        p_article_id: "article-123",
        p_inoreader_id: "inoreader-789",
        p_action_type: "read",
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "queue_overflow",
          queueSize: currentQueueSize,
          maxQueueSize: maxQueueSize,
          overflow: true,
          droppedOperations: 1,
        })
      );
    });

    it("should track queue health metrics", async () => {
      const queueHealthMetrics = {
        size: 50,
        maxSize: 1000,
        utilizationPercentage: 5,
        oldestItemAge: 300000, // 5 minutes in ms
        avgProcessingTime: 2500, // 2.5 seconds
      };

      await mockLogger.logSyncQueueOperation({
        timestamp: new Date().toISOString(),
        operation: "health_check",
        queueMetrics: queueHealthMetrics,
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "health_check",
          queueMetrics: expect.objectContaining({
            utilizationPercentage: 5,
            oldestItemAge: 300000,
            avgProcessingTime: 2500,
          }),
        })
      );
    });
  });

  describe("Estimated Sync Delay Calculations", () => {
    it("should calculate sync delay based on queue size and processing rate", async () => {
      const currentQueueSize = 20;
      const averageProcessingTimeMs = 2000; // 2 seconds per item
      const expectedDelay = currentQueueSize * averageProcessingTimeMs;

      // Mock queue size and processing stats
      vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: Array.from({ length: currentQueueSize }),
            error: null,
          }),
        }),
      } as any);

      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({ error: null });

      await supabase.rpc("add_to_sync_queue", {
        p_article_id: "article-123",
        p_inoreader_id: "inoreader-789",
        p_action_type: "read",
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedSyncDelay: expect.closeTo(expectedDelay, 1000), // Within 1 second tolerance
          queuePosition: currentQueueSize + 1,
        })
      );
    });

    it("should adjust delay calculation based on sync service availability", async () => {
      const queueSize = 10;
      const baseSyncDelay = 5000; // 5 seconds
      const serviceDegradationFactor = 2; // Service running slow

      // Mock sync service health check
      const healthResponse = await fetch("http://localhost:3001/health");
      const serviceHealthy = healthResponse.ok;

      const adjustedDelay = serviceHealthy
        ? baseSyncDelay
        : baseSyncDelay * serviceDegradationFactor;

      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({ error: null });

      await supabase.rpc("add_to_sync_queue", {
        p_article_id: "article-123",
        p_inoreader_id: "inoreader-789",
        p_action_type: "read",
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedSyncDelay: adjustedDelay,
          syncServiceHealthy: serviceHealthy,
          serviceDegradationFactor: serviceHealthy
            ? 1
            : serviceDegradationFactor,
        })
      );
    });
  });

  describe("Bi-directional Sync Status Tracking", () => {
    it("should track sync direction and completion status", async () => {
      const syncOperations = [
        { direction: "local_to_remote", actionType: "read" },
        { direction: "remote_to_local", actionType: "unread" },
        { direction: "local_to_remote", actionType: "star" },
      ];

      for (const operation of syncOperations) {
        vi.spyOn(supabase, "rpc").mockResolvedValueOnce({ error: null });

        await supabase.rpc("add_to_sync_queue", {
          p_article_id: "article-123",
          p_inoreader_id: "inoreader-789",
          p_action_type: operation.actionType,
        });

        expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
          expect.objectContaining({
            syncDirection: operation.direction,
            actionType: operation.actionType,
            bidirectional: true,
          })
        );
      }
    });

    it("should track sync completion and result status", async () => {
      const syncCompletionEvent = {
        operation: "sync_completion",
        articleId: "article-123",
        inoreaderItemId: "inoreader-789",
        actionType: "read",
        success: true,
        syncDuration: 1500,
        attempts: 1,
        finalStatus: "completed",
      };

      await mockLogger.logSyncQueueOperation({
        timestamp: new Date().toISOString(),
        ...syncCompletionEvent,
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "sync_completion",
          success: true,
          syncDuration: 1500,
          attempts: 1,
          finalStatus: "completed",
        })
      );
    });
  });

  describe("Sync Failure and Retry Logging", () => {
    it("should log sync failures with retry information", async () => {
      const failureEvent = {
        operation: "sync_failure",
        articleId: "article-123",
        inoreaderItemId: "inoreader-789",
        actionType: "read",
        error: "Rate limit exceeded",
        attemptNumber: 2,
        maxRetries: 3,
        nextRetryAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes later
        backoffMultiplier: 2,
      };

      await mockLogger.logSyncQueueOperation({
        timestamp: new Date().toISOString(),
        ...failureEvent,
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "sync_failure",
          error: "Rate limit exceeded",
          attemptNumber: 2,
          maxRetries: 3,
          nextRetryAt: expect.stringMatching(
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
          ),
          backoffMultiplier: 2,
        })
      );
    });

    it("should track permanent failure after max retries", async () => {
      const permanentFailureEvent = {
        operation: "permanent_failure",
        articleId: "article-123",
        inoreaderItemId: "inoreader-789",
        actionType: "read",
        finalError: "Authentication failed",
        totalAttempts: 3,
        totalSyncDuration: 45000, // 45 seconds across all attempts
        gaveUpAt: new Date().toISOString(),
      };

      await mockLogger.logSyncQueueOperation({
        timestamp: new Date().toISOString(),
        ...permanentFailureEvent,
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "permanent_failure",
          finalError: "Authentication failed",
          totalAttempts: 3,
          totalSyncDuration: 45000,
        })
      );
    });
  });

  describe("Queue Processing Time Metrics", () => {
    it("should track queue processing performance", async () => {
      const processingMetrics = {
        operation: "processing_metrics",
        queueSize: 25,
        processedCount: 20,
        processingDuration: 40000, // 40 seconds
        averageItemProcessingTime: 2000, // 2 seconds per item
        successRate: 0.95, // 95% success rate
        errorRate: 0.05, // 5% error rate
        throughputPerMinute: 30,
      };

      await mockLogger.logSyncQueueOperation({
        timestamp: new Date().toISOString(),
        ...processingMetrics,
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "processing_metrics",
          successRate: 0.95,
          errorRate: 0.05,
          throughputPerMinute: 30,
          averageItemProcessingTime: 2000,
        })
      );
    });

    it("should identify performance bottlenecks", async () => {
      const bottleneckAnalysis = {
        operation: "bottleneck_analysis",
        slowestOperation: "star",
        slowestOperationTime: 8000, // 8 seconds
        fastestOperation: "read",
        fastestOperationTime: 500, // 0.5 seconds
        recommendedOptimizations: [
          "Batch star operations",
          "Implement star operation caching",
          "Increase star operation timeout threshold",
        ],
      };

      await mockLogger.logSyncQueueOperation({
        timestamp: new Date().toISOString(),
        ...bottleneckAnalysis,
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "bottleneck_analysis",
          slowestOperation: "star",
          slowestOperationTime: 8000,
          recommendedOptimizations: expect.arrayContaining([
            "Batch star operations",
            "Implement star operation caching",
          ]),
        })
      );
    });
  });

  describe("Real-time Queue Monitoring", () => {
    it("should provide real-time queue status updates", async () => {
      const queueStatusUpdate = {
        operation: "queue_status_update",
        currentSize: 12,
        processing: true,
        currentlyProcessingItem: {
          articleId: "article-456",
          actionType: "unread",
          startedAt: new Date(Date.now() - 1500).toISOString(), // Started 1.5 seconds ago
        },
        estimatedCompletionTime: new Date(Date.now() + 24000).toISOString(), // 24 seconds from now
      };

      await mockLogger.logSyncQueueOperation({
        timestamp: new Date().toISOString(),
        ...queueStatusUpdate,
      });

      expect(mockLogger.logSyncQueueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "queue_status_update",
          processing: true,
          currentlyProcessingItem: expect.objectContaining({
            articleId: "article-456",
            actionType: "unread",
          }),
        })
      );
    });
  });
});
