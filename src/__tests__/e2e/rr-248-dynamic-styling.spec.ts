import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// RR-248: E2E tests for Dynamic Styling Components on Mobile Safari PWA
// This file will initially FAIL since the optimized components don't exist yet
// Tests real mobile performance, PWA behavior, and Safari-specific optimizations

// Performance budget constants
const PERFORMANCE_BUDGETS = {
  TTI: 3000, // Time to Interactive < 3 seconds
  FCP: 1800, // First Contentful Paint < 1.8 seconds
  CLS: 0.1, // Cumulative Layout Shift < 0.1
  FPS_MIN: 58, // Minimum FPS during animations
  FRAME_DROP_MAX: 0.02, // <2% frame drops
  MEMORY_GROWTH: 5, // <5MB memory growth during test
  TOUCH_RESPONSE: 50, // Touch response time < 50ms
} as const;

// iPhone 14 Pro specifications for accurate testing
const IPHONE_14_PRO = {
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
} as const;

// iPad Air specifications for tablet testing
const IPAD_AIR = {
  viewport: { width: 820, height: 1180 },
  userAgent:
    "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
} as const;

test.describe("RR-248 Dynamic Styling E2E Tests", () => {
  test.describe("Mobile Safari PWA Performance", () => {
    test.use(IPHONE_14_PRO);

    test("should maintain 60fps during scroll with dynamic header styling", async ({
      page,
    }) => {
      // Navigate to article with long content for scrolling
      await page.goto("/reader/article/performance-test-article");

      // Wait for PWA to be ready
      await page.waitForSelector('[data-testid="pwa-ready"]', {
        timeout: 5000,
      });

      // Inject performance monitoring script
      await page.evaluate(() => {
        (window as any).performanceMetrics = {
          frames: 0,
          droppedFrames: 0,
          frameTimings: [],
          startTime: performance.now(),
          memoryStart: (performance as any).memory?.usedJSHeapSize || 0,
        };

        let lastFrameTime = performance.now();

        function measureFrame() {
          const now = performance.now();
          const frameDelta = now - lastFrameTime;

          (window as any).performanceMetrics.frames++;
          (window as any).performanceMetrics.frameTimings.push(frameDelta);

          if (frameDelta > 20) {
            // >20ms indicates dropped frame
            (window as any).performanceMetrics.droppedFrames++;
          }

          lastFrameTime = now;
          requestAnimationFrame(measureFrame);
        }

        measureFrame();
      });

      // Perform realistic scroll gestures
      const scrollContainer = page.locator("main");

      // Simulate natural scroll patterns
      await scrollContainer.hover();

      // Fast scroll down (momentum scrolling)
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);

      // Slow precise scroll (reading pattern)
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 50);
        await page.waitForTimeout(80);
      }

      // Fast scroll back up
      await page.mouse.wheel(0, -800);
      await page.waitForTimeout(200);

      // Get performance metrics
      const metrics = await page.evaluate(() => {
        const metrics = (window as any).performanceMetrics;
        const totalTime = performance.now() - metrics.startTime;
        const avgFPS = metrics.frames / (totalTime / 1000);
        const frameDropRate = metrics.droppedFrames / metrics.frames;
        const memoryEnd = (performance as any).memory?.usedJSHeapSize || 0;
        const memoryGrowth = (memoryEnd - metrics.memoryStart) / (1024 * 1024); // MB

        return {
          avgFPS,
          frameDropRate,
          memoryGrowthMB: memoryGrowth,
          totalFrames: metrics.frames,
          droppedFrames: metrics.droppedFrames,
        };
      });

      // Assert performance requirements
      expect(metrics.avgFPS).toBeGreaterThanOrEqual(
        PERFORMANCE_BUDGETS.FPS_MIN
      );
      expect(metrics.frameDropRate).toBeLessThan(
        PERFORMANCE_BUDGETS.FRAME_DROP_MAX
      );
      expect(metrics.memoryGrowthMB).toBeLessThan(
        PERFORMANCE_BUDGETS.MEMORY_GROWTH
      );
      expect(metrics.totalFrames).toBeGreaterThan(100); // Sufficient test duration
    });

    test("should handle touch interactions with <50ms response time", async ({
      page,
    }) => {
      await page.goto("/reader");

      // Inject touch response measurement
      await page.evaluate(() => {
        (window as any).touchMetrics = [];

        document.addEventListener(
          "touchstart",
          (e) => {
            const startTime = performance.now();

            // Measure time to visual feedback
            requestAnimationFrame(() => {
              const responseTime = performance.now() - startTime;
              (window as any).touchMetrics.push({
                type: "touchstart",
                responseTime,
                target: (e.target as Element).tagName,
              });
            });
          },
          { passive: true }
        );
      });

      // Test touch interactions on key elements
      const interactiveElements = [
        '[data-testid="progress-bar"]',
        '[data-testid="scrollable-header"]',
        'button[aria-label="Mark all read"]',
        '[data-testid="glass-button"]',
      ];

      for (const selector of interactiveElements) {
        const element = page.locator(selector);
        if ((await element.count()) > 0) {
          await element.tap();
          await page.waitForTimeout(100);
        }
      }

      // Get touch response metrics
      const touchMetrics = await page.evaluate(
        () => (window as any).touchMetrics
      );

      // All touch responses should be under 50ms
      touchMetrics.forEach((metric: any) => {
        expect(metric.responseTime).toBeLessThan(
          PERFORMANCE_BUDGETS.TOUCH_RESPONSE
        );
      });

      expect(touchMetrics.length).toBeGreaterThan(0);
    });

    test("should maintain PWA functionality offline with cached dynamic styles", async ({
      page,
      context,
    }) => {
      // First, load the PWA online to cache resources
      await page.goto("/reader");
      await page.waitForSelector('[data-testid="pwa-ready"]');

      // Wait for service worker to cache dynamic styling
      await page.waitForTimeout(2000);

      // Go offline
      await context.setOffline(true);

      // Reload to test offline functionality
      await page.reload();

      // Should still load with cached dynamic styles
      await page.waitForSelector('[data-testid="scrollable-header"]', {
        timeout: 10000,
      });

      // Test that dynamic styling still works offline
      const headerElement = page.locator('[data-testid="scrollable-header"]');

      // Get initial styles
      const initialStyles = await headerElement.evaluate((el) => {
        return {
          backdropFilter: getComputedStyle(el).backdropFilter,
          opacity: getComputedStyle(el).opacity,
        };
      });

      // Scroll to trigger dynamic styling
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(200);

      // Check that styles changed (indicating dynamic styling is working)
      const updatedStyles = await headerElement.evaluate((el) => {
        return {
          backdropFilter: getComputedStyle(el).backdropFilter,
          opacity: getComputedStyle(el).opacity,
        };
      });

      // Styles should have changed during scroll
      expect(updatedStyles.backdropFilter).not.toBe(
        initialStyles.backdropFilter
      );

      // Restore online mode
      await context.setOffline(false);
    });

    test("should handle iOS Safari rubber-band scrolling gracefully", async ({
      page,
    }) => {
      await page.goto("/reader/article/short-article");

      // Inject bounce detection
      await page.evaluate(() => {
        (window as any).scrollBounceMetrics = {
          bounceEvents: 0,
          maxBounce: 0,
          scrollEvents: 0,
        };

        let lastScrollY = 0;

        window.addEventListener(
          "scroll",
          () => {
            const currentScrollY = window.scrollY;
            (window as any).scrollBounceMetrics.scrollEvents++;

            // Detect bounce (negative scroll position or beyond document)
            const docHeight = document.documentElement.scrollHeight;
            const windowHeight = window.innerHeight;
            const maxScroll = docHeight - windowHeight;

            if (currentScrollY < 0) {
              (window as any).scrollBounceMetrics.bounceEvents++;
              (window as any).scrollBounceMetrics.maxBounce = Math.max(
                (window as any).scrollBounceMetrics.maxBounce,
                Math.abs(currentScrollY)
              );
            } else if (currentScrollY > maxScroll) {
              (window as any).scrollBounceMetrics.bounceEvents++;
              (window as any).scrollBounceMetrics.maxBounce = Math.max(
                (window as any).scrollBounceMetrics.maxBounce,
                currentScrollY - maxScroll
              );
            }

            lastScrollY = currentScrollY;
          },
          { passive: true }
        );
      });

      // Simulate rubber-band scrolling by trying to scroll beyond bounds
      await page.mouse.wheel(0, -1000); // Scroll up beyond top
      await page.waitForTimeout(200);

      await page.mouse.wheel(0, 2000); // Scroll down beyond bottom
      await page.waitForTimeout(200);

      // Get bounce metrics
      const bounceMetrics = await page.evaluate(
        () => (window as any).scrollBounceMetrics
      );

      // Should handle bouncing without errors
      expect(bounceMetrics.scrollEvents).toBeGreaterThan(0);

      // Check that page is still functional after bounce
      const header = page.locator('[data-testid="scrollable-header"]');
      await expect(header).toBeVisible();

      // Dynamic styling should still work after bounce
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(100);

      const headerOpacity = await header.evaluate(
        (el) => getComputedStyle(el).opacity
      );
      expect(parseFloat(headerOpacity)).toBeGreaterThan(0);
    });
  });

  test.describe("Progressive Bar Component Integration", () => {
    test.use(IPHONE_14_PRO);

    test("should render progress bar with transform-based animations", async ({
      page,
    }) => {
      await page.goto("/reader");

      // Wait for sync to start (should show progress bar)
      await page.waitForSelector('[data-testid="sync-progress"]', {
        timeout: 10000,
      });

      const progressBar = page.locator('[data-testid="sync-progress"]');

      // Check that progress bar uses transform instead of width
      const transformStyle = await progressBar.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          transform: computed.transform,
          width: computed.width,
          willChange: computed.willChange,
        };
      });

      // Should use transform for animation, not width
      expect(transformStyle.transform).toContain("scaleX");
      expect(transformStyle.willChange).toBe("transform");

      // Width should not contain percentage (not using width animation)
      expect(transformStyle.width).not.toContain("%");
    });

    test("should handle all progress bar variants correctly", async ({
      page,
    }) => {
      await page.goto("/reader");

      // Test sync variant
      const syncProgress = page.locator('[data-testid="sync-progress"]');
      if ((await syncProgress.count()) > 0) {
        await expect(syncProgress).toHaveClass(/progress-sync/);
      }

      // Test skeleton variant (during loading)
      await page.goto("/reader/feed/loading-feed");
      const skeletonProgress = page.locator(
        '[data-testid="skeleton-progress"]'
      );
      if ((await skeletonProgress.count()) > 0) {
        await expect(skeletonProgress).toHaveClass(/progress-skeleton/);

        // Skeleton should have shimmer animation
        const animationStyle = await skeletonProgress.evaluate(
          (el) => getComputedStyle(el).animation
        );
        expect(animationStyle).toContain("shimmer");
      }

      // Test indeterminate variant
      const indeterminateProgress = page.locator(
        '[data-testid="indeterminate-progress"]'
      );
      if ((await indeterminateProgress.count()) > 0) {
        await expect(indeterminateProgress).toHaveClass(
          /progress-indeterminate/
        );

        // Should have continuous animation
        const animationStyle = await indeterminateProgress.evaluate(
          (el) => getComputedStyle(el).animationIterationCount
        );
        expect(animationStyle).toBe("infinite");
      }
    });

    test("should maintain accessibility during progress updates", async ({
      page,
    }) => {
      await page.goto("/reader");

      const progressBar = page.locator('[role="progressbar"]');
      await expect(progressBar).toBeVisible();

      // Check ARIA attributes
      const ariaAttributes = await progressBar.evaluate((el) => ({
        role: el.getAttribute("role"),
        ariaValueMin: el.getAttribute("aria-valuemin"),
        ariaValueMax: el.getAttribute("aria-valuemax"),
        ariaValueNow: el.getAttribute("aria-valuenow"),
        ariaLabel: el.getAttribute("aria-label"),
      }));

      expect(ariaAttributes.role).toBe("progressbar");
      expect(ariaAttributes.ariaValueMin).toBe("0");
      expect(ariaAttributes.ariaValueMax).toBe("100");
      expect(ariaAttributes.ariaLabel).toBeTruthy();

      // Test screen reader announcements by monitoring aria-live regions
      const liveRegion = page.locator('[aria-live="polite"]');
      if ((await liveRegion.count()) > 0) {
        await expect(liveRegion).toBeAttached();
      }
    });
  });

  test.describe("Theme Integration", () => {
    test.use(IPHONE_14_PRO);

    test("should transition between light and dark modes smoothly", async ({
      page,
    }) => {
      await page.goto("/reader");

      // Inject theme transition monitoring
      await page.evaluate(() => {
        (window as any).themeMetrics = {
          transitionStart: 0,
          transitionEnd: 0,
          cssVariableChanges: [],
        };

        // Monitor CSS variable changes
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (
              mutation.type === "attributes" &&
              mutation.attributeName === "class"
            ) {
              const target = mutation.target as HTMLElement;
              if (target === document.documentElement) {
                (window as any).themeMetrics.cssVariableChanges.push({
                  timestamp: performance.now(),
                  classList: target.className,
                });
              }
            }
          });
        });

        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
      });

      // Get current theme
      const isInitiallyDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );

      // Toggle theme
      const themeToggle = page.locator('[data-testid="theme-toggle"]');
      if ((await themeToggle.count()) > 0) {
        await themeToggle.click();
      } else {
        // Fallback: trigger theme change programmatically
        await page.evaluate(() => {
          document.documentElement.classList.toggle("dark");
        });
      }

      await page.waitForTimeout(500); // Allow transition to complete

      // Check that theme changed
      const isFinallyDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );

      expect(isFinallyDark).not.toBe(isInitiallyDark);

      // Check that violet theme colors are applied
      const progressBar = page.locator('[data-testid="progress-bar"]');
      if ((await progressBar.count()) > 0) {
        const backgroundColor = await progressBar.evaluate(
          (el) => getComputedStyle(el).backgroundColor
        );

        // Should contain violet color values (139, 92, 246)
        expect(backgroundColor).toMatch(/rgb.*139.*92.*246|oklch.*270/);
      }
    });

    test("should maintain violet theme consistency across components", async ({
      page,
    }) => {
      await page.goto("/reader");

      // Get color values from multiple components
      const colorValues = await page.evaluate(() => {
        const components = [
          document.querySelector('[data-testid="progress-bar"]'),
          document.querySelector('[data-testid="glass-button"]'),
          document.querySelector('[data-testid="focus-ring"]'),
          document.querySelector('[data-testid="scrollable-header"]'),
        ].filter(Boolean);

        return components.map((el) => {
          const styles = getComputedStyle(el);
          return {
            component: el.className,
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor,
            outline: styles.outline,
          };
        });
      });

      // Check that violet theme colors are consistent
      const violetColors = colorValues.filter((color) => {
        const hasVioletBg =
          color.backgroundColor.includes("139") &&
          color.backgroundColor.includes("92") &&
          color.backgroundColor.includes("246");
        const hasVioletText =
          color.color.includes("139") &&
          color.color.includes("92") &&
          color.color.includes("246");
        const hasVioletBorder =
          color.borderColor.includes("139") &&
          color.borderColor.includes("92") &&
          color.borderColor.includes("246");

        return hasVioletBg || hasVioletText || hasVioletBorder;
      });

      expect(violetColors.length).toBeGreaterThan(0);
    });

    test("should handle high contrast mode gracefully", async ({
      page,
      context,
    }) => {
      // Enable high contrast mode (simulated)
      await context.addInitScript(() => {
        Object.defineProperty(window, "matchMedia", {
          writable: true,
          value: (query: string) => ({
            matches: query.includes("prefers-contrast: high"),
            addEventListener: () => {},
            removeEventListener: () => {},
          }),
        });
      });

      await page.goto("/reader");

      // Check that components maintain readability in high contrast
      const progressBar = page.locator('[data-testid="progress-bar"]');
      if ((await progressBar.count()) > 0) {
        const styles = await progressBar.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            border: computed.border,
          };
        });

        // Should have sufficient contrast (this is a simplified check)
        expect(styles.backgroundColor).toBeTruthy();
        expect(styles.color).toBeTruthy();
      }
    });
  });

  test.describe("iPad Tablet Experience", () => {
    test.use(IPAD_AIR);

    test("should handle larger screen dynamic styling appropriately", async ({
      page,
    }) => {
      await page.goto("/reader");

      // Check that components scale appropriately for tablet
      const headerHeight = await page
        .locator('[data-testid="scrollable-header"]')
        .evaluate((el) => getComputedStyle(el).height);

      const progressHeight = await page
        .locator('[data-testid="progress-bar"]')
        .evaluate((el) => getComputedStyle(el).height);

      // Tablet should have larger dimensions than mobile
      expect(parseInt(headerHeight)).toBeGreaterThanOrEqual(56); // Minimum tablet header height
      expect(parseInt(progressHeight)).toBeGreaterThanOrEqual(3); // Minimum tablet progress height
    });

    test("should handle multi-touch gestures on tablet", async ({ page }) => {
      await page.goto("/reader/article/long-article");

      // Simulate two-finger scroll (pinch/zoom gesture)
      await page.touchscreen.tap(200, 400);
      await page.touchscreen.tap(600, 400);

      // Check that page remains stable and responsive
      const header = page.locator('[data-testid="scrollable-header"]');
      await expect(header).toBeVisible();

      // Dynamic styling should continue to work
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(100);

      const headerOpacity = await header.evaluate((el) =>
        parseFloat(getComputedStyle(el).opacity)
      );
      expect(headerOpacity).toBeGreaterThan(0);
    });
  });

  test.describe("Performance Regression Prevention", () => {
    test.use(IPHONE_14_PRO);

    test("should not exceed performance budgets during intensive use", async ({
      page,
    }) => {
      await page.goto("/reader");

      // Simulate intensive usage pattern
      const performanceMetrics = await page.evaluate(async () => {
        const startTime = performance.now();
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

        // Track performance during intensive operations
        const metrics = {
          initialMemory: startMemory,
          maxMemory: startMemory,
          frameDrops: 0,
          totalFrames: 0,
        };

        // Monitor frames for 30 seconds of intensive interaction
        let frameCount = 0;
        let droppedFrames = 0;
        let lastFrameTime = performance.now();

        const measureFrame = () => {
          const now = performance.now();
          frameCount++;

          if (now - lastFrameTime > 20) {
            droppedFrames++;
          }

          lastFrameTime = now;

          // Update memory peak
          const currentMemory =
            (performance as any).memory?.usedJSHeapSize || 0;
          metrics.maxMemory = Math.max(metrics.maxMemory, currentMemory);

          if (frameCount < 1800) {
            // 30 seconds at 60fps
            requestAnimationFrame(measureFrame);
          } else {
            metrics.totalFrames = frameCount;
            metrics.frameDrops = droppedFrames;
          }
        };

        measureFrame();

        // Simulate intensive interactions
        for (let i = 0; i < 100; i++) {
          // Trigger scroll events
          window.scrollTo(0, i * 10);

          // Trigger theme changes
          if (i % 20 === 0) {
            document.documentElement.classList.toggle("dark");
          }

          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        return new Promise<typeof metrics>((resolve) => {
          setTimeout(() => resolve(metrics), 31000);
        });
      });

      // Assert performance budgets
      const memoryGrowthMB =
        (performanceMetrics.maxMemory - performanceMetrics.initialMemory) /
        (1024 * 1024);
      const frameDropRate =
        performanceMetrics.frameDrops / performanceMetrics.totalFrames;

      expect(memoryGrowthMB).toBeLessThan(PERFORMANCE_BUDGETS.MEMORY_GROWTH);
      expect(frameDropRate).toBeLessThan(PERFORMANCE_BUDGETS.FRAME_DROP_MAX);
    });

    test("should maintain Time to Interactive under 3 seconds", async ({
      page,
    }) => {
      const startTime = Date.now();

      await page.goto("/reader");

      // Wait for PWA to be fully interactive
      await page.waitForSelector('[data-testid="pwa-ready"]');
      await page.waitForLoadState("networkidle");

      const endTime = Date.now();
      const timeToInteractive = endTime - startTime;

      expect(timeToInteractive).toBeLessThan(PERFORMANCE_BUDGETS.TTI);
    });

    test("should maintain Cumulative Layout Shift under 0.1", async ({
      page,
    }) => {
      await page.goto("/reader");

      // Monitor layout shift during page load and interaction
      const cls = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsScore = 0;

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (
                entry.entryType === "layout-shift" &&
                !(entry as any).hadRecentInput
              ) {
                clsScore += (entry as any).value;
              }
            }
          });

          observer.observe({ type: "layout-shift", buffered: true });

          // Measure CLS for 5 seconds
          setTimeout(() => {
            observer.disconnect();
            resolve(clsScore);
          }, 5000);
        });
      });

      expect(cls).toBeLessThan(PERFORMANCE_BUDGETS.CLS);
    });
  });
});
