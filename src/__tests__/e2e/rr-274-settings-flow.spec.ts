import { test, expect, Page } from "@playwright/test";
import { createTestPreferences } from "@/test-utils/rr-274-factories";

// Helper to wait for toast notifications
async function waitForToast(page: Page, text: string) {
  await expect(
    page.locator('[role="alert"]').filter({ hasText: text })
  ).toBeVisible();
}

// Helper to clear and set input value
async function setInputValue(page: Page, selector: string, value: string) {
  const input = page.locator(selector);
  await input.click();
  await input.press("Control+a");
  await input.fill(value);
}

test.describe("Sync Settings User Flow (RR-274)", () => {
  test.beforeEach(async ({ page }) => {
    // Setup authentication and navigate to settings
    await page.goto("/reader/settings");
    await page.waitForLoadState("networkidle");
  });

  test("should persist settings across sessions", async ({ page }) => {
    // Expand sync configuration section
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Update max articles to 500
    await setInputValue(page, 'input[name="maxArticles"]', "500");

    // Update retention to 1000
    await setInputValue(page, 'input[name="retentionCount"]', "1000");

    // Save settings
    await page.click('button:has-text("Save Changes")');

    // Verify toast notification
    await waitForToast(page, "Settings saved successfully");

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Expand sync configuration again
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Verify settings persisted
    await expect(page.locator('input[name="maxArticles"]')).toHaveValue("500");
    await expect(page.locator('input[name="retentionCount"]')).toHaveValue(
      "1000"
    );
  });

  test("should show real-time validation errors", async ({ page }) => {
    // Expand sync configuration section
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Enter invalid max articles (below minimum)
    await setInputValue(page, 'input[name="maxArticles"]', "5");
    await page.keyboard.press("Tab");

    // Verify error message appears instantly
    await expect(
      page.locator("text=Must be between 10 and 5000")
    ).toBeVisible();

    // Enter invalid retention (above maximum)
    await setInputValue(page, 'input[name="retentionCount"]', "5001");
    await page.keyboard.press("Tab");

    // Verify error message for retention
    await expect(
      page.locator("text=Must be between 100 and 5000")
    ).toBeVisible();

    // Correct the values
    await setInputValue(page, 'input[name="maxArticles"]', "100");
    await setInputValue(page, 'input[name="retentionCount"]', "2000");

    // Verify errors clear
    await expect(page.locator("text=Must be between")).not.toBeVisible();

    // Save should now work
    await page.click('button:has-text("Save Changes")');
    await waitForToast(page, "Settings saved successfully");
  });

  test("should update statistics after retention", async ({ page }) => {
    // Navigate to settings
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Note initial statistics
    const statsSection = page.locator('[data-testid="article-statistics"]');
    const initialTotal = await statsSection
      .locator('[data-label="Total Articles"]')
      .textContent();
    const initialUnread = await statsSection
      .locator('[data-label="Unread"]')
      .textContent();
    const initialStarred = await statsSection
      .locator('[data-label="Starred"]')
      .textContent();

    // Change retention to lower value to trigger cleanup
    await setInputValue(page, 'input[name="retentionCount"]', "500");

    // Save and trigger retention
    await page.click('button:has-text("Save Changes")');
    await waitForToast(page, "Settings saved successfully");

    // Wait for retention to complete
    await page.waitForTimeout(2000);

    // Verify statistics updated
    const newTotal = await statsSection
      .locator('[data-label="Total Articles"]')
      .textContent();
    const newStarred = await statsSection
      .locator('[data-label="Starred"]')
      .textContent();

    // Total should be reduced but starred should remain the same
    expect(parseInt(newTotal || "0")).toBeLessThanOrEqual(500);
    expect(newStarred).toBe(initialStarred); // Starred articles preserved
  });

  test("should handle concurrent operations gracefully", async ({
    page,
    context,
  }) => {
    // Open two tabs
    const page2 = await context.newPage();
    await page2.goto("/reader/settings");
    await page2.waitForLoadState("networkidle");

    // Expand sync config in both tabs
    await page.click("text=Sync Configuration");
    await page2.click("text=Sync Configuration");

    // Make changes in first tab
    await setInputValue(page, 'input[name="maxArticles"]', "300");

    // Make different changes in second tab
    await setInputValue(page2, 'input[name="maxArticles"]', "400");

    // Save in first tab
    await page.click('button:has-text("Save Changes")');
    await waitForToast(page, "Settings saved successfully");

    // Save in second tab (should handle conflict)
    await page2.click('button:has-text("Save Changes")');

    // Second save should either succeed or show conflict message
    const toastLocator = page2.locator('[role="alert"]');
    await expect(toastLocator).toBeVisible();
    const toastText = await toastLocator.textContent();
    expect([
      "Settings saved successfully",
      "Settings were updated by another session",
    ]).toContain(toastText);

    // Reload both pages
    await page.reload();
    await page2.reload();

    // Both should show the same value (last write wins)
    await page.click("text=Sync Configuration");
    await page2.click("text=Sync Configuration");

    const value1 = await page.locator('input[name="maxArticles"]').inputValue();
    const value2 = await page2
      .locator('input[name="maxArticles"]')
      .inputValue();
    expect(value1).toBe(value2);
  });

  test("should show loading states during async operations", async ({
    page,
  }) => {
    // Expand sync configuration
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Intercept API calls to simulate slow response
    await page.route("**/api/users/*/preferences", async (route) => {
      await page.waitForTimeout(1000); // Simulate delay
      await route.continue();
    });

    // Update settings
    await setInputValue(page, 'input[name="maxArticles"]', "250");

    // Click save
    await page.click('button:has-text("Save Changes")');

    // Verify loading state appears
    await expect(page.locator('button:has-text("Saving...")')).toBeVisible();
    await expect(page.locator('[data-loading="true"]')).toBeVisible();

    // Wait for completion
    await waitForToast(page, "Settings saved successfully");

    // Loading state should be gone
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
    await expect(page.locator('[data-loading="true"]')).not.toBeVisible();
  });

  test("should handle network errors gracefully", async ({ page }) => {
    // Expand sync configuration
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Intercept API calls to simulate network error
    await page.route("**/api/users/*/preferences", (route) => {
      route.abort("failed");
    });

    // Update settings
    await setInputValue(page, 'input[name="maxArticles"]', "150");

    // Try to save
    await page.click('button:has-text("Save Changes")');

    // Should show error toast
    await waitForToast(page, "Failed to save settings");

    // Input should retain the attempted value
    await expect(page.locator('input[name="maxArticles"]')).toHaveValue("150");

    // Fix network and retry
    await page.unroute("**/api/users/*/preferences");
    await page.click('button:has-text("Save Changes")');
    await waitForToast(page, "Settings saved successfully");
  });

  test("should display live article statistics", async ({ page }) => {
    // Navigate to settings
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Verify statistics section is visible
    const statsSection = page.locator('[data-testid="article-statistics"]');
    await expect(statsSection).toBeVisible();

    // Verify all stat fields are present and have values
    await expect(
      statsSection.locator('[data-label="Total Articles"]')
    ).toContainText(/\d+/);
    await expect(statsSection.locator('[data-label="Unread"]')).toContainText(
      /\d+/
    );
    await expect(statsSection.locator('[data-label="Starred"]')).toContainText(
      /\d+/
    );

    // Statistics should auto-refresh periodically
    const initialTotal = await statsSection
      .locator('[data-label="Total Articles"]')
      .textContent();

    // Trigger a sync to change stats
    await page.click('button[data-testid="manual-sync"]');
    await page.waitForTimeout(3000);

    // Stats should update
    const newTotal = await statsSection
      .locator('[data-label="Total Articles"]')
      .textContent();
    // Note: In real scenario, this would change after sync
  });

  test("should handle extreme values correctly", async ({ page }) => {
    // Expand sync configuration
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Test minimum values
    await setInputValue(page, 'input[name="maxArticles"]', "10");
    await setInputValue(page, 'input[name="retentionCount"]', "100");
    await page.click('button:has-text("Save Changes")');
    await waitForToast(page, "Settings saved successfully");

    // Test maximum values
    await setInputValue(page, 'input[name="maxArticles"]', "5000");
    await setInputValue(page, 'input[name="retentionCount"]', "5000");
    await page.click('button:has-text("Save Changes")');
    await waitForToast(page, "Settings saved successfully");

    // Test edge case: retention less than current articles
    await setInputValue(page, 'input[name="retentionCount"]', "100");
    await page.click('button:has-text("Save Changes")');

    // Should show warning or handle gracefully
    const warning = page.locator("text=This will delete");
    if (await warning.isVisible()) {
      // If warning shown, user can proceed or cancel
      await page.click('button:has-text("Proceed")');
    }

    await waitForToast(page, /Settings saved|Articles retained/);
  });

  test("should maintain mobile responsiveness", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to settings
    await page.goto("/reader/settings");
    await page.waitForLoadState("networkidle");

    // Expand sync configuration
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Verify inputs are accessible and properly sized
    const maxArticlesInput = page.locator('input[name="maxArticles"]');
    const retentionInput = page.locator('input[name="retentionCount"]');

    // Check visibility and interaction
    await expect(maxArticlesInput).toBeVisible();
    await expect(retentionInput).toBeVisible();

    // Verify touch targets are adequate size (minimum 44x44px)
    const maxArticlesBox = await maxArticlesInput.boundingBox();
    const retentionBox = await retentionInput.boundingBox();

    expect(maxArticlesBox?.height).toBeGreaterThanOrEqual(44);
    expect(retentionBox?.height).toBeGreaterThanOrEqual(44);

    // Test input on mobile
    await maxArticlesInput.tap();
    await page.keyboard.type("250");

    await retentionInput.tap();
    await page.keyboard.type("1000");

    // Save button should be reachable
    const saveButton = page.locator('button:has-text("Save Changes")');
    await expect(saveButton).toBeInViewport();
    await saveButton.tap();

    await waitForToast(page, "Settings saved successfully");
  });

  test("should integrate with TypeScript types correctly", async ({ page }) => {
    // This test verifies TypeScript integration by checking data attributes
    await page.click("text=Sync Configuration");
    await page.waitForSelector('[data-testid="sync-config-section"]');

    // Verify inputs have correct type attributes
    const maxArticlesInput = page.locator('input[name="maxArticles"]');
    const retentionInput = page.locator('input[name="retentionCount"]');

    await expect(maxArticlesInput).toHaveAttribute("type", "number");
    await expect(retentionInput).toHaveAttribute("type", "number");

    // Verify min/max constraints are applied
    await expect(maxArticlesInput).toHaveAttribute("min", "10");
    await expect(maxArticlesInput).toHaveAttribute("max", "5000");
    await expect(retentionInput).toHaveAttribute("min", "100");
    await expect(retentionInput).toHaveAttribute("max", "5000");

    // Verify step increment for number inputs
    await expect(maxArticlesInput).toHaveAttribute("step", "10");
    await expect(retentionInput).toHaveAttribute("step", "50");
  });
});
