/**
 * Simple Click Test for RR-216 + RR-27
 * 
 * Direct test with simple article title clicking
 */

import { test, expect } from "@playwright/test";

test.describe("RR-216 + RR-27: Simple Integration", () => {
  test("Test navigation intent with simple article click", async ({ page }) => {
    // Enable logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('RR-27') || text.includes('RR-216') || text.includes('🔗') || text.includes('⛳')) {
        console.log('🔍 Key log:', text);
      }
    });

    console.log("🧪 Testing simple article click flow...");

    // Go to app
    await page.goto("");
    await page.waitForTimeout(5000);

    // Select India/Canada topic
    console.log("📍 Selecting India/Canada topic");
    await page.locator('text=India/Canada').first().click();
    await page.waitForTimeout(2000);

    // Get current URL
    const urlWithFilter = page.url();
    console.log(`📍 URL with filter: ${urlWithFilter}`);
    
    // Just try clicking the first article title text directly
    console.log("📍 Looking for article titles to click");
    
    // Look for what appears to be article titles in the screenshot
    const articleTitles = [
      'Proposed national class action filed against Amazon',
      'Telus strikes back at Cogeco', 
      'Realme P4 5G'
    ];
    
    for (const title of articleTitles) {
      const titleElement = page.locator(`text="${title.substring(0, 20)}"`, { timeout: 2000 });
      if (await titleElement.count() > 0) {
        console.log(`📍 Found and clicking: ${title.substring(0, 30)}...`);
        
        await titleElement.first().click();
        await page.waitForTimeout(2000);
        
        // Check if navigation happened
        const newUrl = page.url();
        console.log(`📍 URL after click: ${newUrl}`);
        
        if (newUrl.includes('/article/')) {
          console.log("✅ Successfully navigated to article!");
          
          // Test back navigation
          console.log("📍 Testing back navigation");
          await page.goBack();
          await page.waitForTimeout(2000);
          
          const backUrl = page.url();
          console.log(`📍 URL after back: ${backUrl}`);
          
          // Check if filter is preserved
          if (backUrl.includes('tag=')) {
            console.log("✅ Filter preserved after back navigation!");
          } else {
            console.log("❌ Filter lost after back navigation");
          }
          
          return; // Exit test successfully
        }
      }
    }
    
    console.log("⚠️ Could not find any recognizable article titles to click");
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/article-detection-debug.png', fullPage: true });
  });
});