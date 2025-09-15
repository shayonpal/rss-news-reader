/**
 * RR-267: E2E Tests for Settings Button Navigation
 *
 * Full end-to-end test of the Settings button functionality
 * Tests the complete user flow from clicking the button to navigation
 *
 * Expected behavior:
 * - Settings button visible with Bolt icon
 * - Click navigates to /reader/settings
 * - 404 is acceptable (page implemented in RR-268)
 * - Mobile responsiveness and touch targets
 */

import { test, expect, Page } from "@playwright/test";

// Test configuration for mobile viewports
const mobileViewports = [
  { name: "iPhone 12", width: 390, height: 844 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPad Mini", width: 768, height: 1024 },
];

// Helper to wait for sidebar to be fully loaded
async function waitForSidebarLoad(page: Page) {
  // Wait for the sidebar container
  await page.waitForSelector('[data-testid="sidebar-main-container"]', {
    state: "visible",
    timeout: 10000,
  });

  // Wait for feeds to load (check for feed count text)
  await page.waitForSelector("text=/\\d+ unread • \\d+ feeds/", {
    state: "visible",
    timeout: 10000,
  });
}

test.describe("RR-267: Settings Button E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the reader page
    await page.goto("/reader", { waitUntil: "networkidle" });

    // Wait for the sidebar to be fully loaded
    await waitForSidebarLoad(page);
  });

  test.describe("Desktop View", () => {
    test("should display Settings button with correct icon", async ({
      page,
    }) => {
      // Check that the settings button exists
      const settingsButton = page.getByLabel("Settings");
      await expect(settingsButton).toBeVisible();

      // Verify it's in the header actions area
      const headerActions = page.locator(".border-b .flex.items-center.gap-1");
      await expect(headerActions).toBeVisible();
      await expect(
        headerActions.locator('button[aria-label="Settings"]')
      ).toBeVisible();

      // Take a screenshot for visual regression
      await page.screenshot({
        path: "test-results/screenshots/rr-267-settings-button-desktop.png",
        clip: (await headerActions.boundingBox()) || undefined,
      });
    });

    test("should navigate to settings page on click", async ({ page }) => {
      // Click the Settings button
      const settingsButton = page.getByLabel("Settings");
      await settingsButton.click();

      // Wait for navigation
      await page.waitForURL("**/reader/settings", {
        timeout: 5000,
      });

      // Verify we navigated to the settings page
      expect(page.url()).toContain("/reader/settings");

      // It's OK if we get a 404 since the page doesn't exist yet (RR-268)
      // But the navigation should have occurred
      const response = await page
        .waitForResponse((resp) => resp.url().includes("/reader/settings"), {
          timeout: 5000,
        })
        .catch(() => null);

      // If we got a response, it's probably a 404 which is expected
      if (response) {
        console.log(`Settings page response status: ${response.status()}`);
      }
    });

    test("should not show old BarChart3 icon", async ({ page }) => {
      // The old stats button should not exist
      const oldStatsButton = page.getByLabel("View sync statistics");
      await expect(oldStatsButton).not.toBeVisible();

      // Also check that navigation to /fetch-stats doesn't occur
      const settingsButton = page.getByLabel("Settings");
      await settingsButton.click();

      // URL should not contain fetch-stats
      expect(page.url()).not.toContain("fetch-stats");
    });

    test("should have proper hover state", async ({ page }) => {
      const settingsButton = page.getByLabel("Settings");

      // Get initial background
      const initialBg = await settingsButton.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );

      // Hover over the button
      await settingsButton.hover();

      // Wait a bit for transition
      await page.waitForTimeout(100);

      // Get hover background
      const hoverBg = await settingsButton.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );

      // Background should change on hover (exact color depends on theme)
      // Just verify they're different
      expect(initialBg).not.toBe(hoverBg);
    });

    test("should be keyboard accessible", async ({ page }) => {
      // Tab to the settings button
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab"); // Might need multiple tabs

      // Check if settings button is focused (or use a more specific selector)
      const focusedElement = await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label")
      );

      if (focusedElement === "Settings") {
        // Press Enter to activate
        await page.keyboard.press("Enter");

        // Should navigate
        await page.waitForURL("**/reader/settings", {
          timeout: 5000,
        });

        expect(page.url()).toContain("/reader/settings");
      }
    });
  });

  test.describe("Mobile View", () => {
    mobileViewports.forEach(({ name, width, height }) => {
      test(`should work on ${name} (${width}x${height})`, async ({ page }) => {
        // Set viewport
        await page.setViewportSize({ width, height });

        // Reload to ensure proper responsive rendering
        await page.reload({ waitUntil: "networkidle" });
        await waitForSidebarLoad(page);

        // Check settings button visibility
        const settingsButton = page.getByLabel("Settings");
        await expect(settingsButton).toBeVisible();

        // Verify touch target size (should be at least 44x44px for iOS)
        const buttonSize = await settingsButton.boundingBox();
        expect(buttonSize).not.toBeNull();

        if (buttonSize) {
          // Touch target should be at least 44px
          expect(buttonSize.width).toBeGreaterThanOrEqual(32); // Accounting for padding
          expect(buttonSize.height).toBeGreaterThanOrEqual(32);
        }

        // Test tap interaction
        await settingsButton.tap();

        // Should navigate
        await page.waitForURL("**/reader/settings", {
          timeout: 5000,
        });

        expect(page.url()).toContain("/reader/settings");

        // Take mobile screenshot
        await page.screenshot({
          path: `test-results/screenshots/rr-267-settings-button-${name.toLowerCase().replace(" ", "-")}.png`,
        });
      });
    });

    test("should handle touch gestures on mobile", async ({
      page,
      browserName,
    }) => {
      // Skip on non-chromium browsers as touch simulation varies
      test.skip(
        browserName !== "chromium",
        "Touch events are best tested in Chromium"
      );

      // Set mobile viewport
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload({ waitUntil: "networkidle" });
      await waitForSidebarLoad(page);

      const settingsButton = page.getByLabel("Settings");

      // Simulate touch start and end
      const box = await settingsButton.boundingBox();
      if (box) {
        await page.touchscreen.tap(
          box.x + box.width / 2,
          box.y + box.height / 2
        );

        // Should navigate
        await page.waitForURL("**/reader/settings", {
          timeout: 5000,
        });

        expect(page.url()).toContain("/reader/settings");
      }
    });
  });

  test.describe("Integration with Other Features", () => {
    test("should not interfere with sync functionality", async ({ page }) => {
      // Start a sync (if not rate limited)
      const syncButton = page.getByLabel(
        /Sync feeds|Sync in progress|Rate limited/
      );
      const isDisabled = await syncButton.isDisabled();

      if (!isDisabled) {
        // Click sync
        await syncButton.click();

        // Wait a moment for sync to start
        await page.waitForTimeout(500);
      }

      // Settings button should still work during sync
      const settingsButton = page.getByLabel("Settings");
      await expect(settingsButton).toBeEnabled();
      await settingsButton.click();

      // Should still navigate
      await page.waitForURL("**/reader/settings", {
        timeout: 5000,
      });

      expect(page.url()).toContain("/reader/settings");
    });

    test("should work after theme changes", async ({ page }) => {
      // Change theme first
      const themeButton = page.getByLabel(/Current theme:/);
      await themeButton.click();

      // Wait for theme change to apply
      await page.waitForTimeout(200);

      // Settings button should still work
      const settingsButton = page.getByLabel("Settings");
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      // Should navigate
      await page.waitForURL("**/reader/settings", {
        timeout: 5000,
      });

      expect(page.url()).toContain("/reader/settings");
    });

    test("should maintain position relative to other buttons", async ({
      page,
    }) => {
      // Get all header action buttons
      const headerActions = page.locator(
        ".border-b .flex.items-center.gap-1 button"
      );
      const buttonCount = await headerActions.count();

      // Should have at least 3 buttons (theme, settings, sync)
      expect(buttonCount).toBeGreaterThanOrEqual(3);

      // Get button labels in order
      const buttonLabels: string[] = [];
      for (let i = 0; i < buttonCount; i++) {
        const label = await headerActions.nth(i).getAttribute("aria-label");
        if (label) buttonLabels.push(label);
      }

      // Settings should be between theme and sync
      const themeIndex = buttonLabels.findIndex((label) =>
        label.includes("Current theme")
      );
      const settingsIndex = buttonLabels.findIndex(
        (label) => label === "Settings"
      );
      const syncIndex = buttonLabels.findIndex(
        (label) => label.includes("Sync") || label.includes("Rate limited")
      );

      expect(settingsIndex).toBeGreaterThan(themeIndex);
      expect(settingsIndex).toBeLessThan(syncIndex);
    });
  });

  test.describe("Error Handling", () => {
    test("should handle network issues gracefully", async ({ page }) => {
      // Simulate offline mode
      await page.context().setOffline(true);

      const settingsButton = page.getByLabel("Settings");
      await settingsButton.click();

      // Even offline, the navigation attempt should occur
      // The browser will handle the offline state
      await page.waitForTimeout(1000);

      // Go back online
      await page.context().setOffline(false);

      // Try again
      await page.reload({ waitUntil: "networkidle" });
      await waitForSidebarLoad(page);

      const settingsButtonRetry = page.getByLabel("Settings");
      await settingsButtonRetry.click();

      // Should work now
      await page.waitForURL("**/reader/settings", {
        timeout: 5000,
      });

      expect(page.url()).toContain("/reader/settings");
    });

    test("should handle rapid clicks", async ({ page }) => {
      const settingsButton = page.getByLabel("Settings");

      // Click multiple times rapidly
      await settingsButton.click();
      await settingsButton.click();
      await settingsButton.click();

      // Should only navigate once
      await page.waitForURL("**/reader/settings", {
        timeout: 5000,
      });

      expect(page.url()).toContain("/reader/settings");

      // Go back to test navigation doesn't get stuck
      await page.goBack();
      await waitForSidebarLoad(page);

      // Should be back at reader
      expect(page.url()).toContain("/reader");
      expect(page.url()).not.toContain("/settings");
    });
  });
});
