import { test, expect, Page } from "@playwright/test";

/**
 * E2E Tests for RR-5: Sync Status Display
 *
 * These tests verify the complete user flow for viewing API usage
 * with zone 1 and zone 2 percentages in the sidebar.
 */

// Test configuration
const APP_URL = process.env.TEST_URL || "http://localhost:3000/reader";
const API_BASE_URL = process.env.API_URL || "http://localhost:3000";

// Helper function to mock API responses
async function mockApiUsageResponse(
  page: Page,
  zone1Usage: number,
  zone2Usage: number
) {
  await page.route("**/api/sync/api-usage", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        zone1: {
          used: zone1Usage,
          limit: 5000,
          percentage: (zone1Usage / 5000) * 100,
        },
        zone2: {
          used: zone2Usage,
          limit: 100,
          percentage: (zone2Usage / 100) * 100,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  });
}

// Helper function to trigger a sync operation
async function triggerSync(page: Page) {
  await page.route("**/api/sync", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Sync started",
          syncId: "test-sync-id",
        }),
      });
    }
  });
}

test.describe("RR-5: Sync Status Display - E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");
  });

  test.describe("Sidebar API Usage Display", () => {
    test("should display API usage with zone percentages on page load", async ({
      page,
    }) => {
      // Mock API usage response
      await mockApiUsageResponse(page, 234, 87);

      // Reload to trigger API call
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Look for API usage in sidebar
      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Wait for API usage to appear
      await expect(sidebar.locator("text=/API Usage/i")).toBeVisible({
        timeout: 10000,
      });

      // Verify zone 1 percentage
      await expect(sidebar.locator("text=/4\\.7?%.*zone 1/i")).toBeVisible();

      // Verify zone 2 percentage
      await expect(sidebar.locator("text=/87\\.0?%.*zone 2/i")).toBeVisible();

      // Verify separator
      await expect(sidebar.locator("text=|")).toBeVisible();
    });

    test("should show green color for low usage", async ({ page }) => {
      // Mock low usage
      await mockApiUsageResponse(page, 500, 20);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Check for green color class on zone 1 (10% usage)
      const zone1Element = sidebar.locator("text=/10\\.0?%.*zone 1/i");
      await expect(zone1Element).toBeVisible();
      await expect(zone1Element).toHaveClass(/text-green-500/);

      // Check for green color class on zone 2 (20% usage)
      const zone2Element = sidebar.locator("text=/20\\.0?%.*zone 2/i");
      await expect(zone2Element).toBeVisible();
      await expect(zone2Element).toHaveClass(/text-green-500/);
    });

    test("should show yellow color for medium usage", async ({ page }) => {
      // Mock medium usage (80-94%)
      await mockApiUsageResponse(page, 4000, 87);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Check for yellow color class on zone 1 (80% usage)
      const zone1Element = sidebar.locator("text=/80\\.0?%.*zone 1/i");
      await expect(zone1Element).toBeVisible();
      await expect(zone1Element).toHaveClass(/text-yellow-500/);

      // Check for yellow color class on zone 2 (87% usage)
      const zone2Element = sidebar.locator("text=/87\\.0?%.*zone 2/i");
      await expect(zone2Element).toBeVisible();
      await expect(zone2Element).toHaveClass(/text-yellow-500/);
    });

    test("should show red color for high usage", async ({ page }) => {
      // Mock high usage (95%+)
      await mockApiUsageResponse(page, 4750, 99);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Check for red color class on zone 1 (95% usage)
      const zone1Element = sidebar.locator("text=/95\\.0?%.*zone 1/i");
      await expect(zone1Element).toBeVisible();
      await expect(zone1Element).toHaveClass(/text-red-500/);

      // Check for red color class on zone 2 (99% usage)
      const zone2Element = sidebar.locator("text=/99\\.0?%.*zone 2/i");
      await expect(zone2Element).toBeVisible();
      await expect(zone2Element).toHaveClass(/text-red-500/);
    });
  });

  test.describe("Sync Flow with Usage Updates", () => {
    test("should update API usage after manual sync", async ({ page }) => {
      // Initial low usage
      await mockApiUsageResponse(page, 100, 10);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Verify initial usage
      await expect(sidebar.locator("text=/2\\.0?%.*zone 1/i")).toBeVisible();
      await expect(sidebar.locator("text=/10\\.0?%.*zone 2/i")).toBeVisible();

      // Setup sync trigger
      await triggerSync(page);

      // Mock updated usage after sync
      await mockApiUsageResponse(page, 200, 20);

      // Find and click sync button
      const syncButton = page.locator(
        '[data-testid="sync-button"], button:has-text("Sync")'
      );
      await syncButton.click();

      // Wait for sync to complete
      await page.waitForTimeout(1000);

      // Verify updated usage
      await expect(sidebar.locator("text=/4\\.0?%.*zone 1/i")).toBeVisible();
      await expect(sidebar.locator("text=/20\\.0?%.*zone 2/i")).toBeVisible();
    });

    test("should handle API errors gracefully", async ({ page }) => {
      // Mock API error
      await page.route("**/api/sync/api-usage", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      });

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Should show loading or default state
      const apiUsage = sidebar.locator("text=/API Usage/i");
      await expect(apiUsage).toBeVisible();

      // Should not show error to user
      await expect(sidebar.locator("text=/error/i")).not.toBeVisible();
    });

    test("should display zero usage correctly", async ({ page }) => {
      // Mock zero usage
      await mockApiUsageResponse(page, 0, 0);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Verify zero percentages
      await expect(sidebar.locator("text=/0\\.0?%.*zone 1/i")).toBeVisible();
      await expect(sidebar.locator("text=/0\\.0?%.*zone 2/i")).toBeVisible();

      // Should be green (low usage)
      const zone1Element = sidebar.locator("text=/0\\.0?%.*zone 1/i");
      await expect(zone1Element).toHaveClass(/text-green-500/);
    });

    test("should display maximum usage correctly", async ({ page }) => {
      // Mock 100% usage
      await mockApiUsageResponse(page, 5000, 100);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Verify 100% percentages
      await expect(sidebar.locator("text=/100\\.0?%.*zone 1/i")).toBeVisible();
      await expect(sidebar.locator("text=/100\\.0?%.*zone 2/i")).toBeVisible();

      // Should be red (high usage)
      const zone1Element = sidebar.locator("text=/100\\.0?%.*zone 1/i");
      await expect(zone1Element).toHaveClass(/text-red-500/);
    });
  });

  test.describe("Real-time Updates", () => {
    test("should update display when usage changes without page reload", async ({
      page,
    }) => {
      // Initial usage
      await mockApiUsageResponse(page, 1000, 25);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Verify initial display
      await expect(sidebar.locator("text=/20\\.0?%.*zone 1/i")).toBeVisible();
      await expect(sidebar.locator("text=/25\\.0?%.*zone 2/i")).toBeVisible();

      // Mock updated usage
      await mockApiUsageResponse(page, 2500, 50);

      // Trigger an update (could be via WebSocket, polling, or sync)
      await page.evaluate(() => {
        // Simulate store update
        window.dispatchEvent(
          new CustomEvent("api-usage-update", {
            detail: {
              zone1: { used: 2500, limit: 5000, percentage: 50 },
              zone2: { used: 50, limit: 100, percentage: 50 },
            },
          })
        );
      });

      // Wait for UI update
      await page.waitForTimeout(500);

      // Verify updated display
      await expect(sidebar.locator("text=/50\\.0?%.*zone 1/i")).toBeVisible();
      await expect(sidebar.locator("text=/50\\.0?%.*zone 2/i")).toBeVisible();
    });

    test("should maintain display during network issues", async ({ page }) => {
      // Initial successful load
      await mockApiUsageResponse(page, 1500, 30);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');

      // Verify initial display
      await expect(sidebar.locator("text=/30\\.0?%.*zone 1/i")).toBeVisible();
      await expect(sidebar.locator("text=/30\\.0?%.*zone 2/i")).toBeVisible();

      // Simulate network failure
      await page.route("**/api/sync/api-usage", async (route) => {
        await route.abort("failed");
      });

      // Trigger a refresh attempt
      await page.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });

      await page.waitForTimeout(1000);

      // Display should maintain last known values
      await expect(sidebar.locator("text=/30\\.0?%.*zone 1/i")).toBeVisible();
      await expect(sidebar.locator("text=/30\\.0?%.*zone 2/i")).toBeVisible();
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should display API usage correctly on mobile viewport", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Mock API usage
      await mockApiUsageResponse(page, 234, 87);

      await page.reload();
      await page.waitForLoadState("networkidle");

      // On mobile, sidebar might be in a menu
      const menuButton = page.locator(
        '[data-testid="menu-button"], button[aria-label*="menu"]'
      );
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(300); // Wait for menu animation
      }

      // Look for API usage
      const apiUsage = page.locator("text=/API Usage/i");
      await expect(apiUsage).toBeVisible();

      // Verify both zones are visible
      await expect(page.locator("text=/4\\.7?%.*zone 1/i")).toBeVisible();
      await expect(page.locator("text=/87\\.0?%.*zone 2/i")).toBeVisible();
    });

    test("should handle text wrapping on small screens", async ({ page }) => {
      // Set very small viewport
      await page.setViewportSize({ width: 320, height: 568 });

      // Mock API usage with long percentages
      await mockApiUsageResponse(page, 4999, 99);

      await page.reload();
      await page.waitForLoadState("networkidle");

      // Open menu if needed
      const menuButton = page.locator(
        '[data-testid="menu-button"], button[aria-label*="menu"]'
      );
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(300);
      }

      // Verify text is still readable
      const apiUsage = page.locator("text=/API Usage/i");
      await expect(apiUsage).toBeVisible();

      // Check that percentages don't overflow
      const zone1 = page.locator("text=/99\\.98%.*zone 1/i");
      const zone2 = page.locator("text=/99\\.0?%.*zone 2/i");

      await expect(zone1).toBeVisible();
      await expect(zone2).toBeVisible();

      // Verify no horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });
      expect(hasHorizontalScroll).toBe(false);
    });
  });
});
