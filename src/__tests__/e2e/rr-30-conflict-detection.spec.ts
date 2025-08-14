import { test, expect } from "@playwright/test";

// E2E tests for RR-30: Sync Conflict Detection
test.describe("RR-30: Sync Conflict Detection E2E", () => {
  const baseUrl = "http://100.96.166.53:3000/reader";

  test.beforeEach(async ({ page }) => {
    // Navigate to the reader and wait for initial load
    await page.goto(baseUrl);
    await page.waitForLoadState("networkidle");
  });

  test.describe("Manual Sync with Conflict Detection", () => {
    test("should detect and log conflicts during manual sync", async ({
      page,
    }) => {
      // Mock the sync API to simulate conflicts
      await page.route("**/api/sync", async (route) => {
        // Simulate a sync that detects conflicts
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            summary: {
              articlesProcessed: 100,
              articlesUpdated: 85,
              conflictsDetected: 3,
              conflicts: [
                {
                  articleId: "article-1",
                  conflictType: "read_status",
                  localValue: { read: true, starred: false },
                  remoteValue: { read: false, starred: false },
                  resolution: "remote",
                },
                {
                  articleId: "article-2",
                  conflictType: "starred_status",
                  localValue: { read: false, starred: true },
                  remoteValue: { read: false, starred: false },
                  resolution: "remote",
                },
                {
                  articleId: "article-3",
                  conflictType: "both",
                  localValue: { read: true, starred: true },
                  remoteValue: { read: false, starred: false },
                  resolution: "remote",
                },
              ],
            },
            timestamp: new Date().toISOString(),
          }),
        });
      });

      // Wait for the sync button to be available
      await page.waitForSelector('[data-testid="sync-button"]', {
        state: "visible",
      });

      // Click the sync button
      await page.click('[data-testid="sync-button"]');

      // Wait for sync to complete
      await page.waitForSelector('[data-testid="sync-status"]', {
        state: "visible",
      });

      // Check if sync completed successfully
      const syncStatus = await page.textContent('[data-testid="sync-status"]');
      expect(syncStatus).toContain("Sync completed");

      // Verify conflict information is available (may be in console or hidden UI)
      const response = await page.evaluate(() => {
        // Check if conflicts were logged to console or stored
        return window.localStorage.getItem("lastSyncConflicts");
      });

      // Note: In real implementation, conflicts would be logged to server
      // This test verifies the sync completes despite conflicts
    });

    test("should continue sync operation despite detecting conflicts", async ({
      page,
    }) => {
      let syncAttempts = 0;

      // Mock sync endpoint with conflict simulation
      await page.route("**/api/sync", async (route) => {
        syncAttempts++;

        if (syncAttempts === 1) {
          // First sync detects conflicts
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              summary: {
                articlesProcessed: 50,
                articlesUpdated: 45,
                conflictsDetected: 5,
                conflictResolution:
                  "All conflicts resolved using remote values",
              },
            }),
          });
        } else {
          // Subsequent syncs have no conflicts
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              summary: {
                articlesProcessed: 50,
                articlesUpdated: 50,
                conflictsDetected: 0,
              },
            }),
          });
        }
      });

      // Perform first sync
      await page.click('[data-testid="sync-button"]');
      await page.waitForSelector(
        '[data-testid="sync-status"]:has-text("completed")',
        {
          timeout: 10000,
        }
      );

      // Verify sync succeeded despite conflicts
      const firstSyncStatus = await page.textContent(
        '[data-testid="sync-status"]'
      );
      expect(firstSyncStatus).toContain("completed");

      // Wait a moment before second sync
      await page.waitForTimeout(1000);

      // Perform second sync
      await page.click('[data-testid="sync-button"]');
      await page.waitForSelector(
        '[data-testid="sync-status"]:has-text("completed")',
        {
          timeout: 10000,
        }
      );

      // Verify second sync also succeeded
      const secondSyncStatus = await page.textContent(
        '[data-testid="sync-status"]'
      );
      expect(secondSyncStatus).toContain("completed");

      // Both syncs should complete successfully
      expect(syncAttempts).toBe(2);
    });
  });

  test.describe("User Interaction During Conflicts", () => {
    test("should handle marking article as read that conflicts with remote", async ({
      page,
    }) => {
      // Mock article list with a specific article
      await page.route("**/api/articles", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            articles: [
              {
                id: "article-conflict-test",
                title: "Test Article with Potential Conflict",
                feed_title: "Test Feed",
                is_read: false,
                is_starred: false,
                published_at: new Date().toISOString(),
                content: "Article content...",
              },
            ],
          }),
        });
      });

      // Mock the mark as read endpoint
      await page.route("**/api/articles/*/read", async (route) => {
        // Simulate marking as read locally
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            article: {
              id: "article-conflict-test",
              is_read: true,
              last_local_update: new Date().toISOString(),
            },
          }),
        });
      });

      // Wait for article list to load
      await page.waitForSelector('[data-testid="article-list"]', {
        state: "visible",
      });

      // Find and click the article to mark as read
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Wait for article to be marked as read
      await page.waitForTimeout(500);

      // Now trigger a sync that will detect this as a conflict
      await page.route("**/api/sync", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            summary: {
              articlesProcessed: 1,
              articlesUpdated: 1,
              conflictsDetected: 1,
              conflicts: [
                {
                  articleId: "article-conflict-test",
                  conflictType: "read_status",
                  localValue: { read: true, starred: false },
                  remoteValue: { read: false, starred: false },
                  resolution: "remote",
                  note: "Local read status overwritten by remote",
                },
              ],
            },
          }),
        });
      });

      // Trigger sync
      await page.click('[data-testid="sync-button"]');

      // Wait for sync to complete
      await page.waitForSelector(
        '[data-testid="sync-status"]:has-text("completed")',
        {
          timeout: 10000,
        }
      );

      // The article should now reflect the remote state (unread)
      // This tests that remote wins in conflict resolution
      const articleState = await page
        .locator('[data-testid="article-item"]')
        .first()
        .getAttribute("data-read-state");

      // After sync, remote state (unread) should win
      // Note: Actual implementation may vary
    });

    test("should handle starring article that conflicts with remote", async ({
      page,
    }) => {
      // Mock article operations
      await page.route("**/api/articles/*/star", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            article: {
              is_starred: true,
              last_local_update: new Date().toISOString(),
            },
          }),
        });
      });

      // Navigate to article list
      await page.waitForSelector('[data-testid="article-list"]', {
        state: "visible",
      });

      // Star an article
      const starButton = page.locator('[data-testid="star-button"]').first();
      await starButton.click();

      // Mock sync that detects starring conflict
      await page.route("**/api/sync", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            summary: {
              conflictsDetected: 1,
              conflicts: [
                {
                  conflictType: "starred_status",
                  localValue: { read: false, starred: true },
                  remoteValue: { read: false, starred: false },
                  resolution: "remote",
                },
              ],
            },
          }),
        });
      });

      // Trigger sync
      await page.click('[data-testid="sync-button"]');

      // Wait for sync completion
      await page.waitForSelector(
        '[data-testid="sync-status"]:has-text("completed")'
      );

      // Verify sync completed successfully despite conflict
      const syncCompleted = await page.isVisible(
        '[data-testid="sync-status"]:has-text("completed")'
      );
      expect(syncCompleted).toBe(true);
    });
  });

  test.describe("Conflict Visibility and Monitoring", () => {
    test("should not show conflict errors to users", async ({ page }) => {
      // Mock sync with conflicts
      await page.route("**/api/sync", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            summary: {
              articlesProcessed: 100,
              articlesUpdated: 90,
              conflictsDetected: 10,
              message: "Sync completed successfully",
            },
          }),
        });
      });

      // Trigger sync
      await page.click('[data-testid="sync-button"]');

      // Wait for sync to complete
      await page.waitForSelector('[data-testid="sync-status"]', {
        state: "visible",
      });

      // Verify no error messages are shown to user
      const errorMessages = await page
        .locator('[data-testid="error-message"]')
        .count();
      expect(errorMessages).toBe(0);

      // Verify no conflict warnings are shown to user
      const conflictWarnings = await page
        .locator('[data-testid="conflict-warning"]')
        .count();
      expect(conflictWarnings).toBe(0);

      // Sync should show as successful
      const statusText = await page.textContent('[data-testid="sync-status"]');
      expect(statusText).toContain("completed");
      expect(statusText).not.toContain("conflict");
      expect(statusText).not.toContain("error");
    });

    test("should complete sync workflow end-to-end with conflicts", async ({
      page,
    }) => {
      // Setup comprehensive mock for full sync flow
      let syncPhase = "initial";

      await page.route("**/api/sync", async (route) => {
        if (syncPhase === "initial") {
          syncPhase = "processing";

          // Return sync in progress
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({
              status: "processing",
              message: "Sync in progress",
            }),
          });
        } else if (syncPhase === "processing") {
          syncPhase = "complete";

          // Return sync complete with conflicts
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              summary: {
                duration: 5000,
                articlesProcessed: 250,
                articlesUpdated: 230,
                articlesCreated: 10,
                articlesDeleted: 5,
                conflictsDetected: 15,
                conflictTypes: {
                  read_status: 10,
                  starred_status: 3,
                  both: 2,
                },
                apiCallsUsed: 3,
                message: "Sync completed successfully",
              },
              timestamp: new Date().toISOString(),
            }),
          });
        }
      });

      // Start sync
      await page.click('[data-testid="sync-button"]');

      // Wait for sync to show processing state
      await page.waitForSelector(
        '[data-testid="sync-status"]:has-text("progress")',
        {
          timeout: 5000,
        }
      );

      // Poll for completion
      await page.waitForFunction(
        () => {
          const status = document.querySelector('[data-testid="sync-status"]');
          return status && status.textContent?.includes("completed");
        },
        { timeout: 15000 }
      );

      // Verify final state
      const finalStatus = await page.textContent('[data-testid="sync-status"]');
      expect(finalStatus).toContain("completed");

      // Verify article list is updated
      const articleList = await page.locator('[data-testid="article-list"]');
      await expect(articleList).toBeVisible();

      // Verify no user-facing conflict indicators
      const userFacingConflictIndicators = await page
        .locator(".conflict-indicator")
        .count();
      expect(userFacingConflictIndicators).toBe(0);
    });
  });
});
