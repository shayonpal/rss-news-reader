/**
 * Integration Tests for RR-162: Sync Completion Without Auto-Fetch
 *
 * These tests verify end-to-end sync behavior after auto-fetch removal,
 * ensuring the sync pipeline completes successfully without hanging.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Server } from "http";
import { createClient } from "@supabase/supabase-js";
import {
  SyncBehaviorContracts,
  DatabaseBehaviorContracts,
  TestDataGenerators,
  type SyncStatusResponse,
  type FetchLogEntry,
} from "../contracts/rr-162-remove-autofetch.contract";

// Test configuration
const TEST_PORT = 3003;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
const SYNC_TIMEOUT = 30000; // 30 seconds max for sync

// Initialize test Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key"
);

describe("RR-162: Sync Completion Integration Tests", () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    // Note: In a real test, we'd set up the test server
    // For now, we'll test against the contracts
    console.log("Setting up integration test environment...");
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
    // Clear any test data
    await clearTestData();
  });

  describe("Contract: Sync Completes to 100% Without Hanging", () => {
    it("should complete full sync without stopping at 92%", async () => {
      // Record initial auto-fetch count
      const { count: initialAutoFetchCount } = await supabase
        .from("fetch_logs")
        .select("*", { count: "exact", head: true })
        .eq("fetch_type", "auto");

      // Initiate sync
      const syncResponse = await fetch(`${TEST_BASE_URL}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(syncResponse.ok).toBe(true);
      const { syncId } = await syncResponse.json();
      expect(syncId).toBeDefined();

      // Monitor sync progress
      const progressUpdates = await monitorSyncProgress(syncId);

      // Verify contracts
      expect(progressUpdates).toSatisfy((updates: number[]) => {
        // Must reach 100%
        return updates[updates.length - 1] === 100;
      });

      // Must never stop at 92%
      expect(progressUpdates).not.toContain(92);

      // Verify no hanging - check consecutive progress updates
      for (let i = 1; i < progressUpdates.length; i++) {
        // Progress should always increase or stay same, never decrease
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(
          progressUpdates[i - 1]
        );
      }

      // Verify no new auto-fetch entries
      const { count: finalAutoFetchCount } = await supabase
        .from("fetch_logs")
        .select("*", { count: "exact", head: true })
        .eq("fetch_type", "auto");

      expect(finalAutoFetchCount).toBe(initialAutoFetchCount);
    });

    it("should handle multiple concurrent syncs without auto-fetch interference", async () => {
      const syncPromises = [];
      const syncIds: string[] = [];

      // Start 3 concurrent syncs
      for (let i = 0; i < 3; i++) {
        const promise = fetch(`${TEST_BASE_URL}/api/sync`, {
          method: "POST",
        }).then((res) => res.json());
        syncPromises.push(promise);
      }

      const responses = await Promise.all(syncPromises);
      responses.forEach((response) => {
        expect(response.syncId).toBeDefined();
        syncIds.push(response.syncId);
      });

      // Monitor all syncs
      const progressMonitors = syncIds.map((id) => monitorSyncProgress(id));
      const allProgress = await Promise.all(progressMonitors);

      // All syncs should complete without 92% hang
      allProgress.forEach((progressUpdates) => {
        expect(progressUpdates).not.toContain(92);
        expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
      });
    });
  });

  describe("Contract: Database State After Sync", () => {
    it("should not create any new auto-fetch logs", async () => {
      const beforeTimestamp = new Date().toISOString();

      // Run sync
      const syncResponse = await fetch(`${TEST_BASE_URL}/api/sync`, {
        method: "POST",
      });
      const { syncId } = await syncResponse.json();

      // Wait for sync completion
      await waitForSyncCompletion(syncId);

      // Check fetch_logs for any auto-fetch entries after timestamp
      const { data: newAutoFetchLogs } = await supabase
        .from("fetch_logs")
        .select("*")
        .eq("fetch_type", "auto")
        .gte("created_at", beforeTimestamp);

      expect(newAutoFetchLogs).toHaveLength(0);
    });

    it("should preserve manual fetch functionality", async () => {
      // Create test article
      const testArticle = TestDataGenerators.createTestArticle();

      const { data: article, error } = await supabase
        .from("articles")
        .insert(testArticle)
        .select()
        .single();

      expect(error).toBeNull();
      expect(article).toBeDefined();

      // Trigger manual fetch
      const fetchResponse = await fetch(
        `${TEST_BASE_URL}/api/articles/${article.id}/fetch-content`,
        { method: "POST" }
      );

      expect(fetchResponse.ok).toBe(true);

      // Verify fetch log created with type 'manual'
      const { data: fetchLog } = await supabase
        .from("fetch_logs")
        .select("*")
        .eq("article_id", article.id)
        .single();

      expect(fetchLog).toMatchObject({
        fetch_type: "manual",
        status: expect.stringMatching(/success|failure/),
      });

      // Verify article updated
      const { data: updatedArticle } = await supabase
        .from("articles")
        .select("has_full_content, parsed_at")
        .eq("id", article.id)
        .single();

      if (fetchLog?.status === "success") {
        expect(updatedArticle?.has_full_content).toBe(true);
        expect(updatedArticle?.parsed_at).toBeDefined();
      }
    });

    it("should maintain sync_metadata correctly", async () => {
      const beforeSync = new Date();

      // Run sync
      const syncResponse = await fetch(`${TEST_BASE_URL}/api/sync`, {
        method: "POST",
      });
      const { syncId } = await syncResponse.json();

      await waitForSyncCompletion(syncId);

      // Check sync_metadata
      const { data: metadata } = await supabase
        .from("sync_metadata")
        .select("*")
        .single();

      expect(metadata).toBeDefined();
      expect(new Date(metadata.last_sync_at)).toBeInstanceOf(Date);
      expect(new Date(metadata.last_sync_at).getTime()).toBeGreaterThanOrEqual(
        beforeSync.getTime()
      );

      // Should not have auto_fetch related metadata
      expect(metadata).not.toHaveProperty("last_auto_fetch_at");
      expect(metadata).not.toHaveProperty("auto_fetch_enabled");
    });
  });

  describe("Contract: Sync Performance Metrics", () => {
    it("should complete sync faster without auto-fetch overhead", async () => {
      const startTime = Date.now();

      const syncResponse = await fetch(`${TEST_BASE_URL}/api/sync`, {
        method: "POST",
      });
      const { syncId } = await syncResponse.json();

      const finalStatus = await waitForSyncCompletion(syncId);
      const duration = Date.now() - startTime;

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(SYNC_TIMEOUT);

      // Should have completed status
      expect(finalStatus.status).toBe("completed");
      expect(finalStatus.progress).toBe(100);
    });

    it("should show improved progress tracking", async () => {
      const syncResponse = await fetch(`${TEST_BASE_URL}/api/sync`, {
        method: "POST",
      });
      const { syncId } = await syncResponse.json();

      const progressTimestamps: Array<{ progress: number; timestamp: number }> =
        [];
      let lastProgress = -1;

      // Poll for progress updates
      while (lastProgress < 100) {
        const status = await getSyncStatus(syncId);
        if (status.progress > lastProgress) {
          progressTimestamps.push({
            progress: status.progress,
            timestamp: Date.now(),
          });
          lastProgress = status.progress;
        }

        if (status.status === "failed") {
          throw new Error(`Sync failed: ${status.error}`);
        }

        if (status.status === "completed") {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Verify smooth progress without stalls
      for (let i = 1; i < progressTimestamps.length; i++) {
        const timeDiff =
          progressTimestamps[i].timestamp - progressTimestamps[i - 1].timestamp;
        // No single step should take more than 10 seconds
        expect(timeDiff).toBeLessThan(10000);
      }

      // Should never have progress value of 92
      const allProgress = progressTimestamps.map((p) => p.progress);
      expect(allProgress).not.toContain(92);
    });
  });

  describe("Contract: Error Recovery Without Auto-Fetch", () => {
    it("should handle partial sync failures gracefully", async () => {
      // Simulate a scenario that would previously trigger auto-fetch
      // Create articles from partial feeds
      const partialFeedId = "partial-feed-" + Date.now();

      await supabase.from("feeds").insert({
        id: partialFeedId,
        title: "Partial Content Feed",
        url: "https://example.com/partial",
        is_partial_content: true,
      });

      // Create articles without full content
      const articleIds = [];
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from("articles")
          .insert({
            title: `Partial Article ${i}`,
            feed_id: partialFeedId,
            has_full_content: false,
            url: `https://example.com/article-${i}`,
          })
          .select("id")
          .single();

        if (data) articleIds.push(data.id);
      }

      // Run sync
      const syncResponse = await fetch(`${TEST_BASE_URL}/api/sync`, {
        method: "POST",
      });
      const { syncId } = await syncResponse.json();

      const finalStatus = await waitForSyncCompletion(syncId);

      // Sync should complete despite partial content
      expect(finalStatus.status).toBe("completed");
      expect(finalStatus.progress).toBe(100);

      // Articles should remain without full content (no auto-fetch)
      const { data: articles } = await supabase
        .from("articles")
        .select("has_full_content")
        .in("id", articleIds);

      articles?.forEach((article) => {
        expect(article.has_full_content).toBe(false);
      });

      // No auto-fetch logs should be created
      const { data: fetchLogs } = await supabase
        .from("fetch_logs")
        .select("fetch_type")
        .in("article_id", articleIds);

      expect(fetchLogs).toHaveLength(0);
    });
  });
});

// Helper Functions

async function clearTestData(): Promise<void> {
  // Clean up test data from previous runs
  const tables = ["fetch_logs", "sync_status"];

  for (const table of tables) {
    try {
      await supabase
        .from(table)
        .delete()
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());
    } catch (error) {
      console.warn(`Failed to clear ${table}:`, error);
    }
  }
}

async function monitorSyncProgress(syncId: string): Promise<number[]> {
  const progressUpdates: number[] = [];
  const maxAttempts = 60; // 30 seconds with 500ms intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getSyncStatus(syncId);

    if (!progressUpdates.includes(status.progress)) {
      progressUpdates.push(status.progress);
    }

    if (status.status === "completed" || status.status === "failed") {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    attempts++;
  }

  return progressUpdates;
}

async function getSyncStatus(syncId: string): Promise<SyncStatusResponse> {
  // Try file-based status first (primary)
  try {
    const response = await fetch(`${TEST_BASE_URL}/api/sync/status/${syncId}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn("Failed to get file-based status:", error);
  }

  // Fallback to database
  const { data } = await supabase
    .from("sync_status")
    .select("*")
    .eq("sync_id", syncId)
    .single();

  if (data) {
    return {
      status: data.status,
      progress: data.progress_percentage,
      message: data.current_step,
      error: data.error_message,
      startTime: new Date(data.created_at).getTime(),
      syncId: data.sync_id,
    };
  }

  // Default status if not found
  return {
    status: "pending",
    progress: 0,
    startTime: Date.now(),
    syncId,
  };
}

async function waitForSyncCompletion(
  syncId: string,
  timeout: number = SYNC_TIMEOUT
): Promise<SyncStatusResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await getSyncStatus(syncId);

    if (status.status === "completed" || status.status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Sync ${syncId} timed out after ${timeout}ms`);
}
