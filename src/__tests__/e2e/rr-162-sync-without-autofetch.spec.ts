/**
 * E2E Tests for RR-162: Sync Flow Without Auto-Fetch
 *
 * These tests verify the complete sync flow from user perspective,
 * ensuring sync completes successfully without auto-fetch hanging.
 */

import { test, expect, Page } from "@playwright/test";
import {
  SyncBehaviorContracts,
  TestDataGenerators,
} from "../contracts/rr-162-remove-autofetch.contract";

// Test configuration
const BASE_URL = process.env.TEST_URL || "http://100.96.166.53:3000/reader";
const SYNC_TIMEOUT = 35000; // 35 seconds to account for network delays
const POLL_INTERVAL = 500; // Poll every 500ms for status updates

test.describe("RR-162: E2E Sync Without Auto-Fetch", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the RSS reader
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
  });

  test("should complete sync to 100% without hanging at 92%", async ({
    page,
  }) => {
    // Look for sync button
    const syncButton = page
      .locator('[data-testid="sync-button"], button:has-text("Sync")')
      .first();

    // Wait for sync button to be visible and enabled
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await expect(syncButton).toBeEnabled();

    // Start monitoring network requests for sync progress
    const progressUpdates: number[] = [];

    // Listen for sync status API calls
    page.on("response", async (response) => {
      if (response.url().includes("/api/sync/status/")) {
        try {
          const data = await response.json();
          if (data.progress !== undefined) {
            progressUpdates.push(data.progress);
          }
        } catch {
          // Ignore parse errors
        }
      }
    });

    // Click sync button
    await syncButton.click();

    // Wait for sync to start (should show progress indicator)
    await expect(
      page
        .locator('[data-testid="sync-progress"], [role="progressbar"]')
        .first()
    ).toBeVisible({ timeout: 5000 });

    // Monitor sync progress
    const startTime = Date.now();
    let lastProgress = -1;
    let syncCompleted = false;

    while (!syncCompleted && Date.now() - startTime < SYNC_TIMEOUT) {
      // Check for completion indicators
      const completionIndicators = await Promise.race([
        page
          .locator("text=/sync.{0,20}complet/i")
          .isVisible()
          .catch(() => false),
        page
          .locator('[data-testid="sync-complete"]')
          .isVisible()
          .catch(() => false),
        page
          .locator('[data-testid="sync-progress"][data-value="100"]')
          .isVisible()
          .catch(() => false),
      ]);

      if (completionIndicators) {
        syncCompleted = true;
        break;
      }

      // Check for error states
      const errorVisible = await page
        .locator("text=/sync.{0,20}(fail|error)/i")
        .isVisible()
        .catch(() => false);
      if (errorVisible) {
        throw new Error("Sync failed with error");
      }

      // Check current progress if displayed
      const progressElement = page
        .locator('[data-testid="sync-progress"], [data-progress]')
        .first();
      if (await progressElement.isVisible().catch(() => false)) {
        const progressText = await progressElement
          .textContent()
          .catch(() => "");
        const progressMatch = progressText.match(/(\d+)%?/);
        if (progressMatch) {
          const currentProgress = parseInt(progressMatch[1]);
          if (currentProgress > lastProgress) {
            progressUpdates.push(currentProgress);
            lastProgress = currentProgress;
          }
        }
      }

      await page.waitForTimeout(POLL_INTERVAL);
    }

    // Verify sync completed
    expect(syncCompleted).toBe(true);

    // Verify no 92% hang
    expect(progressUpdates).not.toContain(92);

    // Verify reached 100%
    if (progressUpdates.length > 0) {
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    }

    // Verify sync button is re-enabled
    await expect(syncButton).toBeEnabled({ timeout: 5000 });
  });

  test("should not show auto-fetch related UI elements", async ({ page }) => {
    // Check settings/preferences page
    const settingsButton = page
      .locator('[data-testid="settings-button"], button:has-text("Settings")')
      .first();

    if (await settingsButton.isVisible().catch(() => false)) {
      await settingsButton.click();
      await page.waitForLoadState("networkidle");

      // Verify no auto-fetch settings are visible
      await expect(page.locator("text=/auto.{0,5}fetch/i")).not.toBeVisible();
      await expect(
        page.locator('label:has-text("Automatically fetch full content")')
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="auto-fetch-toggle"]')
      ).not.toBeVisible();

      // Close settings if there's a close button
      const closeButton = page
        .locator('[data-testid="close-settings"], button:has-text("Close")')
        .first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test("should allow manual content fetching", async ({ page }) => {
    // Navigate to an article that might not have full content
    await page.waitForSelector('[data-testid="article-list"], article', {
      timeout: 10000,
    });

    // Click on first article
    const firstArticle = page
      .locator('[data-testid="article-list"] article, article')
      .first();
    await firstArticle.click();

    // Wait for article view
    await page.waitForLoadState("networkidle");

    // Look for fetch content button
    const fetchButton = page
      .locator(
        '[data-testid="fetch-content-button"], button:has-text("Fetch"), button:has-text("Load Full")'
      )
      .first();

    if (await fetchButton.isVisible().catch(() => false)) {
      // Click fetch button
      await fetchButton.click();

      // Wait for loading state
      await expect(page.locator('[data-testid="loading-content"], .loading'))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {
          /* Loading indicator might be quick */
        });

      // Wait for content to load (success or failure)
      await page.waitForLoadState("networkidle");

      // Verify no auto-fetch messaging
      await expect(page.locator("text=/auto.{0,10}fetch/i")).not.toBeVisible();
    }
  });

  test("should track sync progress smoothly", async ({ page }) => {
    // Intercept sync API calls
    let syncId: string | null = null;
    const progressSequence: Array<{ progress: number; timestamp: number }> = [];

    await page.route("**/api/sync", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      syncId = data.syncId;
      await route.fulfill({ response });
    });

    await page.route("**/api/sync/status/*", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      progressSequence.push({
        progress: data.progress,
        timestamp: Date.now(),
      });
      await route.fulfill({ response });
    });

    // Trigger sync
    const syncButton = page
      .locator('[data-testid="sync-button"], button:has-text("Sync")')
      .first();
    await syncButton.click();

    // Wait for sync to complete
    await page.waitForFunction(
      () => {
        const progressEl = document.querySelector(
          '[data-testid="sync-progress"]'
        );
        const completeEl = document.querySelector(
          '[data-testid="sync-complete"]'
        );
        return (
          completeEl || (progressEl && progressEl.textContent?.includes("100"))
        );
      },
      { timeout: SYNC_TIMEOUT }
    );

    // Analyze progress sequence
    if (progressSequence.length > 0) {
      // Verify no 92% in sequence
      const progressValues = progressSequence.map((p) => p.progress);
      expect(progressValues).not.toContain(92);

      // Verify monotonic increase (no backwards progress)
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }

      // Verify no long stalls
      for (let i = 1; i < progressSequence.length; i++) {
        const timeDiff =
          progressSequence[i].timestamp - progressSequence[i - 1].timestamp;
        // No single progress update should take more than 10 seconds
        expect(timeDiff).toBeLessThan(10000);
      }
    }
  });

  test("should handle network errors gracefully during sync", async ({
    page,
  }) => {
    // Simulate network error for sync endpoint
    await page.route("**/api/sync", (route) => {
      route.abort("failed");
    });

    // Try to sync
    const syncButton = page
      .locator('[data-testid="sync-button"], button:has-text("Sync")')
      .first();
    await syncButton.click();

    // Should show error message
    await expect(page.locator("text=/error|fail/i")).toBeVisible({
      timeout: 5000,
    });

    // Should not show 92% or auto-fetch related errors
    await expect(page.locator("text=/92%/")).not.toBeVisible();
    await expect(page.locator("text=/auto.{0,5}fetch/i")).not.toBeVisible();

    // Sync button should be re-enabled for retry
    await expect(syncButton).toBeEnabled({ timeout: 5000 });
  });

  test("should display correct sync statistics", async ({ page }) => {
    // Complete a sync first
    const syncButton = page
      .locator('[data-testid="sync-button"], button:has-text("Sync")')
      .first();
    await syncButton.click();

    // Wait for sync completion
    await page
      .waitForFunction(
        () => document.querySelector('[data-testid="sync-complete"]') !== null,
        { timeout: SYNC_TIMEOUT }
      )
      .catch(() => {
        /* Sync might already be complete */
      });

    // Check for sync statistics
    const statsSection = page
      .locator('[data-testid="sync-stats"], [data-testid="statistics"]')
      .first();

    if (await statsSection.isVisible().catch(() => false)) {
      const statsText = await statsSection.textContent();

      // Should not mention auto-fetch
      expect(statsText).not.toMatch(/auto.{0,5}fetch/i);

      // Should show relevant stats
      expect(statsText).toMatch(/article|feed|sync/i);
    }
  });

  test("should persist manual fetch option for articles", async ({ page }) => {
    // Navigate to article list
    await page.waitForSelector('[data-testid="article-list"], article');

    // Find an article without full content indicator
    const partialArticle = page
      .locator('article:not(:has([data-testid="full-content"]))')
      .first();

    if (await partialArticle.isVisible().catch(() => false)) {
      await partialArticle.click();

      // Should show manual fetch option
      const fetchButton = page
        .locator('[data-testid="fetch-content-button"]')
        .first();
      await expect(fetchButton).toBeVisible({ timeout: 5000 });

      // Fetch content manually
      await fetchButton.click();

      // Wait for fetch to complete
      await page.waitForLoadState("networkidle");

      // Go back to article list
      await page.goBack();

      // Click the same article again
      await partialArticle.click();

      // Content should be available (no fetch button or content visible)
      const contentLoaded = await page
        .locator('[data-testid="article-content"]')
        .isVisible()
        .catch(() => false);
      const fetchButtonGone = !(await fetchButton
        .isVisible()
        .catch(() => false));

      expect(contentLoaded || fetchButtonGone).toBe(true);
    }
  });
});

