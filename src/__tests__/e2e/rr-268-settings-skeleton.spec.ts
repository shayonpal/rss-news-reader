/**
 * RR-268: E2E Tests for Settings Page Skeleton Layout
 *
 * Test Requirements:
 * 1. Full navigation flow from reader to settings
 * 2. Page loads without errors
 * 3. All sections render correctly
 * 4. Mobile and tablet viewports
 * 5. Back navigation works
 * 6. No console errors or warnings
 * 7. Performance benchmarks
 *
 * TDD Approach: These tests should FAIL initially and PASS after implementation
 */

import { test, expect, Page } from "@playwright/test";

// Helper to check for console errors
async function checkNoConsoleErrors(page: Page) {
  const messages: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      messages.push(msg.text());
    }
  });

  return messages;
}

test.describe("RR-268: Settings Page E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Start from the main reader page
    await page.goto("http://100.96.166.53:3000/reader");

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");
  });

  test.describe("Navigation Flow", () => {
    test("should navigate to settings page from sidebar", async ({ page }) => {
      // Find and click the settings button (Bolt icon)
      const settingsButton = page.getByLabel("Settings");
      await expect(settingsButton).toBeVisible();

      // Click settings button
      await settingsButton.click();

      // Should navigate to settings page
      await page.waitForURL("**/reader/settings");
      expect(page.url()).toContain("/reader/settings");

      // Settings page should load
      await expect(
        page.getByRole("heading", { level: 1, name: "Settings" })
      ).toBeVisible();
    });

    test("should navigate back from settings to reader", async ({ page }) => {
      // Navigate to settings first
      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");

      // Find and click back button
      const backButton = page.getByRole("button", { name: /back|go back/i });
      await expect(backButton).toBeVisible();

      await backButton.click();

      // Should navigate back to reader
      await page.waitForURL("**/reader");
      expect(page.url()).toContain("/reader");
      expect(page.url()).not.toContain("/settings");
    });

    test("should handle direct URL navigation to settings", async ({
      page,
    }) => {
      // Navigate directly to settings
      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");

      // Page should load correctly
      await expect(
        page.getByRole("heading", { level: 1, name: "Settings" })
      ).toBeVisible();

      // All sections should be present
      await expect(page.getByText("AI Summarization")).toBeVisible();
      await expect(page.getByText("Sync Configuration")).toBeVisible();
    });
  });

  test.describe("Page Structure", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");
    });

    test("should render both implemented sections", async ({ page }) => {
      // Check AI Summarization section
      const aiSection = page
        .locator('[data-testid="collapsible-section"]')
        .filter({ hasText: "AI Summarization" });
      await expect(aiSection).toBeVisible();

      // Check Sync Configuration section
      const syncSection = page
        .locator('[data-testid="collapsible-section"]')
        .filter({ hasText: "Sync Configuration" });
      await expect(syncSection).toBeVisible();
    });

    test("should have correct icons for each section", async ({ page }) => {
      // Bot icon for AI section
      const botIcon = page.locator('[data-testid="bot-icon"]');
      await expect(botIcon).toBeVisible();

      // CloudCheck icon for Sync section
      const cloudIcon = page.locator('[data-testid="cloud-check-icon"]');
      await expect(cloudIcon).toBeVisible();
    });

    test("should have first section expanded by default", async ({ page }) => {
      const sections = page.locator('[data-testid="collapsible-section"]');

      // First section should be expanded
      const firstSection = sections.nth(0);
      const firstHeader = firstSection.locator(".collapsible-header");
      await expect(firstHeader).toHaveAttribute("aria-expanded", "true");

      // Second section should be collapsed
      const secondHeader = sections.nth(1).locator(".collapsible-header");
      await expect(secondHeader).toHaveAttribute("aria-expanded", "false");
    });

    test("should have sticky header", async ({ page }) => {
      const header = page.locator('[data-testid="settings-header"]');
      await expect(header).toHaveCSS("position", "sticky");
      await expect(header).toHaveCSS("top", "0px");
    });
  });

  test.describe("Section Interactions", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");
    });

    test("should expand and collapse sections on click", async ({ page }) => {
      const sections = page.locator('[data-testid="collapsible-section"]');

      // Click to collapse first section
      const firstHeader = sections.nth(0).locator(".collapsible-header");
      await firstHeader.click();
      await expect(firstHeader).toHaveAttribute("aria-expanded", "false");

      // Click to expand second section
      const secondHeader = sections.nth(1).locator(".collapsible-header");
      await secondHeader.click();
      await expect(secondHeader).toHaveAttribute("aria-expanded", "true");

      // Verify content visibility
      const secondContent = sections.nth(1).locator(".collapsible-content");
      await expect(secondContent).toBeVisible();
    });

    test("should maintain independent section states", async ({ page }) => {
      const sections = page.locator('[data-testid="collapsible-section"]');

      // Expand all sections
      for (let i = 0; i < 2; i++) {
        const header = sections.nth(i).locator(".collapsible-header");
        const isExpanded = await header.getAttribute("aria-expanded");

        if (isExpanded === "false") {
          await header.click();
          await expect(header).toHaveAttribute("aria-expanded", "true");
        }
      }

      // All should now be expanded
      for (let i = 0; i < 2; i++) {
        const header = sections.nth(i).locator(".collapsible-header");
        await expect(header).toHaveAttribute("aria-expanded", "true");
      }
    });
  });

  test.describe("Skeleton Loading", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");
    });

    test("should show skeleton placeholders", async ({ page }) => {
      // Check for animate-pulse elements
      const skeletons = page.locator(".animate-pulse");
      const count = await skeletons.count();

      // Should have skeleton elements
      expect(count).toBeGreaterThan(0);

      // Skeletons should be visible
      for (let i = 0; i < Math.min(count, 3); i++) {
        await expect(skeletons.nth(i)).toBeVisible();
      }
    });

    test("should have disabled form elements", async ({ page }) => {
      // All text inputs should be disabled
      const textInputs = page.locator('input[type="text"]');
      const inputCount = await textInputs.count();

      if (inputCount > 0) {
        for (let i = 0; i < inputCount; i++) {
          await expect(textInputs.nth(i)).toBeDisabled();
        }
      }

      // All select elements should be disabled
      const selects = page.locator("select");
      const selectCount = await selects.count();

      if (selectCount > 0) {
        for (let i = 0; i < selectCount; i++) {
          await expect(selects.nth(i)).toBeDisabled();
        }
      }
    });

    test("should apply glass-input styling", async ({ page }) => {
      // Check for glass-input class
      const glassInputs = page.locator(".glass-input");
      const count = await glassInputs.count();

      // Should have glass-input elements
      expect(count).toBeGreaterThan(0);

      // Verify glass effect CSS properties
      if (count > 0) {
        const firstInput = glassInputs.first();

        // Should have border-radius for glass effect
        const borderRadius = await firstInput.evaluate(
          (el) => window.getComputedStyle(el).borderRadius
        );
        expect(borderRadius).not.toBe("0px");
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile viewport (375px)", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");

      // Header should be visible
      await expect(
        page.getByRole("heading", { level: 1, name: "Settings" })
      ).toBeVisible();

      // All sections should be visible
      await expect(page.getByText("AI Summarization")).toBeVisible();
      await expect(page.getByText("Sync Configuration")).toBeVisible();

      // Back button should be accessible
      const backButton = page.getByRole("button", { name: /back|go back/i });
      await expect(backButton).toBeVisible();

      // Touch targets should be large enough (minimum 44px)
      const buttonSize = await backButton.boundingBox();
      expect(buttonSize?.height).toBeGreaterThanOrEqual(44);
    });

    test("should work on tablet viewport (768px)", async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");

      // Check layout is appropriate for tablet
      const container = page.locator(".container");
      await expect(container).toBeVisible();

      // All sections should be properly sized
      const sections = page.locator('[data-testid="collapsible-section"]');
      const count = await sections.count();
      expect(count).toBe(2);

      // Sections should not be too wide
      const firstSection = sections.first();
      const sectionBox = await firstSection.boundingBox();
      expect(sectionBox?.width).toBeLessThanOrEqual(768);
    });
  });

  test.describe("Performance", () => {
    test("should load page within acceptable time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");

      const loadTime = Date.now() - startTime;

      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test("should have smooth animations", async ({ page }) => {
      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");

      // Measure animation performance
      const animationMetrics = await page.evaluate(() => {
        const animations = document.getAnimations();
        return {
          count: animations.length,
          running: animations.filter((a) => a.playState === "running").length,
        };
      });

      // Should have some animations (skeleton pulse)
      expect(animationMetrics.count).toBeGreaterThan(0);
    });

    test("should not have layout shifts", async ({ page }) => {
      await page.goto("http://100.96.166.53:3000/reader/settings");

      // Wait for initial render
      await page.waitForTimeout(500);

      // Take screenshot of initial state
      const screenshot1 = await page.screenshot();

      // Wait a bit more
      await page.waitForTimeout(1000);

      // Take another screenshot
      const screenshot2 = await page.screenshot();

      // Layout should be stable (screenshots should be similar)
      // This is a basic check - in production, use visual regression tools
      expect(screenshot1.length).toBeCloseTo(screenshot2.length, -2);
    });
  });

  test.describe("Accessibility", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");
    });

    test("should be keyboard navigable", async ({ page }) => {
      // Tab through interactive elements
      await page.keyboard.press("Tab");

      // First tab should focus back button
      const focusedElement = await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label")
      );
      expect(focusedElement).toContain("back");

      // Continue tabbing through sections
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Should be able to activate with Enter
      await page.keyboard.press("Enter");

      // Should trigger section expansion
      const sections = page.locator('[data-testid="collapsible-section"]');
      const expandedCount = await sections
        .locator('[aria-expanded="true"]')
        .count();
      expect(expandedCount).toBeGreaterThan(0);
    });

    test("should have proper ARIA attributes", async ({ page }) => {
      // All interactive elements should have labels
      const buttons = page.locator("button");
      const buttonCount = await buttons.count();

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const hasLabel = await button.evaluate(
          (el) =>
            el.hasAttribute("aria-label") || el.textContent?.trim().length > 0
        );
        expect(hasLabel).toBe(true);
      }

      // Disabled elements should have aria-disabled
      const disabledInputs = page.locator("input[disabled]");
      const disabledCount = await disabledInputs.count();

      if (disabledCount > 0) {
        for (let i = 0; i < disabledCount; i++) {
          await expect(disabledInputs.nth(i)).toHaveAttribute(
            "aria-disabled",
            "true"
          );
        }
      }
    });
  });

  test.describe("Error Handling", () => {
    test("should show no console errors", async ({ page }) => {
      const errors = await checkNoConsoleErrors(page);

      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");

      // Interact with the page
      const sections = page.locator('[data-testid="collapsible-section"]');
      for (let i = 0; i < 2; i++) {
        await sections.nth(i).locator(".collapsible-header").click();
      }

      // Should have no console errors
      expect(errors).toHaveLength(0);
    });

    test("should handle network issues gracefully", async ({ page }) => {
      // Simulate offline mode
      await page.context().setOffline(true);

      await page
        .goto("http://100.96.166.53:3000/reader/settings", {
          waitUntil: "domcontentloaded",
        })
        .catch(() => {}); // Expect navigation to fail

      // Go back online
      await page.context().setOffline(false);

      // Try again
      await page.goto("http://100.96.166.53:3000/reader/settings");
      await page.waitForLoadState("networkidle");

      // Page should load correctly
      await expect(
        page.getByRole("heading", { level: 1, name: "Settings" })
      ).toBeVisible();
    });
  });
});
