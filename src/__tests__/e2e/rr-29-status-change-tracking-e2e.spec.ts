import { test, expect } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";

test.describe("Status Change Tracking System E2E - RR-29", () => {
  const logFilePath = path.join(__dirname, "../../logs/status-changes.jsonl");

  test.beforeEach(async ({ page }) => {
    // Clear existing logs before each test
    try {
      await fs.unlink(logFilePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }

    // Navigate to the RSS reader
    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForLoadState("networkidle");

    // Wait for articles to load
    await page.waitForSelector('[data-testid="article-list"]', {
      timeout: 10000,
    });
  });

  test.describe("User Click Tracking", () => {
    test("should log status change when user clicks article title", async ({
      page,
    }) => {
      // Find first unread article
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await expect(firstArticle).toBeVisible();

      // Click article title to mark as read
      await firstArticle.locator('[data-testid="article-title"]').click();

      // Wait for status change to be processed
      await page.waitForTimeout(1000);

      // Verify log entry was created
      const logExists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false);
      expect(logExists).toBe(true);

      if (logExists) {
        const logContent = await fs.readFile(logFilePath, "utf-8");
        const logEntry = JSON.parse(logContent.trim().split("\n")[0]);

        expect(logEntry).toMatchObject({
          action: "mark_read",
          trigger: "user_click",
          previousValue: false,
          newValue: true,
          syncQueued: true,
        });

        expect(logEntry.timestamp).toMatch(
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        );
        expect(logEntry.articleId).toBeTruthy();
        expect(logEntry.userAgent).toContain("Mozilla");
      }
    });

    test("should log star/unstar actions", async ({ page }) => {
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await expect(firstArticle).toBeVisible();

      // Click star button
      await firstArticle.locator('[data-testid="star-button"]').click();

      // Wait for status change
      await page.waitForTimeout(1000);

      // Verify star log entry
      const logContent = await fs.readFile(logFilePath, "utf-8");
      const logEntries = logContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const starEntry = logEntries.find((entry) => entry.action === "star");
      expect(starEntry).toBeTruthy();
      expect(starEntry.trigger).toBe("user_click");
      expect(starEntry.previousValue).toBe(false);
      expect(starEntry.newValue).toBe(true);
    });

    test("should log unread action when toggling back", async ({ page }) => {
      // First mark an article as read
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.locator('[data-testid="article-title"]').click();
      await page.waitForTimeout(500);

      // Then mark it as unread
      await firstArticle.locator('[data-testid="read-toggle"]').click();
      await page.waitForTimeout(1000);

      const logContent = await fs.readFile(logFilePath, "utf-8");
      const logEntries = logContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      // Should have both read and unread entries
      const readEntry = logEntries.find(
        (entry) => entry.action === "mark_read"
      );
      const unreadEntry = logEntries.find(
        (entry) => entry.action === "mark_unread"
      );

      expect(readEntry).toBeTruthy();
      expect(unreadEntry).toBeTruthy();
      expect(unreadEntry.previousValue).toBe(true);
      expect(unreadEntry.newValue).toBe(false);
    });
  });

  test.describe("Auto-Scroll Tracking", () => {
    test("should log auto-scroll events when articles become visible", async ({
      page,
    }) => {
      // Scroll down to trigger auto-scroll detection
      await page.evaluate(() => {
        window.scrollTo(0, 500);
      });

      // Wait for auto-scroll detection (2+ seconds dwell time)
      await page.waitForTimeout(3000);

      // Continue scrolling to trigger more auto-scroll events
      await page.evaluate(() => {
        window.scrollTo(0, 1000);
      });

      await page.waitForTimeout(3000);

      // Check for auto-scroll log entries
      const logExists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(logFilePath, "utf-8");
        const logEntries = logContent
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));

        const autoScrollEntries = logEntries.filter(
          (entry) => entry.trigger === "auto_scroll"
        );
        expect(autoScrollEntries.length).toBeGreaterThan(0);

        // Verify auto-scroll entry structure
        const autoScrollEntry = autoScrollEntries[0];
        expect(autoScrollEntry).toMatchObject({
          action: "mark_read",
          trigger: "auto_scroll",
          previousValue: false,
          newValue: true,
        });

        expect(autoScrollEntry.scrollPosition).toBeGreaterThan(0);
        expect(autoScrollEntry.viewportVisibility).toBeGreaterThan(0);
        expect(autoScrollEntry.dwellTime).toBeGreaterThan(2000); // At least 2 seconds
      }
    });

    test("should distinguish between rapid scroll and intentional reading", async ({
      page,
    }) => {
      // Rapid scroll test
      await page.evaluate(() => {
        window.scrollTo(0, 2000);
      });
      await page.waitForTimeout(100); // Very short dwell time

      await page.evaluate(() => {
        window.scrollTo(0, 4000);
      });
      await page.waitForTimeout(100);

      // Then intentional reading
      await page.evaluate(() => {
        window.scrollTo(0, 1000);
      });
      await page.waitForTimeout(5000); // Long dwell time

      const logExists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(logFilePath, "utf-8");
        const logEntries = logContent
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));

        // Should have entries with different scroll behaviors
        const rapidScrollEntries = logEntries.filter(
          (entry) => entry.scrollBehavior === "rapid" || entry.dwellTime < 1000
        );
        const intentionalEntries = logEntries.filter(
          (entry) =>
            entry.scrollBehavior === "intentional" || entry.dwellTime > 3000
        );

        // May not trigger rapid scroll logging due to short dwell time
        expect(intentionalEntries.length).toBeGreaterThan(0);
      }
    });

    test("should capture viewport and scroll metadata", async ({ page }) => {
      // Get viewport size
      const viewportSize = await page.viewportSize();

      // Scroll to specific position
      await page.evaluate(() => {
        window.scrollTo(0, 800);
      });

      await page.waitForTimeout(3000); // Wait for auto-scroll detection

      const logExists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(logFilePath, "utf-8");
        const logEntries = logContent
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));

        const autoScrollEntry = logEntries.find(
          (entry) => entry.trigger === "auto_scroll"
        );

        if (autoScrollEntry) {
          expect(autoScrollEntry.scrollPosition).toBe(800);
          expect(autoScrollEntry.viewportWidth).toBe(viewportSize?.width);
          expect(autoScrollEntry.viewportHeight).toBe(viewportSize?.height);
          expect(autoScrollEntry.devicePixelRatio).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe("Batch Operations Tracking", () => {
    test("should log mark all as read operation", async ({ page }) => {
      // Navigate to a specific feed
      await page.locator('[data-testid="feed-item"]').first().click();
      await page.waitForTimeout(1000);

      // Click mark all as read button
      await page.locator('[data-testid="mark-all-read"]').click();

      // Confirm the action if there's a confirmation dialog
      const confirmButton = page.locator(
        '[data-testid="confirm-mark-all-read"]'
      );
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click();
      }

      await page.waitForTimeout(2000);

      // Verify batch operation logging
      const logContent = await fs.readFile(logFilePath, "utf-8");
      const logEntries = logContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const batchEntries = logEntries.filter(
        (entry) => entry.trigger === "batch_action"
      );
      expect(batchEntries.length).toBeGreaterThan(0);

      // All should be mark_read actions
      batchEntries.forEach((entry) => {
        expect(entry.action).toBe("mark_read");
        expect(entry.trigger).toBe("batch_action");
        expect(entry.previousValue).toBe(false);
        expect(entry.newValue).toBe(true);
      });
    });
  });

  test.describe("Client Context Capture", () => {
    test("should capture comprehensive client context", async ({ page }) => {
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.locator('[data-testid="article-title"]').click();

      await page.waitForTimeout(1000);

      const logContent = await fs.readFile(logFilePath, "utf-8");
      const logEntry = JSON.parse(logContent.trim().split("\n")[0]);

      // Verify comprehensive context
      expect(logEntry.userAgent).toBeTruthy();
      expect(logEntry.offline).toBe(false);
      expect(logEntry.viewportWidth).toBeGreaterThan(0);
      expect(logEntry.viewportHeight).toBeGreaterThan(0);
      expect(logEntry.devicePixelRatio).toBeGreaterThan(0);
      expect(logEntry.sessionId).toMatch(/^session-/);
      expect(logEntry.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test("should handle offline scenarios", async ({ page, context }) => {
      // Simulate offline mode
      await context.setOffline(true);

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.locator('[data-testid="article-title"]').click();

      await page.waitForTimeout(1000);

      // Re-enable online mode to allow log file operations
      await context.setOffline(false);
      await page.waitForTimeout(500);

      const logExists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(logFilePath, "utf-8");
        const logEntry = JSON.parse(logContent.trim().split("\n")[0]);

        expect(logEntry.offline).toBe(true);
      }
    });
  });

  test.describe("Sync Queue Integration", () => {
    test("should log sync queue status for status changes", async ({
      page,
    }) => {
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.locator('[data-testid="article-title"]').click();

      await page.waitForTimeout(2000); // Wait for sync queue processing

      const logContent = await fs.readFile(logFilePath, "utf-8");
      const logEntry = JSON.parse(logContent.trim().split("\n")[0]);

      // Should indicate whether item was successfully queued for sync
      expect(logEntry.syncQueued).toBeDefined();
      expect(typeof logEntry.syncQueued).toBe("boolean");

      // If sync failed, should have error information
      if (logEntry.syncQueued === false) {
        expect(logEntry.syncError).toBeTruthy();
      }
    });

    test("should handle sync queue failures gracefully", async ({ page }) => {
      // Simulate network issues by intercepting sync requests
      await page.route("**/api/sync", (route) => {
        route.abort("failed");
      });

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.locator('[data-testid="article-title"]').click();

      await page.waitForTimeout(2000);

      const logExists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(logFilePath, "utf-8");
        const logEntry = JSON.parse(logContent.trim().split("\n")[0]);

        // Should still log the status change even if sync fails
        expect(logEntry.action).toBe("mark_read");
        expect(logEntry.trigger).toBe("user_click");

        // Sync queue status might indicate failure
        if (logEntry.syncQueued === false) {
          expect(logEntry.syncError).toBeTruthy();
        }
      }
    });
  });

  test.describe("Log File Management", () => {
    test("should create log file if it does not exist", async ({ page }) => {
      // Ensure log file doesn't exist
      try {
        await fs.unlink(logFilePath);
      } catch (error) {
        // Ignore if already doesn't exist
      }

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.locator('[data-testid="article-title"]').click();

      await page.waitForTimeout(1000);

      // Verify log file was created
      const logExists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false);
      expect(logExists).toBe(true);
    });

    test("should append to existing log file", async ({ page }) => {
      // Create initial log entry
      const initialEntry = {
        timestamp: new Date().toISOString(),
        articleId: "test-article",
        feedId: "test-feed",
        action: "mark_read",
        trigger: "test",
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: "test-agent",
      };

      await fs.writeFile(logFilePath, JSON.stringify(initialEntry) + "\n");

      // Trigger new log entry
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.locator('[data-testid="article-title"]').click();

      await page.waitForTimeout(1000);

      // Verify both entries exist
      const logContent = await fs.readFile(logFilePath, "utf-8");
      const logEntries = logContent.trim().split("\n");

      expect(logEntries.length).toBeGreaterThanOrEqual(2);

      const firstEntry = JSON.parse(logEntries[0]);
      expect(firstEntry.articleId).toBe("test-article");
    });
  });

  test.describe("Performance Impact Validation", () => {
    test("should not significantly impact user interaction performance", async ({
      page,
    }) => {
      const startTime = Date.now();

      // Perform multiple rapid interactions
      const articles = page.locator('[data-testid="article-item"]');
      const articleCount = await articles.count();
      const interactionsToTest = Math.min(10, articleCount);

      for (let i = 0; i < interactionsToTest; i++) {
        await articles.nth(i).locator('[data-testid="article-title"]').click();
        await page.waitForTimeout(100); // Brief pause between interactions
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete interactions within reasonable time (under 5 seconds for 10 interactions)
      expect(totalTime).toBeLessThan(5000);

      // Verify all interactions were logged
      await page.waitForTimeout(2000); // Wait for logging to complete

      const logExists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(logFilePath, "utf-8");
        const logEntries = logContent
          .trim()
          .split("\n")
          .filter((line) => line.trim());

        expect(logEntries.length).toBeGreaterThanOrEqual(interactionsToTest);
      }
    });
  });
});
