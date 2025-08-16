/**
 * Quick Test for RR-216: Filter State Preservation
 * Simple test to verify app loads and basic functionality
 */

import { test, expect } from "@playwright/test";

test.describe("RR-216: Quick Filter Test", () => {
  test("App loads and shows content", async ({ page }) => {
    console.log("🧪 Testing app basic loading...");

    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('❌ Browser error:', msg.text());
      } else {
        console.log('📝 Browser log:', msg.text());
      }
    });

    // Navigate to the app
    console.log("📍 Navigating to app...");
    await page.goto("");
    
    // Take a screenshot to see what's loading
    await page.screenshot({ path: 'test-results/app-load.png', fullPage: true });
    
    // Wait for basic page structure
    console.log("📍 Waiting for page structure...");
    await page.waitForTimeout(5000);
    
    // Check page title
    const title = await page.title();
    console.log(`📍 Page title: ${title}`);
    
    // Check if we can find basic elements
    const bodyText = await page.locator('body').textContent();
    console.log(`📍 Body contains text: ${bodyText ? 'yes' : 'no'}`);
    
    if (bodyText) {
      console.log(`📍 Body text length: ${bodyText.length} characters`);
      console.log(`📍 Body preview: ${bodyText.substring(0, 200)}...`);
    }
    
    // Look for common elements
    const h1Elements = await page.locator('h1').count();
    const newsElements = await page.locator('text=News').count();
    const articlesElements = await page.locator('text=Articles').count();
    const topicsElements = await page.locator('text=Topics').count();
    const feedsElements = await page.locator('text=Feeds').count();
    
    console.log(`📍 Found elements:`);
    console.log(`  - H1 elements: ${h1Elements}`);
    console.log(`  - "News" text: ${newsElements}`);
    console.log(`  - "Articles" text: ${articlesElements}`);
    console.log(`  - "Topics" text: ${topicsElements}`);
    console.log(`  - "Feeds" text: ${feedsElements}`);
    
    // Check current URL
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Basic assertion - page should load something
    expect(bodyText).toBeTruthy();
    
    console.log("✅ Basic app loading test completed");
  });

  test("Can find sidebar elements", async ({ page }) => {
    console.log("🧪 Testing sidebar elements...");

    await page.goto("");
    await page.waitForTimeout(5000);
    
    // Look for sidebar content
    const sidebarTexts = [
      "News", "All Articles", "Topics", "Feeds", 
      "Shayon", "Sync", "unread", "feeds"
    ];
    
    for (const text of sidebarTexts) {
      const elements = await page.locator(`text=${text}`).count();
      console.log(`📍 "${text}": ${elements} elements found`);
    }
    
    // Try to find clickable elements
    const clickableElements = await page.locator('.cursor-pointer').count();
    console.log(`📍 Clickable elements (.cursor-pointer): ${clickableElements}`);
    
    const buttons = await page.locator('button').count();
    console.log(`📍 Buttons: ${buttons}`);
    
    const links = await page.locator('a').count();
    console.log(`📍 Links: ${links}`);
    
    console.log("✅ Sidebar elements test completed");
  });
});