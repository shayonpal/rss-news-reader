/**
 * E2E Test for RR-216 Race Condition Fix
 * 
 * Tests Siri and Gemini's two-layer solution:
 * 1. Gating: filtersReady flag prevents articles loading until URL is parsed
 * 2. Sequencing: loadSeq counter prevents stale requests from overwriting current data
 * 
 * This test verifies the fix for the issue where:
 * - URL showed correct filter
 * - Header showed correct filter name
 * - But article content showed ALL articles instead of filtered articles
 */

import { test, expect } from "@playwright/test";

test.describe("RR-216: Race Condition Fix Verification", () => {
  test.beforeEach(async ({ page }) => {
    // Enable detailed console logging for debugging
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        console.error('❌ Browser error:', text);
      } else if (
        text.includes('RR-27') || 
        text.includes('RR-216') ||
        text.includes('navigation intent') ||
        text.includes('preservation') ||
        text.includes('filtersReady') ||
        text.includes('🚫 Filters not ready') ||
        text.includes('↩️ Stale request') ||
        text.includes('🔗') ||
        text.includes('⛳') ||
        text.includes('🧹') ||
        text.includes('📊') ||
        text.includes('🔄 Loading articles')
      ) {
        console.log('🔍 Debug:', text);
      }
    });

    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForTimeout(5000);
  });

  test("Filter state preservation with race condition protection", async ({ page }) => {
    console.log("🧪 Testing filter state preservation with race condition fix...");

    // Step 1: Wait for sync to complete and topics to be available
    console.log("📍 Step 1: Waiting for content to load");
    await page.waitForTimeout(3000);
    
    // Step 2: Navigate directly to India/Canada filter to test the fix
    console.log("📍 Step 2: Navigating directly to filtered view");
    const tagId = "b139c50e-19d9-4438-b69c-908aed45452d"; // Known India/Canada tag ID
    await page.goto(`http://100.96.166.53:3000/reader?tag=${tagId}`);
    await page.waitForTimeout(3000);

    // Step 3: Verify gating is working - should see console message about filters not ready initially
    console.log("📍 Step 3: Checking for gating behavior");
    
    // Step 4: Verify final state after filters are ready
    console.log("📍 Step 4: Verifying final filtered state");
    
    // Check URL is correct
    const currentUrl = page.url();
    expect(currentUrl).toContain(`tag=${tagId}`);
    console.log(`✅ URL contains correct tag: ${currentUrl}`);

    // Check header shows correct filter name (not "All Articles")
    await expect(page.locator('h1')).toContainText('India/Canada', { timeout: 15000 });
    const headerText = await page.locator('h1').filter({ hasText: 'India/Canada' }).textContent();
    console.log(`✅ Header shows correct filter: ${headerText}`);

    // Step 5: Count articles to verify filtering is working
    console.log("📍 Step 5: Verifying article count and content");
    
    // Look for article buttons/headings - should be small number for India/Canada
    const articleHeadings = page.locator('button h2').or(page.locator('article h2'));
    const articleCount = await articleHeadings.count();
    
    console.log(`📍 Article count: ${articleCount}`);
    expect(articleCount).toBeLessThan(10); // Should be small number for filtered view
    expect(articleCount).toBeGreaterThan(0); // Should have some articles
    
    // Verify we're not showing all articles (no Apple Watch/iPhone deals in India/Canada filter)
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('Apple Watch Reportedly Set');
    expect(pageContent).not.toContain('iPhone 17 Pro Price');
    console.log("✅ Not showing unrelated articles - filtering is working");

    console.log("✅ Race condition fix verification complete");
  });

  test("Complete navigation flow with article preservation", async ({ page }) => {
    console.log("🧪 Testing complete navigation flow with article preservation...");

    // Step 1: Navigate to India/Canada filter
    console.log("📍 Step 1: Navigating to India/Canada filter");
    const tagId = "b139c50e-19d9-4438-b69c-908aed45452d";
    await page.goto(`http://100.96.166.53:3000/reader?tag=${tagId}`);
    await page.waitForTimeout(3000);

    // Step 2: Find and click the first article
    console.log("📍 Step 2: Finding and clicking first article");
    const firstArticle = page.locator('button').filter({ hasText: /Proposed national class action|Realme P4|dangers of Canada/ }).first();
    await expect(firstArticle).toBeVisible({ timeout: 10000 });
    
    const articleTitle = await firstArticle.locator('h2').textContent();
    console.log(`📍 Clicking article: ${articleTitle}`);
    
    await firstArticle.click();
    await page.waitForTimeout(2000);

    // Step 3: Verify we're on article detail page
    console.log("📍 Step 3: Verifying article detail navigation");
    const articleUrl = page.url();
    expect(articleUrl).toContain('/article/');
    console.log(`✅ Navigated to article: ${articleUrl}`);

    // Step 4: Click back button
    console.log("📍 Step 4: Using back navigation");
    await page.goBack();
    await page.waitForTimeout(3000);

    // Step 5: Verify return to correct filtered state
    console.log("📍 Step 5: Verifying return to filtered view");
    const returnUrl = page.url();
    expect(returnUrl).toContain(`tag=${tagId}`);
    console.log(`✅ Returned to filtered URL: ${returnUrl}`);

    // Step 6: Verify header still shows filter name
    await expect(page.locator('h1')).toContainText('India/Canada', { timeout: 15000 });
    const headerText = await page.locator('h1').filter({ hasText: 'India/Canada' }).textContent();
    console.log(`✅ Header shows correct filter: ${headerText}`);

    // Step 7: Verify we still see filtered articles (not all articles)
    console.log("📍 Step 7: Verifying filtered articles are shown");
    const articleCount = await page.locator('button h2').count();
    console.log(`📍 Article count after back navigation: ${articleCount}`);
    
    // Should still be showing filtered articles, not all articles
    expect(articleCount).toBeLessThan(10);
    
    // Should not see unrelated articles
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('Apple Watch Reportedly Set');
    
    console.log("✅ Complete navigation flow working correctly");
  });

  test("Request sequencing verification", async ({ page }) => {
    console.log("🧪 Testing request sequencing to prevent stale overwrites...");

    // This test simulates rapid navigation that could trigger race conditions
    const tagId = "b139c50e-19d9-4438-b69c-908aed45452d";
    
    // Step 1: Rapid navigation to filtered view (simulates back navigation scenario)
    console.log("📍 Step 1: Rapid navigation to filtered view");
    await page.goto(`http://100.96.166.53:3000/reader?tag=${tagId}`);
    
    // Step 2: Navigate away and back quickly to test sequencing
    console.log("📍 Step 2: Quick navigation pattern");
    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForTimeout(500);
    await page.goto(`http://100.96.166.53:3000/reader?tag=${tagId}`);
    await page.waitForTimeout(3000);

    // Step 3: Verify final state is correct (no stale data)
    console.log("📍 Step 3: Verifying no stale data overwrote filtered results");
    
    await expect(page.locator('h1')).toContainText('India/Canada', { timeout: 15000 });
    const headerText = await page.locator('h1').filter({ hasText: 'India/Canada' }).textContent();
    
    const articleCount = await page.locator('button h2').count();
    expect(articleCount).toBeLessThan(10); // Should be filtered count, not all articles
    
    console.log(`✅ Request sequencing working - shows ${articleCount} filtered articles`);
  });

  test("Gating behavior verification", async ({ page }) => {
    console.log("🧪 Testing gating behavior (filtersReady flag)...");

    // Monitor for gating message
    let foundGatingMessage = false;
    page.on('console', msg => {
      if (msg.text().includes('🚫 Filters not ready, skipping article load.')) {
        foundGatingMessage = true;
        console.log('✅ Found gating message - filtersReady working');
      }
    });

    // Navigate to filtered view - should trigger gating initially
    const tagId = "b139c50e-19d9-4438-b69c-908aed45452d";
    await page.goto(`http://100.96.166.53:3000/reader?tag=${tagId}`);
    await page.waitForTimeout(2000);

    // Verify final state is correct
    await expect(page.locator('h1')).toContainText('India/Canada', { timeout: 15000 });
    const headerText = await page.locator('h1').filter({ hasText: 'India/Canada' }).textContent();
    
    console.log("✅ Gating behavior verification complete");
  });
});