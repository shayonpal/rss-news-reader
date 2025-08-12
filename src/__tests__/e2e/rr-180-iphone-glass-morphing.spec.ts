import { test, expect, devices } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * RR-180: iPhone PWA Glass Morphing Animation E2E Tests
 *
 * Test Contract:
 * - Touch targets MUST be at least 44x44 pixels (iOS HIG standard)
 * - No gray flash on touch interactions
 * - Smooth 60fps animations on iPhone 14 and newer
 * - Proper safe area handling for notched devices
 * - Morphing animations complete within 300ms
 * - Glass effects render correctly on Safari/WebKit
 */

// Use iPhone 14 device emulation
test.use({
  ...devices["iPhone 14"],
  // Ensure we're testing in standalone PWA mode
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test.describe("RR-180: iPhone Glass Morphing PWA Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to article detail view
    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForLoadState("networkidle");

    // Navigate to an article
    const firstArticle = page.locator('[data-testid="article-item"]').first();
    await firstArticle.tap();
    await page.waitForSelector('[data-testid="article-detail"]');
  });

  test.describe("Touch Target Compliance", () => {
    test("glass buttons should meet 44x44px iOS touch target", async ({
      page,
    }) => {
      // Find all glass buttons
      const glassButtons = page.locator("[data-glass-button]");
      const count = await glassButtons.count();

      for (let i = 0; i < count; i++) {
        const button = glassButtons.nth(i);
        const box = await button.boundingBox();

        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });

    test("dropdown trigger should have proper touch target", async ({
      page,
    }) => {
      const moreButton = page.locator('[data-testid="more-actions-button"]');
      const box = await moreButton.boundingBox();

      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test("toolbar buttons should be easily tappable", async ({ page }) => {
      const toolbarButtons = page.locator("[data-toolbar-button]");
      const count = await toolbarButtons.count();

      for (let i = 0; i < count; i++) {
        const button = toolbarButtons.nth(i);
        const box = await button.boundingBox();

        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);

        // Verify spacing between buttons
        if (i > 0) {
          const prevButton = toolbarButtons.nth(i - 1);
          const prevBox = await prevButton.boundingBox();
          const spacing = box!.left - (prevBox!.left + prevBox!.width);
          expect(spacing).toBeGreaterThanOrEqual(8);
        }
      }
    });
  });

  test.describe("Touch Interaction Quality", () => {
    test("should not show gray flash on tap", async ({ page }) => {
      const button = page.locator("[data-glass-button]").first();

      // Check webkit tap highlight is disabled
      const tapHighlight = await button.evaluate(
        (el) => window.getComputedStyle(el).webkitTapHighlightColor
      );

      expect(tapHighlight).toMatch(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/);

      // Verify no touch callout
      const touchCallout = await button.evaluate(
        (el) => window.getComputedStyle(el).webkitTouchCallout
      );
      expect(touchCallout).toBe("none");
    });

    test("should provide immediate visual feedback", async ({ page }) => {
      const button = page.locator("[data-glass-button]").first();

      // Start monitoring for transform changes
      const scalePromise = button.evaluate((el) => {
        return new Promise((resolve) => {
          const observer = new MutationObserver(() => {
            const transform = window.getComputedStyle(el).transform;
            if (transform.includes("0.96")) {
              observer.disconnect();
              resolve(true);
            }
          });
          observer.observe(el, {
            attributes: true,
            attributeFilter: ["style"],
          });

          // Timeout after 100ms (should be immediate)
          setTimeout(() => {
            observer.disconnect();
            resolve(false);
          }, 100);
        });
      });

      // Perform touch
      await button.dispatchEvent("touchstart");

      // Should scale immediately
      const scaled = await scalePromise;
      expect(scaled).toBe(true);

      await button.dispatchEvent("touchend");
    });

    test("should handle rapid taps without delay", async ({ page }) => {
      const button = page.locator('[data-testid="more-actions-button"]');

      // Perform rapid taps
      const startTime = Date.now();

      for (let i = 0; i < 5; i++) {
        await button.tap();
        await page.waitForTimeout(50); // Small delay between taps
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete quickly without 300ms delays
      expect(totalTime).toBeLessThan(1000); // 5 taps + small delays
    });
  });

  test.describe("Morphing Animation Performance", () => {
    test("dropdown should morph smoothly within 300ms", async ({ page }) => {
      const trigger = page.locator('[data-testid="more-actions-button"]');

      // Start performance measurement
      await page.evaluate(() => {
        performance.mark("animation-start");
      });

      await trigger.tap();

      // Wait for dropdown to appear
      const dropdown = page.locator("[data-morphing-dropdown]");
      await dropdown.waitFor({ state: "visible" });

      // Measure animation completion
      const animationTime = await page.evaluate(() => {
        performance.mark("animation-end");
        performance.measure("animation", "animation-start", "animation-end");
        const measure = performance.getEntriesByName("animation")[0];
        return measure.duration;
      });

      expect(animationTime).toBeLessThanOrEqual(350); // 300ms + small buffer
    });

    test("should maintain 60fps during animation", async ({ page }) => {
      // Enable FPS monitoring
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Overlay.setShowFPSCounter", { show: true });

      const trigger = page.locator('[data-testid="more-actions-button"]');

      // Monitor frame rate during animation
      const frameData = await page.evaluate(async () => {
        const frames: number[] = [];
        let lastTime = performance.now();
        let frameCount = 0;

        const measureFrames = () => {
          const currentTime = performance.now();
          const delta = currentTime - lastTime;

          if (delta > 0) {
            const fps = 1000 / delta;
            frames.push(fps);
          }

          lastTime = currentTime;
          frameCount++;

          if (frameCount < 20) {
            // Measure 20 frames
            requestAnimationFrame(measureFrames);
          }
        };

        requestAnimationFrame(measureFrames);

        // Wait for measurement to complete
        await new Promise((resolve) => setTimeout(resolve, 400));

        return frames;
      });

      await trigger.tap();

      // Check average FPS
      const avgFPS = frameData.reduce((a, b) => a + b, 0) / frameData.length;
      expect(avgFPS).toBeGreaterThanOrEqual(55); // Allow slight dips from 60fps
    });

    test("glass blur effect should render correctly", async ({ page }) => {
      const dropdown = page.locator("[data-morphing-dropdown]");
      const trigger = page.locator('[data-testid="more-actions-button"]');

      await trigger.tap();
      await dropdown.waitFor({ state: "visible" });

      // Verify backdrop filter is applied
      const hasBackdropFilter = await dropdown.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return (
          styles.backdropFilter !== "none" ||
          styles.webkitBackdropFilter !== "none"
        );
      });

      expect(hasBackdropFilter).toBe(true);

      // Check visual rendering
      const blurValue = await dropdown.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const filter = styles.backdropFilter || styles.webkitBackdropFilter;
        const match = filter.match(/blur\((\d+)px\)/);
        return match ? parseInt(match[1]) : 0;
      });

      expect(blurValue).toBe(16);
    });
  });

  test.describe("Safe Area Handling", () => {
    test("should respect safe area insets on notched devices", async ({
      page,
    }) => {
      // Check for safe area padding
      const header = page.locator('[data-testid="article-header"]');

      const paddingTop = await header.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.paddingTop;
      });

      // Should include env(safe-area-inset-top)
      const hasSafeArea = await header.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return (
          styles.paddingTop.includes("env") ||
          styles.paddingTop.includes("constant")
        );
      });

      expect(hasSafeArea).toBe(true);
    });

    test("dropdown should not overlap status bar", async ({ page }) => {
      const trigger = page.locator('[data-testid="more-actions-button"]');
      await trigger.tap();

      const dropdown = page.locator("[data-morphing-dropdown]");
      await dropdown.waitFor({ state: "visible" });

      const box = await dropdown.boundingBox();

      // Should not extend into status bar area (top 44px on iPhone)
      expect(box!.top).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe("Dropdown Interaction", () => {
    test("should close on tap outside", async ({ page }) => {
      const trigger = page.locator('[data-testid="more-actions-button"]');
      await trigger.tap();

      const dropdown = page.locator("[data-morphing-dropdown]");
      await dropdown.waitFor({ state: "visible" });

      // Tap outside
      await page.locator("body").tap({ position: { x: 10, y: 100 } });

      await expect(dropdown).not.toBeVisible();
    });

    test("should handle swipe gestures correctly", async ({ page }) => {
      const trigger = page.locator('[data-testid="more-actions-button"]');
      await trigger.tap();

      const dropdown = page.locator("[data-morphing-dropdown]");
      await dropdown.waitFor({ state: "visible" });

      // Swipe down on dropdown should close it
      const box = await dropdown.boundingBox();
      await page.touchscreen.swipe({
        start: { x: box!.left + box!.width / 2, y: box!.top + 20 },
        end: { x: box!.left + box!.width / 2, y: box!.top + 100 },
        steps: 10,
      });

      await expect(dropdown).not.toBeVisible();
    });

    test("should not show Fetch Stats option", async ({ page }) => {
      const trigger = page.locator('[data-testid="more-actions-button"]');
      await trigger.tap();

      const dropdown = page.locator("[data-morphing-dropdown]");
      await dropdown.waitFor({ state: "visible" });

      // Verify Fetch Stats is not present
      const fetchStatsOption = dropdown.locator('text="Fetch Stats"');
      await expect(fetchStatsOption).not.toBeVisible();

      // Verify expected options are present
      await expect(dropdown.locator('text="AI Summary"')).toBeVisible();
      await expect(dropdown.locator('text="Share"')).toBeVisible();
      await expect(dropdown.locator('text="Archive"')).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("should support VoiceOver navigation", async ({ page }) => {
      // Check ARIA labels
      const moreButton = page.locator('[data-testid="more-actions-button"]');
      const ariaLabel = await moreButton.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();

      await moreButton.tap();

      const dropdown = page.locator("[data-morphing-dropdown]");
      const role = await dropdown.getAttribute("role");
      expect(role).toBe("menu");

      // Check menu items have proper roles
      const menuItems = dropdown.locator('[role="menuitem"]');
      const itemCount = await menuItems.count();
      expect(itemCount).toBeGreaterThan(0);
    });

    test("should handle reduced motion preference", async ({ page }) => {
      // Enable reduced motion
      await page.emulateMedia({ reducedMotion: "reduce" });

      const trigger = page.locator('[data-testid="more-actions-button"]');
      await trigger.tap();

      const dropdown = page.locator("[data-morphing-dropdown]");

      // Animation should be instant or very fast
      const animationDuration = await dropdown.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.animationDuration || styles.transitionDuration;
      });

      expect(animationDuration).toMatch(/0\.01|0s|none/);
    });
  });
});

