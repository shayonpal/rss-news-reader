/**
 * E2E Test for RR-27 Regression Check
 * 
 * Verifies that the RR-216 filter fix didn't break RR-27 article preservation.
 * 
 * Bug report:
 * 1. Navigate to "India/Canada" topic (unread filter default)
 * 2. Tap article in list  
 * 3. Tap back button
 * 4. Read article disappears from filtered view (should be preserved)
 */

import { test, expect } from "@playwright/test";

test.describe("RR-27 Regression: Article Preservation", () => {
  test.beforeEach(async ({ page }) => {
    // Enable comprehensive console logging for debugging
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        console.error('❌ Browser error:', text);
      } else if (
        text.includes('RR-27') || 
        text.includes('preserve') || 
        text.includes('sessionStorage') ||
        text.includes('article') ||
        text.includes('filter') ||
        text.includes('read') ||
        text.includes('📊') ||
        text.includes('🔧') ||
        text.includes('📍')
      ) {
        console.log('🔍 Debug log:', text);
      }
    });

    await page.goto("");
    await page.waitForTimeout(5000); // Wait for app to load
  });

  test("Article preservation with India/Canada topic filter", async ({ page }) => {
    console.log("🧪 Testing RR-27 regression with India/Canada topic...");

    // Step 1: Navigate to India/Canada topic (should be in unread filter by default)
    console.log("📍 Step 1: Looking for India/Canada topic");
    
    const indiaCanadaTopic = page.locator('text=India/Canada').first();
    await expect(indiaCanadaTopic).toBeVisible({ timeout: 10000 });
    
    // Verify we're in unread filter mode (this should be default)
    const currentUrl = page.url();
    console.log(`📍 Current URL before topic selection: ${currentUrl}`);
    
    // Click the India/Canada topic
    console.log("📍 Clicking India/Canada topic");
    await indiaCanadaTopic.click();
    await page.waitForTimeout(2000);
    
    // Verify URL contains tag parameter
    const urlAfterTopic = page.url();
    console.log(`📍 URL after India/Canada selection: ${urlAfterTopic}`);
    expect(urlAfterTopic).toMatch(/[?&]tag=/);
    
    // Step 2: Find and click first article in the filtered list
    console.log("📍 Step 2: Looking for articles in India/Canada topic");
    
    // Wait for articles to load and look for clickable content
    await page.waitForTimeout(2000);
    
    // Look for articles in the main content area, not sidebar
    // First exclude sidebar elements by focusing on main content area
    const mainContentArea = page.locator('[class*="flex-1"], [class*="min-w-0"]').first();
    const articleElements = mainContentArea.locator('.cursor-pointer').filter({ 
      hasText: /Canada|India|immigration|visa|border|Toronto|Ottawa|Delhi|Mumbai/i 
    });
    
    let articleText = '';
    let articleElement;
    
    if (await articleElements.count() > 0) {
      articleElement = articleElements.first();
      articleText = await articleElement.textContent() || '';
      console.log(`📍 Found India/Canada article: ${articleText.substring(0, 100)}...`);
    } else {
      // Fallback: try any clickable element in main content that looks like an article
      console.log("📍 No India/Canada specific articles found, trying any article in main content");
      articleElement = mainContentArea.locator('.cursor-pointer').filter({ hasText: /\w{20,}/ }).first();
      
      if (await articleElement.count() > 0) {
        articleText = await articleElement.textContent() || '';
        console.log(`📍 Found fallback article: ${articleText.substring(0, 100)}...`);
      } else {
        throw new Error("No articles found in India/Canada topic");
      }
    }
    
    // Click the article
    console.log("📍 Clicking the article");
    await articleElement.click();
    
    // Step 3: Wait for article detail page
    console.log("📍 Step 3: Waiting for article detail page");
    await page.waitForURL(/\/article\//, { timeout: 10000 });
    
    const articleDetailUrl = page.url();
    console.log(`📍 Article detail URL: ${articleDetailUrl}`);
    
    // Wait for article to be marked as read
    await page.waitForTimeout(2000);
    
    // Step 4: Use back button to return to filtered list
    console.log("📍 Step 4: Clicking back button");
    
    const backButton = page.getByRole('button', { name: /back/i })
      .or(page.locator('button').filter({ hasText: /←|Back/ }))
      .or(page.locator('[aria-label*="back" i]'));
    
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();
    
    // Step 5: Verify we're back to the filtered view with preserved article
    console.log("📍 Step 5: Verifying article preservation");
    await page.waitForTimeout(2000);
    
    const finalUrl = page.url();
    console.log(`📍 Final URL after back: ${finalUrl}`);
    
    // Should still have the tag parameter
    expect(finalUrl).toMatch(/[?&]tag=/);
    
    // Check if the article is still visible (this is the key test)
    // Since it's now read, it might not be visible in unread filter
    // But according to RR-27, it should be preserved
    console.log("📍 Checking if read article is preserved in filtered view");
    
    // Look for the article text we clicked on
    const preservedArticle = page.locator('text=' + articleText.substring(0, 50));
    const isArticleVisible = await preservedArticle.count() > 0;
    
    console.log(`📍 Article preservation result: ${isArticleVisible ? 'PRESERVED ✅' : 'DISAPPEARED ❌'}`);
    
    if (!isArticleVisible) {
      console.log("❌ REGRESSION DETECTED: Article disappeared after being read (RR-27 broken)");
      
      // Take screenshot for debugging
      await page.screenshot({ 
        path: 'test-results/rr-27-regression-after-back.png', 
        fullPage: true 
      });
      
      // Check what articles are currently visible
      const visibleArticles = await page.locator('.cursor-pointer').filter({ hasText: /\w{20,}/ }).count();
      console.log(`📍 Currently visible articles: ${visibleArticles}`);
      
      // This indicates the regression
      throw new Error("RR-27 REGRESSION: Read article disappeared from filtered view after back navigation");
    } else {
      console.log("✅ RR-27 working correctly: Article preserved in filtered view");
    }
  });

  test("Check sessionStorage preservation mechanism", async ({ page }) => {
    console.log("🧪 Testing sessionStorage preservation mechanism...");

    // Navigate to a topic
    const anyTopic = page.locator('text=Gaming News').or(page.locator('text=AI Related News')).first();
    if (await anyTopic.count() > 0) {
      console.log("📍 Selecting topic for sessionStorage test");
      await anyTopic.click();
      await page.waitForTimeout(1000);
      
      // Check sessionStorage values via browser console
      const sessionData = await page.evaluate(() => {
        return {
          articleFilter: sessionStorage.getItem('articleListFilter'),
          tagFilter: sessionStorage.getItem('articleListTagFilter'),
          preservedArticles: sessionStorage.getItem('preservedArticles'),
          autoReadArticles: sessionStorage.getItem('autoReadArticles'),
          manualReadArticles: sessionStorage.getItem('manualReadArticles')
        };
      });
      
      console.log("📍 SessionStorage state:", JSON.stringify(sessionData, null, 2));
      
      // Verify filter state is saved
      expect(sessionData.tagFilter).not.toBe(null);
      expect(sessionData.tagFilter).not.toBe('null');
      
      console.log("✅ SessionStorage preservation mechanism active");
    }
  });
});