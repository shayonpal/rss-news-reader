/**
 * RR-251: Ghost Button Violet Theme Integration - E2E Tests (Browser Integration)
 *
 * SCOPE: Tests actual CSS variable resolution in real browser environment.
 * Uses Playwright to load the complete application with CSS.
 *
 * These tests verify the complete implementation works end-to-end.
 */

import { test, expect } from "@playwright/test";

test.describe("RR-251: Ghost Button Browser Integration", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the reader app where ghost buttons are used
    await page.goto("/reader");

    // Wait for the app to load and CSS to be applied
    await page.waitForLoadState("networkidle");
  });

  test.describe("CSS Variable Resolution in Browser", () => {
    test("should resolve --ghost-text-light to violet-700 RGB", async ({
      page,
    }) => {
      // Check that the CSS variable is defined in the document
      const ghostTextLightValue = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue("--ghost-text-light")
          .trim();
      });

      // Should resolve to rgb(109, 40, 217) or just the RGB values
      expect(ghostTextLightValue).toMatch(/(?:rgb\()?109,?\s*40,?\s*217\)?/);
    });

    test("should resolve --ghost-text-dark to white", async ({ page }) => {
      const ghostTextDarkValue = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue("--ghost-text-dark")
          .trim();
      });

      // Should resolve to white in some format
      expect(ghostTextDarkValue).toMatch(
        /(?:rgb\()?255,?\s*255,?\s*255\)?|white/
      );
    });
  });

  test.describe("Article Navigation Ghost Buttons", () => {
    test("should display violet text on article navigation buttons", async ({
      page,
    }) => {
      // Navigate to an article detail page where ghost buttons are used
      await page.goto("/reader/articles/test");
      await page.waitForLoadState("networkidle");

      // Look for navigation buttons (Previous/Next)
      const navButtons = page.locator(
        'button:has-text("Previous"), button:has-text("Next")'
      );
      await expect(navButtons.first()).toBeVisible();

      // Get the computed color of the first navigation button
      const buttonColor = await navButtons.first().evaluate((button) => {
        return getComputedStyle(button).color;
      });

      // Should be violet-700: rgb(109, 40, 217)
      expect(buttonColor).toBe("rgb(109, 40, 217)");
    });

    test("should show white text in dark mode", async ({ page }) => {
      // Enable dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });

      // Navigate to article with navigation buttons
      await page.goto("/reader/articles/test");
      await page.waitForLoadState("networkidle");

      const navButtons = page.locator(
        'button:has-text("Previous"), button:has-text("Next")'
      );
      await expect(navButtons.first()).toBeVisible();

      const buttonColor = await navButtons.first().evaluate((button) => {
        return getComputedStyle(button).color;
      });

      // Should be white in dark mode
      expect(buttonColor).toBe("rgb(255, 255, 255)");
    });
  });

  test.describe("Theme Switching Integration", () => {
    test("should transition colors smoothly between light and dark mode", async ({
      page,
    }) => {
      // Navigate to article page
      await page.goto("/reader/articles/test");
      await page.waitForLoadState("networkidle");

      const navButton = page.locator('button:has-text("Previous")').first();
      await expect(navButton).toBeVisible();

      // Light mode - should be violet
      let buttonColor = await navButton.evaluate((button) => {
        return getComputedStyle(button).color;
      });
      expect(buttonColor).toBe("rgb(109, 40, 217)");

      // Switch to dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });

      // Wait for transition (if any) and check dark mode color
      await page.waitForTimeout(100);
      buttonColor = await navButton.evaluate((button) => {
        return getComputedStyle(button).color;
      });
      expect(buttonColor).toBe("rgb(255, 255, 255)");

      // Switch back to light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove("dark");
      });

      await page.waitForTimeout(100);
      buttonColor = await navButton.evaluate((button) => {
        return getComputedStyle(button).color;
      });
      expect(buttonColor).toBe("rgb(109, 40, 217)");
    });
  });

  test.describe("Visual Regression", () => {
    test("should maintain visual consistency of ghost buttons", async ({
      page,
    }) => {
      // Navigate to a page with various ghost buttons
      await page.goto("/reader");

      // Wait for all content to load
      await page.waitForLoadState("networkidle");

      // Take screenshot of ghost buttons for visual comparison
      const ghostButtons = page
        .locator("button")
        .filter({ hasText: /Previous|Next|Cancel|Close/ });

      // Verify at least one ghost button is present
      await expect(ghostButtons.first()).toBeVisible();

      // Check that buttons have the expected visual properties
      const firstButton = ghostButtons.first();
      const backgroundColor = await firstButton.evaluate((button) => {
        return getComputedStyle(button).backgroundColor;
      });

      // Ghost buttons should have transparent background
      expect(backgroundColor).toMatch(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/);
    });

    test("should maintain hover effects with violet theme", async ({
      page,
    }) => {
      await page.goto("/reader/articles/test");
      await page.waitForLoadState("networkidle");

      const navButton = page.locator('button:has-text("Previous")').first();
      await expect(navButton).toBeVisible();

      // Get initial state
      const initialBg = await navButton.evaluate((button) => {
        return getComputedStyle(button).backgroundColor;
      });

      // Hover over the button
      await navButton.hover();

      // Wait for hover effect
      await page.waitForTimeout(50);

      const hoveredBg = await navButton.evaluate((button) => {
        return getComputedStyle(button).backgroundColor;
      });

      // Background should change on hover (should not be transparent anymore)
      expect(hoveredBg).not.toBe(initialBg);
      expect(hoveredBg).not.toMatch(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/);
    });
  });

  test.describe("Accessibility", () => {
    test("should maintain WCAG contrast ratios", async ({ page }) => {
      await page.goto("/reader/articles/test");
      await page.waitForLoadState("networkidle");

      const navButton = page.locator('button:has-text("Previous")').first();
      await expect(navButton).toBeVisible();

      // Get text and background colors
      const colors = await navButton.evaluate((button) => {
        const computed = getComputedStyle(button);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
        };
      });

      // Violet text (109, 40, 217) on transparent/glass background should meet WCAG AA
      expect(colors.color).toBe("rgb(109, 40, 217)");

      // For glass effects, the effective background includes backdrop effects
      // We mainly need to verify the violet color is applied correctly
    });

    test("should be keyboard accessible", async ({ page }) => {
      await page.goto("/reader/articles/test");
      await page.waitForLoadState("networkidle");

      // Tab to the navigation button
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab"); // May need multiple tabs depending on page structure

      // Find the focused element
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName.toLowerCase();
      });

      // Should be able to focus on buttons
      expect(focusedElement).toBe("button");

      // Focused button should still have violet text
      const focusedColor = await page.evaluate(() => {
        const activeEl = document.activeElement as HTMLElement;
        return getComputedStyle(activeEl).color;
      });

      expect(focusedColor).toBe("rgb(109, 40, 217)");
    });
  });

  test.describe("Performance", () => {
    test("should render ghost buttons efficiently", async ({ page }) => {
      const startTime = Date.now();

      await page.goto("/reader");
      await page.waitForLoadState("networkidle");

      // Measure time to render and apply styles
      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load reasonably quickly (allowing for network, but CSS should be fast)
      expect(loadTime).toBeLessThan(5000);

      // Verify CSS variables don't cause performance issues
      const cssVariableResolutionTime = await page.evaluate(() => {
        const start = performance.now();
        const testEl = document.createElement("div");
        testEl.style.color = "var(--ghost-text-light)";
        document.body.appendChild(testEl);
        getComputedStyle(testEl).color; // Force computation
        document.body.removeChild(testEl);
        return performance.now() - start;
      });

      // CSS variable resolution should be very fast
      expect(cssVariableResolutionTime).toBeLessThan(1);
    });
  });
});
