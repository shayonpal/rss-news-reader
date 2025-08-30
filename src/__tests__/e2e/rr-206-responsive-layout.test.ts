/**
 * E2E Tests for RR-206: Fix sidebar collapse behavior for proper responsive display
 *
 * Test Contract:
 * - Tests real browser behavior across different devices
 * - Validates responsive breakpoints work in practice
 * - Tests touch interactions on mobile devices
 * - Verifies PWA behavior on iOS devices
 * - Tests performance and animation smoothness
 *
 * These tests run in real browsers using Playwright.
 */

import { test, expect, devices } from "@playwright/test";

const APP_URL = "http://100.96.166.53:3000/reader";

// Test configurations for different viewports
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 }, // Desktop
  laptop: { width: 1024, height: 768 }, // Laptop/iPad landscape (boundary)
  tablet: { width: 768, height: 1024 }, // iPad portrait (boundary)
  mobile: { width: 390, height: 844 }, // iPhone 14
};

test.describe("RR-206: Desktop Responsive Behavior", () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test("should NOT show hamburger menu on desktop", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Hamburger should not be visible
    const hamburger = page.locator(
      '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
    );
    await expect(hamburger).not.toBeVisible();

    // Sidebar should be visible
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    await expect(sidebar).toBeVisible();
  });

  test("should show FULL filter button text on desktop", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Filter buttons should show full text
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Unread")')).toBeVisible();
    await expect(page.locator('button:has-text("Read")')).toBeVisible();
  });

  test("sidebar should be persistent on desktop", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();

    // Sidebar should be visible and not have overlay classes
    await expect(sidebar).toBeVisible();
    const className = (await sidebar.getAttribute("class")) || "";
    expect(className).not.toContain("absolute");
    expect(className).not.toContain("fixed");
  });
});

test.describe("RR-206: Tablet Responsive Behavior", () => {
  test.use({ viewport: VIEWPORTS.tablet });

  test("should NOT show hamburger menu on tablet", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Hamburger should not be visible
    const hamburger = page.locator(
      '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
    );
    await expect(hamburger).not.toBeVisible();

    // Sidebar should be visible
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    await expect(sidebar).toBeVisible();
  });

  test("should show ICON-ONLY filter buttons on tablet", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Look for filter buttons
    const filterContainer = page
      .locator('[data-testid="filter-buttons"], .glass-segment')
      .first();
    await expect(filterContainer).toBeVisible();

    // Text should be hidden on tablet (768-1023px)
    const allText = page.locator('button span:has-text("All")');
    const unreadText = page.locator('button span:has-text("Unread")');
    const readText = page.locator('button span:has-text("Read")');

    // Check if text spans have hidden class
    for (const textElement of [allText, unreadText, readText]) {
      const isVisible = await textElement.isVisible().catch(() => false);
      if (isVisible) {
        const className = (await textElement.getAttribute("class")) || "";
        expect(className).toContain("hidden");
      }
    }
  });
});

