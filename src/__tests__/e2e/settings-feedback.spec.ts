/**
 * @fileoverview E2E tests for Settings Feedback - RR-288
 * Tests complete user journey for settings with toast notifications and loading states
 * Following TDD approach - tests written before implementation
 */

import { test, expect, Page } from "@playwright/test";

// Helper to wait for toast
async function waitForToast(page: Page, text: string) {
  return page.locator(`[data-sonner-toast]:has-text("${text}")`).waitFor({
    state: "visible",
    timeout: 5000,
  });
}

// Helper to dismiss all toasts
async function dismissAllToasts(page: Page) {
  const toasts = page.locator("[data-sonner-toast]");
  const count = await toasts.count();
  for (let i = 0; i < count; i++) {
    const closeButton = toasts.nth(i).locator("button[aria-label='Close']");
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  }
}

test.describe("Settings Page Feedback - RR-288", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page
    await page.goto("/reader/settings");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Ensure article stats have loaded
    await page.waitForSelector("[data-testid='article-stats']", {
      state: "visible",
      timeout: 10000,
    });
  });

  test.describe("Toast Notifications", () => {
    test("should show success toast after saving preferences", async ({
      page,
    }) => {
      // Make a change to enable save button
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("200");

      // Save button should be enabled
      const saveButton = page.locator('button:has-text("Save")');
      await expect(saveButton).toBeEnabled();

      // Click save
      await saveButton.click();

      // Wait for success toast
      const successToast = await waitForToast(page, "Preferences saved");
      await expect(successToast).toBeVisible();

      // Check toast has correct styling
      await expect(successToast).toHaveClass(/toast-success/);

      // Toast should auto-dismiss after 3 seconds
      await page.waitForTimeout(3500);
      await expect(successToast).not.toBeVisible();
    });

    test("should show error toast with retry action on save failure", async ({
      page,
    }) => {
      // Intercept API call to simulate failure
      await page.route("/reader/api/preferences", (route) => {
        route.fulfill({
          status: 500,
          json: { error: "Internal Server Error" },
        });
      });

      // Make a change
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("200");

      // Click save
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();

      // Wait for error toast
      const errorToast = await waitForToast(
        page,
        "Couldn't save preferences. Please retry."
      );
      await expect(errorToast).toBeVisible();

      // Check toast has correct styling
      await expect(errorToast).toHaveClass(/toast-error/);

      // Check for retry button
      const retryButton = errorToast.locator('button:has-text("Retry")');
      await expect(retryButton).toBeVisible();

      // Remove route intercept for retry
      await page.unroute("/reader/api/preferences");

      // Click retry
      await retryButton.click();

      // Should now show success toast
      const successToast = await waitForToast(page, "Preferences saved");
      await expect(successToast).toBeVisible();
    });

    test("should stack multiple toasts properly", async ({ page }) => {
      // Trigger multiple operations that show toasts

      // First, make a change and save
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("200");

      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();

      // Wait for first toast
      await waitForToast(page, "Preferences saved");

      // Immediately make another change and save
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("300");
      await saveButton.click();

      // Should have multiple toasts visible
      const toasts = page.locator("[data-sonner-toast]");
      const toastCount = await toasts.count();
      expect(toastCount).toBeGreaterThanOrEqual(2);

      // Toasts should stack vertically
      if (toastCount >= 2) {
        const firstToast = toasts.nth(0);
        const secondToast = toasts.nth(1);

        const firstBox = await firstToast.boundingBox();
        const secondBox = await secondToast.boundingBox();

        // Second toast should be below first
        expect(secondBox!.y).toBeGreaterThan(firstBox!.y);
      }
    });
  });

  test.describe("Save Button Loading State", () => {
    test("should show spinner and 'Saving...' text during save", async ({
      page,
    }) => {
      // Intercept API to add delay
      await page.route("/reader/api/preferences", async (route) => {
        await page.waitForTimeout(1000); // Simulate slow save
        route.fulfill({
          status: 200,
          json: { success: true },
        });
      });

      // Make a change
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("200");

      // Click save
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();

      // Button should immediately show loading state
      await expect(saveButton).toHaveText("Saving...");
      await expect(saveButton).toBeDisabled();

      // Check for spinner
      const spinner = saveButton.locator('[data-testid="loader2-icon"]');
      await expect(spinner).toBeVisible();
      await expect(spinner).toHaveClass(/animate-spin/);

      // Wait for save to complete
      await page.waitForTimeout(1100);

      // Button should return to normal state
      await expect(saveButton).toHaveText("Save");
      await expect(saveButton).toBeDisabled(); // Disabled because no changes
    });

    test("should prevent double-clicking during save", async ({ page }) => {
      let saveCount = 0;

      // Intercept API calls to count them
      await page.route("/reader/api/preferences", async (route) => {
        saveCount++;
        await page.waitForTimeout(500);
        route.fulfill({
          status: 200,
          json: { success: true },
        });
      });

      // Make a change
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("200");

      // Double-click save button rapidly
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.dblclick();

      // Wait for operation to complete
      await page.waitForTimeout(1000);

      // Should only have made one API call
      expect(saveCount).toBe(1);
    });
  });

  test.describe("Article Statistics", () => {
    test("should display article statistics with skeleton loading", async ({
      page,
    }) => {
      // Intercept stats API to add delay
      await page.route("/reader/api/articles/stats", async (route) => {
        await page.waitForTimeout(1000); // Simulate loading
        route.fulfill({
          status: 200,
          json: {
            total: 1234,
            unread: 567,
            starred: 89,
          },
        });
      });

      // Navigate to settings (will trigger stats load)
      await page.reload();

      // Should show skeleton loader initially
      const skeleton = page.locator(".animate-pulse");
      await expect(skeleton).toBeVisible();

      // Skeleton should have proper structure
      const skeletonStats = skeleton.locator(".skeleton-stat");
      expect(await skeletonStats.count()).toBe(3);

      // Wait for stats to load
      await page.waitForSelector("text=Total Articles");

      // Stats should be displayed
      await expect(page.locator("text=1,234")).toBeVisible();
      await expect(page.locator("text=567")).toBeVisible();
      await expect(page.locator("text=89")).toBeVisible();

      // Skeleton should be gone
      await expect(skeleton).not.toBeVisible();
    });

    test("should position stats above settings form", async ({ page }) => {
      const statsContainer = page.locator("[data-testid='article-stats']");
      const settingsForm = page.locator("[data-testid='settings-form']");

      // Both should be visible
      await expect(statsContainer).toBeVisible();
      await expect(settingsForm).toBeVisible();

      // Get bounding boxes
      const statsBox = await statsContainer.boundingBox();
      const formBox = await settingsForm.boundingBox();

      // Stats should be above form
      expect(statsBox!.y).toBeLessThan(formBox!.y);
    });
  });

  test.describe("Complete User Journey", () => {
    test("should handle full settings update flow", async ({ page }) => {
      // Step 1: Check initial state
      const statsContainer = page.locator("[data-testid='article-stats']");
      await expect(statsContainer).toBeVisible();

      // Step 2: Update multiple settings
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("250");

      const refreshIntervalSelect = page.locator(
        'select[name="sync.refreshInterval"]'
      );
      await refreshIntervalSelect.selectOption("60");

      const aiModelSelect = page.locator('select[name="ai.model"]');
      await aiModelSelect.selectOption("claude-3-sonnet");

      // Step 3: Save button should be enabled
      const saveButton = page.locator('button:has-text("Save")');
      await expect(saveButton).toBeEnabled();

      // Step 4: Click save
      await saveButton.click();

      // Step 5: Observe loading state
      await expect(saveButton).toHaveText("Saving...");
      const spinner = saveButton.locator('[data-testid="loader2-icon"]');
      await expect(spinner).toBeVisible();

      // Step 6: Wait for success toast
      const successToast = await waitForToast(page, "Preferences saved");
      await expect(successToast).toBeVisible();

      // Step 7: Button should be disabled (no changes)
      await expect(saveButton).toBeDisabled();
      await expect(saveButton).toHaveText("Save");

      // Step 8: Verify settings persisted (reload page)
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Values should be preserved
      await expect(maxArticlesInput).toHaveValue("250");
      await expect(refreshIntervalSelect).toHaveValue("60");
      await expect(aiModelSelect).toHaveValue("claude-3-sonnet");
    });

    test("should handle error recovery flow", async ({ page }) => {
      let attemptCount = 0;

      // Intercept API to fail first attempt
      await page.route("/reader/api/preferences", (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          route.fulfill({
            status: 500,
            json: { error: "Server error" },
          });
        } else {
          route.fulfill({
            status: 200,
            json: { success: true },
          });
        }
      });

      // Make changes
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("300");

      // First save attempt (will fail)
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();

      // Wait for error toast
      const errorToast = await waitForToast(
        page,
        "Couldn't save preferences. Please retry."
      );
      await expect(errorToast).toBeVisible();

      // Click retry in toast
      const retryButton = errorToast.locator('button:has-text("Retry")');
      await retryButton.click();

      // Should show success this time
      const successToast = await waitForToast(page, "Preferences saved");
      await expect(successToast).toBeVisible();

      // Verify attempts
      expect(attemptCount).toBe(2);
    });
  });

  test.describe("Mobile Experience", () => {
    test.use({
      viewport: { width: 375, height: 667 }, // iPhone SE
      isMobile: true,
      hasTouch: true,
    });

    test("should work correctly on mobile devices", async ({ page }) => {
      await page.goto("/reader/settings");

      // Stats should be visible on mobile
      const statsContainer = page.locator("[data-testid='article-stats']");
      await expect(statsContainer).toBeVisible();

      // Form should be mobile-optimized
      const settingsForm = page.locator("[data-testid='settings-form']");
      await expect(settingsForm).toBeVisible();

      // Make a change using touch
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.tap();
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("150");

      // Save button should be full width on mobile
      const saveButton = page.locator('button:has-text("Save")');
      const buttonBox = await saveButton.boundingBox();
      expect(buttonBox!.width).toBeGreaterThan(300); // Nearly full width

      // Touch target should be adequate
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44);

      // Tap save
      await saveButton.tap();

      // Loading state should work on mobile
      await expect(saveButton).toHaveText("Saving...");

      // Toast should appear on mobile
      const successToast = await waitForToast(page, "Preferences saved");
      await expect(successToast).toBeVisible();

      // Toast should be positioned correctly on mobile
      const toastBox = await successToast.boundingBox();
      expect(toastBox!.y).toBeGreaterThan(50); // Not under status bar
    });

    test("should handle rapid taps on mobile", async ({ page }) => {
      await page.goto("/reader/settings");

      let saveCount = 0;
      await page.route("/reader/api/preferences", async (route) => {
        saveCount++;
        route.fulfill({
          status: 200,
          json: { success: true },
        });
      });

      // Make a change
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.tap();
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("175");

      // Rapid taps on save button
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.tap();
      await saveButton.tap();
      await saveButton.tap();

      // Wait for operations
      await page.waitForTimeout(500);

      // Should only process one save
      expect(saveCount).toBe(1);
    });
  });

  test.describe("Accessibility", () => {
    test("should be keyboard navigable", async ({ page }) => {
      // Navigate using keyboard
      await page.keyboard.press("Tab"); // Focus first element

      // Tab through to save button
      let saveButtonFocused = false;
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        const focusedElement = await page.evaluate(
          () => document.activeElement?.textContent
        );
        if (focusedElement?.includes("Save")) {
          saveButtonFocused = true;
          break;
        }
      }

      expect(saveButtonFocused).toBe(true);

      // Make a change first
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.focus();
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("225");

      // Tab to save button and activate with Enter
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.focus();
      await page.keyboard.press("Enter");

      // Should trigger save
      const successToast = await waitForToast(page, "Preferences saved");
      await expect(successToast).toBeVisible();
    });

    test("should announce toast notifications to screen readers", async ({
      page,
    }) => {
      // Make a change
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("275");

      // Save
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();

      // Toast should have ARIA live region
      const toastContainer = page.locator("[data-sonner-toaster]");
      await expect(toastContainer).toHaveAttribute("aria-live", "polite");

      // Individual toast should be announced
      const successToast = await waitForToast(page, "Preferences saved");
      await expect(successToast).toHaveAttribute("role", "status");
    });

    test("should have proper focus management", async ({ page }) => {
      // Make a change
      const maxArticlesInput = page.locator('input[name="sync.maxArticles"]');
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("325");

      // Save
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();

      // Focus should remain on save button
      await expect(saveButton).toBeFocused();

      // When error occurs with retry
      await page.route("/reader/api/preferences", (route) => {
        route.fulfill({
          status: 500,
          json: { error: "Error" },
        });
      });

      // Make another change
      await maxArticlesInput.clear();
      await maxArticlesInput.fill("350");
      await saveButton.click();

      // Error toast with retry
      const errorToast = await waitForToast(
        page,
        "Couldn't save preferences. Please retry."
      );
      const retryButton = errorToast.locator('button:has-text("Retry")');

      // Tab should reach retry button
      await page.keyboard.press("Tab");
      await expect(retryButton).toBeFocused();
    });
  });
});
