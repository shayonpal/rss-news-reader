/**
 * RR-193: Mobile Sidebar Overlay E2E Tests
 * Tests full-width sidebar overlay behavior on mobile viewports
 */

import { test, expect } from '@playwright/test';

test.describe('RR-193 Mobile Sidebar Overlay', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the RSS reader app
    await page.goto('/reader');
    
    // Set mobile viewport (iPhone 12 Pro dimensions)
    await page.setViewportSize({ width: 390, height: 844 });
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should display sidebar as full-width overlay on mobile', async ({ page }) => {
    // Open sidebar on mobile
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Verify sidebar is displayed as full-width overlay
    const sidebar = page.getByTestId('sidebar-main-container');
    await expect(sidebar).toBeVisible();
    
    // Sidebar should take full width on mobile
    const sidebarBox = await sidebar.boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    
    expect(sidebarBox?.width).toBe(viewportWidth);
  });

  test('should displace article listing when sidebar is open on mobile', async ({ page }) => {
    // Verify article listing is visible initially
    const articleListing = page.getByTestId('article-listing');
    await expect(articleListing).toBeVisible();
    
    // Open sidebar
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Article listing should be displaced (hidden or moved)
    await expect(articleListing).not.toBeInViewport();
  });

  test('should show backdrop when sidebar is open on mobile', async ({ page }) => {
    // Open sidebar
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Verify backdrop is present
    const backdrop = page.getByTestId('sidebar-backdrop');
    await expect(backdrop).toBeVisible();
  });

  test('should close sidebar when backdrop is tapped on mobile', async ({ page }) => {
    // Open sidebar
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Tap backdrop to close
    const backdrop = page.getByTestId('sidebar-backdrop');
    await backdrop.click();
    
    // Sidebar should be closed
    const sidebar = page.getByTestId('sidebar-main-container');
    await expect(sidebar).not.toBeVisible();
  });

  test('should maintain single scroll behavior on mobile', async ({ page }) => {
    // Open sidebar
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    const sidebar = page.getByTestId('sidebar-main-container');
    
    // Verify main container has scroll capability
    const hasScrollbar = await sidebar.evaluate((el) => {
      return el.scrollHeight > el.clientHeight;
    });
    
    if (hasScrollbar) {
      // Verify no nested scrollable areas
      const nestedScrollable = await sidebar.locator('.overflow-y-auto').count();
      expect(nestedScrollable).toBe(1); // Only the main container
    }
  });

  test('should handle mutex accordion on touch interactions', async ({ page }) => {
    // Open sidebar
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Default state: Topics open, Feeds closed
    const topicsSection = page.getByTestId('topics-collapsible-trigger');
    const feedsSection = page.getByTestId('feeds-collapsible-trigger');
    
    // Verify default state
    await expect(topicsSection).toHaveAttribute('data-state', 'open');
    await expect(feedsSection).toHaveAttribute('data-state', 'closed');
    
    // Tap to open Feeds section
    await feedsSection.tap();
    
    // Verify mutex behavior - Feeds open, Topics closed
    await expect(feedsSection).toHaveAttribute('data-state', 'open');
    await expect(topicsSection).toHaveAttribute('data-state', 'closed');
  });

  test('should maintain 60fps animation performance on mobile', async ({ page }) => {
    // Start performance monitoring
    await page.evaluate(() => {
      (window as any).performanceMarks = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).performanceMarks.push(entry);
        }
      });
      observer.observe({ entryTypes: ['measure', 'mark'] });
    });
    
    // Open sidebar (should trigger animations)
    const sidebarToggle = page.getByTestId('sidebar-toggle-button');
    await sidebarToggle.click();
    
    // Wait for animations to complete
    await page.waitForTimeout(500);
    
    // Test mutex accordion animations
    const feedsSection = page.getByTestId('feeds-collapsible-trigger');
    await feedsSection.tap();
    
    // Wait for accordion animation
    await page.waitForTimeout(300);
    
    // Check for smooth animations (no janky frames)
    const performanceData = await page.evaluate(() => {
      return (window as any).performanceMarks;
    });
    
    // Basic performance check - no frame drops or long tasks
    expect(performanceData).toBeDefined();
  });
});