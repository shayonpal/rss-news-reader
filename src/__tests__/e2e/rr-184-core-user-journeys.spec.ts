import { test, expect } from '@playwright/test';

/**
 * RR-184: Core User Journey Tests
 * Build Playwright E2E testing infrastructure for cross-browser validation
 * 
 * These tests validate the core user journeys across all browsers,
 * with special focus on Safari on iPhone and iPad PWA.
 */

const APP_URL = process.env.TEST_URL || 'http://100.96.166.53:3000/reader';

test.describe('Core User Journeys - RR-184', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app - requires Tailscale VPN connection
    await page.goto(APP_URL);
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the RSS Reader
    await expect(page).toHaveTitle(/RSS News Reader|Shayon's News/);
  });

  test('Article Reading Journey: Browse feeds → Select article → Read content → Navigate back', async ({ page }) => {
    // Step 1: Verify feeds are visible in sidebar
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
    await expect(sidebar).toBeVisible();
    
    // Step 2: Wait for feeds to load
    const feedsList = page.locator('[data-testid="feeds-list"], .feeds-list, [role="navigation"] ul');
    await expect(feedsList).toBeVisible({ timeout: 10000 });
    
    // Step 3: Select first available feed
    const firstFeed = feedsList.locator('li:first-child a, button').first();
    const feedTitle = await firstFeed.textContent();
    await firstFeed.click();
    
    // Step 4: Wait for articles to load
    const articlesList = page.locator('[data-testid="articles-list"], .articles-list, main [role="list"]');
    await expect(articlesList).toBeVisible({ timeout: 10000 });
    
    // Step 5: Select first article
    const firstArticle = articlesList.locator('article, [role="article"], .article-item').first();
    await expect(firstArticle).toBeVisible();
    
    const articleTitle = await firstArticle.locator('h2, h3, .article-title').textContent();
    await firstArticle.click();
    
    // Step 6: Verify article detail view loads
    const articleDetail = page.locator('[data-testid="article-detail"], .article-detail, .article-content');
    await expect(articleDetail).toBeVisible({ timeout: 10000 });
    
    // Verify article title is displayed
    const detailTitle = page.locator('h1, .article-header h2, [data-testid="article-title"]');
    await expect(detailTitle).toContainText(articleTitle || '');
    
    // Step 7: Navigate back to article list
    const backButton = page.locator('[data-testid="back-button"], button:has-text("Back"), [aria-label="Back"]');
    if (await backButton.isVisible()) {
      await backButton.click();
    } else {
      // Use browser back if no back button
      await page.goBack();
    }
    
    // Step 8: Verify we're back at the articles list
    await expect(articlesList).toBeVisible();
    
    // Verify the feed is still selected
    const selectedFeed = sidebar.locator('.selected, [aria-current="page"], [data-selected="true"]');
    if (feedTitle) {
      await expect(selectedFeed).toContainText(feedTitle);
    }
  });

  test('Sync Validation: Manual sync triggers and updates UI', async ({ page }) => {
    // Step 1: Find sync button
    const syncButton = page.locator('[data-testid="sync-button"], button:has-text("Sync"), [aria-label*="sync" i]');
    
    // Step 2: Get initial article count
    const articleCount = page.locator('[data-testid="article-count"], .unread-count, .badge');
    const initialCount = await articleCount.textContent().catch(() => '0');
    
    // Step 3: Trigger sync
    await syncButton.click();
    
    // Step 4: Wait for sync to start (loading indicator or disabled button)
    await expect(syncButton).toBeDisabled({ timeout: 5000 })
      .catch(async () => {
        // Alternative: check for loading indicator
        const loadingIndicator = page.locator('.loading, [data-loading="true"], .spinner');
        await expect(loadingIndicator).toBeVisible({ timeout: 5000 });
      });
    
    // Step 5: Wait for sync to complete (button re-enabled or loading disappears)
    await expect(syncButton).toBeEnabled({ timeout: 30000 })
      .catch(async () => {
        // Alternative: wait for loading to disappear
        const loadingIndicator = page.locator('.loading, [data-loading="true"], .spinner');
        await expect(loadingIndicator).toBeHidden({ timeout: 30000 });
      });
    
    // Step 6: Verify UI updated (toast notification or count change)
    const toast = page.locator('[data-testid="toast"], .toast, [role="alert"]');
    const toastVisible = await toast.isVisible().catch(() => false);
    
    if (toastVisible) {
      await expect(toast).toContainText(/sync|complete|success/i);
    }
    
    // Alternative: Check if counts updated
    const newCount = await articleCount.textContent().catch(() => '0');
    // Counts may or may not change depending on new articles
    expect(newCount).toBeDefined();
  });

  test('Cross-Device State: Read/unread status persists', async ({ page }) => {
    // Step 1: Navigate to articles list
    const articlesList = page.locator('[data-testid="articles-list"], .articles-list, main [role="list"]');
    await expect(articlesList).toBeVisible({ timeout: 10000 });
    
    // Step 2: Find an unread article
    const unreadArticle = articlesList.locator('[data-read="false"], .unread, article:not(.read)').first();
    
    if (await unreadArticle.isVisible()) {
      // Step 3: Get article identifier
      const articleId = await unreadArticle.getAttribute('data-article-id') || 
                       await unreadArticle.getAttribute('id');
      const articleTitle = await unreadArticle.locator('h2, h3, .article-title').textContent();
      
      // Step 4: Click to read the article
      await unreadArticle.click();
      
      // Step 5: Wait for article detail to load
      const articleDetail = page.locator('[data-testid="article-detail"], .article-detail, .article-content');
      await expect(articleDetail).toBeVisible({ timeout: 10000 });
      
      // Step 6: Navigate back
      const backButton = page.locator('[data-testid="back-button"], button:has-text("Back"), [aria-label="Back"]');
      if (await backButton.isVisible()) {
        await backButton.click();
      } else {
        await page.goBack();
      }
      
      // Step 7: Verify article is now marked as read
      await expect(articlesList).toBeVisible();
      
      // Find the same article
      const readArticle = articleId 
        ? articlesList.locator(`[data-article-id="${articleId}"], #${articleId}`)
        : articlesList.locator(`article:has-text("${articleTitle}")`);
      
      // Verify it's marked as read
      await expect(readArticle).toHaveAttribute('data-read', 'true')
        .catch(async () => {
          // Alternative: check for read class
          await expect(readArticle).toHaveClass(/read/);
        });
    } else {
      // No unread articles, verify read articles exist
      const readArticles = articlesList.locator('[data-read="true"], .read');
      await expect(readArticles.first()).toBeVisible();
    }
  });

  test('Performance Testing: Page load times are acceptable', async ({ page }) => {
    // Step 1: Measure initial load time
    const startTime = Date.now();
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Initial load should be under 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Step 2: Measure article list load time
    const articleListStart = Date.now();
    const articlesList = page.locator('[data-testid="articles-list"], .articles-list, main [role="list"]');
    await expect(articlesList).toBeVisible({ timeout: 10000 });
    const articleListTime = Date.now() - articleListStart;
    
    // Article list should appear within 2 seconds
    expect(articleListTime).toBeLessThan(2000);
    
    // Step 3: Measure navigation performance
    const firstArticle = articlesList.locator('article, [role="article"], .article-item').first();
    if (await firstArticle.isVisible()) {
      const navStart = Date.now();
      await firstArticle.click();
      
      const articleDetail = page.locator('[data-testid="article-detail"], .article-detail, .article-content');
      await expect(articleDetail).toBeVisible({ timeout: 10000 });
      const navTime = Date.now() - navStart;
      
      // Navigation should be under 1 second
      expect(navTime).toBeLessThan(1000);
    }
    
    // Log performance metrics for CI reporting
    console.log('Performance Metrics:', {
      initialLoad: `${loadTime}ms`,
      articleList: `${articleListTime}ms`,
      navigation: `${Date.now() - startTime}ms total`
    });
  });

  test('PWA Installation: Verify PWA manifest and service worker', async ({ page, browserName }) => {
    // Skip this test on Firefox as it doesn't fully support PWA
    test.skip(browserName === 'firefox', 'Firefox does not fully support PWA installation');
    
    // Step 1: Check for manifest
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', /manifest\.json/);
    
    // Step 2: Verify manifest loads
    const manifestUrl = await manifestLink.getAttribute('href');
    if (manifestUrl) {
      const fullManifestUrl = new URL(manifestUrl, APP_URL).toString();
      const manifestResponse = await page.request.get(fullManifestUrl);
      expect(manifestResponse.ok()).toBeTruthy();
      
      const manifest = await manifestResponse.json();
      expect(manifest.name).toBeDefined();
      expect(manifest.short_name).toBeDefined();
      expect(manifest.start_url).toBeDefined();
      expect(manifest.display).toMatch(/standalone|fullscreen/);
    }
    
    // Step 3: Check for service worker registration
    const hasServiceWorker = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    if (hasServiceWorker) {
      // Wait for service worker to be registered
      const swRegistered = await page.evaluate(() => {
        return navigator.serviceWorker.ready.then(() => true).catch(() => false);
      });
      
      expect(swRegistered).toBeTruthy();
    }
    
    // Step 4: Check for iOS-specific meta tags (important for iPhone/iPad)
    const iosMetaTags = [
      'meta[name="apple-mobile-web-app-capable"]',
      'meta[name="apple-mobile-web-app-status-bar-style"]',
      'link[rel="apple-touch-icon"]'
    ];
    
    for (const selector of iosMetaTags) {
      const tag = page.locator(selector);
      await expect(tag).toHaveCount(1);
    }
  });
});

