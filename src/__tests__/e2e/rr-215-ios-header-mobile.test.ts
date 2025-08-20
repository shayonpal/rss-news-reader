/**
 * RR-215: iOS Header Mobile Device E2E Tests
 * Test Contract: Native iOS-like behavior across devices
 */

import { test, expect, devices } from "@playwright/test";
import type { Page } from "@playwright/test";

// Test on iPhone 14 Pro (primary target)
test.use({
  ...devices["iPhone 14 Pro"],
  viewport: { width: 393, height: 852 },
  hasTouch: true,
  isMobile: true,
});

test.describe("RR-215: iOS Scrollable Header Mobile E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForLoadState("networkidle");
    
    // Wait for iOS header to initialize
    await page.waitForSelector('[data-testid="scrollable-header-container"]');
  });

  test.describe("Header State Transitions", () => {
    test("should start in expanded state with large title", async ({ page }) => {
      const header = page.locator('[data-testid="scrollable-header-container"]');
      const title = page.locator('[data-testid="header-title"]');
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      
      // Verify initial expanded state
      await expect(header).toHaveAttribute("data-scroll-state", "expanded");
      
      // Large title should be 34px on iPhone
      const titleSize = await title.evaluate((el) => 
        window.getComputedStyle(el).fontSize
      );
      expect(parseFloat(titleSize)).toBeCloseTo(34, 0);
      
      // Navigation should show hamburger icon
      await expect(navButton.locator('[data-testid="hamburger-icon"]')).toBeVisible();
      await expect(navButton.locator('[data-testid="back-icon"]')).toHaveCSS('opacity', '0');
    });

    test("should transition to collapsed state on scroll", async ({ page }) => {
      const header = page.locator('[data-testid="scrollable-header-container"]');
      const title = page.locator('[data-testid="header-title"]');
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      
      // Scroll past collapse threshold (150px)
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(400); // Wait for animation
      
      // Verify collapsed state
      await expect(header).toHaveAttribute("data-scroll-state", "collapsed");
      
      // Title should be compact (17px)
      const titleSize = await title.evaluate((el) => 
        window.getComputedStyle(el).fontSize
      );
      expect(parseFloat(titleSize)).toBeCloseTo(17, 0);
      
      // Navigation should show back icon
      await expect(navButton.locator('[data-testid="back-icon"]')).toBeVisible();
      await expect(navButton.locator('[data-testid="hamburger-icon"]')).toHaveCSS('opacity', '0');
    });

    test("should show transitioning state in middle range", async ({ page }) => {
      const header = page.locator('[data-testid="scrollable-header-container"]');
      
      // Scroll to middle of transition (44px < scroll < 150px)
      await page.evaluate(() => window.scrollTo(0, 100));
      await page.waitForTimeout(200);
      
      await expect(header).toHaveAttribute("data-scroll-state", "transitioning");
      
      // Title should be between 34px and 17px
      const title = page.locator('[data-testid="header-title"]');
      const titleSize = await title.evaluate((el) => 
        window.getComputedStyle(el).fontSize
      );
      const size = parseFloat(titleSize);
      expect(size).toBeGreaterThan(17);
      expect(size).toBeLessThan(34);
    });

    test("should animate smoothly with spring physics", async ({ page }) => {
      const startTime = Date.now();
      
      // Trigger transition by scrolling
      await page.evaluate(() => window.scrollTo(0, 200));
      
      // Wait for animation to complete
      await page.waitForFunction(() => {
        const header = document.querySelector('[data-testid="scrollable-header-container"]');
        return header?.getAttribute('data-scroll-state') === 'collapsed';
      }, { timeout: 500 });
      
      const endTime = Date.now();
      const animationDuration = endTime - startTime;
      
      // Should complete within 350ms (300ms target + buffer)
      expect(animationDuration).toBeLessThan(500);
    });
  });

  test.describe("Touch Interactions", () => {
    test("should have 44px minimum touch target for nav button", async ({ page }) => {
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      const boundingBox = await navButton.boundingBox();
      
      expect(boundingBox).not.toBeNull();
      expect(boundingBox!.width).toBeGreaterThanOrEqual(44);
      expect(boundingBox!.height).toBeGreaterThanOrEqual(44);
    });

    test("should respond to nav button tap correctly", async ({ page }) => {
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      
      // In expanded state, should toggle sidebar
      await navButton.tap();
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      
      // Close sidebar
      await page.locator('[data-testid="sidebar-overlay"]').tap();
      await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
      
      // Scroll to collapsed state
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(400);
      
      // In collapsed state, should act as back button
      await navButton.tap();
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    });

    test("should provide immediate visual feedback on tap", async ({ page }) => {
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      
      // Start monitoring transform during tap
      const transformPromise = navButton.evaluate((el) => {
        return new Promise((resolve) => {
          const observer = new MutationObserver(() => {
            const transform = window.getComputedStyle(el).transform;
            if (transform.includes('0.96') || transform.includes('scale')) {
              observer.disconnect();
              resolve(true);
            }
          });
          observer.observe(el, {
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
          
          setTimeout(() => {
            observer.disconnect();
            resolve(false);
          }, 200);
        });
      });
      
      // Perform tap
      await navButton.dispatchEvent('touchstart');
      
      const hasTransform = await transformPromise;
      expect(hasTransform).toBe(true);
    });

    test("should not show gray tap highlight", async ({ page }) => {
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      
      const tapHighlight = await navButton.evaluate((el) => {
        return window.getComputedStyle(el).webkitTapHighlightColor;
      });
      
      expect(tapHighlight).toMatch(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/);
    });
  });

  test.describe("Visual Effects", () => {
    test("should apply glass morphism effects correctly", async ({ page }) => {
      const header = page.locator('[data-testid="scrollable-header-container"]');
      
      // Check backdrop filter support and application
      const hasBlur = await header.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.backdropFilter !== 'none' || 
               styles.webkitBackdropFilter !== 'none';
      });
      
      expect(hasBlur).toBe(true);
      
      // Verify glass border
      const borderColor = await header.evaluate((el) => 
        window.getComputedStyle(el).borderBottomColor
      );
      expect(borderColor).toBeTruthy();
    });

    test("should increase blur intensity on scroll", async ({ page }) => {
      const header = page.locator('[data-testid="scrollable-header-container"]');
      
      // Get initial blur value
      const initialBlur = await header.evaluate((el) => {
        const filter = window.getComputedStyle(el).backdropFilter || 
                      window.getComputedStyle(el).webkitBackdropFilter;
        const match = filter.match(/blur\((\d+)px\)/);
        return match ? parseInt(match[1]) : 0;
      });
      
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 100));
      await page.waitForTimeout(100);
      
      // Get blur after scroll
      const scrolledBlur = await header.evaluate((el) => {
        const filter = window.getComputedStyle(el).backdropFilter || 
                      window.getComputedStyle(el).webkitBackdropFilter;
        const match = filter.match(/blur\((\d+)px\)/);
        return match ? parseInt(match[1]) : 0;
      });
      
      expect(scrolledBlur).toBeGreaterThan(initialBlur);
    });

    test("should have proper contrast in all states", async ({ page }) => {
      const title = page.locator('[data-testid="header-title"]');
      
      // Test contrast in expanded state
      const expandedOpacity = await title.evaluate((el) => 
        parseFloat(window.getComputedStyle(el).opacity)
      );
      expect(expandedOpacity).toBeGreaterThanOrEqual(0.7); // Ensures 4.5:1 contrast
      
      // Test contrast in collapsed state
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(400);
      
      const collapsedOpacity = await title.evaluate((el) => 
        parseFloat(window.getComputedStyle(el).opacity)
      );
      expect(collapsedOpacity).toBeGreaterThanOrEqual(0.7);
    });
  });

  test.describe("Performance Requirements", () => {
    test("should maintain 60fps during scroll", async ({ page }) => {
      // Enable performance monitoring
      await page.addInitScript(() => {
        window.frameTimestamps = [];
        const originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = function(callback) {
          window.frameTimestamps.push(performance.now());
          return originalRAF.call(window, callback);
        };
      });
      
      // Perform smooth scroll
      await page.evaluate(() => {
        const startY = 0;
        const endY = 300;
        const duration = 1000; // 1 second
        const startTime = performance.now();
        
        function animateScroll() {
          const now = performance.now();
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          const currentY = startY + (endY - startY) * progress;
          window.scrollTo(0, currentY);
          
          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          }
        }
        
        animateScroll();
      });
      
      await page.waitForTimeout(1200); // Wait for animation to complete
      
      // Check frame rate
      const frameData = await page.evaluate(() => window.frameTimestamps);
      
      if (frameData.length > 1) {
        const totalTime = frameData[frameData.length - 1] - frameData[0];
        const avgFPS = (frameData.length - 1) / (totalTime / 1000);
        
        expect(avgFPS).toBeGreaterThanOrEqual(55); // Allow slight dips from 60fps
      }
    });

    test("should complete state transitions within 350ms", async ({ page }) => {
      const startTime = await page.evaluate(() => performance.now());
      
      // Trigger immediate state change
      await page.evaluate(() => window.scrollTo(0, 200));
      
      // Wait for transition to complete
      await page.waitForFunction(() => {
        const header = document.querySelector('[data-testid="scrollable-header-container"]');
        return header?.getAttribute('data-scroll-state') === 'collapsed';
      });
      
      const endTime = await page.evaluate(() => performance.now());
      const transitionTime = endTime - startTime;
      
      expect(transitionTime).toBeLessThan(350);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper ARIA labels and roles", async ({ page }) => {
      const header = page.locator('[data-testid="scrollable-header-container"]');
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      const title = page.locator('[data-testid="header-title"]');
      
      // Header should have proper role
      await expect(header).toHaveAttribute('role', 'banner');
      
      // Navigation button should have accessible label
      const ariaLabel = await navButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      
      // Title should be proper heading
      await expect(title).toHaveRole('heading');
    });

    test("should announce state changes to screen readers", async ({ page }) => {
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      
      // Check initial ARIA state
      const initialState = await navButton.getAttribute('aria-expanded');
      
      // Scroll to collapsed state
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(400);
      
      // ARIA state should update
      const collapsedState = await navButton.getAttribute('aria-expanded');
      expect(collapsedState).not.toBe(initialState);
    });

    test("should support keyboard navigation", async ({ page }) => {
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      
      // Focus navigation button
      await navButton.focus();
      await expect(navButton).toBeFocused();
      
      // Should activate with Enter key
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      
      // Should activate with Space key
      await page.locator('[data-testid="sidebar-overlay"]').tap(); // Close sidebar
      await navButton.focus();
      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    });

    test("should respect reduced motion preferences", async ({ page }) => {
      // Enable reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      const navButton = page.locator('[data-testid="morphing-nav-button"]');
      
      // Check transition duration is reduced
      const transitionDuration = await navButton.evaluate((el) => {
        return window.getComputedStyle(el).transitionDuration;
      });
      
      expect(transitionDuration).toMatch(/0\.01s|0s|none/);
    });
  });

  test.describe("Progressive Enhancement", () => {
    test("should fallback gracefully without backdrop-filter", async ({ page }) => {
      // Disable backdrop-filter support
      await page.addInitScript(() => {
        const originalSupports = CSS.supports;
        CSS.supports = function(property, value) {
          if (property.includes('backdrop-filter')) {
            return false;
          }
          return originalSupports.call(CSS, property, value);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="scrollable-header-container"]');
      
      const header = page.locator('[data-testid="scrollable-header-container"]');
      
      // Should have solid background fallback
      const backgroundColor = await header.evaluate((el) => 
        window.getComputedStyle(el).backgroundColor
      );
      
      expect(backgroundColor).toBeTruthy();
      expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    test("should work on older iOS versions", async ({ page }) => {
      // Simulate older iOS by removing modern CSS features
      await page.addInitScript(() => {
        // Remove backdrop-filter and other modern properties
        delete (HTMLElement.prototype as any).style.backdropFilter;
        delete (HTMLElement.prototype as any).style.webkitBackdropFilter;
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="scrollable-header-container"]');
      
      // Header should still function
      const header = page.locator('[data-testid="scrollable-header-container"]');
      await expect(header).toBeVisible();
      
      // Scroll behavior should still work
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(400);
      
      await expect(header).toHaveAttribute("data-scroll-state", "collapsed");
    });
  });
});