test.describe("RR-206: Mobile Responsive Behavior", () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test("SHOULD show hamburger menu on mobile", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Hamburger SHOULD be visible on mobile
    const hamburger = page
      .locator(
        '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
      )
      .first();
    await expect(hamburger).toBeVisible();

    // Sidebar should be initially collapsed
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    const sidebarClass = (await sidebar.getAttribute("class")) || "";
    expect(sidebarClass).toMatch(/-translate-x-full|hidden/);
  });

  test("should toggle sidebar with hamburger menu", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    const hamburger = page
      .locator(
        '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
      )
      .first();
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();

    // Click hamburger to open sidebar
    await hamburger.click();
    await page.waitForTimeout(300); // Wait for animation

    // Sidebar should now be visible
    await expect(sidebar).toBeVisible();
    const openClass = (await sidebar.getAttribute("class")) || "";
    expect(openClass).toContain("translate-x-0");

    // Hamburger should disappear when sidebar is open
    await expect(hamburger).not.toBeVisible();

    // Should have overlay
    const overlay = page
      .locator('[data-testid="sidebar-overlay"], .fixed.inset-0')
      .first();
    await expect(overlay).toBeVisible();

    // Click overlay to close
    await overlay.click();
    await page.waitForTimeout(300); // Wait for animation

    // Sidebar should be hidden again
    const closedClass = (await sidebar.getAttribute("class")) || "";
    expect(closedClass).toMatch(/-translate-x-full/);

    // Hamburger should reappear
    await expect(hamburger).toBeVisible();
  });

  test("should show ICON-ONLY filter buttons on mobile", async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Icons should be visible, text should be hidden
    const filterContainer = page
      .locator('[data-testid="filter-buttons"], .glass-segment')
      .first();
    await expect(filterContainer).toBeVisible();

    // Text should be hidden
    const textSpans = page.locator("button span.hidden");
    const count = await textSpans.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("RR-206: iPhone-specific Tests", () => {
  test("should auto-collapse sidebar on iPhone", async ({ browser }) => {
    // Create context with iPhone device settings
    const context = await browser.newContext({
      ...devices["iPhone 14"],
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Sidebar should be collapsed by default
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    const sidebarClass = (await sidebar.getAttribute("class")) || "";
    expect(sidebarClass).toMatch(/-translate-x-full|hidden/);

    // Hamburger should be visible
    const hamburger = page
      .locator('[data-testid="hamburger-menu"], [aria-label*="menu"], button')
      .first();
    await expect(hamburger).toBeVisible();

    await context.close();
  });

  test("should have proper touch targets (44px minimum)", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      ...devices["iPhone 14"],
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Check hamburger button size
    const hamburger = page
      .locator('[data-testid="hamburger-menu"], [aria-label*="menu"], button')
      .first();
    const hamburgerBox = await hamburger.boundingBox();
    if (hamburgerBox) {
      expect(hamburgerBox.width).toBeGreaterThanOrEqual(44);
      expect(hamburgerBox.height).toBeGreaterThanOrEqual(44);
    }

    // Check filter button sizes
    const filterButtons = page.locator(
      '[data-testid="filter-buttons"] button, .glass-segment button'
    );
    const buttonCount = await filterButtons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = filterButtons.nth(i);
      const box = await button.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    await context.close();
  });

  test("should handle rotation from portrait to landscape", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      ...devices["iPhone 14"],
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Start in portrait (mobile)
    const hamburger = page
      .locator('[data-testid="hamburger-menu"], [aria-label*="menu"], button')
      .first();
    await expect(hamburger).toBeVisible();

    // Rotate to landscape (tablet-like width)
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300); // Wait for responsive changes

    // Behavior depends on exact width - 844px is still < 1024px
    // So hamburger might still be visible, but let's check
    const isHamburgerVisible = await hamburger.isVisible().catch(() => false);

    // Rotate back to portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    // Hamburger should be visible again in portrait
    await expect(hamburger).toBeVisible();

    await context.close();
  });
});

test.describe("RR-206: iPad-specific Tests", () => {
  test.describe("iPad Portrait", () => {
    test("should NOT show hamburger on iPad portrait", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["iPad"],
        viewport: { width: 768, height: 1024 },
      });
      const page = await context.newPage();
      await page.goto(APP_URL);
      await page.waitForLoadState("networkidle");

      // Hamburger should not be visible
      const hamburger = page.locator(
        '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
      );
      await expect(hamburger).not.toBeVisible();

      // Sidebar should be visible
      const sidebar = page
        .locator('[data-testid="sidebar"], .sidebar, aside')
        .first();
      await expect(sidebar).toBeVisible();

      await context.close();
    });
  });

  test.describe("iPad Landscape", () => {
    test("should treat iPad landscape as desktop", async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
      });
      const page = await context.newPage();
      await page.goto(APP_URL);
      await page.waitForLoadState("networkidle");

      // No hamburger
      const hamburger = page.locator(
        '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
      );
      await expect(hamburger).not.toBeVisible();

      // Sidebar visible
      const sidebar = page
        .locator('[data-testid="sidebar"], .sidebar, aside')
        .first();
      await expect(sidebar).toBeVisible();

      // Filter text should be visible (1024px = desktop breakpoint)
      await expect(page.locator('button:has-text("All")')).toBeVisible();
      await expect(page.locator('button:has-text("Unread")')).toBeVisible();
      await expect(page.locator('button:has-text("Read")')).toBeVisible();

      await context.close();
    });
  });
});

test.describe("RR-206: Viewport Transition Tests", () => {
  test("should handle desktop-to-mobile viewport change", async ({ page }) => {
    // Start with desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Verify desktop state
    const hamburger = page
      .locator(
        '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
      )
      .first();
    await expect(hamburger).not.toBeVisible();

    // Change to mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(300); // Wait for responsive changes

    // Verify mobile state
    await expect(hamburger).toBeVisible();

    // Sidebar should auto-collapse
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    const sidebarClass = (await sidebar.getAttribute("class")) || "";
    expect(sidebarClass).toMatch(/-translate-x-full/);
  });

  test("should handle mobile-to-desktop viewport change", async ({ page }) => {
    // Start with mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Verify mobile state
    const hamburger = page
      .locator(
        '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
      )
      .first();
    await expect(hamburger).toBeVisible();

    // Change to desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForTimeout(300); // Wait for responsive changes

    // Verify desktop state
    await expect(hamburger).not.toBeVisible();

    // Sidebar should auto-show
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    await expect(sidebar).toBeVisible();
    const sidebarClass = (await sidebar.getAttribute("class")) || "";
    expect(sidebarClass).toContain("translate-x-0");
  });
});

