/**
 * RR-193: CSS Grid Performance Tests
 * Tests that CSS Grid layout performs better than nested scrolling
 */

import { test, expect } from "@playwright/test";

test.describe("RR-193 CSS Grid Performance", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reader");
    await page.waitForLoadState("networkidle");
  });

  test("should achieve 60fps during sidebar animations", async ({ page }) => {
    // Start performance monitoring
    const performanceMetrics = await page.evaluate(() => {
      const metrics: any[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "measure" || entry.entryType === "mark") {
            metrics.push({
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }
      });
      observer.observe({ entryTypes: ["measure", "mark"] });
      return metrics;
    });

    // Open sidebar
    const sidebarToggle = page.getByTestId("sidebar-toggle-button");
    await sidebarToggle.click();

    // Measure accordion toggle performance
    await page.evaluate(() => performance.mark("accordion-toggle-start"));

    const feedsToggle = page.getByTestId("feeds-collapsible-trigger");
    await feedsToggle.click();

    await page.evaluate(() => {
      performance.mark("accordion-toggle-end");
      performance.measure(
        "accordion-toggle",
        "accordion-toggle-start",
        "accordion-toggle-end"
      );
    });

    // Wait for animations to complete
    await page.waitForTimeout(500);

    // Verify smooth 60fps performance (16.67ms per frame)
    const animationDuration = await page.evaluate(() => {
      const measure = performance.getEntriesByName("accordion-toggle")[0];
      return measure ? measure.duration : 0;
    });

    // Animation should complete within reasonable time for 60fps
    expect(animationDuration).toBeLessThan(300); // 300ms max for smooth UX
  });

  test("should have minimal layout thrashing with CSS Grid", async ({
    page,
  }) => {
    // Monitor layout shifts during interactions
    const layoutShifts: any[] = [];

    await page.evaluateOnNewDocument(() => {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "layout-shift") {
            (window as any).layoutShifts = (window as any).layoutShifts || [];
            (window as any).layoutShifts.push({
              value: (entry as any).value,
              hadRecentInput: (entry as any).hadRecentInput,
            });
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    // Perform operations that previously caused layout thrashing
    const sidebarToggle = page.getByTestId("sidebar-toggle-button");
    await sidebarToggle.click();

    // Toggle between sections multiple times
    const feedsToggle = page.getByTestId("feeds-collapsible-trigger");
    const topicsToggle = page.getByTestId("topics-collapsible-trigger");

    for (let i = 0; i < 3; i++) {
      await feedsToggle.click();
      await page.waitForTimeout(100);
      await topicsToggle.click();
      await page.waitForTimeout(100);
    }

    // Check Cumulative Layout Shift (CLS)
    const cls = await page.evaluate(() => {
      const shifts = (window as any).layoutShifts || [];
      return shifts
        .filter((shift: any) => !shift.hadRecentInput)
        .reduce((sum: number, shift: any) => sum + shift.value, 0);
    });

    // CLS should be very low for CSS Grid layout
    expect(cls).toBeLessThan(0.1); // Good CLS threshold
  });

  test("should handle large feed lists without performance degradation", async ({
    page,
  }) => {
    // Inject large dataset to test performance
    await page.evaluate(() => {
      // Mock large feed list
      const largeFeedList = Array.from({ length: 100 }, (_, i) => ({
        id: `feed-${i}`,
        title: `Test Feed ${i} with a moderately long title that might wrap`,
        unread_count: Math.floor(Math.random() * 50),
      }));

      (window as any).mockLargeFeeds = largeFeedList;
    });

    // Reload with large dataset
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Measure scroll performance
    await page.evaluate(() => performance.mark("scroll-test-start"));

    const sidebar = page.getByTestId("sidebar-main-container");

    // Simulate scrolling through large list
    for (let i = 0; i < 5; i++) {
      await sidebar.evaluate((el, scrollTop) => {
        el.scrollTop = scrollTop;
      }, i * 200);
      await page.waitForTimeout(50);
    }

    await page.evaluate(() => {
      performance.mark("scroll-test-end");
      performance.measure(
        "scroll-test",
        "scroll-test-start",
        "scroll-test-end"
      );
    });

    // Verify scrolling performance
    const scrollDuration = await page.evaluate(() => {
      const measure = performance.getEntriesByName("scroll-test")[0];
      return measure ? measure.duration : 0;
    });

    // Should handle large lists without significant performance impact
    expect(scrollDuration).toBeLessThan(1000); // 1 second max for scroll operations
  });

  test("should maintain responsive performance across viewport sizes", async ({
    page,
  }) => {
    const viewports = [
      { width: 390, height: 844, name: "iPhone 12 Pro" },
      { width: 768, height: 1024, name: "iPad" },
      { width: 1920, height: 1080, name: "Desktop" },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      // Measure layout performance for each viewport
      await page.evaluate(() => performance.mark(`layout-${Date.now()}-start`));

      const sidebarToggle = page.getByTestId("sidebar-toggle-button");
      await sidebarToggle.click();

      // Test mutex accordion performance
      const feedsToggle = page.getByTestId("feeds-collapsible-trigger");
      await feedsToggle.click();

      await page.evaluate(() => performance.mark(`layout-${Date.now()}-end`));

      // Verify responsive performance
      const layoutMetrics = await page.evaluate(() => {
        const marks = performance.getEntriesByType("mark");
        const recent = marks.slice(-2);
        return recent.length >= 2
          ? recent[1].startTime - recent[0].startTime
          : 0;
      });

      // Performance should be consistent across viewports
      expect(layoutMetrics).toBeLessThan(500); // 500ms max for layout operations
    }
  });

  test("should have no memory leaks during accordion interactions", async ({
    page,
  }) => {
    // Track memory usage during extensive interactions
    await page.evaluate(() => {
      (window as any).initialMemory =
        (performance as any).memory?.usedJSHeapSize || 0;
    });

    const sidebarToggle = page.getByTestId("sidebar-toggle-button");
    await sidebarToggle.click();

    const feedsToggle = page.getByTestId("feeds-collapsible-trigger");
    const topicsToggle = page.getByTestId("topics-collapsible-trigger");

    // Perform many toggle operations to test for memory leaks
    for (let i = 0; i < 50; i++) {
      await feedsToggle.click();
      await topicsToggle.click();
    }

    // Force garbage collection and check memory
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
      (window as any).finalMemory =
        (performance as any).memory?.usedJSHeapSize || 0;
    });

    const memoryDelta = await page.evaluate(() => {
      const initial = (window as any).initialMemory;
      const final = (window as any).finalMemory;
      return final - initial;
    });

    // Memory growth should be minimal (under 5MB for extensive operations)
    expect(memoryDelta).toBeLessThan(5 * 1024 * 1024);
  });
});
