/**
 * RR-179: Mark All Read with iOS Liquid Glass morphing UI for topic-filtered views
 * E2E Tests - Complete User Journey Specification
 *
 * Test Categories:
 * 1. Complete Tag Filtering → Mark All Read Flow
 * 2. iOS PWA Touch Interactions
 * 3. Navigation State Preservation
 * 4. Error Recovery Scenarios
 * 5. Cross-Browser Compatibility
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";

// Test configuration for different devices
const devices = {
  iPhone14: {
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    hasTouch: true,
    isMobile: true,
  },
  iPadPro: {
    viewport: { width: 1024, height: 1366 },
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    hasTouch: true,
    isMobile: true,
  },
  desktop: {
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    hasTouch: false,
    isMobile: false,
  },
};

test.describe("RR-179: Mark All Read Tag Flow E2E", () => {
  const baseURL = "http://100.96.166.53:3000/reader";

  test.beforeEach(async ({ page }) => {
    // Set up authentication and initial state
    await page.goto(baseURL);
    await page.waitForLoadState("networkidle");

    // Ensure we're on the articles page
    await expect(page.locator('[data-testid="article-list"]')).toBeVisible();
  });

  test.describe("Complete Tag Filtering → Mark All Read Flow", () => {
    test("should navigate to tag-filtered view and mark all as read", async ({
      page,
    }) => {
      // Step 1: Navigate to a tag-filtered view
      await page.click('[data-testid="tag-filter-technology"]');
      await page.waitForURL(/.*tag=technology/);

      // Verify filtered articles are shown
      const articles = page.locator('[data-testid="article-item"]');
      const articleCount = await articles.count();
      expect(articleCount).toBeGreaterThan(0);

      // Store article IDs for verification
      const articleIds = await articles.evaluateAll((elements) =>
        elements.map((el) => el.getAttribute("data-article-id"))
      );

      // Step 2: Click Mark All Read button
      const markAllButton = page.locator(
        '[data-testid="mark-all-read-tag-button"]'
      );
      await expect(markAllButton).toBeVisible();
      await expect(markAllButton).toHaveText(/Mark all "Technology" as read/);

      await markAllButton.click();

      // Step 3: Verify confirmation UI appears (liquid glass morph)
      await expect(markAllButton).toHaveAttribute("data-state", "confirming");

      // Verify segmented control animation
      const segmentedControl = page.locator(
        '[data-testid="segmented-control"]'
      );
      await expect(segmentedControl).toBeVisible();
      await expect(segmentedControl).toHaveCSS("opacity", "1");

      // Step 4: Confirm the action
      await page.click('[data-testid="confirm-button"]');

      // Step 5: Verify loading state with animation
      await expect(markAllButton).toHaveAttribute("data-state", "loading");

      // Verify liquid glass animation is smooth
      await page
        .evaluate(() => {
          const button = document.querySelector(
            '[data-testid="mark-all-read-tag-button"]'
          );
          const style = window.getComputedStyle(button!);
          return style.transition.includes("cubic-bezier");
        })
        .then((hasAnimation) => {
          expect(hasAnimation).toBe(true);
        });

      // Step 6: Wait for success
      await expect(markAllButton).toHaveAttribute("data-state", "normal", {
        timeout: 3000,
      });

      // Step 7: Verify toast notification
      const toast = page.locator('[data-testid="toast-success"]');
      await expect(toast).toContainText(
        'All "Technology" articles have been marked as read'
      );

      // Step 8: Verify articles are marked as read
      for (const articleId of articleIds) {
        const article = page.locator(`[data-article-id="${articleId}"]`);
        await expect(article).toHaveAttribute("data-read", "true");
      }

      // Step 9: Verify persistence after page reload
      await page.reload();
      await page.waitForLoadState("networkidle");

      for (const articleId of articleIds) {
        const article = page.locator(`[data-article-id="${articleId}"]`);
        await expect(article).toHaveAttribute("data-read", "true");
      }
    });

    test("should handle multiple tags sequentially", async ({ page }) => {
      const tags = ["technology", "science", "business"];

      for (const tag of tags) {
        // Navigate to tag
        await page.click(`[data-testid="tag-filter-${tag}"]`);
        await page.waitForURL(new RegExp(`tag=${tag}`));

        // Mark all as read
        const markAllButton = page.locator(
          '[data-testid="mark-all-read-tag-button"]'
        );
        await markAllButton.click();
        await page.click('[data-testid="confirm-button"]');

        // Wait for completion
        await expect(markAllButton).toHaveAttribute("data-state", "normal", {
          timeout: 3000,
        });

        // Verify success
        const toast = page.locator('[data-testid="toast-success"]');
        await expect(toast).toContainText(
          `All "${tag}" articles have been marked as read`
        );
      }
    });

    test("should update article count badge after marking", async ({
      page,
    }) => {
      await page.click('[data-testid="tag-filter-technology"]');

      // Get initial count
      const countBadge = page.locator(
        '[data-testid="unread-count-technology"]'
      );
      const initialCount = await countBadge.textContent();
      expect(Number(initialCount)).toBeGreaterThan(0);

      // Mark all as read
      await page.click('[data-testid="mark-all-read-tag-button"]');
      await page.click('[data-testid="confirm-button"]');
      await page.waitForTimeout(2000);

      // Verify count updated to 0
      await expect(countBadge).toHaveText("0");
    });
  });

  test.describe("iOS PWA Touch Interactions", () => {
    test.use(devices.iPhone14);

    test("should handle touch interactions correctly", async ({ page }) => {
      await page.goto(`${baseURL}?tag=technology`);

      // Test touch on Mark All Read button
      const button = page.locator('[data-testid="mark-all-read-tag-button"]');
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44); // iOS minimum touch target
      expect(box?.height).toBeGreaterThanOrEqual(44);

      // Simulate touch
      await button.tap();
      await expect(button).toHaveAttribute("data-state", "confirming");

      // Test touch on segmented control
      const confirmButton = page.locator('[data-testid="confirm-button"]');
      await confirmButton.tap();

      await expect(button).toHaveAttribute("data-state", "loading");
    });

    test("should handle swipe gestures during animation", async ({ page }) => {
      await page.goto(`${baseURL}?tag=technology`);

      const button = page.locator('[data-testid="mark-all-read-tag-button"]');
      await button.tap();

      // Try to swipe while in confirming state
      await page.touchscreen.swipe({
        start: { x: 200, y: 400 },
        end: { x: 100, y: 400 },
        steps: 10,
      });

      // Button should maintain state during swipe
      await expect(button).toHaveAttribute("data-state", "confirming");
    });

    test("should optimize for iOS viewport and safe areas", async ({
      page,
    }) => {
      await page.goto(`${baseURL}?tag=technology`);

      // Check for iOS safe area handling
      const styles = await page.evaluate(() => {
        const button = document.querySelector(
          '[data-testid="mark-all-read-tag-button"]'
        );
        const computed = window.getComputedStyle(button!);
        return {
          paddingBottom: computed.paddingBottom,
          position: computed.position,
        };
      });

      // Should account for iOS safe areas
      expect(styles.paddingBottom).toBeDefined();
    });

    test("should handle iOS PWA standalone mode", async ({ page, context }) => {
      // Simulate PWA standalone mode
      await context.addInitScript(() => {
        Object.defineProperty(window.navigator, "standalone", {
          get() {
            return true;
          },
        });
      });

      await page.goto(`${baseURL}?tag=technology`);

      // Verify PWA-specific styles are applied
      const button = page.locator('[data-testid="mark-all-read-tag-button"]');
      const isPWA = await page.evaluate(() => {
        return (window.navigator as any).standalone === true;
      });

      expect(isPWA).toBe(true);
      await expect(button).toBeVisible();
    });
  });

  test.describe("Navigation State Preservation", () => {
    test("should preserve mark all state during navigation", async ({
      page,
    }) => {
      await page.goto(`${baseURL}?tag=technology`);

      // Start marking process
      await page.click('[data-testid="mark-all-read-tag-button"]');
      await expect(
        page.locator('[data-testid="mark-all-read-tag-button"]')
      ).toHaveAttribute("data-state", "confirming");

      // Navigate away
      await page.click('[data-testid="tag-filter-science"]');
      await page.waitForURL(/.*tag=science/);

      // Navigate back
      await page.goBack();
      await page.waitForURL(/.*tag=technology/);

      // State should be reset (not preserved for UX reasons)
      await expect(
        page.locator('[data-testid="mark-all-read-tag-button"]')
      ).toHaveAttribute("data-state", "normal");
    });

    test("should maintain scroll position after marking", async ({ page }) => {
      await page.goto(`${baseURL}?tag=technology`);

      // Scroll to middle of page
      await page.evaluate(() => window.scrollTo(0, 500));
      const initialScroll = await page.evaluate(() => window.scrollY);

      // Mark all as read
      await page.click('[data-testid="mark-all-read-tag-button"]');
      await page.click('[data-testid="confirm-button"]');
      await page.waitForTimeout(2000);

      // Check scroll position maintained
      const finalScroll = await page.evaluate(() => window.scrollY);
      expect(Math.abs(finalScroll - initialScroll)).toBeLessThan(50); // Allow small variance
    });

    test("should preserve filter state after marking", async ({ page }) => {
      const url = `${baseURL}?tag=technology&sort=oldest&unread=true`;
      await page.goto(url);

      // Mark all as read
      await page.click('[data-testid="mark-all-read-tag-button"]');
      await page.click('[data-testid="confirm-button"]');
      await page.waitForTimeout(2000);

      // URL should maintain all query params
      expect(page.url()).toContain("tag=technology");
      expect(page.url()).toContain("sort=oldest");
      expect(page.url()).toContain("unread=true");
    });
  });

  test.describe("Error Recovery Scenarios", () => {
    test("should handle network failure gracefully", async ({
      page,
      context,
    }) => {
      await page.goto(`${baseURL}?tag=technology`);

      // Start the mark all process
      await page.click('[data-testid="mark-all-read-tag-button"]');

      // Simulate network failure
      await context.setOffline(true);

      // Try to confirm
      await page.click('[data-testid="confirm-button"]');

      // Should show error after timeout
      const toast = page.locator('[data-testid="toast-error"]');
      await expect(toast).toContainText("Failed to mark articles as read", {
        timeout: 5000,
      });

      // Should return to normal state
      await expect(
        page.locator('[data-testid="mark-all-read-tag-button"]')
      ).toHaveAttribute("data-state", "normal");

      // Restore network and retry
      await context.setOffline(false);
      await page.click('[data-testid="mark-all-read-tag-button"]');
      await page.click('[data-testid="confirm-button"]');

      // Should succeed now
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible({
        timeout: 5000,
      });
    });

    test("should handle server errors with retry", async ({ page }) => {
      await page.goto(`${baseURL}?tag=technology`);

      // Mock server error on first attempt
      await page.route("**/api/articles/mark-read", (route, request) => {
        if (request.method() === "POST") {
          // Fail first request
          if (!page.url().includes("retry")) {
            route.fulfill({
              status: 500,
              body: JSON.stringify({ error: "Internal server error" }),
            });
          } else {
            // Succeed on retry
            route.fulfill({
              status: 200,
              body: JSON.stringify({ success: true }),
            });
          }
        }
      });

      // First attempt - should fail
      await page.click('[data-testid="mark-all-read-tag-button"]');
      await page.click('[data-testid="confirm-button"]');
      await expect(page.locator('[data-testid="toast-error"]')).toBeVisible({
        timeout: 5000,
      });

      // Add retry flag to URL for test
      await page.goto(`${baseURL}?tag=technology&retry=true`);

      // Retry - should succeed
      await page.click('[data-testid="mark-all-read-tag-button"]');
      await page.click('[data-testid="confirm-button"]');
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible({
        timeout: 5000,
      });
    });

    test("should handle concurrent operations", async ({ page }) => {
      await page.goto(`${baseURL}?tag=technology`);

      // Start multiple mark operations quickly
      const button = page.locator('[data-testid="mark-all-read-tag-button"]');

      // First operation
      await button.click();
      const confirmButton = page.locator('[data-testid="confirm-button"]');
      await confirmButton.click();

      // Try to start another while first is processing
      await button.click({ force: true });

      // Should be disabled or in loading state
      const state = await button.getAttribute("data-state");
      expect(["loading", "disabled"]).toContain(state);

      // Wait for first to complete
      await expect(button).toHaveAttribute("data-state", "normal", {
        timeout: 5000,
      });
    });
  });

  test.describe("Cross-Browser Compatibility", () => {
    const browsers = ["chromium", "firefox", "webkit"];

    browsers.forEach((browserName) => {
      test(`should work correctly in ${browserName}`, async ({
        page,
        browserName: currentBrowser,
      }) => {
        if (currentBrowser !== browserName) {
          test.skip();
        }

        await page.goto(`${baseURL}?tag=technology`);

        // Test basic flow
        await page.click('[data-testid="mark-all-read-tag-button"]');
        await expect(
          page.locator('[data-testid="segmented-control"]')
        ).toBeVisible();

        await page.click('[data-testid="confirm-button"]');
        await expect(
          page.locator('[data-testid="mark-all-read-tag-button"]')
        ).toHaveAttribute("data-state", "loading");

        // Verify animations work
        const hasTransition = await page.evaluate(() => {
          const button = document.querySelector(
            '[data-testid="mark-all-read-tag-button"]'
          );
          return window.getComputedStyle(button!).transition !== "none";
        });
        expect(hasTransition).toBe(true);

        // Wait for completion
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible(
          { timeout: 5000 }
        );
      });
    });

    test("should handle browser-specific CSS features", async ({
      page,
      browserName,
    }) => {
      await page.goto(`${baseURL}?tag=technology`);

      const button = page.locator('[data-testid="mark-all-read-tag-button"]');

      // Check for vendor prefixes if needed
      const styles = await button.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          transform: computed.transform || (computed as any).webkitTransform,
          transition: computed.transition || (computed as any).webkitTransition,
          backfaceVisibility:
            computed.backfaceVisibility ||
            (computed as any).webkitBackfaceVisibility,
        };
      });

      // All browsers should support these (with or without prefix)
      expect(styles.transform).toBeDefined();
      expect(styles.transition).toBeDefined();
      expect(styles.backfaceVisibility).toBeDefined();
    });
  });

  test.describe("Accessibility", () => {
    test("should be fully keyboard navigable", async ({ page }) => {
      await page.goto(`${baseURL}?tag=technology`);

      // Tab to the button
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab"); // May need multiple tabs

      // Check focus is on button
      const focusedElement = await page.evaluate(() =>
        document.activeElement?.getAttribute("data-testid")
      );
      expect(focusedElement).toBe("mark-all-read-tag-button");

      // Activate with Enter
      await page.keyboard.press("Enter");
      await expect(
        page.locator('[data-testid="segmented-control"]')
      ).toBeVisible();

      // Tab to Cancel
      await page.keyboard.press("Tab");
      await expect(page.locator('[data-testid="cancel-button"]')).toBeFocused();

      // Tab to Confirm
      await page.keyboard.press("Tab");
      await expect(
        page.locator('[data-testid="confirm-button"]')
      ).toBeFocused();

      // Confirm with Enter
      await page.keyboard.press("Enter");
      await expect(
        page.locator('[data-testid="mark-all-read-tag-button"]')
      ).toHaveAttribute("data-state", "loading");
    });

    test("should announce state changes to screen readers", async ({
      page,
    }) => {
      await page.goto(`${baseURL}?tag=technology`);

      const button = page.locator('[data-testid="mark-all-read-tag-button"]');

      // Check ARIA attributes
      await expect(button).toHaveAttribute(
        "aria-label",
        /Mark all .* articles as read/
      );
      await expect(button).toHaveAttribute("aria-busy", "false");

      // Start process
      await button.click();
      await page.click('[data-testid="confirm-button"]');

      // Check loading state announced
      await expect(button).toHaveAttribute("aria-busy", "true");
      await expect(button).toHaveAttribute("aria-live", "polite");

      // Wait for completion
      await expect(button).toHaveAttribute("aria-busy", "false", {
        timeout: 5000,
      });
    });
  });
});