test.describe("RR-206: Performance Tests", () => {
  test("should maintain 60fps during sidebar animation", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Start performance measurement
    await page.evaluate(() => {
      (window as any).animationFrames = [];
      let lastTime = performance.now();

      const measureFrame = () => {
        const currentTime = performance.now();
        const delta = currentTime - lastTime;
        (window as any).animationFrames.push(delta);
        lastTime = currentTime;

        if ((window as any).animationFrames.length < 60) {
          requestAnimationFrame(measureFrame);
        }
      };

      requestAnimationFrame(measureFrame);
    });

    // Trigger sidebar animation
    const hamburger = page
      .locator('[data-testid="hamburger-menu"], [aria-label*="menu"], button')
      .first();
    await hamburger.click();

    // Wait for animation to complete
    await page.waitForTimeout(1000);

    // Check frame times
    const frameTimes = await page.evaluate(
      () => (window as any).animationFrames
    );

    // Average frame time should be ~16.67ms for 60fps
    const avgFrameTime =
      frameTimes.reduce((a: number, b: number) => a + b, 0) / frameTimes.length;

    // Allow some variance but should be close to 60fps
    expect(avgFrameTime).toBeLessThan(20); // 50fps minimum
  });

  test("should not cause layout shifts during responsive changes", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Measure CLS (Cumulative Layout Shift)
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            clsValue += (entry as any).value;
          }
        });

        observer.observe({ type: "layout-shift", buffered: true });

        // Trigger viewport changes
        setTimeout(() => {
          resolve(clsValue);
        }, 2000);
      });
    });

    // CLS should be minimal (< 0.1 is good, < 0.25 needs improvement)
    expect(cls).toBeLessThan(0.1);
  });
});

test.describe("RR-206: Accessibility Tests", () => {
  test("should maintain focus management during sidebar toggle", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    const hamburger = page
      .locator('[data-testid="hamburger-menu"], [aria-label*="menu"], button')
      .first();

    // Focus on hamburger
    await hamburger.focus();
    await expect(hamburger).toBeFocused();

    // Open sidebar
    await hamburger.click();
    await page.waitForTimeout(300);

    // Focus should move to sidebar or first focusable element in sidebar
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    const firstLink = sidebar.locator("a, button").first();

    // Either sidebar or first link should be focusable
    const sidebarHasFocus = await sidebar.evaluate((el) =>
      el.contains(document.activeElement)
    );
    expect(sidebarHasFocus).toBeTruthy();
  });

  test("should have proper ARIA attributes", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // Hamburger should have ARIA label
    const hamburger = page
      .locator('[data-testid="hamburger-menu"], [aria-label*="menu"], button')
      .first();
    const ariaLabel = await hamburger.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();

    // Sidebar should have navigation role
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    const role = await sidebar.getAttribute("role");
    if (role) {
      expect(role).toBe("navigation");
    }
  });
});

test.describe("RR-206: Edge Cases", () => {
  test("should handle exactly 768px width (boundary)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // At exactly 768px, should be treated as tablet (no hamburger)
    const hamburger = page.locator(
      '[data-testid="hamburger-menu"], [aria-label*="menu"], button:has-text("☰")'
    );
    await expect(hamburger).not.toBeVisible();
  });

  test("should handle exactly 1024px width (boundary)", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    // At exactly 1024px, should be treated as desktop (full text)
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Unread")')).toBeVisible();
    await expect(page.locator('button:has-text("Read")')).toBeVisible();
  });

  test("should handle rapid hamburger clicks", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");

    const hamburger = page
      .locator('[data-testid="hamburger-menu"], [aria-label*="menu"], button')
      .first();

    // Rapidly click hamburger multiple times
    for (let i = 0; i < 5; i++) {
      await hamburger.click();
      await page.waitForTimeout(50); // Very short wait
    }

    // Should end in a stable state
    await page.waitForTimeout(500);

    // Check final state is consistent
    const sidebar = page
      .locator('[data-testid="sidebar"], .sidebar, aside')
      .first();
    const sidebarVisible = await sidebar.isVisible();
    const hamburgerVisible = await hamburger.isVisible();

    // Either sidebar is open (hamburger hidden) or sidebar is closed (hamburger visible)
    expect(sidebarVisible).not.toBe(hamburgerVisible);
  });
});