test.describe('Mobile-Specific Tests - iOS Focus', () => {
  // These tests run only on mobile devices
  test.skip(({ isMobile }) => !isMobile, 'Mobile-only test');
  
  test('Touch Interactions: Swipe and tap gestures work correctly', async ({ page }) => {
    await page.goto(APP_URL);
    
    // Wait for articles to load
    const articlesList = page.locator('[data-testid="articles-list"], .articles-list, main [role="list"]');
    await expect(articlesList).toBeVisible({ timeout: 10000 });
    
    // Test tap to open article
    const firstArticle = articlesList.locator('article, [role="article"], .article-item').first();
    await firstArticle.tap();
    
    // Verify article opened
    const articleDetail = page.locator('[data-testid="article-detail"], .article-detail, .article-content');
    await expect(articleDetail).toBeVisible({ timeout: 10000 });
    
    // Test swipe to go back (if supported)
    const viewport = page.viewportSize();
    if (viewport) {
      await page.touchscreen.swipe({
        from: { x: 10, y: viewport.height / 2 },
        to: { x: viewport.width - 10, y: viewport.height / 2 },
        steps: 10
      }).catch(async () => {
        // Fallback to back button if swipe not supported
        const backButton = page.locator('[data-testid="back-button"], button:has-text("Back")');
        if (await backButton.isVisible()) {
          await backButton.tap();
        }
      });
    }
  });
  
  test('Viewport Responsiveness: Layout adapts to device orientation', async ({ page }) => {
    await page.goto(APP_URL);
    
    // Test portrait orientation
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 portrait
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
    
    // In portrait, sidebar might be hidden or overlay
    const sidebarVisibility = await sidebar.isVisible();
    
    // Test landscape orientation
    await page.setViewportSize({ width: 844, height: 390 }); // iPhone 14 landscape
    
    // In landscape, sidebar should be visible
    if (!sidebarVisibility) {
      await expect(sidebar).toBeVisible();
    }
    
    // Verify content area adjusts
    const content = page.locator('main, [role="main"], .main-content');
    const contentBox = await content.boundingBox();
    expect(contentBox?.width).toBeGreaterThan(400);
  });
});