// Helper function to wait for sync completion with detailed monitoring
async function waitForSyncCompletion(
  page: Page,
  timeout: number = SYNC_TIMEOUT
): Promise<{ progress: number; duration: number }> {
  const startTime = Date.now();
  let lastProgress = 0;

  while (Date.now() - startTime < timeout) {
    // Check multiple completion indicators
    const isComplete = await page.evaluate(() => {
      const indicators = [
        document.querySelector('[data-testid="sync-complete"]'),
        document.querySelector(
          '[data-testid="sync-progress"][data-value="100"]'
        ),
        document.querySelector('.sync-status:has-text("Completed")'),
        Array.from(document.querySelectorAll("*")).find((el) =>
          el.textContent?.match(/sync.{0,20}complete/i)
        ),
      ];
      return indicators.some((el) => el !== null && el !== undefined);
    });

    if (isComplete) {
      return {
        progress: 100,
        duration: Date.now() - startTime,
      };
    }

    // Check for progress updates
    const currentProgress = await page.evaluate(() => {
      const progressEl = document.querySelector(
        '[data-testid="sync-progress"]'
      );
      if (progressEl) {
        const value = progressEl.getAttribute("data-value");
        if (value) return parseInt(value);
        const text = progressEl.textContent || "";
        const match = text.match(/(\d+)%?/);
        if (match) return parseInt(match[1]);
      }
      return 0;
    });

    if (currentProgress > lastProgress) {
      lastProgress = currentProgress;

      // Verify not stuck at 92%
      if (currentProgress === 92) {
        // Wait a bit to see if it progresses
        await page.waitForTimeout(3000);
        const nextProgress = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="sync-progress"]');
          const text = el?.textContent || "";
          const match = text.match(/(\d+)%?/);
          return match ? parseInt(match[1]) : 0;
        });

        if (nextProgress === 92) {
          throw new Error("Sync stuck at 92% - auto-fetch hang detected");
        }
      }
    }

    await page.waitForTimeout(POLL_INTERVAL);
  }

  throw new Error(`Sync did not complete within ${timeout}ms`);
}