test.describe("RR-180: Performance Benchmarks", () => {
  test("should meet performance criteria", async ({ page, browser }) => {
    // Create performance observer
    await page.evaluateOnNewDocument(() => {
      window.performanceMetrics = {
        paintTimes: [],
        interactionDelays: [],
        memoryUsage: [],
      };

      // Observe paint timings
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "paint") {
            window.performanceMetrics.paintTimes.push({
              name: entry.name,
              time: entry.startTime,
            });
          }
        }
      });
      paintObserver.observe({ entryTypes: ["paint"] });

      // Track interaction delays
      document.addEventListener(
        "click",
        (e) => {
          const startTime = performance.now();
          requestAnimationFrame(() => {
            const delay = performance.now() - startTime;
            window.performanceMetrics.interactionDelays.push(delay);
          });
        },
        true
      );
    });

    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForLoadState("networkidle");

    // Navigate to article and interact
    const firstArticle = page.locator('[data-testid="article-item"]').first();
    await firstArticle.tap();

    const moreButton = page.locator('[data-testid="more-actions-button"]');
    await moreButton.tap();

    // Collect metrics
    const metrics = await page.evaluate(() => window.performanceMetrics);

    // Verify paint times
    const fcpEntry = metrics.paintTimes.find(
      (p) => p.name === "first-contentful-paint"
    );
    expect(fcpEntry).toBeTruthy();
    expect(fcpEntry!.time).toBeLessThan(1000); // FCP under 1s

    // Verify interaction responsiveness
    const avgDelay =
      metrics.interactionDelays.reduce((a, b) => a + b, 0) /
      metrics.interactionDelays.length;
    expect(avgDelay).toBeLessThan(50); // Under 50ms average

    // Check memory usage
    const memoryInfo = await page.evaluate(() => {
      if ("memory" in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });

    if (memoryInfo) {
      expect(memoryInfo).toBeLessThan(50 * 1024 * 1024); // Under 50MB
    }
  });
});

// Type augmentation for test window object
declare global {
  interface Window {
    performanceMetrics: {
      paintTimes: Array<{ name: string; time: number }>;
      interactionDelays: number[];
      memoryUsage: number[];
    };
  }
}

interface SwipeOptions {
  start: { x: number; y: number };
  end: { x: number; y: number };
  steps: number;
}

declare module "@playwright/test" {
  interface Touchscreen {
    swipe(options: SwipeOptions): Promise<void>;
  }
}
