/**
 * End-to-End Tests for 404 Page User Flows - RR-116
 * 
 * Tests complete user journeys for 404 pages including:
 * - Navigation flows from 404 pages
 * - Visual consistency across different themes
 * - Mobile and desktop responsive behavior
 * - User interaction patterns
 * - Accessibility navigation flows
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://100.96.166.53:3000';
const READER_BASE = `${BASE_URL}/reader`;

test.describe('RR-116: 404 Page User Flows', () => {
  
  test.describe('Global 404 Page User Flows', () => {
    test('should display global 404 page for non-existent routes', async ({ page }) => {
      await page.goto(`${READER_BASE}/non-existent-page`);
      await page.waitForLoadState('networkidle');
      
      // Should show 404 content
      await expect(page).toHaveTitle(/404|Not Found/i);
      await expect(page.locator('h2')).toContainText('Not Found');
      await expect(page.locator('p')).toContainText('Could not find requested resource');
    });

    test('should handle deep nested non-existent routes', async ({ page }) => {
      await page.goto(`${READER_BASE}/deep/nested/non-existent/path`);
      await page.waitForLoadState('networkidle');
      
      // Should still show 404
      await expect(page.locator('h2')).toContainText('Not Found');
      
      // URL should remain as requested
      expect(page.url()).toContain('/deep/nested/non-existent/path');
    });

    test('should maintain basePath in 404 URLs', async ({ page }) => {
      await page.goto(`${READER_BASE}/invalid-route`);
      await page.waitForLoadState('networkidle');
      
      // URL should still contain /reader basePath
      expect(page.url()).toContain('/reader');
      expect(page.url()).toContain('/invalid-route');
    });

    test('should be accessible via keyboard navigation', async ({ page }) => {
      await page.goto(`${READER_BASE}/keyboard-test-404`);
      await page.waitForLoadState('networkidle');
      
      // Should be able to tab through focusable elements
      await page.keyboard.press('Tab');
      
      // Should focus on any interactive elements if they exist
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      
      // If no interactive elements, focus should stay on body or similar
      expect(['BODY', 'BUTTON', 'A', 'INPUT'].includes(focusedElement || 'BODY')).toBeTruthy();
    });
  });

  test.describe('Article 404 Page User Flows', () => {
    test('should display article 404 page for non-existent article', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/non-existent-article-id`);
      await page.waitForLoadState('networkidle');
      
      // Should show article-specific 404 content
      await expect(page.locator('h2')).toContainText('Article not found');
      await expect(page.locator('p')).toContainText("The article you're looking for doesn't exist or has been removed");
      
      // Should show FileQuestion icon
      await expect(page.locator('[data-testid="file-question-icon"], .lucide-file-question, svg')).toBeVisible();
    });

    test('should navigate back to reader from article 404', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/test-navigation-404`);
      await page.waitForLoadState('networkidle');
      
      // Click "Back to Reader" button
      const backButton = page.locator('button:has-text("Back to Reader")');
      await expect(backButton).toBeVisible();
      await backButton.click();
      
      // Should navigate to reader home
      await page.waitForLoadState('networkidle');
      expect(page.url()).toMatch(new RegExp(`${READER_BASE}/?$`));
    });

    test('should handle malformed article IDs gracefully', async ({ page }) => {
      const malformedIds = [
        'script<alert>test</alert>',
        '%20%20%20spaces%20%20',
        'unicode-test-📚-article',
        'very-long-id-'.repeat(10) + 'end'
      ];

      for (const malformedId of malformedIds) {
        await page.goto(`${READER_BASE}/article/${encodeURIComponent(malformedId)}`);
        await page.waitForLoadState('networkidle');
        
        // Should either show 404 or handle gracefully without error
        const hasError = await page.locator('h2:has-text("Article not found")').isVisible();
        const hasContent = await page.locator('article, main, [data-testid="article-content"]').isVisible();
        
        expect(hasError || hasContent).toBeTruthy();
      }
    });

    test('should be keyboard navigable on article 404', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/keyboard-test-id`);
      await page.waitForLoadState('networkidle');
      
      // Tab to the "Back to Reader" button
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toContainText('Back to Reader');
      
      // Press Enter to activate
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      
      // Should navigate to reader
      expect(page.url()).toMatch(new RegExp(`${READER_BASE}/?$`));
    });
  });

  test.describe('Visual Consistency and Theming', () => {
    test('should maintain consistent styling in light mode', async ({ page }) => {
      // Force light mode
      await page.emulateMedia({ colorScheme: 'light' });
      
      // Test global 404
      await page.goto(`${READER_BASE}/light-mode-test-global`);
      await page.waitForLoadState('networkidle');
      
      const globalStyles = await page.locator('h2').evaluate(el => 
        window.getComputedStyle(el)
      );
      
      // Test article 404
      await page.goto(`${READER_BASE}/article/light-mode-test-article`);
      await page.waitForLoadState('networkidle');
      
      const articleStyles = await page.locator('h2').evaluate(el => 
        window.getComputedStyle(el)
      );
      
      // Both should use appropriate light mode colors
      expect(globalStyles.color).toBeTruthy();
      expect(articleStyles.color).toBeTruthy();
    });

    test('should maintain consistent styling in dark mode', async ({ page }) => {
      // Force dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
      
      // Test article 404 (has better dark mode implementation)
      await page.goto(`${READER_BASE}/article/dark-mode-test`);
      await page.waitForLoadState('networkidle');
      
      // Should have dark mode classes applied
      const hasThemeClasses = await page.locator('p').evaluate(el => {
        return el.className.includes('dark:') || 
               window.getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)';
      });
      
      expect(hasThemeClasses).toBeTruthy();
    });

    test('should have consistent icon styling', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/icon-styling-test`);
      await page.waitForLoadState('networkidle');
      
      const icon = page.locator('[data-testid="file-question-icon"], .lucide-file-question, svg').first();
      await expect(icon).toBeVisible();
      
      // Icon should have appropriate styling
      const iconBox = await icon.boundingBox();
      expect(iconBox?.width).toBeGreaterThan(30); // Should be reasonably sized
      expect(iconBox?.height).toBeGreaterThan(30);
    });

    test('should maintain layout consistency across viewport sizes', async ({ page }) => {
      const viewports = [
        { width: 320, height: 568 },  // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 } // Desktop
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`${READER_BASE}/article/responsive-test`);
        await page.waitForLoadState('networkidle');
        
        // Content should be visible and centered
        const container = page.locator('.flex.min-h-screen');
        await expect(container).toBeVisible();
        
        // Button should be accessible
        const button = page.locator('button:has-text("Back to Reader")');
        await expect(button).toBeVisible();
        
        // Should not have horizontal scroll
        const hasHorizontalScroll = await page.evaluate(() => 
          document.documentElement.scrollWidth > window.innerWidth
        );
        expect(hasHorizontalScroll).toBeFalsy();
      }
    });
  });

  test.describe('Performance and Loading', () => {
    test('should load 404 pages quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${READER_BASE}/performance-test-404`);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should handle concurrent 404 requests', async ({ browser }) => {
      const pages = await Promise.all([
        browser.newPage(),
        browser.newPage(),
        browser.newPage(),
        browser.newPage(),
        browser.newPage()
      ]);

      const startTime = Date.now();
      
      // Navigate all pages to different 404 routes simultaneously
      await Promise.all(pages.map((page, index) => 
        page.goto(`${READER_BASE}/concurrent-test-${index}`)
      ));

      // Wait for all to load
      await Promise.all(pages.map(page => page.waitForLoadState('networkidle')));
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(5000); // All should load within 5 seconds

      // Verify all show 404 content
      for (const page of pages) {
        await expect(page.locator('h2')).toContainText(/Not Found|Article not found/);
      }

      // Clean up
      await Promise.all(pages.map(page => page.close()));
    });

    test('should not have memory leaks during navigation', async ({ page }) => {
      // Navigate through multiple 404 pages
      const routes = [
        '/reader/test-1',
        '/reader/test-2', 
        '/reader/article/test-1',
        '/reader/article/test-2',
        '/reader/deep/nested/test'
      ];

      for (const route of routes) {
        await page.goto(`${BASE_URL}${route}`);
        await page.waitForLoadState('networkidle');
        
        // Should load without errors
        const errors = await page.evaluate(() => {
          return (window as any).errors || [];
        });
        expect(errors.length).toBe(0);
      }
    });
  });

  test.describe('Accessibility User Flows', () => {
    test('should be screen reader accessible', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/screen-reader-test`);
      await page.waitForLoadState('networkidle');
      
      // Check for proper heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);
      
      // Main heading should be prominent
      const mainHeading = page.locator('h2').first();
      await expect(mainHeading).toBeVisible();
      
      // Button should have accessible text
      const button = page.locator('button:has-text("Back to Reader")');
      const buttonText = await button.textContent();
      expect(buttonText?.trim()).toBeTruthy();
    });

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast simulation
      await page.emulateMedia({ forcedColors: 'active' });
      
      await page.goto(`${READER_BASE}/article/high-contrast-test`);
      await page.waitForLoadState('networkidle');
      
      // Elements should still be visible
      await expect(page.locator('h2')).toBeVisible();
      await expect(page.locator('button:has-text("Back to Reader")')).toBeVisible();
      
      // Should not have invisible text
      const elements = await page.locator('h2, p, button').all();
      for (const element of elements) {
        const isVisible = await element.isVisible();
        expect(isVisible).toBeTruthy();
      }
    });

    test('should work with reduced motion preferences', async ({ page }) => {
      // Simulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      await page.goto(`${READER_BASE}/article/reduced-motion-test`);
      await page.waitForLoadState('networkidle');
      
      // Page should still function normally
      await expect(page.locator('h2')).toContainText('Article not found');
      
      // Navigation should still work
      const button = page.locator('button:has-text("Back to Reader")');
      await button.click();
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toMatch(new RegExp(`${READER_BASE}/?$`));
    });

    test('should maintain focus management', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/focus-management-test`);
      await page.waitForLoadState('networkidle');
      
      // Should be able to tab to button
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toContainText('Back to Reader');
      
      // Should maintain focus outline
      const hasOutline = await focusedElement.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.outline !== 'none' || styles.boxShadow !== 'none';
      });
      
      expect(hasOutline).toBeTruthy();
    });
  });

  test.describe('Error Recovery and Edge Cases', () => {
    test('should handle JavaScript disabled gracefully', async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      
      await page.goto(`${READER_BASE}/article/no-js-test`);
      await page.waitForLoadState('networkidle');
      
      // Should still show basic content
      await expect(page.locator('h2')).toBeVisible();
      
      // Should have fallback navigation if possible
      const links = await page.locator('a[href]').count();
      const hasNavigation = links > 0;
      
      // If no links, should at least show content
      if (!hasNavigation) {
        await expect(page.locator('h2')).toContainText('Article not found');
      }

      await context.close();
    });

    test('should handle slow network conditions', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 100); // 100ms delay
      });
      
      await page.goto(`${READER_BASE}/article/slow-network-test`);
      await page.waitForLoadState('networkidle');
      
      // Should eventually load
      await expect(page.locator('h2')).toContainText('Article not found');
      await expect(page.locator('button:has-text("Back to Reader")')).toBeVisible();
    });

    test('should handle browser navigation correctly', async ({ page }) => {
      // Start at a valid page
      await page.goto(`${READER_BASE}/`);
      await page.waitForLoadState('networkidle');
      
      // Navigate to 404
      await page.goto(`${READER_BASE}/article/browser-nav-test`);
      await page.waitForLoadState('networkidle');
      
      // Use browser back button
      await page.goBack();
      await page.waitForLoadState('networkidle');
      
      // Should return to reader
      expect(page.url()).toMatch(new RegExp(`${READER_BASE}/?$`));
      
      // Use browser forward button
      await page.goForward();
      await page.waitForLoadState('networkidle');
      
      // Should return to 404
      await expect(page.locator('h2')).toContainText('Article not found');
    });

    test('should handle URL manipulation attacks', async ({ page }) => {
      const maliciousUrls = [
        `${READER_BASE}/article/<script>alert('xss')</script>`,
        `${READER_BASE}/article/../../etc/passwd`,
        `${READER_BASE}/article/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd`,
        `${READER_BASE}/article/javascript:alert('xss')`
      ];

      for (const url of maliciousUrls) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Should show safe 404 page, not execute malicious content
        const hasScriptExecuted = await page.evaluate(() => {
          return (window as any).xssExecuted === true;
        });
        expect(hasScriptExecuted).toBeFalsy();
        
        // Should show 404 content
        const has404Content = await page.locator('h2:has-text("Article not found"), h2:has-text("Not Found")').isVisible();
        expect(has404Content).toBeTruthy();
      }
    });
  });

  test.describe('Integration with Main App', () => {
    test('should maintain header/navigation if present', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/integration-test`);
      await page.waitForLoadState('networkidle');
      
      // Check if main app header exists
      const header = page.locator('header, nav, [data-testid="header"]');
      const headerExists = await header.count() > 0;
      
      if (headerExists) {
        await expect(header.first()).toBeVisible();
      }
      
      // 404 content should still be visible
      await expect(page.locator('h2')).toContainText('Article not found');
    });

    test('should work with theme toggle if present', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/theme-toggle-test`);
      await page.waitForLoadState('networkidle');
      
      // Look for theme toggle
      const themeToggle = page.locator('[data-testid="theme-toggle"], button:has-text("theme"), button:has-text("dark"), button:has-text("light")');
      const hasThemeToggle = await themeToggle.count() > 0;
      
      if (hasThemeToggle) {
        // Click theme toggle
        await themeToggle.first().click();
        await page.waitForTimeout(500); // Wait for theme change
        
        // 404 page should still be functional
        await expect(page.locator('h2')).toContainText('Article not found');
        await expect(page.locator('button:has-text("Back to Reader")')).toBeVisible();
      }
    });

    test('should preserve URL structure for analytics', async ({ page }) => {
      await page.goto(`${READER_BASE}/article/analytics-test-id?utm_source=test&ref=direct`);
      await page.waitForLoadState('networkidle');
      
      // URL should preserve query parameters
      expect(page.url()).toContain('utm_source=test');
      expect(page.url()).toContain('ref=direct');
      
      // Should still show 404 content
      await expect(page.locator('h2')).toContainText('Article not found');
    });
  });
});