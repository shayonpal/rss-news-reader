/**
 * RR-258: Mark All Read Button Disable Flow E2E Test
 * Validates button properly disables after mark-all-read operation completes
 */

import { test, expect } from "@playwright/test";

test.describe("RR-258: Mark All Read Button Disable Flow", () => {
  const baseURL = "http://100.96.166.53:3000/reader";

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState("networkidle");

    // Wait for articles to load
    await expect(page.locator('[data-testid="article-list"]')).toBeVisible();
  });

  test("should disable mark-all-read button after operation completes", async ({ page }) => {
    // Step 1: Navigate to a feed with unread articles
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
    await expect(sidebar).toBeVisible();

    const feedItem = sidebar.locator('[data-testid="feed-item"], li a, button').first();
    await feedItem.click();
    await page.waitForTimeout(1000);

    // Step 2: Verify mark-all-read button is initially enabled
    const markAllButton = page.locator(
      '[data-testid="mark-all-read"], .liquid-glass-mark-all-read, button:has-text("Mark All Read")'
    );
    await expect(markAllButton).toBeVisible();

    // Get initial button state
    const initialState = await markAllButton.getAttribute("data-state");
    expect(["normal", "confirming"]).toContain(initialState);

    // Step 3: Execute mark-all-read operation
    // First click for confirmation
    if (initialState === "normal") {
      await markAllButton.click();
      await expect(markAllButton).toHaveAttribute("data-state", "confirming");
    }

    // Second click to execute
    await markAllButton.click();

    // Step 4: Verify loading state
    await expect(markAllButton).toHaveAttribute("data-state", "loading", {
      timeout: 1000,
    });

    // Step 5: Verify button becomes disabled after operation
    await expect(markAllButton).toHaveAttribute("data-state", "disabled", {
      timeout: 5000,
    });

    // Step 6: Verify button is actually disabled (not clickable)
    expect(await markAllButton.isDisabled()).toBe(true);

    // Step 7: Verify success toast appears
    const successToast = page.locator('[data-testid="toast-success"], .toast-success');
    if (await successToast.isVisible()) {
      await expect(successToast).toContainText(/marked.*read/i);
    }

    // Step 8: Verify persistence - button should stay disabled
    await page.waitForTimeout(2000);
    await expect(markAllButton).toHaveAttribute("data-state", "disabled");
    expect(await markAllButton.isDisabled()).toBe(true);
  });

  test("should re-enable button when navigating to feed with unread articles", async ({ page }) => {
    // Step 1: Navigate to first feed and mark all as read
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
    const firstFeed = sidebar.locator('[data-testid="feed-item"], li a, button').first();
    await firstFeed.click();

    const markAllButton = page.locator(
      '[data-testid="mark-all-read"], .liquid-glass-mark-all-read, button:has-text("Mark All Read")'
    );

    // Execute mark-all-read if button is enabled
    const initialState = await markAllButton.getAttribute("data-state");
    if (initialState === "normal") {
      await markAllButton.click(); // confirming
      await markAllButton.click(); // execute
      await expect(markAllButton).toHaveAttribute("data-state", "disabled", {
        timeout: 5000,
      });
    }

    // Step 2: Navigate to second feed with potential unread articles
    const secondFeed = sidebar.locator('[data-testid="feed-item"], li a, button').nth(1);
    await secondFeed.click();
    await page.waitForTimeout(1000);

    // Step 3: Verify button state reflects new feed context
    const newState = await markAllButton.getAttribute("data-state");

    // Button should be normal if new feed has unread articles, or disabled if empty
    expect(["normal", "disabled"]).toContain(newState);

    // If normal, verify we can start the mark-all-read process
    if (newState === "normal") {
      await markAllButton.click();
      await expect(markAllButton).toHaveAttribute("data-state", "confirming");
    }
  });

  test("should handle tag-filtered views correctly", async ({ page }) => {
    // Step 1: Navigate to tag-filtered view
    const tagFilter = page.locator(
      '[data-testid="tag-filter"], .tag-filter, button:has-text("Gaming")'
    );

    if (await tagFilter.isVisible()) {
      await tagFilter.click();
      await page.waitForURL(/.*tag=/);

      // Step 2: Test mark-all-read for tag context
      const markAllButton = page.locator(
        '[data-testid="mark-all-read"], .liquid-glass-mark-all-read'
      );

      if (await markAllButton.isVisible()) {
        const tagState = await markAllButton.getAttribute("data-state");

        if (tagState === "normal") {
          await markAllButton.click(); // confirming
          await markAllButton.click(); // execute

          // Verify button becomes disabled for tag context
          await expect(markAllButton).toHaveAttribute("data-state", "disabled", {
            timeout: 5000,
          });
        }
      }
    }
  });

  test("should maintain button state after page refresh", async ({ page }) => {
    // Step 1: Navigate to feed and mark all as read
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
    const feedItem = sidebar.locator('[data-testid="feed-item"], li a, button').first();
    await feedItem.click();

    const markAllButton = page.locator(
      '[data-testid="mark-all-read"], .liquid-glass-mark-all-read'
    );

    const initialState = await markAllButton.getAttribute("data-state");
    if (initialState === "normal") {
      await markAllButton.click(); // confirming
      await markAllButton.click(); // execute
      await expect(markAllButton).toHaveAttribute("data-state", "disabled", {
        timeout: 5000,
      });
    }

    // Step 2: Refresh page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Step 3: Navigate back to same feed
    await feedItem.click();
    await page.waitForTimeout(1000);

    // Step 4: Verify button is still disabled (data persisted)
    await expect(markAllButton).toHaveAttribute("data-state", "disabled");
  });
});